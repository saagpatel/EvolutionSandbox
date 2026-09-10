import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore, get, set } from 'idb-keyval'
import * as idbKeyval from 'idb-keyval'

import { DEFAULT_CONFIG, STORAGE_KEYS, STORAGE_SCHEMA_VERSION, SIM_RULESET_VERSION } from '@/domain/config'
import { createScenarioDraft } from '@/domain/scenarios'
import type { SavedExperiment } from '@/domain/types'
import {
  LAB_QUARANTINE_RECOVERY_LABEL,
  LAB_QUARANTINE_RECOVERY_TYPE,
  LAB_QUARANTINE_RECOVERY_VERSION,
  LAB_STORAGE_NAMES,
  buildLabQuarantineRecoveryArtifact,
  buildQuarantineId,
  clearLabData,
  clearQuarantineRecords,
  deleteExperimentRecord,
  deleteScenarioRecord,
  loadLabData,
  restoreQuarantinedRecord,
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

  it('keeps compatible lab records and quarantines incompatible originals', async () => {
    const incompatibleScenarioStore = createStore(LAB_STORAGE_NAMES.scenariosDb, LAB_STORAGE_NAMES.storeName)
    const incompatibleExperimentStore = createStore(LAB_STORAGE_NAMES.experimentsDb, LAB_STORAGE_NAMES.storeName)
    const quarantineStore = createStore(LAB_STORAGE_NAMES.quarantineDb, LAB_STORAGE_NAMES.storeName)
    const incompatibleScenario = {
      schemaVersion: 'legacy-schema',
      rulesetVersion: SIM_RULESET_VERSION,
      savedAt: new Date('2026-04-13T08:00:00.000Z').toISOString(),
      payload: {
        ...sampleScenario,
        id: 'legacy-scenario',
        name: 'PAYLOAD_SHOULD_NOT_RENDER_scenario',
      },
    }
    const incompatibleExperiment = {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      rulesetVersion: 'legacy-ruleset',
      savedAt: new Date('2026-04-13T08:00:00.000Z').toISOString(),
      payload: sampleExperiment,
    }

    await saveScenarioRecord(sampleScenario)
    await saveExperimentRecord(sampleExperiment)
    await set('legacy-scenario', incompatibleScenario, incompatibleScenarioStore)
    await set('legacy-experiment', incompatibleExperiment, incompatibleExperimentStore)

    const loaded = await loadLabData()
    expect(loaded.scenarios.map((scenario) => scenario.id)).toEqual([sampleScenario.id])
    expect(loaded.experiments.map((experiment) => experiment.id)).toEqual([sampleExperiment.id])
    expect(loaded.quarantine).toHaveLength(2)
    expect(loaded.notice?.level).toBe('warning')
    expect(loaded.notice?.message).toContain('moved to local recovery')
    expect(loaded.quarantine.map((entry) => entry.originalKey).sort()).toEqual(['legacy-experiment', 'legacy-scenario'])

    const quarantinedScenario = await get(buildQuarantineId('scenario', 'legacy-scenario'), quarantineStore)
    const quarantinedExperiment = await get(buildQuarantineId('experiment', 'legacy-experiment'), quarantineStore)
    expect(quarantinedScenario).toMatchObject({
      kind: 'scenario',
      originalKey: 'legacy-scenario',
      observedSchemaVersion: 'legacy-schema',
      observedRulesetVersion: SIM_RULESET_VERSION,
      originalSavedAt: incompatibleScenario.savedAt,
      rawRecord: incompatibleScenario,
    })
    expect(quarantinedExperiment).toMatchObject({
      kind: 'experiment',
      originalKey: 'legacy-experiment',
      observedSchemaVersion: STORAGE_SCHEMA_VERSION,
      observedRulesetVersion: 'legacy-ruleset',
      rawRecord: incompatibleExperiment,
    })
    expect(await get('legacy-scenario', incompatibleScenarioStore)).toBeUndefined()
    expect(await get('legacy-experiment', incompatibleExperimentStore)).toBeUndefined()

    const reloaded = await loadLabData()
    expect(reloaded.notice).toBeNull()
    expect(reloaded.quarantine).toHaveLength(2)
    expect(reloaded.quarantine.map((entry) => entry.id).sort()).toEqual(loaded.quarantine.map((entry) => entry.id).sort())
    expect(reloaded.quarantine.map((entry) => entry.quarantinedAt).sort()).toEqual(
      loaded.quarantine.map((entry) => entry.quarantinedAt).sort(),
    )
  })

  it('retains source records when quarantine write fails', async () => {
    const incompatibleScenarioStore = createStore(LAB_STORAGE_NAMES.scenariosDb, LAB_STORAGE_NAMES.storeName)
    const incompatibleRecord = {
      schemaVersion: 'legacy-schema',
      rulesetVersion: SIM_RULESET_VERSION,
      savedAt: new Date('2026-04-13T08:00:00.000Z').toISOString(),
      payload: sampleScenario,
    }
    await set('legacy-scenario', incompatibleRecord, incompatibleScenarioStore)

    const originalSet = idbKeyval.set.bind(idbKeyval)
    vi.spyOn(idbKeyval, 'set').mockImplementation(async (key, value, store) => {
      if (value && typeof value === 'object' && 'rawRecord' in value) {
        throw new Error('quota exceeded')
      }
      return originalSet(key, value, store)
    })

    const loaded = await loadLabData()
    expect(loaded.scenarios).toHaveLength(0)
    expect(loaded.quarantine).toHaveLength(0)
    expect(loaded.notice?.level).toBe('warning')
    expect(loaded.notice?.message).toContain('could not be moved to local recovery')
    expect(await get('legacy-scenario', incompatibleScenarioStore)).toEqual(incompatibleRecord)
  })

  it('restores a quarantined record to its original key and re-quarantines it on the next incompatible load', async () => {
    const scenarioStore = createStore(LAB_STORAGE_NAMES.scenariosDb, LAB_STORAGE_NAMES.storeName)
    const quarantineStore = createStore(LAB_STORAGE_NAMES.quarantineDb, LAB_STORAGE_NAMES.storeName)
    const incompatibleScenario = {
      schemaVersion: 'legacy-schema',
      rulesetVersion: SIM_RULESET_VERSION,
      savedAt: new Date('2026-04-13T08:00:00.000Z').toISOString(),
      payload: sampleScenario,
    }
    await set('legacy-scenario', incompatibleScenario, scenarioStore)

    const loaded = await loadLabData()
    const quarantineId = buildQuarantineId('scenario', 'legacy-scenario')
    expect(loaded.quarantine.map((entry) => entry.id)).toEqual([quarantineId])

    const restored = await restoreQuarantinedRecord(quarantineId)
    expect(restored.ok).toBe(true)
    expect(await get('legacy-scenario', scenarioStore)).toEqual(incompatibleScenario)
    expect(await get(quarantineId, quarantineStore)).toBeUndefined()

    const reloaded = await loadLabData()
    expect(reloaded.quarantine).toHaveLength(1)
    expect(reloaded.quarantine[0]?.originalKey).toBe('legacy-scenario')
    expect(await get('legacy-scenario', scenarioStore)).toBeUndefined()
    expect(await get(quarantineId, quarantineStore)).toMatchObject({
      rawRecord: incompatibleScenario,
    })
  })

  it('clears quarantine without deleting compatible lab records', async () => {
    const scenarioStore = createStore(LAB_STORAGE_NAMES.scenariosDb, LAB_STORAGE_NAMES.storeName)
    await saveScenarioRecord(sampleScenario)
    await saveExperimentRecord(sampleExperiment)
    await set(
      'legacy-scenario',
      {
        schemaVersion: 'legacy-schema',
        rulesetVersion: SIM_RULESET_VERSION,
        savedAt: new Date('2026-04-13T08:00:00.000Z').toISOString(),
        payload: sampleScenario,
      },
      scenarioStore,
    )

    await loadLabData()
    await clearQuarantineRecords()

    const loaded = await loadLabData()
    expect(loaded.quarantine).toHaveLength(0)
    expect(loaded.scenarios.map((scenario) => scenario.id)).toEqual([sampleScenario.id])
    expect(loaded.experiments.map((experiment) => experiment.id)).toEqual([sampleExperiment.id])
    expect(await get(sampleScenario.id, scenarioStore)).toBeTruthy()
  })

  it('exports a versioned local recovery envelope with JSON-safe raw records', async () => {
    const experimentStore = createStore(LAB_STORAGE_NAMES.experimentsDb, LAB_STORAGE_NAMES.storeName)
    const incompatibleExperiment = {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      rulesetVersion: 'legacy-ruleset',
      savedAt: new Date('2026-04-13T08:00:00.000Z').toISOString(),
      payload: sampleExperiment,
    }
    await set('legacy-experiment', incompatibleExperiment, experimentStore)
    await loadLabData()

    const artifact = await buildLabQuarantineRecoveryArtifact()
    expect(artifact.recoveryType).toBe(LAB_QUARANTINE_RECOVERY_TYPE)
    expect(artifact.recoverySchemaVersion).toBe(LAB_QUARANTINE_RECOVERY_VERSION)
    expect(artifact.label).toBe(LAB_QUARANTINE_RECOVERY_LABEL)
    expect(artifact).not.toHaveProperty('artifactType')
    expect(artifact.records).toHaveLength(1)
    expect(artifact.records[0]).toMatchObject({
      kind: 'experiment',
      originalKey: 'legacy-experiment',
      observedSchemaVersion: STORAGE_SCHEMA_VERSION,
      observedRulesetVersion: 'legacy-ruleset',
      originalSavedAt: incompatibleExperiment.savedAt,
      reason: expect.stringContaining('ruleset'),
      rawRecord: incompatibleExperiment,
    })
    expect(JSON.parse(JSON.stringify(artifact))).toEqual(artifact)
  })
})
