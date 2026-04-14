import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore, set } from 'idb-keyval'

import { DEFAULT_CONFIG, STORAGE_KEYS, STORAGE_SCHEMA_VERSION, SIM_RULESET_VERSION } from '@/domain/config'
import { createScenarioDraft } from '@/domain/scenarios'
import type { SavedExperiment } from '@/domain/types'
import {
  LAB_STORAGE_NAMES,
  clearLabData,
  deleteExperimentRecord,
  deleteScenarioRecord,
  loadLabData,
  saveExperimentRecord,
  saveScenarioRecord,
} from '@/infra/labStorage'
import { loadStoredSettings, saveStoredSettings } from '@/infra/sessionStorage'

const sampleScenario = createScenarioDraft('Stored Scenario')

const sampleExperiment: SavedExperiment = {
  id: 'experiment-1',
  name: 'Stored Experiment',
  note: 'Useful baseline',
  createdAt: new Date('2026-04-13T08:00:00.000Z').toISOString(),
  updatedAt: new Date('2026-04-13T08:00:00.000Z').toISOString(),
  recipe: {
    scenario: sampleScenario,
    config: sampleScenario.baseConfig,
    seed: sampleScenario.baseConfig.seed,
    rulesetVersion: SIM_RULESET_VERSION,
  },
  completedSummary: {
    rulesetVersion: SIM_RULESET_VERSION,
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    configHash: 'abc12345',
    scenarioHash: 'scenario12345',
    seed: sampleScenario.baseConfig.seed,
    scenarioId: sampleScenario.id,
    scenarioName: sampleScenario.name,
    finalGeneration: 5,
    finalPopulationSize: 380,
    finalMeanTraits: {
      size: 0.5,
      speed: 0.52,
      camouflage: 0.49,
      energyEfficiency: 0.55,
    },
    populationCurve: [400, 398, 390, 385, 382, 380],
    survivalCurve: [1, 0.61, 0.59, 0.58, 0.57, 0.56],
    diversityCurve: [0.58, 0.56, 0.51, 0.48, 0.46, 0.44],
    dominantPhenotypeCurve: [0.14, 0.15, 0.18, 0.22, 0.25, 0.28],
    meanTraitCurves: {
      size: [0.5],
      speed: [0.52],
      camouflage: [0.49],
      energyEfficiency: [0.55],
    },
    finalSummary: ['Test summary'],
    runHash: 'run12345',
  },
}

describe('storage adapters', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    vi.restoreAllMocks()
    await clearLabData()
  })

  it('round-trips session settings', () => {
    saveStoredSettings(DEFAULT_CONFIG, DEFAULT_CONFIG.scenarioId, null, 'sandbox')

    const result = loadStoredSettings()
    expect(result.settings?.config).toEqual(DEFAULT_CONFIG)
    expect(result.settings?.selectedScenarioId).toBe(DEFAULT_CONFIG.scenarioId)
  })

  it('clears unreadable session settings and returns a warning notice', () => {
    window.localStorage.setItem(STORAGE_KEYS.settings, '{bad json')

    const result = loadStoredSettings()
    expect(result.settings).toBeNull()
    expect(result.notice?.level).toBe('warning')
    expect(window.localStorage.getItem(STORAGE_KEYS.settings)).toBeNull()
  })

  it('round-trips saved scenarios and experiments through the lab store', async () => {
    await saveScenarioRecord(sampleScenario)
    await saveExperimentRecord(sampleExperiment)

    const loaded = await loadLabData()
    expect(loaded.scenarios.map((scenario) => scenario.id)).toContain(sampleScenario.id)
    expect(loaded.experiments.map((experiment) => experiment.id)).toContain(sampleExperiment.id)

    await deleteScenarioRecord(sampleScenario.id)
    await deleteExperimentRecord(sampleExperiment.id)

    const emptied = await loadLabData()
    expect(emptied.scenarios).toHaveLength(0)
    expect(emptied.experiments).toHaveLength(0)
  })

  it('clears incompatible lab records and returns a warning notice', async () => {
    const incompatibleScenarioStore = createStore(LAB_STORAGE_NAMES.scenariosDb, LAB_STORAGE_NAMES.storeName)
    const incompatibleExperimentStore = createStore(LAB_STORAGE_NAMES.experimentsDb, LAB_STORAGE_NAMES.storeName)

    await set(
      'legacy-scenario',
      {
        schemaVersion: 'legacy-schema',
        rulesetVersion: SIM_RULESET_VERSION,
        savedAt: new Date('2026-04-13T08:00:00.000Z').toISOString(),
        payload: sampleScenario,
      },
      incompatibleScenarioStore,
    )
    await set(
      'legacy-experiment',
      {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        rulesetVersion: 'legacy-ruleset',
        savedAt: new Date('2026-04-13T08:00:00.000Z').toISOString(),
        payload: sampleExperiment,
      },
      incompatibleExperimentStore,
    )

    const loaded = await loadLabData()
    expect(loaded.scenarios).toHaveLength(0)
    expect(loaded.experiments).toHaveLength(0)
    expect(loaded.notice?.level).toBe('warning')
    expect(loaded.notice?.message).toContain('incompatible')

    const reloaded = await loadLabData()
    expect(reloaded.notice).toBeNull()
  })
})
