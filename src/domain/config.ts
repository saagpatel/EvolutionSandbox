import type { PressureKey, PressureValues, SimulationConfig, TraitKey, TraitValues } from '@/domain/types'

export const APP_TITLE = 'Evolution Sandbox'
export const SIM_RULESET_VERSION = 'v2.1.0'
export const STORAGE_SCHEMA_VERSION = 'v2'
export const ARTIFACT_SCHEMA_VERSION = 'a1'

export const PRESSURE_MIN = 0
export const PRESSURE_MAX = 1
export const MUTATION_RATE_MIN = 0.005
export const MUTATION_RATE_MAX = 0.08
export const STARTING_POPULATION_MIN = 100
export const STARTING_POPULATION_MAX = 1000
export const GENERATION_TARGET_MIN = 25
export const GENERATION_TARGET_MAX = 200
export const HISTOGRAM_BUCKETS = 10
export const SCENARIO_EVENT_LIMIT = 6

export const STORAGE_KEYS = {
  settings: 'evolution-sandbox:settings',
} as const

export const TRAIT_LABELS: Record<TraitKey, string> = {
  size: 'Size',
  speed: 'Speed',
  camouflage: 'Camouflage',
  energyEfficiency: 'Energy Efficiency',
}

export const PRESSURE_LABELS: Record<PressureKey, string> = {
  foodScarcity: 'Food Scarcity',
  predationPressure: 'Predation Pressure',
  coldStress: 'Cold Stress',
  habitatVisibility: 'Habitat Visibility',
}

export const DEFAULT_CONFIG: SimulationConfig = {
  seed: 58214021,
  scenarioId: 'balanced-world',
  foodScarcity: 0.4,
  predationPressure: 0.38,
  coldStress: 0.32,
  habitatVisibility: 0.42,
  mutationRate: 0.02,
  startingPopulation: 400,
  generationTarget: 80,
}

export const EMPTY_TRAIT_VALUES: TraitValues = {
  size: 0,
  speed: 0,
  camouflage: 0,
  energyEfficiency: 0,
}

export const EMPTY_PRESSURE_VALUES: PressureValues = {
  foodScarcity: 0,
  predationPressure: 0,
  coldStress: 0,
  habitatVisibility: 0,
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

export function roundTo(value: number, places = 3): number {
  const multiplier = 10 ** places
  return Math.round(value * multiplier) / multiplier
}

export function normalizeConfig(input: Partial<SimulationConfig>): SimulationConfig {
  const merged = { ...DEFAULT_CONFIG, ...input }

  return {
    seed: Math.abs(Math.floor(merged.seed)) || DEFAULT_CONFIG.seed,
    scenarioId: merged.scenarioId || DEFAULT_CONFIG.scenarioId,
    foodScarcity: roundTo(clamp(merged.foodScarcity, PRESSURE_MIN, PRESSURE_MAX)),
    predationPressure: roundTo(clamp(merged.predationPressure, PRESSURE_MIN, PRESSURE_MAX)),
    coldStress: roundTo(clamp(merged.coldStress, PRESSURE_MIN, PRESSURE_MAX)),
    habitatVisibility: roundTo(clamp(merged.habitatVisibility, PRESSURE_MIN, PRESSURE_MAX)),
    mutationRate: roundTo(clamp(merged.mutationRate, MUTATION_RATE_MIN, MUTATION_RATE_MAX), 4),
    startingPopulation: clamp(Math.round(merged.startingPopulation), STARTING_POPULATION_MIN, STARTING_POPULATION_MAX),
    generationTarget: clamp(Math.round(merged.generationTarget), GENERATION_TARGET_MIN, GENERATION_TARGET_MAX),
  }
}

export function toPercent(value: number): number {
  return Math.round(value * 100)
}

export function fromPercent(value: number): number {
  return roundTo(clamp(value / 100, 0, 1))
}
