import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadHomeLayout, isHomeLayoutEmpty, placeFurniture, moveFurniture, removeFurniture,
  HOME_GRID_COLS, HOME_GRID_ROWS,
} from './homeLayout'
import { grantFurniture } from './furniture'

function installLocalStorageStub(): Map<string, string> {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
  return store
}

// 1x1 footprint
const LAMP = 'reading-lamp'
// 2x1 footprint (2 wide, 1 tall)
const TABLE = 'round-table'
const HOUSE = 'ravenwatch:test-house'

describe('homeLayout', () => {
  beforeEach(() => {
    installLocalStorageStub()
    grantFurniture(LAMP)
    grantFurniture(TABLE)
  })

  it('starts empty', () => {
    expect(loadHomeLayout(HOUSE)).toEqual([])
    expect(isHomeLayoutEmpty(HOUSE)).toBe(true)
  })

  it('places an owned piece within bounds', () => {
    const piece = placeFurniture(HOUSE, LAMP, 2, 3)
    expect(piece).not.toBeNull()
    expect(piece).toMatchObject({ itemId: LAMP, x: 2, y: 3, rotation: 0 })
    expect(loadHomeLayout(HOUSE)).toHaveLength(1)
    expect(isHomeLayoutEmpty(HOUSE)).toBe(false)
  })

  it('rejects placement of an item that is not owned', () => {
    expect(placeFurniture(HOUSE, 'oak-bookshelf', 0, 0)).toBeNull()
    expect(loadHomeLayout(HOUSE)).toHaveLength(0)
  })

  it('rejects placement of an unknown itemId', () => {
    expect(placeFurniture(HOUSE, 'not-a-real-item', 0, 0)).toBeNull()
    expect(loadHomeLayout(HOUSE)).toHaveLength(0)
  })

  it('rejects placement out of bounds', () => {
    expect(placeFurniture(HOUSE, LAMP, -1, 0)).toBeNull()
    expect(placeFurniture(HOUSE, LAMP, 0, -1)).toBeNull()
    expect(placeFurniture(HOUSE, LAMP, HOME_GRID_COLS, 0)).toBeNull()
    expect(placeFurniture(HOUSE, LAMP, 0, HOME_GRID_ROWS)).toBeNull()
    expect(loadHomeLayout(HOUSE)).toHaveLength(0)
  })

  it('rejects a 2-wide piece that would extend past the right edge', () => {
    expect(placeFurniture(HOUSE, TABLE, HOME_GRID_COLS - 1, 0)).toBeNull()
    expect(loadHomeLayout(HOUSE)).toHaveLength(0)
  })

  it('rejects placement on an occupied cell', () => {
    expect(placeFurniture(HOUSE, LAMP, 1, 1)).not.toBeNull()
    expect(placeFurniture(HOUSE, TABLE, 0, 1)).toBeNull() // would cover (0,1) and (1,1)
    expect(loadHomeLayout(HOUSE)).toHaveLength(1)
  })

  it('a multi-cell footprint blocks every cell it covers, not just its origin', () => {
    expect(placeFurniture(HOUSE, TABLE, 2, 2)).not.toBeNull() // covers (2,2) and (3,2)
    expect(placeFurniture(HOUSE, LAMP, 3, 2)).toBeNull()
    expect(placeFurniture(HOUSE, LAMP, 2, 2)).toBeNull()
    expect(placeFurniture(HOUSE, LAMP, 4, 2)).not.toBeNull() // just outside the footprint
  })

  it('rotation swaps footprint dimensions for bounds checking', () => {
    // TABLE is 2w x 1h; rotated 90, it becomes 1w x 2h and should fit vertically
    // at the bottom row where a horizontal 2x1 would not fit.
    expect(placeFurniture(HOUSE, TABLE, 0, HOME_GRID_ROWS - 2, 90)).not.toBeNull()
    // Unrotated, a 2-wide piece can't fit in the last single row.
    expect(placeFurniture(HOUSE, TABLE, 0, HOME_GRID_ROWS - 1)).toBeNull()
  })

  it('moves a piece to a free cell', () => {
    const piece = placeFurniture(HOUSE, LAMP, 0, 0)!
    expect(moveFurniture(HOUSE, piece.id, 4, 5, 90)).toBe(true)
    const [moved] = loadHomeLayout(HOUSE)
    expect(moved).toMatchObject({ x: 4, y: 5, rotation: 90 })
  })

  it('rejects moving onto another piece and onto out-of-bounds cells', () => {
    const a = placeFurniture(HOUSE, LAMP, 0, 0)!
    placeFurniture(HOUSE, LAMP, 1, 0)
    expect(moveFurniture(HOUSE, a.id, 1, 0)).toBe(false)
    expect(moveFurniture(HOUSE, a.id, -1, 0)).toBe(false)
    expect(moveFurniture(HOUSE, a.id, 0, 0)).toBe(true) // onto its own current cell
  })

  it('returns false when moving an unknown id', () => {
    expect(moveFurniture(HOUSE, 'does-not-exist', 0, 0)).toBe(false)
  })

  it('removes a piece and frees its cell', () => {
    const piece = placeFurniture(HOUSE, LAMP, 2, 2)!
    expect(removeFurniture(HOUSE, piece.id)).toBe(true)
    expect(loadHomeLayout(HOUSE)).toHaveLength(0)
    expect(placeFurniture(HOUSE, LAMP, 2, 2)).not.toBeNull()
  })

  it('returns false when removing an unknown id', () => {
    expect(removeFurniture(HOUSE, 'does-not-exist')).toBe(false)
  })

  it('persists across separate load calls', () => {
    placeFurniture(HOUSE, LAMP, 0, 0)
    placeFurniture(HOUSE, LAMP, 1, 1)
    expect(loadHomeLayout(HOUSE)).toHaveLength(2)
  })

  it('fails open when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(loadHomeLayout(HOUSE)).toEqual([])
    expect(() => placeFurniture(HOUSE, LAMP, 0, 0)).not.toThrow()
  })

  describe('per-house scoping', () => {
    it('keeps two houses\' furniture independent', () => {
      placeFurniture('ravenwatch:house-a', LAMP, 0, 0)
      placeFurniture('millhaven:house-b', TABLE, 3, 3)
      expect(loadHomeLayout('ravenwatch:house-a')).toHaveLength(1)
      expect(loadHomeLayout('millhaven:house-b')).toHaveLength(1)
      expect(loadHomeLayout('ravenwatch:house-a')[0].itemId).toBe(LAMP)
      expect(loadHomeLayout('millhaven:house-b')[0].itemId).toBe(TABLE)
    })

    it('the legacy default bucket falls back to pre-scoping unscoped data once', () => {
      const store = installLocalStorageStub()
      grantFurniture(LAMP)
      store.set('jarv_hub_home_layout', JSON.stringify({
        placed: [{ id: 'legacy-1', itemId: LAMP, x: 0, y: 0, rotation: 0 }],
      }))
      expect(loadHomeLayout('default')).toHaveLength(1)
      expect(loadHomeLayout('default')[0].id).toBe('legacy-1')
      // A non-default house key never sees the legacy data.
      expect(loadHomeLayout(HOUSE)).toHaveLength(0)
    })

    it('writes to the default bucket land in its own namespaced key, not the legacy key', () => {
      const store = installLocalStorageStub()
      grantFurniture(LAMP)
      placeFurniture('default', LAMP, 1, 1)
      expect(store.has('jarv_hub_home_layout:default')).toBe(true)
      expect(store.has('jarv_hub_home_layout')).toBe(false)
    })
  })
})
