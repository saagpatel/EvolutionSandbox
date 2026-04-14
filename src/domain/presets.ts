import { BUILT_IN_SCENARIOS, getScenarioById } from '@/domain/scenarios'
import type { ScenarioDefinition, SimulationConfig } from '@/domain/types'

export interface PresetDefinition {
  id: string
  name: string
  description: string
  config: SimulationConfig
}

export const PRESETS: PresetDefinition[] = BUILT_IN_SCENARIOS.map((scenario) => ({
  id: scenario.id,
  name: scenario.name,
  description: scenario.description,
  config: scenario.baseConfig,
}))

export function getPresetById(presetId: string): PresetDefinition {
  const scenario = getScenarioById(presetId)
  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    config: scenario.baseConfig,
  }
}

export function presetToScenario(presetId: string): ScenarioDefinition {
  return getScenarioById(presetId)
}
