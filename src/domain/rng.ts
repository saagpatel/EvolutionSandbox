export interface RandomResult {
  value: number
  state: number
}

export function hashSeed(seed: number): number {
  let state = seed >>> 0
  state ^= state >>> 16
  state = Math.imul(state, 0x7feb352d)
  state ^= state >>> 15
  state = Math.imul(state, 0x846ca68b)
  state ^= state >>> 16
  return state >>> 0 || 0x9e3779b9
}

export function nextFloat(state: number): RandomResult {
  const nextState = (state + 0x6d2b79f5) >>> 0
  let t = nextState
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, state: nextState }
}

export function nextBetween(state: number, min: number, max: number): RandomResult {
  const result = nextFloat(state)
  return {
    value: min + (max - min) * result.value,
    state: result.state,
  }
}

export function nextSigned(state: number): RandomResult {
  const result = nextFloat(state)
  return {
    value: result.value * 2 - 1,
    state: result.state,
  }
}

export function nextNormal(state: number): RandomResult {
  const first = nextFloat(state)
  const second = nextFloat(first.state)
  const u1 = Math.max(first.value, 1e-9)
  const u2 = second.value
  const radius = Math.sqrt(-2 * Math.log(u1))
  const theta = 2 * Math.PI * u2
  return {
    value: radius * Math.cos(theta),
    state: second.state,
  }
}

export function pickWeightedIndex(state: number, weights: number[]): RandomResult {
  const total = weights.reduce((sum, weight) => sum + weight, 0)

  if (total <= 0) {
    return {
      value: 0,
      state,
    }
  }

  const roll = nextBetween(state, 0, total)
  let cursor = 0

  for (let index = 0; index < weights.length; index += 1) {
    cursor += weights[index] ?? 0
    if (roll.value <= cursor) {
      return {
        value: index,
        state: roll.state,
      }
    }
  }

  return {
    value: weights.length - 1,
    state: roll.state,
  }
}
