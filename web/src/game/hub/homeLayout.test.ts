import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadHomeLayout, isHomeLayoutEmpty, placeFurniture, moveFurniture, removeFurniture,
  HOME_GRID_COLS, HOME_GRID_ROWS,
} from './homeLayout'
import { grantFurniture } from './furniture'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

// 1x1 footprint
const LAMP = 'reading-lamp'
// 2x1 footprint (2 wide, 1 tall)
const TABLE = 'round-table'

describe('homeLayout', () => {
  beforeEach(() => {
    installLocalStorageStub()
    grantFurniture(LAMP)
    grantFurniture(TABLE)
  })

  it('starts empty', () => {
    expect(loadHomeLayout()).toEqual([])
    expect(isHomeLayoutEmpty()).toBe(true)
  })

  it('places an owned piece within bounds', () => {
    const piece = placeFurniture(LAMP, 2, 3)
    expect(piece).not.toBeNull()
    expect(piece).toMatchObject({ itemId: LAMP, x: 2, y: 3, rotation: 0 })
    expect(loadHomeLayout()).toHaveLength(1)
    expect(isHomeLayoutEmpty()).toBe(false)
  })

  it('rejects placement of an item that is not owned', () => {
    expect(placeFurniture('oak-bookshelf', 0, 0)).toBeNull()
    expect(loadHomeLayout()).toHaveLength(0)
  })

  it('rejects placement of an unknown itemId', () => {
    expect(placeFurniture('not-a-real-item', 0, 0)).toBeNull()
    expect(loadHomeLayout()).toHaveLength(0)
  })

  it('rejects placement out of bounds', () => {
    expect(placeFurniture(LAMP, -1, 0)).toBeNull()
    expect(placeFurniture(LAMP, 0, -1)).toBeNull()
    expect(placeFurniture(LAMP, HOME_GRID_COLS, 0)).toBeNull()
    expect(placeFurniture(LAMP, 0, HOME_GRID_ROWS)).toBeNull()
    expect(loadHomeLayout()).toHaveLength(0)
  })

  it('rejects a 2-wide piece that would extend past the right edge', () => {
    expect(placeFurniture(TABLE, HOME_GRID_COLS - 1, 0)).toBeNull()
    expect(loadHomeLayout()).toHaveLength(0)
  })

  it('rejects placement on an occupied cell', () => {
    expect(placeFurniture(LAMP, 1, 1)).not.toBeNull()
    expect(placeFurniture(TABLE, 0, 1)).toBeNull() // would cover (0,1) and (1,1)
    expect(loadHomeLayout()).toHaveLength(1)
  })

  it('a multi-cell footprint blocks every cell it covers, not just its origin', () => {
    expect(placeFurniture(TABLE, 2, 2)).not.toBeNull() // covers (2,2) and (3,2)
    expect(placeFurniture(LAMP, 3, 2)).toBeNull()
    expect(placeFurniture(LAMP, 2, 2)).toBeNull()
    expect(placeFurniture(LAMP, 4, 2)).not.toBeNull() // just outside the footprint
  })

  it('rotation swaps footprint dimensions for bounds checking', () => {
    // TABLE is 2w x 1h; rotated 90, it becomes 1w x 2h and should fit vertically
    // at the bottom row where a horizontal 2x1 would not fit.
    expect(placeFurniture(TABLE, 0, HOME_GRID_ROWS - 2, 90)).not.toBeNull()
    // Unrotated, a 2-wide piece can't fit in the last single row.
    expect(placeFurniture(TABLE, 0, HOME_GRID_ROWS - 1)).toBeNull()
  })

  it('moves a piece to a free cell', () => {
    const piece = placeFurniture(LAMP, 0, 0)!
    expect(moveFurniture(piece.id, 4, 5, 90)).toBe(true)
    const [moved] = loadHomeLayout()
    expect(moved).toMatchObject({ x: 4, y: 5, rotation: 90 })
  })

  it('rejects moving onto another piece and onto out-of-bounds cells', () => {
    const a = placeFurniture(LAMP, 0, 0)!
    placeFurniture(LAMP, 1, 0)
    expect(moveFurniture(a.id, 1, 0)).toBe(false)
    expect(moveFurniture(a.id, -1, 0)).toBe(false)
    expect(moveFurniture(a.id, 0, 0)).toBe(true) // onto its own current cell
  })

  it('returns false when moving an unknown id', () => {
    expect(moveFurniture('does-not-exist', 0, 0)).toBe(false)
  })

  it('removes a piece and frees its cell', () => {
    const piece = placeFurniture(LAMP, 2, 2)!
    expect(removeFurniture(piece.id)).toBe(true)
    expect(loadHomeLayout()).toHaveLength(0)
    expect(placeFurniture(LAMP, 2, 2)).not.toBeNull()
  })

  it('returns false when removing an unknown id', () => {
    expect(removeFurniture('does-not-exist')).toBe(false)
  })

  it('persists across separate load calls', () => {
    placeFurniture(LAMP, 0, 0)
    placeFurniture(LAMP, 1, 1)
    expect(loadHomeLayout()).toHaveLength(2)
  })

  it('fails open when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(loadHomeLayout()).toEqual([])
    expect(() => placeFurniture(LAMP, 0, 0)).not.toThrow()
  })
})
