import { clear, createStore, del, get, keys, set } from 'idb-keyval'

import { SIM_RULESET_VERSION, STORAGE_SCHEMA_VERSION } from '@/domain/config'
import { normalizeScenarioDefinition } from '@/domain/scenarios'
import type {
  AppNotice,
  PersistedPayload,
  SavedExperiment,
  ScenarioDefinition,
} from '@/domain/types'

export const LAB_STORAGE_NAMES = {
  scenariosDb: 'evolution-sandbox-lab-scenarios',
  experimentsDb: 'evolution-sandbox-lab-experiments',
  storeName: 'records',
} as const

const SCENARIO_STORE = createStore(LAB_STORAGE_NAMES.scenariosDb, LAB_STORAGE_NAMES.storeName)
const EXPERIMENT_STORE = createStore(LAB_STORAGE_NAMES.experimentsDb, LAB_STORAGE_NAMES.storeName)

function wrapPayload<T>(payload: T): PersistedPayload<T> {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    rulesetVersion: SIM_RULESET_VERSION,
    savedAt: new Date().toISOString(),
    payload,
  }
}

function isCompatible<T>(value: PersistedPayload<T> | undefined): value is PersistedPayload<T> {
  return Boolean(
    value &&
      value.schemaVersion === STORAGE_SCHEMA_VERSION &&
      value.rulesetVersion === SIM_RULESET_VERSION &&
      value.payload,
  )
}

async function listEntries<T>(store: ReturnType<typeof createStore>) {
  const storeKeys = await keys(store)
  const values = await Promise.all(storeKeys.map((key) => get<PersistedPayload<T>>(key, store)))
  return storeKeys.map((key, index) => ({
    key,
    value: values[index],
  }))
}

function isCompatibleEntry<T>(entry: { key: IDBValidKey; value: PersistedPayload<T> | undefined }): entry is {
  key: IDBValidKey
  value: PersistedPayload<T>
} {
  return isCompatible(entry.value)
}

export async function loadLabData(): Promise<{
  scenarios: ScenarioDefinition[]
  experiments: SavedExperiment[]
  notice: AppNotice | null
}> {
  try {
    const [scenarioEntries, experimentEntries] = await Promise.all([
      listEntries<ScenarioDefinition>(SCENARIO_STORE),
      listEntries<SavedExperiment>(EXPERIMENT_STORE),
    ])
    const compatibleScenarioEntries = scenarioEntries.filter(isCompatibleEntry)
    const compatibleExperimentEntries = experimentEntries.filter(isCompatibleEntry)
    const incompatibleScenarioEntries = scenarioEntries.filter((entry) => !isCompatible(entry.value))
    const incompatibleExperimentEntries = experimentEntries.filter((entry) => !isCompatible(entry.value))

    if (incompatibleScenarioEntries.length > 0 || incompatibleExperimentEntries.length > 0) {
      await Promise.all([
        ...incompatibleScenarioEntries.map((entry) => del(entry.key, SCENARIO_STORE).catch(() => undefined)),
        ...incompatibleExperimentEntries.map((entry) => del(entry.key, EXPERIMENT_STORE).catch(() => undefined)),
      ])
    }

    const scenarios = compatibleScenarioEntries
      .map((entry) => normalizeScenarioDefinition(entry.value.payload))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    const experiments = compatibleExperimentEntries
      .map((entry) => entry.value.payload)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    const droppedCount = incompatibleScenarioEntries.length + incompatibleExperimentEntries.length

    return {
      scenarios,
      experiments,
      notice:
        droppedCount > 0
          ? {
              level: 'warning',
              message:
                droppedCount === 1
                  ? 'One incompatible saved lab record was cleared after a version change.'
                  : `${droppedCount} incompatible saved lab records were cleared after a version change.`,
            }
          : null,
    }
  } catch {
    return {
      scenarios: [],
      experiments: [],
      notice: {
        level: 'warning',
        message: 'Lab data could not be read, so the local experiment library was reset for this session.',
      },
    }
  }
}

export async function saveScenarioRecord(scenario: ScenarioDefinition): Promise<void> {
  await set(scenario.id, wrapPayload(normalizeScenarioDefinition(scenario)), SCENARIO_STORE)
}

export async function deleteScenarioRecord(scenarioId: string): Promise<void> {
  await del(scenarioId, SCENARIO_STORE)
}

export async function saveExperimentRecord(experiment: SavedExperiment): Promise<void> {
  await set(experiment.id, wrapPayload(experiment), EXPERIMENT_STORE)
}

export async function deleteExperimentRecord(experimentId: string): Promise<void> {
  await del(experimentId, EXPERIMENT_STORE)
}

export async function clearLabData(): Promise<void> {
  await Promise.all([
    clear(SCENARIO_STORE).catch(() => undefined),
    clear(EXPERIMENT_STORE).catch(() => undefined),
  ])
}
