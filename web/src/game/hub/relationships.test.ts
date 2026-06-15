import { describe, it, expect, beforeEach } from 'vitest'
import {
  addRelationshipPoints,
  getRelationship,
  getRelationshipLevel,
  getRelationshipTrack,
} from './relationships'

// In-memory localStorage mock (tests run in node environment)
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  globalThis.localStorage = {
    getItem:    (k: string) => store.get(k) ?? null,
    setItem:    (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear:      () => { store.clear() },
    key:        (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  } as Storage
})

describe('relationships default state', () => {
  it('returns an empty entry for an unknown npc', () => {
    const rel = getRelationship('nobody')
    expect(rel.track).toBeNull()
    expect(rel.level).toBe(0)
    expect(rel.points).toEqual({ ally: 0, rival: 0, romance: 0 })
  })
})

describe('addRelationshipPoints', () => {
  it('accumulates points and sets the dominant track', () => {
    addRelationshipPoints('elder', 'ally', 4)
    expect(getRelationshipTrack('elder')).toBe('ally')
    expect(getRelationship('elder').points.ally).toBe(4)
  })

  it('derives level from the dominant track total (mirrors friendship ladder)', () => {
    addRelationshipPoints('elder', 'ally', 4)
    expect(getRelationshipLevel('elder')).toBe(1) // any points => level 1 ("met")
    addRelationshipPoints('elder', 'ally', 6)      // total 10 => level 2
    expect(getRelationshipLevel('elder')).toBe(2)
    addRelationshipPoints('elder', 'ally', 15)     // total 25 => level 3
    expect(getRelationshipLevel('elder')).toBe(3)
  })

  it('switches the dominant track when another overtakes it', () => {
    addRelationshipPoints('merchant', 'ally', 10)
    expect(getRelationshipTrack('merchant')).toBe('ally')
    addRelationshipPoints('merchant', 'rival', 12)
    expect(getRelationshipTrack('merchant')).toBe('rival')
    expect(getRelationshipLevel('merchant')).toBe(2) // 12 pts => level 2
  })

  it('keeps the current track on a tie (stable steering)', () => {
    addRelationshipPoints('rosie', 'ally', 10)
    addRelationshipPoints('rosie', 'romance', 10)
    expect(getRelationshipTrack('rosie')).toBe('ally')
  })

  it('persists across loads', () => {
    addRelationshipPoints('naia', 'romance', 30)
    expect(getRelationshipTrack('naia')).toBe('romance')
    expect(getRelationshipLevel('naia')).toBe(3) // 30 pts => level 3
  })
})
