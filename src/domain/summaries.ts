import { PRESSURE_LABELS, TRAIT_LABELS, toPercent } from '@/domain/config'
import type { EventFlag, PressureImpact, PressureValues, ScenarioEvent, TraitKey, TraitValues } from '@/domain/types'

interface DiversitySummaryContext {
  previousDiversityScore: number
  currentDiversityScore: number
  previousDominantPhenotypeShare: number
  currentDominantPhenotypeShare: number
}

function formatTraitList(traits: TraitKey[]): string {
  if (traits.length === 0) {
    return 'No trait stood out'
  }

  return traits.map((trait) => TRAIT_LABELS[trait].toLowerCase()).join(' and ')
}

function dominantPressureLine(impact: PressureImpact): string {
  const topPressure = impact.ranking[0]
  if (!topPressure) {
    return 'Conditions stayed relatively even this generation.'
  }

  return `${PRESSURE_LABELS[topPressure.pressure]} shaped survival the most this generation.`
}

function traitShiftLine(previous: TraitValues, current: TraitValues, impact: PressureImpact): string {
  const deltas = (Object.keys(current) as TraitKey[]).map((trait) => ({
    trait,
    delta: current[trait] - previous[trait],
  }))
  const strongestShift = [...deltas].sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))[0]

  if (!strongestShift || Math.abs(strongestShift.delta) < 0.01) {
    return `${formatTraitList(impact.rewardedTraits)} held their ground without a dramatic shift.`
  }

  const direction = strongestShift.delta > 0 ? 'rose' : 'fell'
  return `${TRAIT_LABELS[strongestShift.trait]} ${direction} while ${formatTraitList(impact.rewardedTraits)} had the clearest advantage.`
}

function eventLine(flags: EventFlag[]): string | null {
  if (flags.includes('extinction')) {
    return 'The population collapsed to zero after the latest selection pass.'
  }

  if (flags.includes('bottleneck')) {
    return 'A bottleneck sharply narrowed the population this generation.'
  }

  if (flags.includes('recovery')) {
    return 'The population recovered after an earlier squeeze.'
  }

  if (flags.includes('lowDiversity')) {
    return 'Trait diversity narrowed, so the population is becoming more uniform.'
  }

  return null
}

function diversityLine(flags: EventFlag[], context: DiversitySummaryContext): string | null {
  const diversityDelta = context.currentDiversityScore - context.previousDiversityScore
  const dominantShareDelta =
    context.currentDominantPhenotypeShare - context.previousDominantPhenotypeShare

  if (flags.includes('recovery') && flags.includes('lowDiversity')) {
    return 'Recovery improved population size, but the population stayed genetically narrow.'
  }

  if (flags.includes('diversityRecovery')) {
    return 'Rare phenotypes regained ground after the pressure eased.'
  }

  if (flags.includes('lowDiversity')) {
    if (diversityDelta <= -0.05 || dominantShareDelta >= 0.05) {
      return 'The population narrowed around a common body plan.'
    }

    return 'The population stayed narrow around a common body plan.'
  }

  return null
}

function scenarioEventLine(
  scheduledEvent: ScenarioEvent | null,
  previousAppliedPressures: PressureValues,
): string | null {
  if (!scheduledEvent) {
    return null
  }

  const changedPressures = Object.entries(scheduledEvent.pressureOverrides)
    .map(([pressure, value]) => {
      const previousValue = previousAppliedPressures[pressure as keyof PressureValues]
      const nextValue = value ?? previousValue
      const direction = nextValue > previousValue ? 'increased' : nextValue < previousValue ? 'eased' : 'held'
      return {
        text: `${PRESSURE_LABELS[pressure as keyof PressureValues]} ${direction} to ${toPercent(nextValue)}%`,
        delta: Math.abs(nextValue - previousValue),
      }
    })
    .sort((left, right) => right.delta - left.delta)
    .slice(0, 2)

  if (changedPressures.length === 0) {
    return `${scheduledEvent.label} changed the world this generation.`
  }

  return `${scheduledEvent.label}: ${changedPressures.map((entry) => entry.text).join(' and ')}.`
}

export function buildSummaryLines(
  previousTraits: TraitValues,
  currentTraits: TraitValues,
  impact: PressureImpact,
  flags: EventFlag[],
  scheduledEvent: ScenarioEvent | null,
  previousAppliedPressures: PressureValues,
  diversityContext: DiversitySummaryContext,
): string[] {
  const lines = [dominantPressureLine(impact)]
  const scheduledLine = scenarioEventLine(scheduledEvent, previousAppliedPressures)
  const flagLine = eventLine(flags)
  const convergenceLine = diversityLine(flags, diversityContext)

  if (scheduledLine) {
    lines.push(scheduledLine)
  }

  lines.push(traitShiftLine(previousTraits, currentTraits, impact))

  if (convergenceLine) {
    lines.push(convergenceLine)
  } else if (!scheduledLine && flagLine) {
    lines.push(flagLine)
  } else if (!scheduledLine && impact.penalizedTraits.length > 0) {
    lines.push(`${formatTraitList(impact.penalizedTraits)} paid the highest cost under the current conditions.`)
  } else if (scheduledLine && flagLine) {
    lines.push(flagLine)
  }

  return lines
}
