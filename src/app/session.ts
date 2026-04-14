import { useEffect, useEffectEvent, useMemo, useReducer, useRef } from 'react'

import { DEFAULT_CONFIG, PRESSURE_LABELS, SIM_RULESET_VERSION, normalizeConfig } from '@/domain/config'
import {
  MAX_ARTIFACT_BYTES,
  buildExperimentArtifact,
  buildScenarioArtifact,
  parseArtifactJson,
  serializeArtifact,
  validateExperimentArtifact,
  validateScenarioArtifact,
} from '@/domain/artifacts'
import { buildComparisonSummary } from '@/domain/comparison'
import { advanceRun, initializeRun } from '@/domain/sim'
import {
  BUILT_IN_SCENARIOS,
  buildScenarioHash,
  createScenarioDraft,
  duplicateScenario,
  getScenarioById,
  normalizeScenarioDefinition,
} from '@/domain/scenarios'
import type {
  Announcement,
  ArtifactImportReview,
  AppNotice,
  AppSurface,
  ComparisonSummary,
  Creature,
  QuickstartState,
  RunRecord,
  RunStatus,
  SavedExperiment,
  ScenarioDefinition,
  ScenarioEvent,
  SimulationConfig,
} from '@/domain/types'
import {
  announcementForBaseline,
  announcementForCreature,
  announcementForGeneration,
  announcementForRunCompletion,
  announcementFromNotice,
  formatFileSize,
} from '@/app/accessibility'
import {
  deleteExperimentRecord,
  deleteScenarioRecord,
  loadLabData,
  saveExperimentRecord,
  saveScenarioRecord,
} from '@/infra/labStorage'
import { downloadJsonFile, readArtifactFile } from '@/infra/fileArtifacts'
import { loadStoredSettings, saveStoredSettings } from '@/infra/sessionStorage'

export interface SessionState {
  surface: AppSurface
  config: SimulationConfig
  currentRun: RunRecord
  selectedGeneration: number
  selectedCreatureId: string | null
  runStatus: RunStatus
  compareMode: boolean
  fastForward: boolean
  selectedScenarioId: string
  scenarioEditorId: string
  customScenarios: ScenarioDefinition[]
  savedExperiments: SavedExperiment[]
  baselineExperimentId: string | null
  notice: AppNotice | null
  announcement: Announcement | null
  quickstart: QuickstartState
  labReady: boolean
  labSort: 'updated' | 'oldest' | 'population'
}

type ConfigField = Exclude<keyof SimulationConfig, 'seed' | 'scenarioId'>
type ScenarioField = 'name' | 'description'

type SessionAction =
  | { type: 'LOAD_LAB_DATA'; customScenarios: ScenarioDefinition[]; savedExperiments: SavedExperiment[]; notice: AppNotice | null }
  | { type: 'NAVIGATE'; surface: AppSurface }
  | { type: 'SET_CONFIG_FIELD'; field: ConfigField; value: number }
  | { type: 'LOAD_SCENARIO'; scenario: ScenarioDefinition }
  | { type: 'SELECT_EDITOR_SCENARIO'; scenarioId: string }
  | { type: 'REPLACE_CUSTOM_SCENARIOS'; scenarios: ScenarioDefinition[]; editorScenarioId?: string }
  | { type: 'REPLACE_SAVED_EXPERIMENTS'; experiments: SavedExperiment[] }
  | { type: 'SET_BASELINE_EXPERIMENT'; experimentId: string | null }
  | { type: 'SET_LAB_SORT'; sort: SessionState['labSort'] }
  | { type: 'LOAD_EXPERIMENT'; experiment: SavedExperiment; customScenarios: ScenarioDefinition[]; recreatedRun: RunRecord; notice: AppNotice | null }
  | { type: 'RESEED'; seed: number }
  | { type: 'RUN' }
  | { type: 'PAUSE' }
  | { type: 'STEP' }
  | { type: 'RESET' }
  | { type: 'TOGGLE_FAST_FORWARD' }
  | { type: 'SET_SELECTED_GENERATION'; generationIndex: number }
  | { type: 'SET_SELECTED_CREATURE'; creatureId: string | null }
  | { type: 'TOGGLE_COMPARE' }
  | { type: 'ADVANCE'; steps: number }
  | { type: 'DISMISS_NOTICE' }
  | { type: 'SET_NOTICE'; notice: AppNotice | null }
  | { type: 'SET_ANNOUNCEMENT'; announcement: Announcement | null }
  | { type: 'DISMISS_QUICKSTART' }

function createSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now()
  }

  return Math.floor(Math.random() * 2 ** 32)
}

function rebuildPreview(
  config: SimulationConfig,
  scenario: ScenarioDefinition,
): Pick<SessionState, 'config' | 'currentRun' | 'selectedGeneration' | 'selectedCreatureId' | 'runStatus' | 'compareMode' | 'fastForward'> {
  const normalizedConfig = normalizeConfig({
    ...config,
    scenarioId: scenario.id,
  })

  return {
    config: normalizedConfig,
    currentRun: initializeRun(normalizedConfig, scenario),
    selectedGeneration: 0,
    selectedCreatureId: null,
    runStatus: 'idle',
    compareMode: false,
    fastForward: false,
  }
}

function sortExperiments(
  experiments: SavedExperiment[],
  sort: SessionState['labSort'],
): SavedExperiment[] {
  const entries = [...experiments]

  switch (sort) {
    case 'oldest':
      return entries.sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
    case 'population':
      return entries.sort(
        (left, right) => right.completedSummary.finalPopulationSize - left.completedSummary.finalPopulationSize,
      )
    case 'updated':
    default:
      return entries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }
}

function buildInitialState(): SessionState {
  const stored = loadStoredSettings()
  const selectedScenarioId = stored.settings?.selectedScenarioId ?? DEFAULT_CONFIG.scenarioId
  const scenario = getScenarioById(selectedScenarioId)
  const config = normalizeConfig({
    ...stored.settings?.config,
    scenarioId: selectedScenarioId,
  })

  return {
    surface: stored.settings?.surface ?? 'sandbox',
    ...rebuildPreview(config, scenario),
    selectedScenarioId: scenario.id,
    scenarioEditorId: scenario.id,
    customScenarios: [],
    savedExperiments: [],
    baselineExperimentId: stored.settings?.baselineExperimentId ?? null,
    notice: stored.notice,
    announcement: null,
    quickstart: {
      dismissed: false,
    },
    labReady: false,
    labSort: 'updated',
  }
}

function reducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'LOAD_LAB_DATA': {
      const activeScenario = getScenarioById(state.selectedScenarioId, action.customScenarios)
      const currentEditor = getScenarioById(state.scenarioEditorId, action.customScenarios)
      const baselineExists = action.savedExperiments.some((experiment) => experiment.id === state.baselineExperimentId)

      return {
        ...state,
        customScenarios: action.customScenarios,
        savedExperiments: sortExperiments(action.savedExperiments, state.labSort),
        baselineExperimentId: baselineExists ? state.baselineExperimentId : null,
        scenarioEditorId: currentEditor.id,
        selectedScenarioId: activeScenario.id,
        currentRun:
          activeScenario.id === state.currentRun.scenario.id
            ? state.currentRun
            : initializeRun({ ...state.config, scenarioId: activeScenario.id }, activeScenario),
        notice: action.notice ?? state.notice,
        labReady: true,
      }
    }
    case 'NAVIGATE':
      return {
        ...state,
        surface: action.surface,
      }
    case 'SET_CONFIG_FIELD': {
      const scenario = getScenarioById(state.selectedScenarioId, state.customScenarios)
      const nextConfig = normalizeConfig({
        ...state.config,
        [action.field]: action.value,
      })

      return {
        ...state,
        ...rebuildPreview(nextConfig, scenario),
      }
    }
    case 'LOAD_SCENARIO':
      return {
        ...state,
        selectedScenarioId: action.scenario.id,
        ...rebuildPreview(action.scenario.baseConfig, action.scenario),
      }
    case 'SELECT_EDITOR_SCENARIO':
      return {
        ...state,
        scenarioEditorId: action.scenarioId,
      }
    case 'REPLACE_CUSTOM_SCENARIOS':
      return {
        ...state,
        customScenarios: action.scenarios,
        scenarioEditorId: action.editorScenarioId ?? state.scenarioEditorId,
      }
    case 'REPLACE_SAVED_EXPERIMENTS':
      return {
        ...state,
        savedExperiments: sortExperiments(action.experiments, state.labSort),
      }
    case 'SET_BASELINE_EXPERIMENT':
      return {
        ...state,
        baselineExperimentId: action.experimentId,
      }
    case 'SET_LAB_SORT':
      return {
        ...state,
        labSort: action.sort,
        savedExperiments: sortExperiments(state.savedExperiments, action.sort),
      }
    case 'LOAD_EXPERIMENT':
      return {
        ...state,
        customScenarios: action.customScenarios,
        selectedScenarioId: action.experiment.recipe.scenario.id,
        scenarioEditorId: action.experiment.recipe.scenario.id,
        config: action.experiment.recipe.config,
        currentRun: action.recreatedRun,
        selectedGeneration: action.recreatedRun.snapshots.length - 1,
        selectedCreatureId: null,
        runStatus: 'completed',
        compareMode: false,
        fastForward: false,
        surface: 'sandbox',
        notice: action.notice ?? state.notice,
      }
    case 'RESEED': {
      const scenario = getScenarioById(state.selectedScenarioId, state.customScenarios)
      const nextConfig = normalizeConfig({
        ...state.config,
        seed: action.seed,
      })
      return {
        ...state,
        ...rebuildPreview(nextConfig, scenario),
      }
    }
    case 'RUN':
      return {
        ...state,
        runStatus: state.currentRun.completed ? 'completed' : 'running',
      }
    case 'PAUSE':
      return {
        ...state,
        runStatus: state.currentRun.completed ? 'completed' : 'paused',
      }
    case 'STEP': {
      if (state.currentRun.completed) {
        return state
      }

      const nextRun = advanceRun(state.currentRun, 1)
      return {
        ...state,
        currentRun: nextRun,
        selectedGeneration: nextRun.snapshots.length - 1,
        selectedCreatureId: null,
        runStatus: nextRun.completed ? 'completed' : 'paused',
      }
    }
    case 'RESET': {
      const scenario = getScenarioById(state.selectedScenarioId, state.customScenarios)
      return {
        ...state,
        ...rebuildPreview(state.config, scenario),
      }
    }
    case 'TOGGLE_FAST_FORWARD':
      return {
        ...state,
        fastForward: !state.fastForward,
      }
    case 'SET_SELECTED_GENERATION':
      if (state.selectedGeneration === action.generationIndex) {
        return state
      }
      return {
        ...state,
        selectedGeneration: action.generationIndex,
      }
    case 'SET_SELECTED_CREATURE':
      if (state.selectedCreatureId === action.creatureId) {
        return state
      }
      return {
        ...state,
        selectedCreatureId: action.creatureId,
      }
    case 'TOGGLE_COMPARE':
      return {
        ...state,
        compareMode: !state.compareMode,
      }
    case 'ADVANCE': {
      if (state.runStatus !== 'running') {
        return state
      }

      const nextRun = advanceRun(state.currentRun, action.steps)
      return {
        ...state,
        currentRun: nextRun,
        selectedGeneration: nextRun.snapshots.length - 1,
        selectedCreatureId: null,
        runStatus: nextRun.completed ? 'completed' : 'running',
      }
    }
    case 'DISMISS_NOTICE':
      return {
        ...state,
        notice: null,
      }
    case 'SET_NOTICE':
      return {
        ...state,
        notice: action.notice,
      }
    case 'SET_ANNOUNCEMENT':
      return {
        ...state,
        announcement: action.announcement,
      }
    case 'DISMISS_QUICKSTART':
      return {
        ...state,
        quickstart: {
          dismissed: true,
        },
      }
    default:
      return state
  }
}

function updateScenarioTimestamp(scenario: ScenarioDefinition): ScenarioDefinition {
  return {
    ...scenario,
    updatedAt: new Date().toISOString(),
  }
}

function buildDownloadName(label: string, suffix: string): string {
  const safe = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${safe || 'evolution-sandbox'}-${suffix}.json`
}

function formatExportedAt(exportedAt: string, formatter: Intl.DateTimeFormat): string {
  const date = new Date(exportedAt)
  if (Number.isNaN(date.getTime())) {
    return exportedAt
  }

  return formatter.format(date)
}

export interface SessionController {
  state: SessionState
  availableScenarios: ScenarioDefinition[]
  editorScenario: ScenarioDefinition
  selectedCreature: Creature | null
  comparison: ComparisonSummary | null
  baselineExperiment: SavedExperiment | null
  announce: (announcement: Announcement | null) => void
  loadScenario: (scenarioId: string) => void
  navigate: (surface: AppSurface) => void
  reseed: () => void
  run: () => void
  pause: () => void
  step: () => void
  reset: () => void
  toggleFastForward: () => void
  setSelectedGeneration: (generationIndex: number) => void
  setSelectedCreature: (creatureId: string | null) => void
  toggleCompare: () => void
  dismissNotice: () => void
  setConfigField: (field: ConfigField, value: number) => void
  setLabSort: (sort: SessionState['labSort']) => void
  setBaselineExperiment: (experimentId: string | null) => void
  createScenario: () => Promise<void>
  duplicateScenario: (scenarioId: string) => Promise<void>
  selectEditorScenario: (scenarioId: string) => void
  updateEditorField: (field: ScenarioField, value: string) => Promise<void>
  updateEditorConfigField: (field: ConfigField, value: number) => Promise<void>
  addEditorEvent: () => Promise<void>
  updateEditorEvent: (eventId: string, update: Partial<ScenarioEvent>) => Promise<void>
  setEditorEventPressureOverride: (eventId: string, pressure: keyof ScenarioEvent['pressureOverrides'], value: number | null) => Promise<void>
  deleteEditorEvent: (eventId: string) => Promise<void>
  deleteScenario: (scenarioId: string) => Promise<void>
  loadEditorIntoSandbox: () => void
  saveExperiment: () => Promise<void>
  reviewScenarioImport: (file: File) => Promise<ArtifactImportReview | null>
  exportScenario: (scenarioId: string) => Promise<void>
  importScenario: (file: File) => Promise<void>
  reviewExperimentImport: (file: File) => Promise<ArtifactImportReview | null>
  exportExperiment: (experimentId: string) => Promise<void>
  importExperiment: (file: File) => Promise<void>
  exportExampleExperiment: (scenarioId: string) => Promise<void>
  updateExperiment: (experimentId: string, patch: Partial<Pick<SavedExperiment, 'name' | 'note'>>) => Promise<void>
  deleteExperiment: (experimentId: string) => Promise<void>
  openExperiment: (experimentId: string) => Promise<void>
  dismissQuickstart: () => void
  comparisonEnabled: boolean
}

export function useSessionController(): SessionController {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState)
  const scenarioSaveTimersRef = useRef(new Map<string, ReturnType<typeof globalThis.setTimeout>>())
  const experimentSaveTimersRef = useRef(new Map<string, ReturnType<typeof globalThis.setTimeout>>())
  const lastNoticeMessageRef = useRef<string | null>(null)
  const lastCompletedRunHashRef = useRef<string | null>(null)
  const reviewDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    [],
  )

  const availableScenarios = useMemo(
    () => [...BUILT_IN_SCENARIOS, ...state.customScenarios],
    [state.customScenarios],
  )
  const editorScenario = useMemo(
    () => getScenarioById(state.scenarioEditorId, state.customScenarios),
    [state.customScenarios, state.scenarioEditorId],
  )
  const baselineExperiment = useMemo(
    () => state.savedExperiments.find((experiment) => experiment.id === state.baselineExperimentId) ?? null,
    [state.baselineExperimentId, state.savedExperiments],
  )

  const latestTick = useEffectEvent(() => {
    dispatch({
      type: 'ADVANCE',
      steps: state.fastForward ? 8 : 1,
    })
  })

  useEffect(() => {
    void (async () => {
      const loaded = await loadLabData()
      dispatch({
        type: 'LOAD_LAB_DATA',
        customScenarios: loaded.scenarios,
        savedExperiments: loaded.experiments,
        notice: loaded.notice,
      })
    })()
  }, [])

  useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => {
      saveStoredSettings(state.config, state.selectedScenarioId, state.baselineExperimentId, state.surface)
    }, 180)

    return () => {
      globalThis.clearTimeout(timeoutId)
    }
  }, [state.baselineExperimentId, state.config, state.selectedScenarioId, state.surface])

  useEffect(() => {
    if (!state.notice || lastNoticeMessageRef.current === state.notice.message) {
      return
    }

    lastNoticeMessageRef.current = state.notice.message
    dispatch({
      type: 'SET_ANNOUNCEMENT',
      announcement: announcementFromNotice(state.notice),
    })
  }, [state.notice])

  useEffect(() => {
    if (state.runStatus !== 'running') {
      return undefined
    }

    let frameId = 0
    const tick = () => {
      latestTick()
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [state.runStatus])

  useEffect(() => {
    const runHash = state.currentRun.completedSummary?.runHash ?? null
    if (!runHash || lastCompletedRunHashRef.current === runHash) {
      return
    }

    lastCompletedRunHashRef.current = runHash
    dispatch({
      type: 'SET_ANNOUNCEMENT',
      announcement: announcementForRunCompletion(state.currentRun.completedSummary!),
    })
  }, [state.currentRun.completedSummary])

  const selectedSnapshot = state.currentRun.snapshots[state.selectedGeneration]
  const selectedCreature =
    selectedSnapshot?.creatures.find((creature) => creature.id === state.selectedCreatureId) ?? null

  const comparisonEnabled =
    state.currentRun.completed &&
    Boolean(state.currentRun.completedSummary) &&
    Boolean(baselineExperiment) &&
    baselineExperiment?.completedSummary.rulesetVersion === SIM_RULESET_VERSION

  const comparison = useMemo(() => {
    if (!comparisonEnabled || !state.currentRun.completedSummary || !baselineExperiment) {
      return null
    }

    return buildComparisonSummary(state.currentRun.completedSummary, baselineExperiment.completedSummary)
  }, [baselineExperiment, comparisonEnabled, state.currentRun.completedSummary])

  function setNotice(notice: AppNotice | null) {
    dispatch({ type: 'SET_NOTICE', notice })
  }

  function announce(announcement: Announcement | null) {
    dispatch({ type: 'SET_ANNOUNCEMENT', announcement })
  }

  function findScenarioByHash(scenarioHash: string) {
    return availableScenarios.find((scenario) => buildScenarioHash(scenario) === scenarioHash) ?? null
  }

  async function ensureImportedScenario(scenario: ScenarioDefinition): Promise<ScenarioDefinition> {
    const timestamp = new Date().toISOString()
    const importedHash = buildScenarioHash(scenario)
    const existingScenario = findScenarioByHash(importedHash)
    if (existingScenario) {
      return existingScenario
    }

    const idInUse = availableScenarios.some((entry) => entry.id === scenario.id)
    const importedId = idInUse ? `scenario-${crypto.randomUUID().slice(0, 8)}` : scenario.id
    const importedScenario = normalizeScenarioDefinition({
      ...scenario,
      id: importedId,
      isBuiltIn: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      baseConfig: {
        ...normalizeConfig(scenario.baseConfig),
        scenarioId: importedId,
      },
    })

    const nextScenarios = [importedScenario, ...state.customScenarios]
    dispatch({
      type: 'REPLACE_CUSTOM_SCENARIOS',
      scenarios: nextScenarios,
      editorScenarioId: importedScenario.id,
    })
    await saveScenarioRecord(importedScenario)
    return importedScenario
  }

  function queueScenarioSave(scenario: ScenarioDefinition) {
    const existing = scenarioSaveTimersRef.current.get(scenario.id)
    if (existing) {
      globalThis.clearTimeout(existing)
    }

    const timeoutId = globalThis.setTimeout(() => {
      void saveScenarioRecord(scenario)
      scenarioSaveTimersRef.current.delete(scenario.id)
    }, 220)

    scenarioSaveTimersRef.current.set(scenario.id, timeoutId)
  }

  function queueExperimentSave(experiment: SavedExperiment) {
    const existing = experimentSaveTimersRef.current.get(experiment.id)
    if (existing) {
      globalThis.clearTimeout(existing)
    }

    const timeoutId = globalThis.setTimeout(() => {
      void saveExperimentRecord(experiment)
      experimentSaveTimersRef.current.delete(experiment.id)
    }, 220)

    experimentSaveTimersRef.current.set(experiment.id, timeoutId)
  }

  async function persistScenario(updatedScenario: ScenarioDefinition, nextScenarios: ScenarioDefinition[], editorScenarioId?: string) {
    if (editorScenarioId) {
      dispatch({ type: 'REPLACE_CUSTOM_SCENARIOS', scenarios: nextScenarios, editorScenarioId })
    } else {
      dispatch({ type: 'REPLACE_CUSTOM_SCENARIOS', scenarios: nextScenarios })
    }
    await saveScenarioRecord(updatedScenario)
  }

  async function createScenario() {
    const scenario = createScenarioDraft()
    const nextScenarios = [scenario, ...state.customScenarios]
    await persistScenario(scenario, nextScenarios, scenario.id)
    dispatch({ type: 'NAVIGATE', surface: 'scenarios' })
  }

  async function duplicateScenarioById(scenarioId: string) {
    const source = getScenarioById(scenarioId, state.customScenarios)
    const scenario = duplicateScenario(source)
    const nextScenarios = [scenario, ...state.customScenarios]
    await persistScenario(scenario, nextScenarios, scenario.id)
  }

  function selectEditorScenario(scenarioId: string) {
    dispatch({ type: 'SELECT_EDITOR_SCENARIO', scenarioId })
  }

  async function commitEditorScenario(nextScenario: ScenarioDefinition) {
    const normalized = normalizeScenarioDefinition(updateScenarioTimestamp(nextScenario))
    const nextScenarios = state.customScenarios.some((scenario) => scenario.id === normalized.id)
      ? state.customScenarios.map((scenario) => (scenario.id === normalized.id ? normalized : scenario))
      : [normalized, ...state.customScenarios]
    dispatch({ type: 'REPLACE_CUSTOM_SCENARIOS', scenarios: nextScenarios, editorScenarioId: normalized.id })
    queueScenarioSave(normalized)
  }

  async function updateEditorField(field: ScenarioField, value: string) {
    if (editorScenario.isBuiltIn) {
      return
    }

    await commitEditorScenario({
      ...editorScenario,
      [field]: value,
    })
  }

  async function updateEditorConfigField(field: ConfigField, value: number) {
    if (editorScenario.isBuiltIn) {
      return
    }

    await commitEditorScenario({
      ...editorScenario,
      baseConfig: normalizeConfig({
        ...editorScenario.baseConfig,
        [field]: value,
        scenarioId: editorScenario.id,
      }),
    })
  }

  async function addEditorEvent() {
    if (editorScenario.isBuiltIn) {
      return
    }

    const nextGeneration = Math.min(
      editorScenario.baseConfig.generationTarget,
      10 + editorScenario.events.length * 10,
    )

    const nextEvent: ScenarioEvent = {
      id: `event-${crypto.randomUUID().slice(0, 8)}`,
      generationIndex: nextGeneration,
      label: `Event ${editorScenario.events.length + 1}`,
      description: 'Describe the world change here.',
      pressureOverrides: {
        predationPressure: editorScenario.baseConfig.predationPressure,
      },
    }

    await commitEditorScenario({
      ...editorScenario,
      events: [...editorScenario.events, nextEvent],
    })
  }

  async function updateEditorEvent(eventId: string, update: Partial<ScenarioEvent>) {
    if (editorScenario.isBuiltIn) {
      return
    }

    await commitEditorScenario({
      ...editorScenario,
      events: editorScenario.events.map((event) =>
        event.id === eventId
          ? {
              ...event,
              ...update,
            }
          : event,
      ),
    })
  }

  async function setEditorEventPressureOverride(
    eventId: string,
    pressure: keyof ScenarioEvent['pressureOverrides'],
    value: number | null,
  ) {
    const event = editorScenario.events.find((entry) => entry.id === eventId)
    if (!event || editorScenario.isBuiltIn) {
      return
    }

    const nextOverrides = { ...event.pressureOverrides }
    if (value === null) {
      delete nextOverrides[pressure]
    } else {
      nextOverrides[pressure] = value
    }

    await updateEditorEvent(eventId, {
      pressureOverrides: nextOverrides,
    })
  }

  async function deleteEditorEvent(eventId: string) {
    if (editorScenario.isBuiltIn) {
      return
    }

    await commitEditorScenario({
      ...editorScenario,
      events: editorScenario.events.filter((event) => event.id !== eventId),
    })
  }

  async function deleteScenarioById(scenarioId: string) {
    const scenario = state.customScenarios.find((entry) => entry.id === scenarioId)
    if (!scenario) {
      return
    }

    const pendingSave = scenarioSaveTimersRef.current.get(scenarioId)
    if (pendingSave) {
      globalThis.clearTimeout(pendingSave)
      scenarioSaveTimersRef.current.delete(scenarioId)
    }

    const nextScenarios = state.customScenarios.filter((entry) => entry.id !== scenarioId)
    dispatch({
      type: 'REPLACE_CUSTOM_SCENARIOS',
      scenarios: nextScenarios,
      editorScenarioId: nextScenarios[0]?.id ?? BUILT_IN_SCENARIOS[0]!.id,
    })

    if (state.selectedScenarioId === scenarioId) {
      dispatch({ type: 'LOAD_SCENARIO', scenario: BUILT_IN_SCENARIOS[0]! })
    }

    await deleteScenarioRecord(scenarioId)
  }

  function loadScenario(scenarioId: string) {
    const scenario = getScenarioById(scenarioId, state.customScenarios)
    dispatch({
      type: 'LOAD_SCENARIO',
      scenario,
    })
    setNotice(null)
  }

  function loadEditorIntoSandbox() {
    dispatch({
      type: 'LOAD_SCENARIO',
      scenario: editorScenario,
    })
    dispatch({ type: 'NAVIGATE', surface: 'sandbox' })
  }

  async function saveExperiment() {
    if (!state.currentRun.completedSummary) {
      return
    }

    const timestamp = new Date().toISOString()
    const experiment: SavedExperiment = {
      id: `experiment-${crypto.randomUUID().slice(0, 8)}`,
      name: `${state.currentRun.scenario.name} · seed ${state.currentRun.seed}`,
      note: '',
      createdAt: timestamp,
      updatedAt: timestamp,
      recipe: {
        scenario: state.currentRun.scenario,
        config: state.currentRun.config,
        seed: state.currentRun.seed,
        rulesetVersion: SIM_RULESET_VERSION,
      },
      completedSummary: state.currentRun.completedSummary,
    }

    const nextExperiments = [experiment, ...state.savedExperiments]
    dispatch({ type: 'REPLACE_SAVED_EXPERIMENTS', experiments: nextExperiments })
    if (!state.baselineExperimentId) {
      dispatch({ type: 'SET_BASELINE_EXPERIMENT', experimentId: experiment.id })
      announce(announcementForBaseline(experiment))
    }
    await saveExperimentRecord(experiment)
    setNotice({
      level: 'info',
      message: `${experiment.name} was saved to the lab.`,
    })
  }

  async function reviewScenarioImport(file: File): Promise<ArtifactImportReview | null> {
    const raw = await readArtifactFile(file, MAX_ARTIFACT_BYTES)
    if (!raw.ok) {
      setNotice(raw.notice)
      return null
    }

    const parsed = parseArtifactJson(raw.text)
    if (!parsed.ok) {
      setNotice(parsed.notice)
      return null
    }

    const validated = validateScenarioArtifact(parsed.value)
    if (!validated.ok) {
      setNotice(validated.notice)
      return null
    }

    const existingScenario = findScenarioByHash(validated.value.scenarioHash)

    return {
      kind: 'scenario',
      fileName: file.name,
      fileSizeLabel: formatFileSize(file.size),
      title: existingScenario ? existingScenario.name : validated.value.scenario.name,
      summary: existingScenario
        ? 'This file already matches a scenario in the local library.'
        : 'This file is ready to import as a custom scenario.',
      details: [
        `Exported ${formatExportedAt(validated.value.artifact.exportedAt, reviewDateFormatter)} under ruleset ${validated.value.artifact.appRulesetVersion}.`,
        `${validated.value.scenario.events.length} scheduled events across ${validated.value.scenario.baseConfig.generationTarget} generations.`,
        existingScenario
          ? `Confirming will select ${existingScenario.name} instead of creating a duplicate.`
          : `Confirming will add ${validated.value.scenario.name} to the local scenario library.`,
      ],
      warnings: validated.value.rulesetMatches
        ? []
        : ['This file was created under a different ruleset version, so later results may differ from older screenshots or notes.'],
      action: existingScenario ? 'dedupe' : 'import',
      actionLabel: existingScenario ? 'Use local scenario' : 'Import scenario',
      canImport: true,
    }
  }

  async function exportScenario(scenarioId: string) {
    const scenario = getScenarioById(scenarioId, state.customScenarios)
    const artifact = buildScenarioArtifact(scenario)
    downloadJsonFile(buildDownloadName(scenario.name, 'scenario'), serializeArtifact(artifact))
    setNotice({
      level: 'info',
      message: `${scenario.name} was exported as a portable scenario file.`,
    })
  }

  async function importScenario(file: File) {
    const raw = await readArtifactFile(file, MAX_ARTIFACT_BYTES)
    if (!raw.ok) {
      setNotice(raw.notice)
      return
    }

    const parsed = parseArtifactJson(raw.text)
    if (!parsed.ok) {
      setNotice(parsed.notice)
      return
    }

    const validated = validateScenarioArtifact(parsed.value)
    if (!validated.ok) {
      setNotice(validated.notice)
      return
    }

    const existingScenario = findScenarioByHash(validated.value.scenarioHash)
    if (existingScenario) {
      dispatch({ type: 'SELECT_EDITOR_SCENARIO', scenarioId: existingScenario.id })
      dispatch({ type: 'NAVIGATE', surface: 'scenarios' })
      setNotice({
        level: 'info',
        message: `${existingScenario.name} is already in the scenario library, so the import was not duplicated.`,
      })
      return
    }

    const importedScenario = await ensureImportedScenario(validated.value.scenario)
    dispatch({ type: 'SELECT_EDITOR_SCENARIO', scenarioId: importedScenario.id })
    dispatch({ type: 'NAVIGATE', surface: 'scenarios' })
    setNotice({
      level: validated.value.rulesetMatches ? 'info' : 'warning',
      message: validated.value.rulesetMatches
        ? `${importedScenario.name} was imported into the local scenario library.`
        : `${importedScenario.name} was imported, but it was created under a different ruleset version and may not replay exactly the same.`,
    })
  }

  async function reviewExperimentImport(file: File): Promise<ArtifactImportReview | null> {
    const raw = await readArtifactFile(file, MAX_ARTIFACT_BYTES)
    if (!raw.ok) {
      setNotice(raw.notice)
      return null
    }

    const parsed = parseArtifactJson(raw.text)
    if (!parsed.ok) {
      setNotice(parsed.notice)
      return null
    }

    const validated = validateExperimentArtifact(parsed.value)
    if (!validated.ok) {
      setNotice(validated.notice)
      return null
    }

    const duplicateExperiment = state.savedExperiments.find(
      (entry) => entry.completedSummary.runHash === validated.value.runHash,
    )
    if (duplicateExperiment) {
      return {
        kind: 'experiment',
        fileName: file.name,
        fileSizeLabel: formatFileSize(file.size),
        title: duplicateExperiment.name,
        summary: 'This experiment is already in the local lab.',
        details: [
          `Exported ${formatExportedAt(validated.value.artifact.exportedAt, reviewDateFormatter)} from ${validated.value.recipe.scenario.name}.`,
          'Confirming will keep the current lab entry and skip a duplicate import.',
        ],
        warnings: [],
        action: 'dedupe',
        actionLabel: 'Use local experiment',
        canImport: true,
      }
    }

    const matchingScenario = findScenarioByHash(validated.value.scenarioHash)
    const previewScenario = matchingScenario ?? validated.value.recipe.scenario
    const previewConfig = normalizeConfig({
      ...validated.value.recipe.config,
      scenarioId: previewScenario.id,
    })
    const previewRun = advanceRun(
      initializeRun(previewConfig, previewScenario),
      previewConfig.generationTarget,
    )
    const replayTrusted = previewRun.completedSummary?.runHash === validated.value.runHash

    return {
      kind: 'experiment',
      fileName: file.name,
      fileSizeLabel: formatFileSize(file.size),
      title: validated.value.artifact.payload.name,
      summary: replayTrusted
        ? 'This experiment replayed successfully and is ready to import.'
        : 'This experiment could not be replay-verified and should not be imported.',
      details: [
        `Exported ${formatExportedAt(validated.value.artifact.exportedAt, reviewDateFormatter)} from ${validated.value.recipe.scenario.name} with seed ${validated.value.recipe.seed}.`,
        `Final population ${validated.value.completedSummary.finalPopulationSize} at generation ${validated.value.completedSummary.finalGeneration}.`,
        matchingScenario
          ? `${matchingScenario.name} already exists locally, so the imported run will link to that scenario.`
          : `${validated.value.recipe.scenario.name} will be added to the local scenario library so this run can reopen later.`,
      ],
      warnings: replayTrusted
        ? []
        : ['The regenerated run hash did not match the saved artifact, so importing this file would break the replay trust contract.'],
      action: replayTrusted ? 'import' : 'blocked',
      actionLabel: replayTrusted ? 'Import experiment' : 'Close review',
      canImport: replayTrusted,
    }
  }

  async function exportExperiment(experimentId: string) {
    const experiment = state.savedExperiments.find((entry) => entry.id === experimentId)
    if (!experiment) {
      return
    }

    const artifact = buildExperimentArtifact(experiment)
    downloadJsonFile(buildDownloadName(experiment.name, 'experiment'), serializeArtifact(artifact))
    setNotice({
      level: 'info',
      message: `${experiment.name} was exported as a portable experiment file.`,
    })
  }

  async function exportExampleExperiment(scenarioId: string) {
    const scenario = getScenarioById(scenarioId, state.customScenarios)
    const config = normalizeConfig({
      ...scenario.baseConfig,
      scenarioId: scenario.id,
    })
    const recreatedRun = advanceRun(initializeRun(config, scenario), config.generationTarget)

    if (!recreatedRun.completedSummary) {
      return
    }

    const timestamp = new Date().toISOString()
    const exampleExperiment: SavedExperiment = {
      id: `example-${scenario.id}`,
      name: `Example ${scenario.name} · seed ${config.seed}`,
      note: 'Portable example generated by Evolution Sandbox for reviewer import testing.',
      createdAt: timestamp,
      updatedAt: timestamp,
      recipe: {
        scenario,
        config,
        seed: config.seed,
        rulesetVersion: SIM_RULESET_VERSION,
      },
      completedSummary: recreatedRun.completedSummary,
    }

    const artifact = buildExperimentArtifact(exampleExperiment)
    downloadJsonFile(buildDownloadName(exampleExperiment.name, 'experiment'), serializeArtifact(artifact))
    setNotice({
      level: 'info',
      message: `${exampleExperiment.name} was exported as a sample experiment file.`,
    })
  }

  async function updateExperiment(experimentId: string, patch: Partial<Pick<SavedExperiment, 'name' | 'note'>>) {
    const experiment = state.savedExperiments.find((entry) => entry.id === experimentId)
    if (!experiment) {
      return
    }

    const updatedExperiment: SavedExperiment = {
      ...experiment,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    const nextExperiments = state.savedExperiments.map((entry) =>
      entry.id === experimentId ? updatedExperiment : entry,
    )
    dispatch({ type: 'REPLACE_SAVED_EXPERIMENTS', experiments: nextExperiments })
    queueExperimentSave(updatedExperiment)
  }

  async function deleteExperiment(experimentId: string) {
    const pendingSave = experimentSaveTimersRef.current.get(experimentId)
    if (pendingSave) {
      globalThis.clearTimeout(pendingSave)
      experimentSaveTimersRef.current.delete(experimentId)
    }

    const nextExperiments = state.savedExperiments.filter((entry) => entry.id !== experimentId)
    dispatch({ type: 'REPLACE_SAVED_EXPERIMENTS', experiments: nextExperiments })
    if (state.baselineExperimentId === experimentId) {
      dispatch({ type: 'SET_BASELINE_EXPERIMENT', experimentId: null })
    }
    await deleteExperimentRecord(experimentId)
  }

  async function openExperiment(experimentId: string) {
    const experiment = state.savedExperiments.find((entry) => entry.id === experimentId)
    if (!experiment) {
      return
    }

    const recipeScenario = normalizeScenarioDefinition(experiment.recipe.scenario)
    const scenarioExists = availableScenarios.some((scenario) => scenario.id === recipeScenario.id)
    const nextCustomScenarios =
      recipeScenario.isBuiltIn || scenarioExists
        ? state.customScenarios
        : [recipeScenario, ...state.customScenarios]

    if (!recipeScenario.isBuiltIn && !scenarioExists) {
      await saveScenarioRecord(recipeScenario)
    }

    const recreatedRun = advanceRun(
      initializeRun(experiment.recipe.config, recipeScenario),
      experiment.recipe.config.generationTarget,
    )

    dispatch({
      type: 'LOAD_EXPERIMENT',
      experiment,
      customScenarios: nextCustomScenarios,
      recreatedRun,
      notice:
        recreatedRun.completedSummary?.runHash === experiment.completedSummary.runHash
          ? {
              level: 'info',
              message: `Reopened ${experiment.name} from the local lab.`,
            }
          : {
              level: 'warning',
              message: `${experiment.name} reopened, but the regenerated run no longer matches the saved hash.`,
            },
    })
  }

  async function importExperiment(file: File) {
    const raw = await readArtifactFile(file, MAX_ARTIFACT_BYTES)
    if (!raw.ok) {
      setNotice(raw.notice)
      return
    }

    const parsed = parseArtifactJson(raw.text)
    if (!parsed.ok) {
      setNotice(parsed.notice)
      return
    }

    const validated = validateExperimentArtifact(parsed.value)
    if (!validated.ok) {
      setNotice(validated.notice)
      return
    }

    const duplicateExperiment = state.savedExperiments.find(
      (entry) => entry.completedSummary.runHash === validated.value.runHash,
    )
    if (duplicateExperiment) {
      dispatch({ type: 'NAVIGATE', surface: 'lab' })
      setNotice({
        level: 'info',
        message: `${duplicateExperiment.name} is already in the lab, so the imported experiment was not duplicated.`,
      })
      return
    }

    const localScenario = await ensureImportedScenario(validated.value.recipe.scenario)
    const localRecipe = {
      ...validated.value.recipe,
      scenario: localScenario,
      config: normalizeConfig({
        ...validated.value.recipe.config,
        scenarioId: localScenario.id,
      }),
    }
    const recreatedRun = advanceRun(
      initializeRun(localRecipe.config, localScenario),
      localRecipe.config.generationTarget,
    )

    if (recreatedRun.completedSummary?.runHash !== validated.value.runHash) {
      setNotice({
        level: 'warning',
        message: 'The imported experiment could not be trusted because the replayed run hash did not match the saved artifact.',
      })
      return
    }

    const timestamp = new Date().toISOString()
    const importedExperiment: SavedExperiment = {
      id: `experiment-${crypto.randomUUID().slice(0, 8)}`,
      name: validated.value.artifact.payload.name,
      note: validated.value.artifact.payload.note,
      createdAt: timestamp,
      updatedAt: timestamp,
      recipe: localRecipe,
      completedSummary: validated.value.completedSummary,
    }
    const nextExperiments = [importedExperiment, ...state.savedExperiments]
    dispatch({ type: 'REPLACE_SAVED_EXPERIMENTS', experiments: nextExperiments })
    await saveExperimentRecord(importedExperiment)
    dispatch({ type: 'NAVIGATE', surface: 'lab' })
    setNotice({
      level: 'info',
      message: `${importedExperiment.name} was imported into the local lab and is ready to reopen or compare.`,
    })
  }

  return {
    state,
    availableScenarios,
    editorScenario,
    selectedCreature,
    comparison,
    baselineExperiment,
    announce,
    loadScenario,
    navigate: (surface) => dispatch({ type: 'NAVIGATE', surface }),
    reseed: () => dispatch({ type: 'RESEED', seed: createSeed() }),
    run: () => dispatch({ type: 'RUN' }),
    pause: () => dispatch({ type: 'PAUSE' }),
    step: () => dispatch({ type: 'STEP' }),
    reset: () => dispatch({ type: 'RESET' }),
    toggleFastForward: () => dispatch({ type: 'TOGGLE_FAST_FORWARD' }),
    setSelectedGeneration: (generationIndex) => {
      dispatch({ type: 'SET_SELECTED_GENERATION', generationIndex })
      const snapshot = state.currentRun.snapshots[generationIndex]
      if (snapshot) {
        announce(announcementForGeneration(snapshot))
      }
    },
    setSelectedCreature: (creatureId) => {
      dispatch({ type: 'SET_SELECTED_CREATURE', creatureId })
      const creature = selectedSnapshot?.creatures.find((entry) => entry.id === creatureId) ?? null
      announce(announcementForCreature(creature))
    },
    toggleCompare: () => dispatch({ type: 'TOGGLE_COMPARE' }),
    dismissNotice: () => {
      lastNoticeMessageRef.current = null
      dispatch({ type: 'DISMISS_NOTICE' })
    },
    setConfigField: (field, value) => dispatch({ type: 'SET_CONFIG_FIELD', field, value }),
    setLabSort: (sort) => dispatch({ type: 'SET_LAB_SORT', sort }),
    setBaselineExperiment: (experimentId) => {
      const experiment = state.savedExperiments.find((entry) => entry.id === experimentId) ?? null
      dispatch({ type: 'SET_BASELINE_EXPERIMENT', experimentId })
      announce(announcementForBaseline(experiment))
    },
    createScenario,
    duplicateScenario: duplicateScenarioById,
    selectEditorScenario,
    updateEditorField,
    updateEditorConfigField,
    addEditorEvent,
    updateEditorEvent,
    setEditorEventPressureOverride,
    deleteEditorEvent,
    deleteScenario: deleteScenarioById,
    loadEditorIntoSandbox,
    saveExperiment,
    reviewScenarioImport,
    exportScenario,
    importScenario,
    reviewExperimentImport,
    exportExperiment,
    importExperiment,
    exportExampleExperiment,
    updateExperiment,
    deleteExperiment,
    openExperiment,
    dismissQuickstart: () => dispatch({ type: 'DISMISS_QUICKSTART' }),
    comparisonEnabled,
  }
}

export function buildPressureCaption(): string {
  return `${PRESSURE_LABELS.foodScarcity}, ${PRESSURE_LABELS.predationPressure}, ${PRESSURE_LABELS.coldStress}, and ${PRESSURE_LABELS.habitatVisibility} are the only world pressures in this phase.`
}
