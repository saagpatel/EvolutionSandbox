import { describe, expect, it } from 'vitest'

import {
  CROWDING_ADJUSTMENT_LIMIT,
  buildPhenotypeCounts,
  buildPhenotypeSignature,
  computeCrowdingAdjustment,
  computeDiversityMetrics,
} from '@/domain/diversity'

describe('diversity helpers', () => {
  it('builds deterministic phenotype signatures within the expected bucket space', () => {
    const signature = buildPhenotypeSignature({
      size: 0.2,
      speed: 0.51,
      camouflage: 0.99,
      energyEfficiency: 0.01,
    })

    expect(signature).toBe('0:1:2:0')
  })

  it('computes stable diversity metrics for the same population', () => {
    const creatures = [
      { size: 0.1, speed: 0.1, camouflage: 0.1, energyEfficiency: 0.1 },
      { size: 0.2, speed: 0.2, camouflage: 0.2, energyEfficiency: 0.2 },
      { size: 0.8, speed: 0.8, camouflage: 0.8, energyEfficiency: 0.8 },
      { size: 0.9, speed: 0.9, camouflage: 0.9, energyEfficiency: 0.9 },
    ]

    const first = computeDiversityMetrics(creatures)
    const second = computeDiversityMetrics(creatures)

    expect(first).toEqual(second)
    expect(first.diversityScore).toBeGreaterThan(0)
    expect(first.diversityScore).toBeLessThanOrEqual(1)
    expect(first.dominantPhenotypeShare).toBeGreaterThan(0)
    expect(first.dominantPhenotypeShare).toBeLessThanOrEqual(1)
    expect(first.phenotypeBucketCount).toBe(buildPhenotypeCounts(creatures).size)
  })

  it('keeps crowding adjustments inside the configured clamp bounds', () => {
    expect(computeCrowdingAdjustment(1, 100, 20)).toBeGreaterThanOrEqual(-CROWDING_ADJUSTMENT_LIMIT)
    expect(computeCrowdingAdjustment(1, 100, 20)).toBeLessThanOrEqual(CROWDING_ADJUSTMENT_LIMIT)
    expect(computeCrowdingAdjustment(80, 100, 5)).toBeGreaterThanOrEqual(-CROWDING_ADJUSTMENT_LIMIT)
    expect(computeCrowdingAdjustment(80, 100, 5)).toBeLessThanOrEqual(CROWDING_ADJUSTMENT_LIMIT)
  })
})
