import { DEFAULT_CONFIG, SCENARIO_EVENT_LIMIT, clamp, normalizeConfig, roundTo } from '@/domain/config'
import { hashStable } from '@/domain/hash'
import { PRESSURE_KEYS } from '@/domain/types'
import type { PressureOverrides, PressureValues, ScenarioDefinition, ScenarioEvent, SimulationConfig } from '@/domain/types'

function createTimestamp(offsetMinutes = 0): string {
  return new Date(Date.UTC(2026, 3, 13, 8, offsetMinutes, 0)).toISOString()
}

function normalizeOverrides(overrides: PressureOverrides): PressureOverrides {
  const normalized: PressureOverrides = {}

  for (const pressure of PRESSURE_KEYS) {
    const value = overrides[pressure]
    if (typeof value === 'number') {
      normalized[pressure] = roundTo(clamp(value, 0, 1))
    }
  }

  return normalized
}

export function normalizeScenarioEvent(event: ScenarioEvent, generationTarget: number): ScenarioEvent {
  return {
    id: event.id,
    generationIndex: clamp(Math.round(event.generationIndex), 1, generationTarget),
    label: event.label.trim() || 'Scenario change',
    description: event.description.trim() || 'The environment shifts at this generation.',
    pressureOverrides: normalizeOverrides(event.pressureOverrides),
  }
}

function uniqueEvents(events: ScenarioEvent[]): ScenarioEvent[] {
  const byGeneration = new Map<number, ScenarioEvent>()
  for (const event of events) {
    byGeneration.set(event.generationIndex, event)
  }
  return [...byGeneration.values()]
}

export function normalizeScenarioDefinition(input: ScenarioDefinition): ScenarioDefinition {
  const baseConfig = normalizeConfig({
    ...input.baseConfig,
    scenarioId: input.id,
  })
  const normalizedEvents = uniqueEvents(
    input.events
      .map((event) => normalizeScenarioEvent(event, baseConfig.generationTarget))
      .sort((left, right) => left.generationIndex - right.generationIndex)
      .slice(0, SCENARIO_EVENT_LIMIT),
  )

  return {
    ...input,
    id: input.id.trim() || crypto.randomUUID(),
    name: input.name.trim() || 'Untitled Scenario',
    description: input.description.trim() || 'A custom experiment scenario.',
    baseConfig,
    events: normalizedEvents,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  }
}

function baseBehaviorShape(config: SimulationConfig) {
  return {
    foodScarcity: config.foodScarcity,
    predationPressure: config.predationPressure,
    coldStress: config.coldStress,
    habitatVisibility: config.habitatVisibility,
    mutationRate: config.mutationRate,
    startingPopulation: config.startingPopulation,
    generationTarget: config.generationTarget,
  }
}

export function buildScenarioHash(scenario: ScenarioDefinition): string {
  const normalized = normalizeScenarioDefinition(scenario)
  return hashStable({
    baseConfig: baseBehaviorShape(normalized.baseConfig),
    events: normalized.events.map((event) => ({
      generationIndex: event.generationIndex,
      pressureOverrides: normalizeOverrides(event.pressureOverrides),
    })),
  })
}

function makeBuiltInScenario(
  input: Omit<ScenarioDefinition, 'isBuiltIn' | 'createdAt' | 'updatedAt'>,
  offsetMinutes: number,
): ScenarioDefinition {
  return normalizeScenarioDefinition({
    ...input,
    isBuiltIn: true,
    createdAt: createTimestamp(offsetMinutes),
    updatedAt: createTimestamp(offsetMinutes),
  })
}

export const BUILT_IN_SCENARIOS: ScenarioDefinition[] = [
  makeBuiltInScenario(
    {
      id: 'balanced-world',
      name: 'Balanced World',
      description: 'Stable baseline with room for several traits to matter.',
      baseConfig: {
        ...DEFAULT_CONFIG,
        scenarioId: 'balanced-world',
      },
      events: [],
    },
    0,
  ),
  makeBuiltInScenario(
    {
      id: 'scarcity-crunch',
      name: 'Scarcity Crunch',
      description: 'Food becomes the dominant filter and body cost starts to hurt.',
      baseConfig: {
        ...DEFAULT_CONFIG,
        scenarioId: 'scarcity-crunch',
        seed: 18024017,
        foodScarcity: 0.85,
        predationPressure: 0.24,
        coldStress: 0.22,
        habitatVisibility: 0.24,
      },
      events: [],
    },
    1,
  ),
  makeBuiltInScenario(
    {
      id: 'predator-surge',
      name: 'Predator Surge',
      description: 'Speed and camouflage matter more when escape pressure spikes.',
      baseConfig: {
        ...DEFAULT_CONFIG,
        scenarioId: 'predator-surge',
        seed: 74185296,
        foodScarcity: 0.28,
        predationPressure: 0.85,
        coldStress: 0.18,
        habitatVisibility: 0.48,
      },
      events: [],
    },
    2,
  ),
  makeBuiltInScenario(
    {
      id: 'exposed-habitat',
      name: 'Exposed Habitat',
      description: 'Visibility punishes obvious bodies and rewards blending in.',
      baseConfig: {
        ...DEFAULT_CONFIG,
        scenarioId: 'exposed-habitat',
        seed: 96245183,
        foodScarcity: 0.38,
        predationPressure: 0.34,
        coldStress: 0.18,
        habitatVisibility: 0.92,
      },
      events: [],
    },
    3,
  ),
  makeBuiltInScenario(
    {
      id: 'cold-snap',
      name: 'Cold Snap',
      description: 'Cold stress pushes the population toward heat retention and thrift.',
      baseConfig: {
        ...DEFAULT_CONFIG,
        scenarioId: 'cold-snap',
        seed: 31415926,
        foodScarcity: 0.48,
        predationPressure: 0.18,
        coldStress: 0.92,
        habitatVisibility: 0.18,
      },
      events: [],
    },
    4,
  ),
  makeBuiltInScenario(
    {
      id: 'predator-pulse',
      name: 'Predator Pulse',
      description: 'A calm world gets hit by a sharp predator spike before cover returns.',
      baseConfig: {
        ...DEFAULT_CONFIG,
        scenarioId: 'predator-pulse',
        seed: 84320511,
        foodScarcity: 0.26,
        predationPressure: 0.38,
        coldStress: 0.28,
        habitatVisibility: 0.42,
      },
      events: [
        {
          id: 'predator-pulse-1',
          generationIndex: 16,
          label: 'Predator Pulse',
          description: 'Predation spikes and the habitat becomes more exposed.',
          pressureOverrides: {
            predationPressure: 0.96,
            habitatVisibility: 0.8,
          },
        },
        {
          id: 'predator-pulse-2',
          generationIndex: 36,
          label: 'Shelter Returns',
          description: 'Cover improves and the predator pulse tapers off.',
          pressureOverrides: {
            predationPressure: 0.58,
            habitatVisibility: 0.52,
          },
        },
      ],
    },
    5,
  ),
  makeBuiltInScenario(
    {
      id: 'cold-snap-recovery',
      name: 'Cold Snap Recovery',
      description: 'A sudden freeze squeezes the population before a warmer recovery period settles in.',
      baseConfig: {
        ...DEFAULT_CONFIG,
        scenarioId: 'cold-snap-recovery',
        seed: 66022418,
        foodScarcity: 0.42,
        predationPressure: 0.2,
        coldStress: 0.38,
        habitatVisibility: 0.22,
      },
      events: [
        {
          id: 'cold-snap-recovery-1',
          generationIndex: 14,
          label: 'Cold Snap',
          description: 'Cold stress spikes and a lean winter squeezes the population.',
          pressureOverrides: {
            predationPressure: 0.18,
            coldStress: 0.96,
            foodScarcity: 0.72,
            habitatVisibility: 0.2,
          },
        },
        {
          id: 'cold-snap-recovery-2',
          generationIndex: 38,
          label: 'Warmer Recovery',
          description: 'The climate softens and food pressure eases enough for a recovery run.',
          pressureOverrides: {
            predationPressure: 0.18,
            coldStress: 0.1,
            foodScarcity: 0.22,
            habitatVisibility: 0.24,
          },
        },
      ],
    },
    6,
  ),
]

export function getScenarioById(scenarioId: string, customScenarios: ScenarioDefinition[] = []): ScenarioDefinition {
  const scenario = [...BUILT_IN_SCENARIOS, ...customScenarios].find((candidate) => candidate.id === scenarioId)
  return scenario ?? BUILT_IN_SCENARIOS[0]!
}

export function createScenarioDraft(name = 'New Scenario'): ScenarioDefinition {
  const timestamp = new Date().toISOString()
  const id = `scenario-${crypto.randomUUID().slice(0, 8)}`

  return normalizeScenarioDefinition({
    id,
    name,
    description: 'A custom scenario for repeatable local experiments.',
    baseConfig: {
      ...DEFAULT_CONFIG,
      scenarioId: id,
      seed: Math.floor(Math.random() * 2 ** 32),
    },
    events: [],
    isBuiltIn: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}

export function duplicateScenario(source: ScenarioDefinition): ScenarioDefinition {
  const timestamp = new Date().toISOString()
  const id = `scenario-${crypto.randomUUID().slice(0, 8)}`

  return normalizeScenarioDefinition({
    ...source,
    id,
    name: `${source.name} Copy`,
    baseConfig: {
      ...source.baseConfig,
      scenarioId: id,
    },
    events: source.events.map((event) => ({
      ...event,
      id: `event-${crypto.randomUUID().slice(0, 8)}`,
    })),
    isBuiltIn: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}

export function resolveAppliedPressures(
  config: SimulationConfig,
  events: ScenarioEvent[],
  generationIndex: number,
): PressureValues {
  const applied: PressureValues = {
    foodScarcity: config.foodScarcity,
    predationPressure: config.predationPressure,
    coldStress: config.coldStress,
    habitatVisibility: config.habitatVisibility,
  }

  for (const event of events) {
    if (event.generationIndex > generationIndex) {
      break
    }

    for (const pressure of PRESSURE_KEYS) {
      const override = event.pressureOverrides[pressure]
      if (typeof override === 'number') {
        applied[pressure] = override
      }
    }
  }

  return applied
}

export function getTriggeredScenarioEvent(events: ScenarioEvent[], generationIndex: number): ScenarioEvent | null {
  return events.find((event) => event.generationIndex === generationIndex) ?? null
}

export function getActiveScenarioEvent(events: ScenarioEvent[], generationIndex: number): ScenarioEvent | null {
  const active = events.filter((event) => event.generationIndex <= generationIndex).at(-1)
  return active ?? null
}
