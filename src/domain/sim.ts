import {
  EMPTY_PRESSURE_VALUES,
  EMPTY_TRAIT_VALUES,
  HISTOGRAM_BUCKETS,
  SIM_RULESET_VERSION,
  STORAGE_SCHEMA_VERSION,
  clamp01,
  normalizeConfig,
  roundTo,
} from '@/domain/config'
import {
  DIVERSITY_RECOVERY_DELTA,
  LOW_DIVERSITY_THRESHOLD,
  buildPhenotypeSignature,
  computeCrowdingAdjustment,
  computeDiversityMetrics,
} from '@/domain/diversity'
import { hashStable } from '@/domain/hash'
import {
  buildScenarioHash,
  getActiveScenarioEvent,
  getScenarioById,
  getTriggeredScenarioEvent,
  normalizeScenarioDefinition,
  resolveAppliedPressures,
} from '@/domain/scenarios'
import { pickWeightedIndex, hashSeed, nextBetween, nextFloat, nextNormal, nextSigned } from '@/domain/rng'
import { buildPressureImpact, scoreCreature, scoreToSurvivalProbability } from '@/domain/scoring'
import { buildSummaryLines } from '@/domain/summaries'
import type {
  CompletedRunSummary,
  Creature,
  EventFlag,
  GenerationSnapshot,
  PressureValues,
  RunRecord,
  ScenarioDefinition,
  SimulationConfig,
  TraitKey,
  TraitValues,
} from '@/domain/types'

export { resolveAppliedPressures } from '@/domain/scenarios'

function buildCreatureId(index: number): string {
  return `c-${index}`
}

function cloneTraits(creature: Pick<Creature, TraitKey>): TraitValues {
  return {
    size: creature.size,
    speed: creature.speed,
    camouflage: creature.camouflage,
    energyEfficiency: creature.energyEfficiency,
  }
}

function buildHistogram(creatures: Creature[], trait: TraitKey): number[] {
  const buckets = Array.from({ length: HISTOGRAM_BUCKETS }, () => 0)

  if (creatures.length === 0) {
    return buckets
  }

  for (const creature of creatures) {
    const bucketIndex = Math.min(HISTOGRAM_BUCKETS - 1, Math.floor(creature[trait] * HISTOGRAM_BUCKETS))
    buckets[bucketIndex] = (buckets[bucketIndex] ?? 0) + 1
  }

  return buckets
}

function computeMeanTraits(creatures: Creature[]): TraitValues {
  if (creatures.length === 0) {
    return { ...EMPTY_TRAIT_VALUES }
  }

  const totals = creatures.reduce<TraitValues>(
    (accumulator, creature) => ({
      size: accumulator.size + creature.size,
      speed: accumulator.speed + creature.speed,
      camouflage: accumulator.camouflage + creature.camouflage,
      energyEfficiency: accumulator.energyEfficiency + creature.energyEfficiency,
    }),
    { ...EMPTY_TRAIT_VALUES },
  )

  return {
    size: roundTo(totals.size / creatures.length),
    speed: roundTo(totals.speed / creatures.length),
    camouflage: roundTo(totals.camouflage / creatures.length),
    energyEfficiency: roundTo(totals.energyEfficiency / creatures.length),
  }
}

function buildSnapshot(
  generationIndex: number,
  creatures: Creature[],
  survivalRate: number,
  appliedPressures: PressureValues,
  pressureTotals: PressureValues,
  traitTotals: TraitValues,
  previousSnapshot: GenerationSnapshot | null,
  recentSnapshots: GenerationSnapshot[],
  scenario: ScenarioDefinition,
): GenerationSnapshot {
  const diversityMetrics = computeDiversityMetrics(creatures)
  const projectedCreatures = creatures.map((creature) => {
    const projectedScore = scoreCreature(creature, appliedPressures, 0)
    const crowdingAdjustment = computeCrowdingAdjustment(
      diversityMetrics.phenotypeCounts.get(buildPhenotypeSignature(creature)) ?? 1,
      creatures.length,
      diversityMetrics.phenotypeBucketCount,
    )
    const totalScore = projectedScore.baseScore + crowdingAdjustment
    return {
      ...creature,
      currentSurvivalScore: roundTo(totalScore),
      currentSurvivalProbability: roundTo(scoreToSurvivalProbability(totalScore)),
      pressureEffects: projectedScore.pressureEffects,
    }
  })
  const meanTraitValues = computeMeanTraits(projectedCreatures)
  const eventFlags: EventFlag[] = []

  if (projectedCreatures.length === 0) {
    eventFlags.push('extinction')
  } else {
    if (previousSnapshot) {
      if (
        projectedCreatures.length < previousSnapshot.populationSize * 0.65 ||
        projectedCreatures.length < previousSnapshot.populationSize * 0.5
      ) {
        eventFlags.push('bottleneck')
      } else if (
        previousSnapshot.eventFlags.includes('bottleneck') &&
        projectedCreatures.length > previousSnapshot.populationSize * 1.2
      ) {
        eventFlags.push('recovery')
      }
    }

    const diversityWindow = [...recentSnapshots, ...(previousSnapshot ? [previousSnapshot] : [])].slice(-8)
    const recentLowDiversity = diversityWindow.some(
      (snapshot) =>
        snapshot.eventFlags.includes('lowDiversity') || snapshot.diversityScore < LOW_DIVERSITY_THRESHOLD + 0.02,
    )
    const recentDiversityFloor = Math.min(
      previousSnapshot?.diversityScore ?? diversityMetrics.diversityScore,
      ...diversityWindow.map((snapshot) => snapshot.diversityScore),
    )

    if (
      recentLowDiversity &&
      diversityMetrics.diversityScore >= LOW_DIVERSITY_THRESHOLD &&
      diversityMetrics.diversityScore - recentDiversityFloor >= DIVERSITY_RECOVERY_DELTA &&
      !previousSnapshot?.eventFlags.includes('diversityRecovery')
    ) {
      eventFlags.push('diversityRecovery')
    }

    if (diversityMetrics.diversityScore < LOW_DIVERSITY_THRESHOLD) {
      eventFlags.push('lowDiversity')
    }
  }

  const pressureImpact = buildPressureImpact(
    pressureTotals,
    traitTotals,
    Math.max(previousSnapshot?.populationSize ?? projectedCreatures.length, 1),
  )
  const traitDistributions = {
    size: buildHistogram(projectedCreatures, 'size'),
    speed: buildHistogram(projectedCreatures, 'speed'),
    camouflage: buildHistogram(projectedCreatures, 'camouflage'),
    energyEfficiency: buildHistogram(projectedCreatures, 'energyEfficiency'),
  }
  const previousTraits = previousSnapshot?.meanTraitValues ?? meanTraitValues
  const triggeredScenarioEvent = getTriggeredScenarioEvent(scenario.events, generationIndex)
  const activeScenarioEvent = getActiveScenarioEvent(scenario.events, generationIndex)

  return {
    generationIndex,
    populationSize: projectedCreatures.length,
    survivalRate: roundTo(survivalRate),
    diversityScore: diversityMetrics.diversityScore,
    dominantPhenotypeShare: diversityMetrics.dominantPhenotypeShare,
    phenotypeBucketCount: diversityMetrics.phenotypeBucketCount,
    meanTraitValues,
    traitDistributions,
    summaryText:
      generationIndex === 0
        ? ['Population initialized.', 'Load a scenario, run it, and save useful outcomes into the lab.']
        : buildSummaryLines(
            previousTraits,
            meanTraitValues,
            pressureImpact,
            eventFlags,
            triggeredScenarioEvent,
            previousSnapshot?.appliedPressures ?? appliedPressures,
            {
              previousDiversityScore: previousSnapshot?.diversityScore ?? diversityMetrics.diversityScore,
              currentDiversityScore: diversityMetrics.diversityScore,
              previousDominantPhenotypeShare:
                previousSnapshot?.dominantPhenotypeShare ?? diversityMetrics.dominantPhenotypeShare,
              currentDominantPhenotypeShare: diversityMetrics.dominantPhenotypeShare,
            },
          ),
    eventFlags,
    creatures: projectedCreatures,
    pressureImpact,
    appliedPressures,
    triggeredScenarioEvent,
    activeScenarioEvent,
  }
}

function buildInitialCreature(index: number, generationBorn: number, state: number): { creature: Creature; state: number } {
  let nextState = state
  const traitValues: TraitValues = { ...EMPTY_TRAIT_VALUES }

  for (const trait of ['size', 'speed', 'camouflage', 'energyEfficiency'] as TraitKey[]) {
    const normal = nextNormal(nextState)
    nextState = normal.state
    traitValues[trait] = clamp01(0.5 + normal.value * 0.12)
  }

  return {
    creature: {
      id: buildCreatureId(index),
      parentId: null,
      generationBorn,
      ...traitValues,
      currentSurvivalScore: 0,
      currentSurvivalProbability: 0.5,
      pressureEffects: { ...EMPTY_PRESSURE_VALUES },
    },
    state: nextState,
  }
}

function mutateTrait(value: number, mutationRate: number, state: number): { value: number; state: number } {
  const mutationRoll = nextFloat(state)
  let nextState = mutationRoll.state

  if (mutationRoll.value > mutationRate) {
    return {
      value,
      state: nextState,
    }
  }

  const moderateRoll = nextFloat(nextState)
  nextState = moderateRoll.state
  const signed = nextSigned(nextState)
  nextState = signed.state
  const magnitude = moderateRoll.value < 0.15 ? 0.08 + Math.abs(signed.value) * 0.1 : 0.02 + Math.abs(signed.value) * 0.06

  return {
    value: clamp01(value + Math.sign(signed.value || 1) * magnitude),
    state: nextState,
  }
}

function buildOffspring(
  parent: Creature,
  nextCreatureId: number,
  generationBorn: number,
  mutationRate: number,
  state: number,
): { creature: Creature; state: number } {
  let nextState = state
  const traits = cloneTraits(parent)

  for (const trait of ['size', 'speed', 'camouflage', 'energyEfficiency'] as TraitKey[]) {
    const mutation = mutateTrait(traits[trait], mutationRate, nextState)
    traits[trait] = mutation.value
    nextState = mutation.state
  }

  return {
    creature: {
      id: buildCreatureId(nextCreatureId),
      parentId: parent.id,
      generationBorn,
      ...traits,
      currentSurvivalScore: 0,
      currentSurvivalProbability: 0.5,
      pressureEffects: { ...EMPTY_PRESSURE_VALUES },
    },
    state: nextState,
  }
}

function computeNextPopulationSize(currentPopulation: number, survivorRate: number, carryingCapacity: number): number {
  if (currentPopulation === 0) {
    return 0
  }

  const desiredRatio = Math.min(0.94, Math.max(0.12, 0.58 + (survivorRate - 0.45) * 1.05))
  const desiredPopulation = carryingCapacity * desiredRatio
  return Math.max(0, Math.min(carryingCapacity, Math.round(currentPopulation * 0.55 + desiredPopulation * 0.45)))
}

function createCompletedSummary(run: RunRecord): CompletedRunSummary {
  const snapshots = run.snapshots
  const finalSnapshot = snapshots.at(-1)

  if (!finalSnapshot) {
    throw new Error('Cannot summarize a run with no snapshots.')
  }

  const meanTraitCurves = {
    size: snapshots.map((snapshot) => snapshot.meanTraitValues.size),
    speed: snapshots.map((snapshot) => snapshot.meanTraitValues.speed),
    camouflage: snapshots.map((snapshot) => snapshot.meanTraitValues.camouflage),
    energyEfficiency: snapshots.map((snapshot) => snapshot.meanTraitValues.energyEfficiency),
  }

  const summaryCore = {
    configHash: run.configHash,
    scenarioHash: run.scenarioHash,
    seed: run.seed,
    finalGeneration: finalSnapshot.generationIndex,
    finalPopulationSize: finalSnapshot.populationSize,
    populationCurve: snapshots.map((snapshot) => snapshot.populationSize),
    survivalCurve: snapshots.map((snapshot) => snapshot.survivalRate),
    diversityCurve: snapshots.map((snapshot) => snapshot.diversityScore),
    dominantPhenotypeCurve: snapshots.map((snapshot) => snapshot.dominantPhenotypeShare),
    meanTraitCurves,
    finalMeanTraits: finalSnapshot.meanTraitValues,
  }

  return {
    rulesetVersion: run.rulesetVersion,
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    configHash: run.configHash,
    scenarioHash: run.scenarioHash,
    seed: run.seed,
    scenarioId: run.scenario.id,
    scenarioName: run.scenario.name,
    finalGeneration: finalSnapshot.generationIndex,
    finalPopulationSize: finalSnapshot.populationSize,
    finalMeanTraits: finalSnapshot.meanTraitValues,
    populationCurve: summaryCore.populationCurve,
    survivalCurve: summaryCore.survivalCurve,
    diversityCurve: summaryCore.diversityCurve,
    dominantPhenotypeCurve: summaryCore.dominantPhenotypeCurve,
    meanTraitCurves,
    finalSummary: finalSnapshot.summaryText,
    runHash: hashStable(summaryCore),
  }
}

export function initializeRun(configInput: SimulationConfig, scenarioInput?: ScenarioDefinition): RunRecord {
  const config = normalizeConfig(configInput)
  const scenario = normalizeScenarioDefinition(scenarioInput ?? getScenarioById(config.scenarioId))
  const seed = config.seed
  let rngState = hashSeed(seed)
  const creatures: Creature[] = []

  for (let index = 0; index < config.startingPopulation; index += 1) {
    const initial = buildInitialCreature(index, 0, rngState)
    creatures.push(initial.creature)
    rngState = initial.state
  }

  const initialPressures = resolveAppliedPressures(config, scenario.events, 0)
  const initialSnapshot = buildSnapshot(
    0,
    creatures,
    1,
    initialPressures,
    { ...EMPTY_PRESSURE_VALUES },
    { ...EMPTY_TRAIT_VALUES },
    null,
    [],
    scenario,
  )

  return {
    config,
    scenario,
    seed,
    rulesetVersion: SIM_RULESET_VERSION,
    configHash: hashStable(config),
    scenarioHash: buildScenarioHash(scenario),
    snapshots: [initialSnapshot],
    completed: false,
    nextCreatureId: config.startingPopulation,
    rngState,
    completedSummary: null,
  }
}

export function stepGeneration(run: RunRecord): RunRecord {
  if (run.completed) {
    return run
  }

  const previousSnapshot = run.snapshots.at(-1)
  if (!previousSnapshot) {
    return initializeRun(run.config, run.scenario)
  }

  const currentCreatures = previousSnapshot.creatures
  let rngState = run.rngState
  const survivors: Creature[] = []
  const survivorCrowdingAdjustments = new Map<string, number>()
  const pressureTotals: PressureValues = { ...EMPTY_PRESSURE_VALUES }
  const traitTotals: TraitValues = { ...EMPTY_TRAIT_VALUES }
  const generationIndex = previousSnapshot.generationIndex + 1
  const appliedPressures = resolveAppliedPressures(run.config, run.scenario.events, generationIndex)
  const parentDiversityMetrics = computeDiversityMetrics(currentCreatures)

  for (const creature of currentCreatures) {
    const noiseRoll = nextBetween(rngState, -0.08, 0.08)
    rngState = noiseRoll.state
    const score = scoreCreature(creature, appliedPressures, noiseRoll.value)
    const crowdingAdjustment = computeCrowdingAdjustment(
      parentDiversityMetrics.phenotypeCounts.get(buildPhenotypeSignature(creature)) ?? 1,
      currentCreatures.length,
      parentDiversityMetrics.phenotypeBucketCount,
    )
    const totalScore = score.baseScore + crowdingAdjustment
    const probability = scoreToSurvivalProbability(totalScore)
    const survivalRoll = nextFloat(rngState)
    rngState = survivalRoll.state

    const nextCreature: Creature = {
      ...creature,
      currentSurvivalScore: roundTo(totalScore),
      currentSurvivalProbability: roundTo(probability),
      pressureEffects: score.pressureEffects,
    }

    for (const [pressure, value] of Object.entries(score.pressureEffects) as Array<[keyof PressureValues, number]>) {
      pressureTotals[pressure] += value
    }

    for (const [trait, value] of Object.entries(score.traitEffects) as Array<[TraitKey, number]>) {
      traitTotals[trait] += value
    }

    if (survivalRoll.value <= probability) {
      survivors.push(nextCreature)
      survivorCrowdingAdjustments.set(nextCreature.id, crowdingAdjustment)
    }
  }

  const survivalRate = currentCreatures.length === 0 ? 0 : survivors.length / currentCreatures.length

  if (survivors.length === 0) {
    const extinctionSnapshot = buildSnapshot(
      generationIndex,
      [],
      survivalRate,
      appliedPressures,
      pressureTotals,
      traitTotals,
      previousSnapshot,
      run.snapshots,
      run.scenario,
    )
    const nextRun = {
      ...run,
      snapshots: [...run.snapshots, extinctionSnapshot],
      completed: true,
      rngState,
    }

    return {
      ...nextRun,
      completedSummary: createCompletedSummary(nextRun),
    }
  }

  const nextPopulationSize = computeNextPopulationSize(
    currentCreatures.length,
    survivalRate,
    run.config.startingPopulation,
  )
  const weights = survivors.map((creature) => {
    const crowdingAdjustment = survivorCrowdingAdjustments.get(creature.id) ?? 0
    const multiplier = Math.max(0.65, 1 + crowdingAdjustment * 0.5)
    return Math.max(0.001, creature.currentSurvivalProbability ** 1.5 * multiplier)
  })
  const offspring: Creature[] = []
  let nextCreatureId = run.nextCreatureId

  for (let index = 0; index < nextPopulationSize; index += 1) {
    const picked = pickWeightedIndex(rngState, weights)
    rngState = picked.state
    const parent = survivors[picked.value]
    if (!parent) {
      continue
    }
    const child = buildOffspring(parent, nextCreatureId, generationIndex, run.config.mutationRate, rngState)
    offspring.push(child.creature)
    rngState = child.state
    nextCreatureId += 1
  }

  const nextSnapshot = buildSnapshot(
    generationIndex,
    offspring,
    survivalRate,
    appliedPressures,
    pressureTotals,
    traitTotals,
    previousSnapshot,
    run.snapshots,
    run.scenario,
  )
  const nextRun = {
    ...run,
    snapshots: [...run.snapshots, nextSnapshot],
    completed:
      nextSnapshot.generationIndex >= run.config.generationTarget || nextSnapshot.eventFlags.includes('extinction'),
    rngState,
    nextCreatureId,
  }

  return nextRun.completed
    ? {
        ...nextRun,
        completedSummary: createCompletedSummary(nextRun),
      }
    : {
        ...nextRun,
        completedSummary: null,
      }
}

export function advanceRun(run: RunRecord, generations: number): RunRecord {
  let nextRun = run

  for (let index = 0; index < generations; index += 1) {
    if (nextRun.completed) {
      break
    }
    nextRun = stepGeneration(nextRun)
  }

  return nextRun
}

export function getScenarioPreviewRun(scenario: ScenarioDefinition): RunRecord {
  return initializeRun(scenario.baseConfig, scenario)
}
