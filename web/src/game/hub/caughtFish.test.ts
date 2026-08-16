import { describe, it, expect, beforeEach, vi } from 'vitest'
import { addCaughtFish, getCaughtFish, removeCaughtFish } from './caughtFish'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

const BASE = { locale: 'ocean', tier: 'Shoal', tierIcon: '🐟', name: 'Silverside', weightGrams: 200, lengthCm: 12, stars: 2 }

describe('caughtFish', () => {
  beforeEach(() => {
    installLocalStorageStub()
  })

  it('starts empty', () => {
    expect(getCaughtFish()).toEqual([])
  })

  it('adds a catch and assigns it a unique id', () => {
    const a = addCaughtFish(BASE)
    const b = addCaughtFish(BASE)
    expect(a.id).not.toBe(b.id)
    expect(getCaughtFish()).toHaveLength(2)
    expect(getCaughtFish().map(f => f.id)).toEqual([a.id, b.id])
  })

  it('preserves the recorded fields', () => {
    const entry = addCaughtFish(BASE)
    expect(entry).toMatchObject(BASE)
    expect(getCaughtFish()[0]).toMatchObject(BASE)
  })

  it('removes a catch by id, leaving others intact', () => {
    const a = addCaughtFish(BASE)
    const b = addCaughtFish({ ...BASE, name: 'Anchovy' })
    expect(removeCaughtFish(a.id)).toBe(true)
    expect(getCaughtFish()).toEqual([b])
  })

  it('returns false removing an unknown id', () => {
    expect(removeCaughtFish('nope')).toBe(false)
  })

  it('returns empty + does not throw when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(() => addCaughtFish(BASE)).not.toThrow()
    expect(getCaughtFish()).toEqual([])
    expect(removeCaughtFish('anything')).toBe(false)
  })
})
