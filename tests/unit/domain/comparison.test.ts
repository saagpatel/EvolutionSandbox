import { describe, expect, it } from 'vitest'

import { SIM_RULESET_VERSION, STORAGE_SCHEMA_VERSION } from '@/domain/config'
import { buildComparisonSummary } from '@/domain/comparison'
import type { CompletedRunSummary } from '@/domain/types'

const baseSummary: CompletedRunSummary = {
  rulesetVersion: SIM_RULESET_VERSION,
  storageSchemaVersion: STORAGE_SCHEMA_VERSION,
  configHash: 'cfg-hash',
  scenarioHash: 'scenario-hash',
  seed: 12345,
  scenarioId: 'balanced-world',
  scenarioName: 'Balanced World',
  finalGeneration: 80,
  finalPopulationSize: 400,
  finalMeanTraits: {
    size: 0.5,
    speed: 0.5,
    camouflage: 0.5,
    energyEfficiency: 0.5,
  },
  populationCurve: [400],
  survivalCurve: [0.6],
  diversityCurve: [0.55],
  dominantPhenotypeCurve: [0.16],
  meanTraitCurves: {
    size: [0.5],
    speed: [0.5],
    camouflage: [0.5],
    energyEfficiency: [0.5],
  },
  finalSummary: ['Balanced.'],
  runHash: 'run-hash',
}

describe('comparison summary', () => {
  it('uses steady-language when two completed runs are effectively identical', () => {
    const comparison = buildComparisonSummary(baseSummary, baseSummary)

    expect(comparison.summaryText).toContain('held steady')
    expect(comparison.summaryText).toContain('stayed effectively unchanged')
    expect(comparison.summaryText).toContain('direct replay check')
  })

  it('distinguishes same-scenario reruns from changed recipes', () => {
    const changedConfigSummary: CompletedRunSummary = {
      ...baseSummary,
      configHash: 'cfg-hash-2',
    }

    const comparison = buildComparisonSummary(changedConfigSummary, baseSummary)

    expect(comparison.summaryText).toContain('same seed')
    expect(comparison.summaryText).toContain('different world settings')
  })
})
