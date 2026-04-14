import type {
  Announcement,
  ArtifactImportReview,
  AppNotice,
  CompletedRunSummary,
  Creature,
  GenerationSnapshot,
  QuickstartState,
  QuickstartStep,
  SavedExperiment,
  ScenarioDefinition,
} from '@/domain/types'

function makeAnnouncement(message: string): Announcement {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    message,
  }
}

export function announcementFromNotice(notice: AppNotice | null): Announcement | null {
  if (!notice) {
    return null
  }

  return makeAnnouncement(notice.message)
}

export function announcementForBaseline(experiment: SavedExperiment | null): Announcement {
  return makeAnnouncement(
    experiment ? `${experiment.name} is now the active baseline.` : 'Baseline comparison was cleared.',
  )
}

export function announcementForGeneration(snapshot: GenerationSnapshot): Announcement {
  return makeAnnouncement(
    `Generation ${snapshot.generationIndex} selected. Population ${snapshot.populationSize}. Survival ${Math.round(snapshot.survivalRate * 100)} percent.`,
  )
}

export function announcementForCreature(creature: Creature | null): Announcement {
  if (!creature) {
    return makeAnnouncement('Creature selection cleared.')
  }

  return makeAnnouncement(
    `Selected creature ${creature.id}. Survival estimate ${Math.round(creature.currentSurvivalProbability * 100)} percent.`,
  )
}

export function announcementForRunCompletion(summary: CompletedRunSummary): Announcement {
  return makeAnnouncement(
    `Run complete at generation ${summary.finalGeneration}. Final population ${summary.finalPopulationSize}.`,
  )
}

export function describeCreaturePosition(creature: Creature | null): string {
  if (!creature) {
    return 'Select a creature from the roster or canvas to hear how it sits in the phenotype field.'
  }

  const speedBand = creature.speed >= 0.67 ? 'far to the right among faster bodies' : creature.speed <= 0.33 ? 'toward the left among slower bodies' : 'near the middle speed range'
  const camouflageBand =
    creature.camouflage >= 0.67
      ? 'high in the field among better-camouflaged bodies'
      : creature.camouflage <= 0.33
        ? 'low in the field among more visible bodies'
        : 'around the middle camouflage range'
  const sizeBand =
    creature.size >= 0.67 ? 'larger than most sprites' : creature.size <= 0.33 ? 'smaller than most sprites' : 'mid-sized in the field'

  return `This creature sits ${speedBand}, ${camouflageBand}, and appears ${sizeBand}.`
}

function percentDelta(current: number, baseline: number): number {
  return Math.round((current - baseline) * 100)
}

export function buildAnalyticsNarrative(snapshots: GenerationSnapshot[], selectedIndex: number): string[] {
  const selected = snapshots[selectedIndex]
  const initial = snapshots[0]

  if (!selected || !initial) {
    return []
  }

  const populationDirection =
    selected.populationSize > initial.populationSize
      ? 'rose'
      : selected.populationSize < initial.populationSize
        ? 'fell'
        : 'held steady'
  const survivalDirection =
    selected.survivalRate > initial.survivalRate
      ? 'improved'
      : selected.survivalRate < initial.survivalRate
        ? 'slipped'
        : 'held steady'
  const diversityDirection =
    selected.diversityScore > initial.diversityScore
      ? 'broadened'
      : selected.diversityScore < initial.diversityScore
        ? 'narrowed'
        : 'stayed level'

  const traitEntries = Object.entries(selected.meanTraitValues).map(([trait, value]) => ({
    trait,
    delta: percentDelta(value, initial.meanTraitValues[trait as keyof typeof initial.meanTraitValues]),
  }))
  const strongestTrait = [...traitEntries].sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))[0]

  return [
    `Population ${populationDirection} from ${initial.populationSize} to ${selected.populationSize} by generation ${selected.generationIndex}.`,
    `Survival ${survivalDirection} to ${Math.round(selected.survivalRate * 100)} percent while diversity ${diversityDirection}.`,
    strongestTrait
      ? `The strongest mean-trait shift so far is ${strongestTrait.trait} at ${strongestTrait.delta >= 0 ? '+' : ''}${strongestTrait.delta} points from the founding generation.`
      : 'Trait averages are still close to the founding generation.',
  ]
}

export function getQuickstartStep(args: {
  quickstart: QuickstartState
  activeScenario: ScenarioDefinition
  baselineExperiment: SavedExperiment | null
  currentRunCompleted: boolean
  compareMode: boolean
}): QuickstartStep | null {
  if (args.quickstart.dismissed) {
    return null
  }

  if (args.activeScenario.id !== 'balanced-world' && !args.baselineExperiment) {
    return {
      title: 'Start with Balanced World',
      description: 'Use the baseline world first so the later comparison has a clean reference point.',
      actionLabel: 'Load Balanced World',
      action: 'loadBalancedWorld',
    }
  }

  if (args.activeScenario.id === 'balanced-world' && !args.currentRunCompleted) {
    return {
      title: 'Run the baseline world',
      description: 'Complete one full baseline run before saving or comparing anything else.',
      actionLabel: 'Run this scenario',
      action: 'runCurrentScenario',
    }
  }

  if (args.activeScenario.id === 'balanced-world' && args.currentRunCompleted && !args.baselineExperiment) {
    return {
      title: 'Save the baseline',
      description: 'Store this completed run so later scenarios have a stable comparison target.',
      actionLabel: 'Save as baseline',
      action: 'saveBaseline',
    }
  }

  if (args.baselineExperiment && args.activeScenario.id !== 'predator-pulse') {
    return {
      title: 'Load Predator Pulse next',
      description: 'This scenario shows the clearest squeeze-and-rebound story against the baseline.',
      actionLabel: 'Load Predator Pulse',
      action: 'loadPredatorPulse',
    }
  }

  if (args.activeScenario.id === 'predator-pulse' && !args.currentRunCompleted) {
    return {
      title: 'Run the comparison world',
      description: 'Finish Predator Pulse so the baseline compare button has a full run to compare.',
      actionLabel: 'Run this scenario',
      action: 'runCurrentScenario',
    }
  }

  if (args.activeScenario.id === 'predator-pulse' && args.currentRunCompleted && !args.compareMode) {
    return {
      title: 'Compare the two runs',
      description: 'Open comparison mode to see how the predator spike changed survival, traits, and diversity.',
      actionLabel: 'Compare baseline',
      action: 'compareBaseline',
    }
  }

  return {
    title: 'Explore the lab',
    description: 'Open the Lab to reopen past runs, export artifacts, or pick a different baseline.',
    actionLabel: 'Open Lab',
    action: 'openLab',
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function buildImportReviewSummary(review: ArtifactImportReview): string {
  const detailLead = review.details[0]

  if (review.warnings.length > 0) {
    return `${review.summary} ${review.warnings[0]}`
  }

  if (detailLead) {
    return `${review.summary} ${detailLead}`
  }

  return review.summary
}
