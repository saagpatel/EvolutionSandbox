import { ARTIFACT_SCHEMA_VERSION, SIM_RULESET_VERSION, STORAGE_SCHEMA_VERSION, normalizeConfig } from '@/domain/config'
import { buildScenarioHash, normalizeScenarioDefinition } from '@/domain/scenarios'
import type {
  AppNotice,
  CompletedRunSummary,
  ExperimentArtifact,
  PortableArtifact,
  RunRecipe,
  SavedExperiment,
  ScenarioArtifact,
  ScenarioDefinition,
  SimulationConfig,
  TraitValues,
} from '@/domain/types'

export const MAX_ARTIFACT_BYTES = 512 * 1024

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; notice: AppNotice }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function invalidArtifact(message: string): ValidationResult<never> {
  return {
    ok: false,
    notice: {
      level: 'warning',
      message,
    },
  }
}

function validateTraitValues(value: unknown): value is TraitValues {
  return (
    isRecord(value) &&
    isNumber(value.size) &&
    isNumber(value.speed) &&
    isNumber(value.camouflage) &&
    isNumber(value.energyEfficiency)
  )
}

function validateTraitCurves(value: unknown): boolean {
  return (
    isRecord(value) &&
    Array.isArray(value.size) &&
    Array.isArray(value.speed) &&
    Array.isArray(value.camouflage) &&
    Array.isArray(value.energyEfficiency)
  )
}

function validateConfig(value: unknown): value is SimulationConfig {
  return (
    isRecord(value) &&
    isNumber(value.seed) &&
    isString(value.scenarioId) &&
    isNumber(value.foodScarcity) &&
    isNumber(value.predationPressure) &&
    isNumber(value.coldStress) &&
    isNumber(value.habitatVisibility) &&
    isNumber(value.mutationRate) &&
    isNumber(value.startingPopulation) &&
    isNumber(value.generationTarget)
  )
}

function validateScenario(value: unknown): value is ScenarioDefinition {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.description) &&
    validateConfig(value.baseConfig) &&
    Array.isArray(value.events) &&
    typeof value.isBuiltIn === 'boolean' &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  )
}

function validateCompletedSummary(value: unknown): value is CompletedRunSummary {
  return (
    isRecord(value) &&
    isString(value.rulesetVersion) &&
    isString(value.storageSchemaVersion) &&
    isString(value.configHash) &&
    isString(value.scenarioHash) &&
    isNumber(value.seed) &&
    isString(value.scenarioId) &&
    isString(value.scenarioName) &&
    isNumber(value.finalGeneration) &&
    isNumber(value.finalPopulationSize) &&
    validateTraitValues(value.finalMeanTraits) &&
    Array.isArray(value.populationCurve) &&
    Array.isArray(value.survivalCurve) &&
    Array.isArray(value.diversityCurve) &&
    Array.isArray(value.dominantPhenotypeCurve) &&
    validateTraitCurves(value.meanTraitCurves) &&
    Array.isArray(value.finalSummary) &&
    value.finalSummary.every(isString) &&
    isString(value.runHash)
  )
}

function validateRunRecipe(value: unknown): value is RunRecipe {
  return (
    isRecord(value) &&
    validateScenario(value.scenario) &&
    validateConfig(value.config) &&
    isNumber(value.seed) &&
    isString(value.rulesetVersion)
  )
}

export function buildScenarioArtifact(scenario: ScenarioDefinition): ScenarioArtifact {
  return {
    artifactType: 'scenario',
    artifactSchemaVersion: ARTIFACT_SCHEMA_VERSION,
    appRulesetVersion: SIM_RULESET_VERSION,
    exportedAt: new Date().toISOString(),
    payload: {
      scenario: normalizeScenarioDefinition(scenario),
    },
  }
}

export function buildExperimentArtifact(experiment: SavedExperiment): ExperimentArtifact {
  return {
    artifactType: 'experiment',
    artifactSchemaVersion: ARTIFACT_SCHEMA_VERSION,
    appRulesetVersion: SIM_RULESET_VERSION,
    exportedAt: new Date().toISOString(),
    payload: {
      name: experiment.name,
      note: experiment.note,
      recipe: {
        ...experiment.recipe,
        scenario: normalizeScenarioDefinition(experiment.recipe.scenario),
        config: normalizeConfig(experiment.recipe.config),
      },
      completedSummary: experiment.completedSummary,
    },
  }
}

export function serializeArtifact(artifact: PortableArtifact): string {
  return JSON.stringify(artifact, null, 2)
}

export function parseArtifactJson(raw: string): ValidationResult<unknown> {
  try {
    return {
      ok: true,
      value: JSON.parse(raw) as unknown,
    }
  } catch {
    return invalidArtifact('The selected file could not be read as valid JSON.')
  }
}

function validateArtifactEnvelope(value: unknown): value is PortableArtifact {
  return (
    isRecord(value) &&
    (value.artifactType === 'scenario' || value.artifactType === 'experiment') &&
    isString(value.artifactSchemaVersion) &&
    isString(value.appRulesetVersion) &&
    isString(value.exportedAt) &&
    isRecord(value.payload)
  )
}

export function validateScenarioArtifact(value: unknown): ValidationResult<{
  artifact: ScenarioArtifact
  scenario: ScenarioDefinition
  scenarioHash: string
  rulesetMatches: boolean
}> {
  if (!validateArtifactEnvelope(value) || value.artifactType !== 'scenario') {
    return invalidArtifact('This file is not a valid scenario artifact.')
  }

  if (value.artifactSchemaVersion !== ARTIFACT_SCHEMA_VERSION) {
    return invalidArtifact('This scenario file uses an unsupported artifact format.')
  }

  const scenario = value.payload.scenario
  if (!validateScenario(scenario)) {
    return invalidArtifact('This scenario file is missing required scenario data.')
  }

  const normalizedScenario = normalizeScenarioDefinition({
    ...scenario,
    isBuiltIn: false,
    baseConfig: {
      ...normalizeConfig(scenario.baseConfig),
      scenarioId: scenario.id,
    },
  })

  return {
    ok: true,
    value: {
      artifact: value,
      scenario: normalizedScenario,
      scenarioHash: buildScenarioHash(normalizedScenario),
      rulesetMatches: value.appRulesetVersion === SIM_RULESET_VERSION,
    },
  }
}

export function validateExperimentArtifact(value: unknown): ValidationResult<{
  artifact: ExperimentArtifact
  recipe: RunRecipe
  completedSummary: CompletedRunSummary
  scenarioHash: string
  runHash: string
}> {
  if (!validateArtifactEnvelope(value) || value.artifactType !== 'experiment') {
    return invalidArtifact('This file is not a valid experiment artifact.')
  }

  if (value.artifactSchemaVersion !== ARTIFACT_SCHEMA_VERSION) {
    return invalidArtifact('This experiment file uses an unsupported artifact format.')
  }

  if (value.appRulesetVersion !== SIM_RULESET_VERSION) {
    return invalidArtifact('This experiment file was created under a different simulation ruleset and cannot be replayed safely.')
  }

  if (!isString(value.payload.name) || !isString(value.payload.note)) {
    return invalidArtifact('This experiment file is missing its name or note fields.')
  }

  if (!validateRunRecipe(value.payload.recipe)) {
    return invalidArtifact('This experiment file is missing a valid deterministic replay recipe.')
  }

  if (!validateCompletedSummary(value.payload.completedSummary)) {
    return invalidArtifact('This experiment file is missing a valid completed-run summary.')
  }

  if (
    value.payload.recipe.rulesetVersion !== SIM_RULESET_VERSION ||
    value.payload.completedSummary.rulesetVersion !== SIM_RULESET_VERSION ||
    value.payload.completedSummary.storageSchemaVersion !== STORAGE_SCHEMA_VERSION
  ) {
    return invalidArtifact('This experiment file is not compatible with the current replay contract.')
  }

  const recipe: RunRecipe = {
    ...value.payload.recipe,
    scenario: normalizeScenarioDefinition({
      ...value.payload.recipe.scenario,
      isBuiltIn: false,
      baseConfig: {
        ...normalizeConfig(value.payload.recipe.scenario.baseConfig),
        scenarioId: value.payload.recipe.scenario.id,
      },
    }),
    config: normalizeConfig(value.payload.recipe.config),
  }

  return {
    ok: true,
    value: {
      artifact: value,
      recipe,
      completedSummary: value.payload.completedSummary,
      scenarioHash: buildScenarioHash(recipe.scenario),
      runHash: value.payload.completedSummary.runHash,
    },
  }
}
