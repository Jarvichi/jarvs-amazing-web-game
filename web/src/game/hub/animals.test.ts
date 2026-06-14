import { describe, it, expect } from 'vitest'
import {
  ANIMAL_CAPS,
  computeProceduralCounts,
  resolveVariantTint,
  TINT_PALETTES,
  pickWeighted,
  randomDuration,
} from './animals'

describe('computeProceduralCounts', () => {
  it('applies the issue ratios', () => {
    // 8 buildings → 2 cats, 8 npcs → 2 dogs, birds fixed 4, 12 pond tiles → 2 fish
    expect(computeProceduralCounts(8, 8, 12)).toEqual({ cat: 2, dog: 2, bird: 4, fish: 2 })
  })

  it('floors fractional counts', () => {
    expect(computeProceduralCounts(7, 7, 11)).toEqual({ cat: 1, dog: 1, bird: 4, fish: 1 })
  })

  it('returns zero when there is no source data (and birds stay fixed)', () => {
    expect(computeProceduralCounts(0, 0, 0)).toEqual({ cat: 0, dog: 0, bird: 4, fish: 0 })
  })

  it('clamps to the per-type caps for a large town', () => {
    // Ravenwatch-scale: 22 buildings, 56 npcs, 85 pond tiles
    const counts = computeProceduralCounts(22, 56, 85)
    expect(counts.cat).toBe(5)                 // 22/4=5, below cap 6
    expect(counts.dog).toBe(ANIMAL_CAPS.dog)   // 56/4=14 → capped to 8
    expect(counts.fish).toBe(ANIMAL_CAPS.fish) // 85/6=14 → capped to 12
    expect(counts.bird).toBe(4)
  })
})

describe('resolveVariantTint', () => {
  it('resolves a named palette key', () => {
    expect(resolveVariantTint('cat', 'orange')).toBe(TINT_PALETTES.cat.orange)
  })

  it('parses hex strings in several forms', () => {
    expect(resolveVariantTint('dog', '#abcdef')).toBe(0xabcdef)
    expect(resolveVariantTint('dog', 'abcdef')).toBe(0xabcdef)
    expect(resolveVariantTint('dog', '0xABCDEF')).toBe(0xabcdef)
  })

  it('falls back to a palette colour using the supplied rng', () => {
    const tint = resolveVariantTint('bird', undefined, () => 0)
    expect(tint).toBe(Object.values(TINT_PALETTES.bird)[0])
  })

  it('ignores an invalid variant and falls back', () => {
    const tint = resolveVariantTint('fish', 'not-a-colour', () => 0)
    expect(tint).toBe(Object.values(TINT_PALETTES.fish)[0])
  })
})

describe('pickWeighted', () => {
  it('selects the first bucket at rng=0', () => {
    expect(pickWeighted({ a: 1, b: 9 }, () => 0)).toBe('a')
  })

  it('selects a later bucket as rng approaches 1', () => {
    expect(pickWeighted({ a: 1, b: 9 }, () => 0.99)).toBe('b')
  })
})

describe('randomDuration', () => {
  it('returns the low bound at rng=0', () => {
    expect(randomDuration('sit', () => 0)).toBe(3000)
  })

  it('uses a default range for unknown states', () => {
    const d = randomDuration('mystery', () => 0)
    expect(d).toBe(2000)
  })
})
