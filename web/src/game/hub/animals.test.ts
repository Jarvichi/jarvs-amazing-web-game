import { describe, it, expect } from 'vitest'
import {
  ANIMAL_CAPS,
  ANIMAL_SPECS,
  ANIMAL_TYPES,
  SpawnSources,
  computeProceduralCounts,
  resolveVariantTint,
  TINT_PALETTES,
  pickWeighted,
  randomDuration,
} from './animals'

function sources(p: Partial<SpawnSources>): SpawnSources {
  return { buildings: 0, npcs: 0, flowers: 0, pondTiles: 0, grass: 0, zones: 0, ...p }
}

describe('computeProceduralCounts', () => {
  it('applies each spec spawn rule', () => {
    // 8 buildings → 2 cats, 8 npcs → 2 dogs, birds fixed 8, 12 pond → 2 fish + 1 frog
    expect(computeProceduralCounts(sources({ buildings: 8, npcs: 8, pondTiles: 12 }))).toEqual({
      cat: 2, dog: 2, bird: 8, fish: 2, butterfly: 0, rabbit: 0, chicken: 0, frog: 1,
      firefly: 10, bat: 5,
    })
  })

  it('butterflies: 1 per 2 flowers, capped at 5', () => {
    expect(computeProceduralCounts(sources({ flowers: 4 })).butterfly).toBe(2)
    expect(computeProceduralCounts(sources({ flowers: 16 })).butterfly).toBe(5)
  })

  it('rabbits: fixed 4 when grass exists, else 0', () => {
    expect(computeProceduralCounts(sources({ grass: 0 })).rabbit).toBe(0)
    expect(computeProceduralCounts(sources({ grass: 1 })).rabbit).toBe(4)
    expect(computeProceduralCounts(sources({ grass: 9999 })).rabbit).toBe(4)
  })

  it('chickens: 1 per 6 zone tiles, capped at 8', () => {
    expect(computeProceduralCounts(sources({ zones: 18 })).chicken).toBe(3)
    expect(computeProceduralCounts(sources({ zones: 999 })).chicken).toBe(8)
    expect(computeProceduralCounts(sources({ zones: 0 })).chicken).toBe(0)
  })

  it('clamps to caps for a large town', () => {
    const c = computeProceduralCounts(sources({ buildings: 22, npcs: 56, pondTiles: 85, flowers: 16, grass: 500, zones: 30 }))
    expect(c.cat).toBe(5)                  // 22/4
    expect(c.dog).toBe(ANIMAL_CAPS.dog)    // 56/4=14 → cap 4
    expect(c.fish).toBe(ANIMAL_CAPS.fish)  // 85/6=14 → cap 12
    expect(c.frog).toBe(ANIMAL_CAPS.frog)  // 85/8=10 → cap 4
    expect(c.bird).toBe(8)
  })
})

describe('registry', () => {
  it('every type has a palette and a cap', () => {
    for (const t of ANIMAL_TYPES) {
      expect(Object.keys(ANIMAL_SPECS[t].palette).length).toBeGreaterThan(0)
      expect(ANIMAL_SPECS[t].spawn.cap).toBeGreaterThan(0)
    }
  })

  it('predator/prey relations are symmetric where expected', () => {
    expect(ANIMAL_SPECS.cat.chases).toContain('butterfly')
    expect(ANIMAL_SPECS.butterfly.fleesFrom).toContain('cat')
    expect(ANIMAL_SPECS.dog.chases).toContain('rabbit')
    expect(ANIMAL_SPECS.rabbit.fleesFrom).toContain('dog')
  })

  it('fliers are gated to day or night', () => {
    expect(ANIMAL_SPECS.bird.active).toBe('day')
    expect(ANIMAL_SPECS.butterfly.active).toBe('day')
    expect(ANIMAL_SPECS.firefly.active).toBe('night')
    expect(ANIMAL_SPECS.bat.active).toBe('night')
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
    expect(resolveVariantTint('frog', undefined, () => 0)).toBe(Object.values(TINT_PALETTES.frog)[0])
  })
})

describe('pickWeighted', () => {
  it('selects the first bucket at rng=0 and a later one near 1', () => {
    expect(pickWeighted({ a: 1, b: 9 }, () => 0)).toBe('a')
    expect(pickWeighted({ a: 1, b: 9 }, () => 0.99)).toBe('b')
  })
})

describe('randomDuration', () => {
  it('returns the low bound at rng=0; default range for unknown states', () => {
    expect(randomDuration('sit', () => 0)).toBe(3000)
    expect(randomDuration('mystery', () => 0)).toBe(2000)
  })
})
