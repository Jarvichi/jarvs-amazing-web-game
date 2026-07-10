import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getFurnitureDef, getAllFurnitureDefs, getOwnedFurnitureIds, ownsFurniture, grantFurniture } from './furniture'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

describe('furniture', () => {
  beforeEach(() => {
    installLocalStorageStub()
  })

  it('looks up a catalog def by id', () => {
    const def = getFurnitureDef('reading-lamp')
    expect(def).toMatchObject({ id: 'reading-lamp', name: 'Reading Lamp', footprint: { w: 1, h: 1 } })
  })

  it('returns undefined for an unknown id', () => {
    expect(getFurnitureDef('not-a-real-item')).toBeUndefined()
  })

  it('lists the whole catalog', () => {
    const all = getAllFurnitureDefs()
    expect(all.length).toBeGreaterThan(0)
    expect(all.every(f => f.id && f.name && f.footprint)).toBe(true)
  })

  it('starts with nothing owned', () => {
    expect(getOwnedFurnitureIds()).toEqual([])
    expect(ownsFurniture('reading-lamp')).toBe(false)
  })

  it('grants ownership of a catalog item', () => {
    expect(grantFurniture('reading-lamp')).toBe(true)
    expect(ownsFurniture('reading-lamp')).toBe(true)
    expect(getOwnedFurnitureIds()).toEqual(['reading-lamp'])
  })

  it('is idempotent — granting an already-owned item returns false', () => {
    grantFurniture('reading-lamp')
    expect(grantFurniture('reading-lamp')).toBe(false)
    expect(getOwnedFurnitureIds()).toEqual(['reading-lamp'])
  })

  it('refuses to grant an unknown id', () => {
    expect(grantFurniture('not-a-real-item')).toBe(false)
    expect(getOwnedFurnitureIds()).toEqual([])
  })

  it('fails open when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(getOwnedFurnitureIds()).toEqual([])
    expect(ownsFurniture('reading-lamp')).toBe(false)
    expect(() => grantFurniture('reading-lamp')).not.toThrow()
  })
})
