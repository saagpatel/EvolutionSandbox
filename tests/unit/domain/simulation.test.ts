import { describe, expect, it } from 'vitest'

import { getPresetById } from '@/domain/presets'
import { getScenarioById } from '@/domain/scenarios'
import { advanceRun, initializeRun } from '@/domain/sim'

describe('simulation determinism', () => {
  it('produces the same completed run hash for the same seed and config', () => {
    const config = getPresetById('balanced-world').config
    const first = advanceRun(initializeRun(config), config.generationTarget)
    const second = advanceRun(initializeRun(config), config.generationTarget)

    expect(first.completedSummary?.runHash).toBeTruthy()
    expect(first.completedSummary?.runHash).toBe(second.completedSummary?.runHash)
    expect(first.completedSummary?.populationCurve).toEqual(second.completedSummary?.populationCurve)
    expect(first.completedSummary?.diversityCurve).toEqual(second.completedSummary?.diversityCurve)
  })

  it('keeps all trait values bounded', () => {
    const config = getPresetById('predator-surge').config
    const run = advanceRun(initializeRun(config), config.generationTarget)

    for (const snapshot of run.snapshots) {
      for (const creature of snapshot.creatures) {
        expect(creature.size).toBeGreaterThanOrEqual(0)
        expect(creature.size).toBeLessThanOrEqual(1)
        expect(creature.speed).toBeGreaterThanOrEqual(0)
        expect(creature.speed).toBeLessThanOrEqual(1)
        expect(creature.camouflage).toBeGreaterThanOrEqual(0)
        expect(creature.camouflage).toBeLessThanOrEqual(1)
        expect(creature.energyEfficiency).toBeGreaterThanOrEqual(0)
        expect(creature.energyEfficiency).toBeLessThanOrEqual(1)
      }
    }
  })

  it('projects survival probabilities for visible creatures instead of leaving newborn defaults', () => {
    const config = getPresetById('balanced-world').config
    const run = initializeRun(config)
    const firstCreature = run.snapshots[0]!.creatures[0]

    expect(firstCreature).toBeTruthy()
    expect(firstCreature!.currentSurvivalProbability).not.toBe(0.5)
    expect(
      Object.values(firstCreature!.pressureEffects).some((value) => Math.abs(value) > 0.001),
    ).toBe(true)
  })

  it('shows interpretable directional shifts under scarcity and exposure presets', () => {
    const scarcity = getPresetById('scarcity-crunch').config
    const scarcityRun = advanceRun(initializeRun(scarcity), scarcity.generationTarget)
    const scarcityStart = scarcityRun.snapshots[0]!.meanTraitValues
    const scarcityEnd = scarcityRun.completedSummary?.finalMeanTraits
    expect(scarcityEnd).toBeTruthy()
    expect((scarcityEnd?.energyEfficiency ?? 0) - scarcityStart.energyEfficiency).toBeGreaterThan(0)
    expect((scarcityEnd?.size ?? 1) - scarcityStart.size).toBeLessThan(0)

    const exposed = getPresetById('exposed-habitat').config
    const exposedRun = advanceRun(initializeRun(exposed), exposed.generationTarget)
    const exposedStart = exposedRun.snapshots[0]!.meanTraitValues
    const exposedEnd = exposedRun.completedSummary?.finalMeanTraits
    expect(exposedEnd).toBeTruthy()
    expect((exposedEnd?.camouflage ?? 0) - exposedStart.camouflage).toBeGreaterThan(0)
  })

  it('shows interpretable directional shifts under predator and cold presets', () => {
    const predator = getPresetById('predator-surge').config
    const predatorRun = advanceRun(initializeRun(predator), predator.generationTarget)
    const predatorStart = predatorRun.snapshots[0]!.meanTraitValues
    const predatorEnd = predatorRun.completedSummary?.finalMeanTraits
    expect(predatorEnd).toBeTruthy()
    expect((predatorEnd?.speed ?? 0) - predatorStart.speed).toBeGreaterThan(0)
    expect((predatorEnd?.camouflage ?? 0) - predatorStart.camouflage).toBeGreaterThan(0)

    const cold = getPresetById('cold-snap').config
    const coldRun = advanceRun(initializeRun(cold), cold.generationTarget)
    const coldStart = coldRun.snapshots[0]!.meanTraitValues
    const coldEnd = coldRun.completedSummary?.finalMeanTraits
    const scarcityReference = advanceRun(
      initializeRun(getPresetById('scarcity-crunch').config),
      getPresetById('scarcity-crunch').config.generationTarget,
    ).completedSummary?.finalMeanTraits
    expect(coldEnd).toBeTruthy()
    expect((coldEnd?.energyEfficiency ?? 0) - coldStart.energyEfficiency).toBeGreaterThan(0)
    expect((coldEnd?.size ?? 0)).toBeGreaterThan(scarcityReference?.size ?? 0)
  })

  it('keeps the built-in static scenarios behaviorally distinct', () => {
    const scarcityEnd = advanceRun(
      initializeRun(getPresetById('scarcity-crunch').config),
      getPresetById('scarcity-crunch').config.generationTarget,
    ).completedSummary!.finalMeanTraits
    const predatorEnd = advanceRun(
      initializeRun(getPresetById('predator-surge').config),
      getPresetById('predator-surge').config.generationTarget,
    ).completedSummary!.finalMeanTraits
    const exposedEnd = advanceRun(
      initializeRun(getPresetById('exposed-habitat').config),
      getPresetById('exposed-habitat').config.generationTarget,
    ).completedSummary!.finalMeanTraits
    const coldEnd = advanceRun(
      initializeRun(getPresetById('cold-snap').config),
      getPresetById('cold-snap').config.generationTarget,
    ).completedSummary!.finalMeanTraits

    expect(scarcityEnd.energyEfficiency).toBeGreaterThan(predatorEnd.energyEfficiency)
    expect(scarcityEnd.energyEfficiency).toBeGreaterThan(exposedEnd.energyEfficiency)
    expect(exposedEnd.camouflage).toBeGreaterThan(scarcityEnd.camouflage)
    expect(exposedEnd.camouflage).toBeGreaterThan(coldEnd.camouflage)
    expect(predatorEnd.speed).toBeGreaterThan(scarcityEnd.speed)
    expect(predatorEnd.speed).toBeGreaterThan(coldEnd.speed)
    expect(coldEnd.size).toBeGreaterThan(predatorEnd.size)
    expect(coldEnd.size).toBeGreaterThan(exposedEnd.size)
  })

  it('applies scheduled predator-pulse pressure changes and surfaces them in summaries', () => {
    const scenario = getScenarioById('predator-pulse')
    const run = advanceRun(initializeRun(scenario.baseConfig, scenario), scenario.baseConfig.generationTarget)
    const pulseSnapshot = run.snapshots[16]!
    const recoverySnapshot = run.snapshots[36]!
    const finalTraits = run.completedSummary?.finalMeanTraits
    const initialTraits = run.snapshots[0]!.meanTraitValues

    expect(pulseSnapshot.triggeredScenarioEvent?.label).toBe('Predator Pulse')
    expect(pulseSnapshot.appliedPressures.predationPressure).toBe(0.96)
    expect(pulseSnapshot.appliedPressures.habitatVisibility).toBe(0.8)
    expect(pulseSnapshot.summaryText.some((line) => line.includes('Predator Pulse'))).toBe(true)
    expect(recoverySnapshot.triggeredScenarioEvent?.label).toBe('Shelter Returns')
    expect(recoverySnapshot.appliedPressures.predationPressure).toBe(0.58)
    expect((finalTraits?.speed ?? 0) - initialTraits.speed).toBeGreaterThan(0.05)
    expect((finalTraits?.camouflage ?? 0) - initialTraits.camouflage).toBeGreaterThan(0.2)
  })

  it('applies cold-snap recovery events and produces a readable rebound window', () => {
    const scenario = getScenarioById('cold-snap-recovery')
    const run = advanceRun(initializeRun(scenario.baseConfig, scenario), scenario.baseConfig.generationTarget)
    const snapStart = run.snapshots[14]!
    const thawStart = run.snapshots[38]!
    const finalTraits = run.completedSummary?.finalMeanTraits
    const initialTraits = run.snapshots[0]!.meanTraitValues

    expect(snapStart.triggeredScenarioEvent?.label).toBe('Cold Snap')
    expect(snapStart.appliedPressures.coldStress).toBe(0.96)
    expect(snapStart.summaryText.some((line) => line.includes('Cold Stress increased'))).toBe(true)
    expect(thawStart.triggeredScenarioEvent?.label).toBe('Warmer Recovery')
    expect(thawStart.appliedPressures.coldStress).toBe(0.1)
    expect(thawStart.summaryText.some((line) => line.includes('Cold Stress eased'))).toBe(true)
    expect((finalTraits?.energyEfficiency ?? 0) - initialTraits.energyEfficiency).toBeGreaterThan(0.2)
  })

  it('keeps Balanced World from spending most of its back half in low diversity', () => {
    const scenario = getScenarioById('balanced-world')
    const run = advanceRun(initializeRun(scenario.baseConfig, scenario), scenario.baseConfig.generationTarget)
    const finalThird = run.snapshots.slice(Math.floor(run.snapshots.length * (2 / 3)))
    const lowDiversityRatio =
      finalThird.filter((snapshot) => snapshot.eventFlags.includes('lowDiversity')).length / finalThird.length

    expect(run.completedSummary?.diversityCurve.length).toBe(run.snapshots.length)
    expect(run.completedSummary?.dominantPhenotypeCurve.length).toBe(run.snapshots.length)
    expect(lowDiversityRatio).toBeLessThan(0.5)
  })

  it('shows a diversity squeeze and rebound in Predator Pulse', () => {
    const scenario = getScenarioById('predator-pulse')
    const run = advanceRun(initializeRun(scenario.baseConfig, scenario), scenario.baseConfig.generationTarget)
    const prePulse = run.snapshots.slice(8, 16)
    const pulseWindow = run.snapshots.slice(16, 28)
    const shelterWindow = run.snapshots.slice(36, 50)
    const pulseMinDiversity = Math.min(...pulseWindow.map((snapshot) => snapshot.diversityScore))
    const prePulseMaxDiversity = Math.max(...prePulse.map((snapshot) => snapshot.diversityScore))
    const shelterMaxDiversity = Math.max(...shelterWindow.map((snapshot) => snapshot.diversityScore))
    const pulseMaxDominantShare = Math.max(...pulseWindow.map((snapshot) => snapshot.dominantPhenotypeShare))

    expect(pulseMinDiversity).toBeLessThan(prePulseMaxDiversity)
    expect(shelterMaxDiversity).toBeGreaterThan(pulseMinDiversity)
    expect(pulseMaxDominantShare).toBeGreaterThan(0.18)
  })

  it('shows a diversity squeeze and rebound in Cold Snap Recovery', () => {
    const scenario = getScenarioById('cold-snap-recovery')
    const run = advanceRun(initializeRun(scenario.baseConfig, scenario), scenario.baseConfig.generationTarget)
    const preSnap = run.snapshots.slice(6, 14)
    const coldWindow = run.snapshots.slice(14, 32)
    const recoveryWindow = run.snapshots.slice(38, 56)
    const coldMinDiversity = Math.min(...coldWindow.map((snapshot) => snapshot.diversityScore))
    const preSnapMaxDiversity = Math.max(...preSnap.map((snapshot) => snapshot.diversityScore))
    const recoveryMaxDiversity = Math.max(...recoveryWindow.map((snapshot) => snapshot.diversityScore))
    const recoverySeen = recoveryWindow.some((snapshot) => snapshot.eventFlags.includes('diversityRecovery'))

    expect(coldMinDiversity).toBeLessThan(preSnapMaxDiversity)
    expect(recoveryMaxDiversity).toBeGreaterThan(coldMinDiversity)
    expect(recoverySeen).toBe(true)
  })
})
