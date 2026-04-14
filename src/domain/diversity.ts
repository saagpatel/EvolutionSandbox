import { clamp01, roundTo } from '@/domain/config'
import type { Creature, TraitKey } from '@/domain/types'

export const PHENOTYPE_BUCKETS_PER_TRAIT = 3
export const PHENOTYPE_SIGNATURE_SPACE = PHENOTYPE_BUCKETS_PER_TRAIT ** 4
export const CROWDING_ADJUSTMENT_LIMIT = 0.18
export const LOW_DIVERSITY_THRESHOLD = 0.24
export const DIVERSITY_RECOVERY_DELTA = 0.015

function bucketTrait(value: number): number {
  return Math.min(PHENOTYPE_BUCKETS_PER_TRAIT - 1, Math.floor(clamp01(value) * PHENOTYPE_BUCKETS_PER_TRAIT))
}

export function buildPhenotypeSignature(creature: Pick<Creature, TraitKey>): string {
  return [
    bucketTrait(creature.size),
    bucketTrait(creature.speed),
    bucketTrait(creature.camouflage),
    bucketTrait(creature.energyEfficiency),
  ].join(':')
}

export function buildPhenotypeCounts(creatures: Array<Pick<Creature, TraitKey>>): Map<string, number> {
  const counts = new Map<string, number>()

  for (const creature of creatures) {
    const signature = buildPhenotypeSignature(creature)
    counts.set(signature, (counts.get(signature) ?? 0) + 1)
  }

  return counts
}

function computeVarianceScore(creatures: Array<Pick<Creature, TraitKey>>): number {
  if (creatures.length <= 1) {
    return 0
  }

  const traits: TraitKey[] = ['size', 'speed', 'camouflage', 'energyEfficiency']
  const means = traits.reduce<Record<TraitKey, number>>(
    (accumulator, trait) => ({
      ...accumulator,
      [trait]: creatures.reduce((sum, creature) => sum + creature[trait], 0) / creatures.length,
    }),
    {
      size: 0,
      speed: 0,
      camouflage: 0,
      energyEfficiency: 0,
    },
  )

  const averageVariance =
    traits.reduce((sum, trait) => {
      const traitVariance =
        creatures.reduce((varianceSum, creature) => varianceSum + (creature[trait] - means[trait]) ** 2, 0) /
        creatures.length
      return sum + traitVariance
    }, 0) / traits.length

  return clamp01(averageVariance / 0.25)
}

function computeEntropyScore(counts: Map<string, number>, populationSize: number): number {
  if (populationSize <= 1 || counts.size <= 1) {
    return 0
  }

  const entropy = [...counts.values()].reduce((sum, count) => {
    const probability = count / populationSize
    return probability > 0 ? sum - probability * Math.log(probability) : sum
  }, 0)

  return clamp01(entropy / Math.log(PHENOTYPE_SIGNATURE_SPACE))
}

export interface DiversityMetrics {
  diversityScore: number
  dominantPhenotypeShare: number
  phenotypeBucketCount: number
  phenotypeCounts: Map<string, number>
}

export function computeDiversityMetrics(creatures: Array<Pick<Creature, TraitKey>>): DiversityMetrics {
  if (creatures.length === 0) {
    return {
      diversityScore: 0,
      dominantPhenotypeShare: 0,
      phenotypeBucketCount: 0,
      phenotypeCounts: new Map(),
    }
  }

  const phenotypeCounts = buildPhenotypeCounts(creatures)
  const dominantPhenotypeShare = Math.max(...phenotypeCounts.values()) / creatures.length
  const varianceScore = computeVarianceScore(creatures)
  const entropyScore = computeEntropyScore(phenotypeCounts, creatures.length)
  const diversityScore = roundTo(clamp01(entropyScore * 0.55 + varianceScore * 0.45))

  return {
    diversityScore,
    dominantPhenotypeShare: roundTo(dominantPhenotypeShare),
    phenotypeBucketCount: phenotypeCounts.size,
    phenotypeCounts,
  }
}

export function computeCrowdingAdjustment(
  signatureCount: number,
  populationSize: number,
  phenotypeBucketCount: number,
): number {
  if (populationSize <= 0 || phenotypeBucketCount <= 0) {
    return 0
  }

  const share = signatureCount / populationSize
  const meanShare = 1 / phenotypeBucketCount
  const centered = (meanShare - share) / meanShare
  return roundTo(Math.max(-CROWDING_ADJUSTMENT_LIMIT, Math.min(CROWDING_ADJUSTMENT_LIMIT, centered * 0.12)))
}
