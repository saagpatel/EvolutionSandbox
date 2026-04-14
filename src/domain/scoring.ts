import { EMPTY_PRESSURE_VALUES, EMPTY_TRAIT_VALUES, clamp01 } from '@/domain/config'
import type { Creature, PressureKey, PressureValues, TraitKey, TraitValues } from '@/domain/types'

const PRESSURE_TRAIT_WEIGHTS: Record<PressureKey, Partial<Record<TraitKey, number>>> = {
  foodScarcity: {
    energyEfficiency: 1.08,
    size: -1.08,
    speed: -0.35,
    camouflage: -0.18,
  },
  predationPressure: {
    speed: 1.15,
    camouflage: 0.92,
    size: -0.35,
    energyEfficiency: -0.08,
  },
  coldStress: {
    size: 0.95,
    energyEfficiency: 0.48,
    speed: -0.28,
    camouflage: -0.24,
  },
  habitatVisibility: {
    camouflage: 1.35,
    size: -0.38,
    speed: -0.08,
  },
}

function responseCurve(value: number): number {
  return Math.tanh((value - 0.5) * 2.4)
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value))
}

export interface ScoreResult {
  baseScore: number
  pressureEffects: PressureValues
  traitEffects: TraitValues
}

export function scoreCreature(
  creature: Pick<Creature, TraitKey>,
  pressures: PressureValues,
  noise: number,
): ScoreResult {
  const pressureEffects: PressureValues = { ...EMPTY_PRESSURE_VALUES }
  const traitEffects: TraitValues = { ...EMPTY_TRAIT_VALUES }

  for (const [pressure, intensity] of Object.entries(pressures) as Array<[PressureKey, number]>) {
    const traitWeights = PRESSURE_TRAIT_WEIGHTS[pressure]
    let pressureScore = 0

    for (const [trait, weight] of Object.entries(traitWeights) as Array<[TraitKey, number]>) {
      const traitContribution = responseCurve(creature[trait]) * weight * intensity
      traitEffects[trait] += traitContribution
      pressureScore += traitContribution
    }

    pressureEffects[pressure] = pressureScore
  }

  const maintenancePenalty = Math.max(0, creature.size + creature.speed - creature.energyEfficiency - 1.05) * 0.32
  const stealthTradeoffPenalty = Math.max(0, creature.size + creature.camouflage - 1.3) * pressures.habitatVisibility * 0.12
  const concealmentUpkeepPenalty =
    Math.max(0, creature.camouflage - creature.energyEfficiency - 0.08) *
    (0.06 + pressures.foodScarcity * 0.12 + pressures.coldStress * 0.08)
  const baseScore =
    Object.values(pressureEffects).reduce((sum, value) => sum + value, 0) -
    maintenancePenalty -
    stealthTradeoffPenalty +
    concealmentUpkeepPenalty * -1 +
    noise

  return {
    baseScore,
    pressureEffects,
    traitEffects,
  }
}

export function scoreToSurvivalProbability(score: number): number {
  return clamp01(0.05 + sigmoid(score * 1.35) * 0.9)
}

export function buildPressureImpact(
  pressureTotals: PressureValues,
  traitTotals: TraitValues,
  populationSize: number,
) {
  const safePopulation = Math.max(populationSize, 1)
  const ranking = (Object.entries(pressureTotals) as Array<[PressureKey, number]>)
    .map(([pressure, total]) => ({
      pressure,
      intensity: Math.abs(total / safePopulation),
    }))
    .sort((left, right) => right.intensity - left.intensity)

  const traitEntries = (Object.entries(traitTotals) as Array<[TraitKey, number]>).map(([trait, total]) => ({
    trait,
    mean: total / safePopulation,
  }))

  const rewardedTraits = [...traitEntries]
    .sort((left, right) => right.mean - left.mean)
    .filter((entry) => entry.mean > 0)
    .slice(0, 2)
    .map((entry) => entry.trait)

  const penalizedTraits = [...traitEntries]
    .sort((left, right) => left.mean - right.mean)
    .filter((entry) => entry.mean < 0)
    .slice(0, 2)
    .map((entry) => entry.trait)

  return {
    ranking,
    rewardedTraits,
    penalizedTraits,
  }
}
