import { TRAIT_LABELS, roundTo } from '@/domain/config'
import type { ComparisonSummary, CompletedRunSummary, TraitKey, TraitValues } from '@/domain/types'

function deltaTraits(current: TraitValues, previous: TraitValues): TraitValues {
  return {
    size: roundTo(current.size - previous.size),
    speed: roundTo(current.speed - previous.speed),
    camouflage: roundTo(current.camouflage - previous.camouflage),
    energyEfficiency: roundTo(current.energyEfficiency - previous.energyEfficiency),
  }
}

export function buildComparisonSummary(
  current: CompletedRunSummary,
  previous: CompletedRunSummary,
): ComparisonSummary {
  const meanTraitDeltas = deltaTraits(current.finalMeanTraits, previous.finalMeanTraits)
  const entries = Object.entries(meanTraitDeltas) as Array<[TraitKey, number]>
  const biggestWinnerTrait = [...entries].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'size'
  const biggestLoserTrait = [...entries].sort((left, right) => left[1] - right[1])[0]?.[0] ?? 'size'
  const strongestAbsoluteDelta = Math.max(...entries.map(([, value]) => Math.abs(value)), 0)
  const previousFinalSurvival = previous.survivalCurve.at(-1) ?? 0
  const currentFinalSurvival = current.survivalCurve.at(-1) ?? 0
  const survivalCurveDelta = roundTo(currentFinalSurvival - previousFinalSurvival)
  const finalPopulationDelta = current.finalPopulationSize - previous.finalPopulationSize
  const direction = finalPopulationDelta === 0 ? 'held steady' : finalPopulationDelta > 0 ? 'grew' : 'shrank'
  const sameScenario = current.scenarioId === previous.scenarioId
  const sameScenarioRecipe = current.scenarioHash === previous.scenarioHash
  const sameRunRecipe = sameScenarioRecipe && current.configHash === previous.configHash && current.seed === previous.seed
  const sameSeed = current.seed === previous.seed
  const scenarioContext = sameRunRecipe
    ? `Both runs used the same ${current.scenarioName} recipe and the same seed, so this is a direct replay check.`
    : sameScenario
      ? sameSeed
        ? `Both runs used ${current.scenarioName} with the same seed but different world settings.`
        : `Both runs used ${current.scenarioName} with different experiment conditions or seeds.`
      : `The experiment changed from ${previous.scenarioName} to ${current.scenarioName}.`
  const summaryText =
    strongestAbsoluteDelta < 0.01
      ? `Compared with the baseline, the population ${direction} and the mean traits stayed effectively unchanged. ${scenarioContext}`
      : `Compared with the baseline, the population ${direction}. ${TRAIT_LABELS[biggestWinnerTrait]} gained the most while ${TRAIT_LABELS[biggestLoserTrait]} slipped the most. ${scenarioContext}`

  return {
    finalPopulationDelta,
    meanTraitDeltas,
    biggestWinnerTrait,
    biggestLoserTrait,
    survivalCurveDelta,
    summaryText,
  }
}
