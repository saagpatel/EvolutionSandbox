import * as idbKeyval from 'idb-keyval'

import { SIM_RULESET_VERSION, STORAGE_SCHEMA_VERSION } from '@/domain/config'
import { normalizeScenarioDefinition } from '@/domain/scenarios'
import type {
  AppNotice,
  LabQuarantineSummary,
  LabRecordKind,
  PersistedPayload,
  SavedExperiment,
  ScenarioDefinition,
} from '@/domain/types'

export const LAB_STORAGE_NAMES = {
  scenariosDb: 'evolution-sandbox-lab-scenarios',
  experimentsDb: 'evolution-sandbox-lab-experiments',
  quarantineDb: 'evolution-sandbox-lab-quarantine',
  storeName: 'records',
} as const

export const LAB_QUARANTINE_RECOVERY_TYPE = 'lab-quarantine'
export const LAB_QUARANTINE_RECOVERY_VERSION = 'q1'
export const LAB_QUARANTINE_RECOVERY_LABEL = 'local recovery data'

const SCENARIO_STORE = idbKeyval.createStore(LAB_STORAGE_NAMES.scenariosDb, LAB_STORAGE_NAMES.storeName)
const EXPERIMENT_STORE = idbKeyval.createStore(LAB_STORAGE_NAMES.experimentsDb, LAB_STORAGE_NAMES.storeName)
const QUARANTINE_STORE = idbKeyval.createStore(LAB_STORAGE_NAMES.quarantineDb, LAB_STORAGE_NAMES.storeName)

export interface LabQuarantineRecord extends LabQuarantineSummary {
  rawRecord: unknown
}

export interface LabQuarantineRecoveryArtifact {
  recoveryType: typeof LAB_QUARANTINE_RECOVERY_TYPE
  recoverySchemaVersion: typeof LAB_QUARANTINE_RECOVERY_VERSION
  label: typeof LAB_QUARANTINE_RECOVERY_LABEL
  exportedAt: string
  records: Array<LabQuarantineSummary & { rawRecord: unknown }>
}

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

async function listEntries<T>(store: ReturnType<typeof idbKeyval.createStore>) {
  const storeKeys = await idbKeyval.keys(store)
  const values = await Promise.all(storeKeys.map((key) => idbKeyval.get<PersistedPayload<T>>(key, store)))
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

function serializeIdbKey(key: IDBValidKey): string {
  if (typeof key === 'string') {
    return key
  }

  if (typeof key === 'number') {
    return String(key)
  }

  try {
    return JSON.stringify(key)
  } catch {
    return String(key)
  }
}

export function buildQuarantineId(kind: LabRecordKind, originalKey: IDBValidKey): string {
  return `${kind}:${serializeIdbKey(originalKey)}`
}

function readStringField(value: unknown, field: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const candidate = (value as Record<string, unknown>)[field]
  return typeof candidate === 'string' ? candidate : null
}

function incompatibilityReason(kind: LabRecordKind, value: unknown): string {
  const schemaVersion = readStringField(value, 'schemaVersion')
  const rulesetVersion = readStringField(value, 'rulesetVersion')
  const hasPayload = Boolean(
    value && typeof value === 'object' && !Array.isArray(value) && (value as { payload?: unknown }).payload,
  )

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return `The saved ${kind} record could not be read as a lab payload after a version change.`
  }

  if (!hasPayload) {
    return `The saved ${kind} record is missing a payload after a version change.`
  }

  if (schemaVersion !== STORAGE_SCHEMA_VERSION && rulesetVersion !== SIM_RULESET_VERSION) {
    return `The saved ${kind} record uses schema ${schemaVersion ?? 'unknown'} and ruleset ${rulesetVersion ?? 'unknown'}, which this app cannot load.`
  }

  if (schemaVersion !== STORAGE_SCHEMA_VERSION) {
    return `The saved ${kind} record uses schema ${schemaVersion ?? 'unknown'}, which this app cannot load.`
  }

  if (rulesetVersion !== SIM_RULESET_VERSION) {
    return `The saved ${kind} record uses ruleset ${rulesetVersion ?? 'unknown'}, which this app cannot load.`
  }

  return `The saved ${kind} record is incompatible with the current lab storage contract.`
}

function isQuarantineRecord(value: unknown): value is LabQuarantineRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const record = value as Partial<LabQuarantineRecord>
  return (
    typeof record.id === 'string' &&
    (record.kind === 'scenario' || record.kind === 'experiment') &&
    typeof record.originalKey === 'string' &&
    typeof record.reason === 'string' &&
    typeof record.quarantinedAt === 'string' &&
    'rawRecord' in record
  )
}

function toQuarantineSummary(record: LabQuarantineRecord): LabQuarantineSummary {
  return {
    id: record.id,
    kind: record.kind,
    originalKey: record.originalKey,
    observedSchemaVersion: record.observedSchemaVersion,
    observedRulesetVersion: record.observedRulesetVersion,
    originalSavedAt: record.originalSavedAt,
    quarantinedAt: record.quarantinedAt,
    reason: record.reason,
  }
}

function cloneJsonSafe(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value)) as unknown
  } catch {
    return null
  }
}

function buildQuarantineRecord(kind: LabRecordKind, key: IDBValidKey, value: unknown): LabQuarantineRecord {
  return {
    id: buildQuarantineId(kind, key),
    kind,
    originalKey: serializeIdbKey(key),
    observedSchemaVersion: readStringField(value, 'schemaVersion'),
    observedRulesetVersion: readStringField(value, 'rulesetVersion'),
    originalSavedAt: readStringField(value, 'savedAt'),
    quarantinedAt: new Date().toISOString(),
    reason: incompatibilityReason(kind, value),
    rawRecord: value ?? null,
  }
}

async function listQuarantineRecords(): Promise<LabQuarantineRecord[]> {
  const storeKeys = await idbKeyval.keys(QUARANTINE_STORE)
  const values = await Promise.all(storeKeys.map((key) => idbKeyval.get<LabQuarantineRecord>(key, QUARANTINE_STORE)))
  return values.filter(isQuarantineRecord).sort((left, right) => right.quarantinedAt.localeCompare(left.quarantinedAt))
}

async function listQuarantineSummaries(): Promise<LabQuarantineSummary[]> {
  const records = await listQuarantineRecords()
  return records.map(toQuarantineSummary)
}

async function quarantineIncompatibleEntries(
  kind: LabRecordKind,
  entries: Array<{ key: IDBValidKey; value: unknown }>,
  sourceStore: ReturnType<typeof idbKeyval.createStore>,
): Promise<{ quarantined: number; retained: number }> {
  const outcomes = await Promise.all(
    entries.map(async (entry) => {
      const record = buildQuarantineRecord(kind, entry.key, entry.value)
      try {
        const existing = await idbKeyval.get<LabQuarantineRecord>(record.id, QUARANTINE_STORE)
        if (!isQuarantineRecord(existing)) {
          await idbKeyval.set(record.id, record, QUARANTINE_STORE)
        }
        await idbKeyval.del(entry.key, sourceStore)
        return 'quarantined' as const
      } catch {
        return 'retained' as const
      }
    }),
  )

  return {
    quarantined: outcomes.filter((outcome) => outcome === 'quarantined').length,
    retained: outcomes.filter((outcome) => outcome === 'retained').length,
  }
}

function quarantineNotice(quarantined: number, retained: number): AppNotice | null {
  if (retained > 0 && quarantined > 0) {
    return {
      level: 'warning',
      message:
        'Some incompatible saved lab records were moved to local recovery, but at least one original was kept because recovery storage could not be written.',
    }
  }

  if (retained > 0) {
    return {
      level: 'warning',
      message:
        retained === 1
          ? 'One incompatible saved lab record could not be moved to local recovery, so the original was kept.'
          : `${retained} incompatible saved lab records could not be moved to local recovery, so the originals were kept.`,
    }
  }

  if (quarantined > 0) {
    return {
      level: 'warning',
      message:
        quarantined === 1
          ? 'One incompatible saved lab record was moved to local recovery after a version change.'
          : `${quarantined} incompatible saved lab records were moved to local recovery after a version change.`,
    }
  }

  return null
}

export async function loadLabData(): Promise<{
  scenarios: ScenarioDefinition[]
  experiments: SavedExperiment[]
  quarantine: LabQuarantineSummary[]
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

    const [scenarioRecovery, experimentRecovery] = await Promise.all([
      quarantineIncompatibleEntries('scenario', incompatibleScenarioEntries, SCENARIO_STORE),
      quarantineIncompatibleEntries('experiment', incompatibleExperimentEntries, EXPERIMENT_STORE),
    ])

    const scenarios = compatibleScenarioEntries
      .map((entry) => normalizeScenarioDefinition(entry.value.payload))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    const experiments = compatibleExperimentEntries
      .map((entry) => entry.value.payload)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    const quarantine = await listQuarantineSummaries()
    const quarantined = scenarioRecovery.quarantined + experimentRecovery.quarantined
    const retained = scenarioRecovery.retained + experimentRecovery.retained

    return {
      scenarios,
      experiments,
      quarantine,
      notice: quarantineNotice(quarantined, retained),
    }
  } catch {
    const quarantine = await listQuarantineSummaries().catch(() => [])
    return {
      scenarios: [],
      experiments: [],
      quarantine,
      notice: {
        level: 'warning',
        message: 'Lab data could not be read, so the local experiment library was reset for this session.',
      },
    }
  }
}

export async function saveScenarioRecord(scenario: ScenarioDefinition): Promise<void> {
  await idbKeyval.set(scenario.id, wrapPayload(normalizeScenarioDefinition(scenario)), SCENARIO_STORE)
}

export async function deleteScenarioRecord(scenarioId: string): Promise<void> {
  await idbKeyval.del(scenarioId, SCENARIO_STORE)
}

export async function saveExperimentRecord(experiment: SavedExperiment): Promise<void> {
  await idbKeyval.set(experiment.id, wrapPayload(experiment), EXPERIMENT_STORE)
}

export async function deleteExperimentRecord(experimentId: string): Promise<void> {
  await idbKeyval.del(experimentId, EXPERIMENT_STORE)
}

export async function restoreQuarantinedRecord(quarantineId: string): Promise<{
  ok: boolean
  notice: AppNotice
}> {
  const record = await idbKeyval.get<LabQuarantineRecord>(quarantineId, QUARANTINE_STORE)
  if (!isQuarantineRecord(record)) {
    return {
      ok: false,
      notice: {
        level: 'warning',
        message: 'The selected recovery record could not be found.',
      },
    }
  }

  const sourceStore = record.kind === 'scenario' ? SCENARIO_STORE : EXPERIMENT_STORE

  try {
    await idbKeyval.set(record.originalKey, record.rawRecord, sourceStore)
  } catch {
    return {
      ok: false,
      notice: {
        level: 'warning',
        message: 'The quarantined record could not be restored, so it remains in local recovery.',
      },
    }
  }

  try {
    await idbKeyval.del(quarantineId, QUARANTINE_STORE)
  } catch {
    return {
      ok: true,
      notice: {
        level: 'warning',
        message: 'The record was restored, but the recovery copy could not be removed.',
      },
    }
  }

  return {
    ok: true,
    notice: {
      level: 'info',
      message: `The quarantined ${record.kind} record was restored to the lab.`,
    },
  }
}

export async function buildLabQuarantineRecoveryArtifact(): Promise<LabQuarantineRecoveryArtifact> {
  const records = await listQuarantineRecords()
  return {
    recoveryType: LAB_QUARANTINE_RECOVERY_TYPE,
    recoverySchemaVersion: LAB_QUARANTINE_RECOVERY_VERSION,
    label: LAB_QUARANTINE_RECOVERY_LABEL,
    exportedAt: new Date().toISOString(),
    records: records.map((record) => ({
      ...toQuarantineSummary(record),
      rawRecord: cloneJsonSafe(record.rawRecord),
    })),
  }
}

export async function clearQuarantineRecords(): Promise<void> {
  await idbKeyval.clear(QUARANTINE_STORE)
}

export async function clearLabData(): Promise<void> {
  await Promise.all([
    idbKeyval.clear(SCENARIO_STORE).catch(() => undefined),
    idbKeyval.clear(EXPERIMENT_STORE).catch(() => undefined),
    idbKeyval.clear(QUARANTINE_STORE).catch(() => undefined),
  ])
}
