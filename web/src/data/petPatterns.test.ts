import { describe, it, expect } from 'vitest'
import { PET_PATTERNS, getPatternsForSpecies, getPatternDef } from './petPatterns'

describe('getPatternsForSpecies', () => {
  it('returns exactly the cat patterns', () => {
    expect(getPatternsForSpecies('cat').map(p => p.id).sort()).toEqual(['calico', 'tabby', 'tuxedo'])
  })

  it('returns exactly the dog patterns', () => {
    expect(getPatternsForSpecies('dog').map(p => p.id).sort()).toEqual(['black-and-tan', 'brindle', 'spotted'])
  })
})

describe('getPatternDef', () => {
  it('resolves a pattern for its own species', () => {
    expect(getPatternDef('cat', 'tabby')?.label).toBe('Tabby')
  })

  it('returns undefined for a pattern that belongs to a different species', () => {
    expect(getPatternDef('cat', 'brindle')).toBeUndefined()
  })

  it('returns undefined for undefined or "none"', () => {
    expect(getPatternDef('cat', undefined)).toBeUndefined()
    expect(getPatternDef('cat', 'none')).toBeUndefined()
  })

  it('returns undefined for an unknown id', () => {
    expect(getPatternDef('dog', 'not-a-real-pattern')).toBeUndefined()
  })
})

describe('PET_PATTERNS shape', () => {
  it('every part has exactly one of useBaseColor/tint', () => {
    for (const pattern of PET_PATTERNS) {
      for (const part of pattern.parts) {
        const hasBase = part.useBaseColor === true
        const hasTint = typeof part.tint === 'number'
        expect(hasBase !== hasTint).toBe(true)
      }
    }
  })

  it('every pattern has at least one part', () => {
    for (const pattern of PET_PATTERNS) {
      expect(pattern.parts.length).toBeGreaterThan(0)
    }
  })
})
