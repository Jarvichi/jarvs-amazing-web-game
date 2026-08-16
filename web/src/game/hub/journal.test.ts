import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  recordNpcMet, hasMetNpc, getMetNpcIds,
  recordAnimalSeen, hasSeenAnimal, getSeenAnimalVariants, getSeenAnimalTypes,
  recordAreaSeen, hasSeenArea, getSeenAreaKeys,
  recordFishCaught, hasCaughtFish, getCaughtFishKeys,
} from './journal'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

describe('journal', () => {
  beforeEach(() => {
    installLocalStorageStub()
  })

  it('records and reads met NPCs, deduplicating', () => {
    expect(hasMetNpc('elder')).toBe(false)
    expect(recordNpcMet('elder')).toBe(true)
    expect(recordNpcMet('elder')).toBe(false)
    expect(hasMetNpc('elder')).toBe(true)
    expect(getMetNpcIds()).toEqual(new Set(['elder']))
  })

  it('records seen animal species and named variants', () => {
    expect(hasSeenAnimal('cat')).toBe(false)
    expect(recordAnimalSeen('cat', 'orange')).toBe(true)
    expect(hasSeenAnimal('cat')).toBe(true)
    expect(getSeenAnimalVariants('cat')).toEqual(new Set(['orange']))
    expect(getSeenAnimalTypes()).toEqual(new Set(['cat']))

    // Same species + same variant again is not new info.
    expect(recordAnimalSeen('cat', 'orange')).toBe(false)
    // Same species, a different variant is new info.
    expect(recordAnimalSeen('cat', 'black')).toBe(true)
    expect(getSeenAnimalVariants('cat')).toEqual(new Set(['orange', 'black']))
  })

  it('marks a species seen even without a resolved variant', () => {
    expect(recordAnimalSeen('dog')).toBe(true)
    expect(hasSeenAnimal('dog')).toBe(true)
    expect(getSeenAnimalVariants('dog')).toEqual(new Set())
    // No new info the second time.
    expect(recordAnimalSeen('dog')).toBe(false)
  })

  it('records seen areas scoped per-town, deduplicating', () => {
    expect(hasSeenArea('ravenwatch', 'market')).toBe(false)
    expect(recordAreaSeen('ravenwatch', 'market')).toBe(true)
    expect(recordAreaSeen('ravenwatch', 'market')).toBe(false)
    expect(hasSeenArea('ravenwatch', 'market')).toBe(true)
    // Same area id in a different town is a distinct key.
    expect(hasSeenArea('millhaven', 'market')).toBe(false)
    expect(getSeenAreaKeys()).toEqual(new Set(['ravenwatch:market']))
  })

  it('records caught fish species scoped per-locale, deduplicating', () => {
    expect(hasCaughtFish('river', 'Minnow')).toBe(false)
    expect(recordFishCaught('river', 'Minnow')).toBe(true)
    expect(recordFishCaught('river', 'Minnow')).toBe(false)
    expect(hasCaughtFish('river', 'Minnow')).toBe(true)
    // Same species name in a different locale is a distinct key.
    expect(hasCaughtFish('ocean', 'Minnow')).toBe(false)
    expect(getCaughtFishKeys()).toEqual(new Set(['river:Minnow']))
  })

  it('returns empty + false when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(() => recordNpcMet('x')).not.toThrow()
    expect(hasMetNpc('x')).toBe(false)
    expect(getMetNpcIds()).toEqual(new Set())
    expect(getSeenAreaKeys()).toEqual(new Set())
  })
})
