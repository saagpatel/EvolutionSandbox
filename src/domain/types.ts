export const TRAIT_KEYS = ['size', 'speed', 'camouflage', 'energyEfficiency'] as const
export const PRESSURE_KEYS = ['foodScarcity', 'predationPressure', 'coldStress', 'habitatVisibility'] as const
export const EVENT_FLAGS = ['bottleneck', 'recovery', 'lowDiversity', 'diversityRecovery', 'extinction'] as const

export type TraitKey = (typeof TRAIT_KEYS)[number]
export type PressureKey = (typeof PRESSURE_KEYS)[number]
export type EventFlag = (typeof EVENT_FLAGS)[number]
export type RunStatus = 'idle' | 'running' | 'paused' | 'completed'
export type AppSurface = 'sandbox' | 'scenarios' | 'lab'
export type ArtifactType = 'scenario' | 'experiment'
export type ImportReviewAction = 'import' | 'dedupe' | 'blocked'
export type QuickstartAction =
  | 'loadBalancedWorld'
  | 'runCurrentScenario'
  | 'saveBaseline'
  | 'loadPredatorPulse'
  | 'compareBaseline'
  | 'openLab'

export type TraitValues = Record<TraitKey, number>
export type PressureValues = Record<PressureKey, number>
export type PressureOverrides = Partial<PressureValues>

export interface SimulationConfig {
  seed: number
  scenarioId: string
  foodScarcity: number
  predationPressure: number
  coldStress: number
  habitatVisibility: number
  mutationRate: number
  startingPopulation: number
  generationTarget: number
}

export interface ScenarioEvent {
  id: string
  generationIndex: number
  label: string
  description: string
  pressureOverrides: PressureOverrides
}

export interface ScenarioDefinition {
  id: string
  name: string
  description: string
  baseConfig: SimulationConfig
  events: ScenarioEvent[]
  isBuiltIn: boolean
  createdAt: string
  updatedAt: string
}

export interface RunRecipe {
  scenario: ScenarioDefinition
  config: SimulationConfig
  seed: number
  rulesetVersion: string
}

export interface PressureImpact {
  ranking: Array<{ pressure: PressureKey; intensity: number }>
  rewardedTraits: TraitKey[]
  penalizedTraits: TraitKey[]
}

export interface Creature extends TraitValues {
  id: string
  parentId: string | null
  generationBorn: number
  currentSurvivalScore: number
  currentSurvivalProbability: number
  pressureEffects: PressureValues
}

export interface GenerationSnapshot {
  generationIndex: number
  populationSize: number
  survivalRate: number
  diversityScore: number
  dominantPhenotypeShare: number
  phenotypeBucketCount: number
  meanTraitValues: TraitValues
  traitDistributions: Record<TraitKey, number[]>
  summaryText: string[]
  eventFlags: EventFlag[]
  creatures: Creature[]
  pressureImpact: PressureImpact
  appliedPressures: PressureValues
  triggeredScenarioEvent: ScenarioEvent | null
  activeScenarioEvent: ScenarioEvent | null
}

export interface RunRecord {
  config: SimulationConfig
  scenario: ScenarioDefinition
  seed: number
  rulesetVersion: string
  configHash: string
  scenarioHash: string
  snapshots: GenerationSnapshot[]
  completed: boolean
  nextCreatureId: number
  rngState: number
  completedSummary: CompletedRunSummary | null
}

export interface CompletedRunSummary {
  rulesetVersion: string
  storageSchemaVersion: string
  configHash: string
  scenarioHash: string
  seed: number
  scenarioId: string
  scenarioName: string
  finalGeneration: number
  finalPopulationSize: number
  finalMeanTraits: TraitValues
  populationCurve: number[]
  survivalCurve: number[]
  diversityCurve: number[]
  dominantPhenotypeCurve: number[]
  meanTraitCurves: Record<TraitKey, number[]>
  finalSummary: string[]
  runHash: string
}

export interface SavedExperiment {
  id: string
  name: string
  note: string
  createdAt: string
  updatedAt: string
  recipe: RunRecipe
  completedSummary: CompletedRunSummary
}

export interface ScenarioArtifact {
  artifactType: 'scenario'
  artifactSchemaVersion: string
  appRulesetVersion: string
  exportedAt: string
  payload: {
    scenario: ScenarioDefinition
  }
}

export interface ExperimentArtifact {
  artifactType: 'experiment'
  artifactSchemaVersion: string
  appRulesetVersion: string
  exportedAt: string
  payload: {
    name: string
    note: string
    recipe: RunRecipe
    completedSummary: CompletedRunSummary
  }
}

export type PortableArtifact = ScenarioArtifact | ExperimentArtifact

export interface ComparisonSummary {
  finalPopulationDelta: number
  meanTraitDeltas: TraitValues
  biggestWinnerTrait: TraitKey
  biggestLoserTrait: TraitKey
  survivalCurveDelta: number
  summaryText: string
}

export interface StoredSettings {
  rulesetVersion: string
  selectedScenarioId: string
  baselineExperimentId: string | null
  surface: AppSurface
  config: SimulationConfig
}

export interface AppNotice {
  level: 'info' | 'warning'
  message: string
}

export interface PersistedPayload<T> {
  schemaVersion: string
  rulesetVersion: string
  savedAt: string
  payload: T
}

export interface Announcement {
  id: string
  message: string
}

export interface QuickstartState {
  dismissed: boolean
}

export interface QuickstartStep {
  title: string
  description: string
  actionLabel: string
  action: QuickstartAction
}

export interface ArtifactImportReview {
  kind: ArtifactType
  fileName: string
  fileSizeLabel: string
  title: string
  summary: string
  details: string[]
  warnings: string[]
  action: ImportReviewAction
  actionLabel: string
  canImport: boolean
}
