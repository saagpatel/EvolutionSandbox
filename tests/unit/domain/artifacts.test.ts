import { describe, expect, it } from 'vitest'

import {
  buildExperimentArtifact,
  buildScenarioArtifact,
  parseArtifactJson,
  serializeArtifact,
  validateExperimentArtifact,
  validateScenarioArtifact,
} from '@/domain/artifacts'
import { SIM_RULESET_VERSION } from '@/domain/config'
import { BUILT_IN_SCENARIOS, buildScenarioHash } from '@/domain/scenarios'
import { advanceRun, initializeRun } from '@/domain/sim'
import type { SavedExperiment } from '@/domain/types'

function createCompletedExperiment(): SavedExperiment {
  const scenario = BUILT_IN_SCENARIOS[0]!
  const run = advanceRun(initializeRun(scenario.baseConfig, scenario), scenario.baseConfig.generationTarget)

  return {
    id: 'experiment-artifact',
    name: 'Artifact baseline',
    note: 'Portable replay check',
    createdAt: new Date('2026-04-13T08:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-04-13T08:00:00.000Z').toISOString(),
    recipe: {
      scenario,
      config: scenario.baseConfig,
      seed: scenario.baseConfig.seed,
      rulesetVersion: SIM_RULESET_VERSION,
    },
    completedSummary: run.completedSummary!,
  }
}

describe('artifact contracts', () => {
  it('round-trips a scenario artifact through serialization and validation', () => {
    const scenario = BUILT_IN_SCENARIOS[0]!
    const serialized = serializeArtifact(buildScenarioArtifact(scenario))
    const parsed = parseArtifactJson(serialized)
    expect(parsed.ok).toBe(true)

    const validated = validateScenarioArtifact(parsed.ok ? parsed.value : null)
    expect(validated.ok).toBe(true)
    if (!validated.ok) {
      return
    }

    expect(validated.value.scenarioHash).toBe(buildScenarioHash(scenario))
    expect(validated.value.scenario.name).toBe(scenario.name)
    expect(validated.value.rulesetMatches).toBe(true)
  })

  it('round-trips an experiment artifact and preserves run identity', () => {
    const experiment = createCompletedExperiment()
    const serialized = serializeArtifact(buildExperimentArtifact(experiment))
    const parsed = parseArtifactJson(serialized)
    expect(parsed.ok).toBe(true)

    const validated = validateExperimentArtifact(parsed.ok ? parsed.value : null)
    expect(validated.ok).toBe(true)
    if (!validated.ok) {
      return
    }

    expect(validated.value.runHash).toBe(experiment.completedSummary.runHash)
    expect(validated.value.completedSummary.runHash).toBe(experiment.completedSummary.runHash)
    expect(validated.value.recipe.rulesetVersion).toBe(SIM_RULESET_VERSION)
  })

  it('rejects malformed artifacts with a warning notice', () => {
    const malformed = parseArtifactJson('{"artifactType":"scenario"}')
    expect(malformed.ok).toBe(true)

    const validated = validateScenarioArtifact(malformed.ok ? malformed.value : null)
    expect(validated.ok).toBe(false)
    if (validated.ok) {
      return
    }

    expect(validated.notice.level).toBe('warning')
  })
})
