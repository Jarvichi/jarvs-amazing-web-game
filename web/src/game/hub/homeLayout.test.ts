import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadHomeLayout, isHomeLayoutEmpty, placeFurniture, moveFurniture, removeFurniture,
  HOME_GRID_COLS, HOME_GRID_ROWS,
} from './homeLayout'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

describe('homeLayout', () => {
  beforeEach(() => {
    installLocalStorageStub()
  })

  it('starts empty', () => {
    expect(loadHomeLayout()).toEqual([])
    expect(isHomeLayoutEmpty()).toBe(true)
  })

  it('places a piece within bounds', () => {
    const piece = placeFurniture('rug-1', 2, 3)
    expect(piece).not.toBeNull()
    expect(piece).toMatchObject({ itemId: 'rug-1', x: 2, y: 3, rotation: 0 })
    expect(loadHomeLayout()).toHaveLength(1)
    expect(isHomeLayoutEmpty()).toBe(false)
  })

  it('rejects placement out of bounds', () => {
    expect(placeFurniture('rug-1', -1, 0)).toBeNull()
    expect(placeFurniture('rug-1', 0, -1)).toBeNull()
    expect(placeFurniture('rug-1', HOME_GRID_COLS, 0)).toBeNull()
    expect(placeFurniture('rug-1', 0, HOME_GRID_ROWS)).toBeNull()
    expect(loadHomeLayout()).toHaveLength(0)
  })

  it('rejects placement on an occupied cell', () => {
    expect(placeFurniture('rug-1', 1, 1)).not.toBeNull()
    expect(placeFurniture('lamp-1', 1, 1)).toBeNull()
    expect(loadHomeLayout()).toHaveLength(1)
  })

  it('moves a piece to a free cell', () => {
    const piece = placeFurniture('rug-1', 0, 0)!
    expect(moveFurniture(piece.id, 4, 5, 90)).toBe(true)
    const [moved] = loadHomeLayout()
    expect(moved).toMatchObject({ x: 4, y: 5, rotation: 90 })
  })

  it('rejects moving onto another piece and onto out-of-bounds cells', () => {
    const a = placeFurniture('rug-1', 0, 0)!
    placeFurniture('lamp-1', 1, 0)
    expect(moveFurniture(a.id, 1, 0)).toBe(false)
    expect(moveFurniture(a.id, -1, 0)).toBe(false)
    expect(moveFurniture(a.id, 0, 0)).toBe(true) // onto its own current cell
  })

  it('returns false when moving an unknown id', () => {
    expect(moveFurniture('does-not-exist', 0, 0)).toBe(false)
  })

  it('removes a piece and frees its cell', () => {
    const piece = placeFurniture('rug-1', 2, 2)!
    expect(removeFurniture(piece.id)).toBe(true)
    expect(loadHomeLayout()).toHaveLength(0)
    expect(placeFurniture('lamp-1', 2, 2)).not.toBeNull()
  })

  it('returns false when removing an unknown id', () => {
    expect(removeFurniture('does-not-exist')).toBe(false)
  })

  it('persists across separate load calls', () => {
    placeFurniture('rug-1', 0, 0)
    placeFurniture('lamp-1', 1, 1)
    expect(loadHomeLayout()).toHaveLength(2)
  })

  it('fails open when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(loadHomeLayout()).toEqual([])
    expect(() => placeFurniture('rug-1', 0, 0)).not.toThrow()
  })
})
