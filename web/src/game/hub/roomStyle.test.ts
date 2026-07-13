import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getRoomStyle, setRoomFloor, setRoomWall, getResolvedRoomStyle } from './roomStyle'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

const HOUSE = 'Millhaven:building-1'

describe('roomStyle', () => {
  beforeEach(() => { installLocalStorageStub() })

  it('starts with no style set', () => {
    expect(getRoomStyle(HOUSE)).toEqual({})
    expect(getResolvedRoomStyle(HOUSE)).toEqual({ floorTileId: undefined, wallMaterial: undefined })
  })

  it('sets and persists a floor tile', () => {
    setRoomFloor(HOUSE, 'stoneFloor')
    expect(getRoomStyle(HOUSE)).toEqual({ floorTileId: 'stoneFloor' })
  })

  it('sets and persists a wall material', () => {
    setRoomWall(HOUSE, 'brick')
    expect(getRoomStyle(HOUSE)).toEqual({ wallMaterial: 'brick' })
  })

  it('setting floor and wall independently keeps both', () => {
    setRoomFloor(HOUSE, 'stoneFloor')
    setRoomWall(HOUSE, 'brick')
    expect(getRoomStyle(HOUSE)).toEqual({ floorTileId: 'stoneFloor', wallMaterial: 'brick' })
  })

  it('overwrites a previously set floor tile', () => {
    setRoomFloor(HOUSE, 'stoneFloor')
    setRoomFloor(HOUSE, 'woodFloor')
    expect(getRoomStyle(HOUSE)).toEqual({ floorTileId: 'woodFloor' })
  })

  it('resolves the stored floor tile name to a numeric id', () => {
    setRoomFloor(HOUSE, 'woodFloor')
    const resolved = getResolvedRoomStyle(HOUSE)
    expect(resolved.floorTileId).toBeGreaterThan(0)
    expect(resolved.wallMaterial).toBeUndefined()
  })

  it('scopes style per house — one room does not affect another', () => {
    setRoomFloor('Millhaven:building-1', 'stoneFloor')
    expect(getRoomStyle('Ravenwatch:building-1')).toEqual({})
  })

  it('scopes style per purchased room slot', () => {
    setRoomFloor(HOUSE, 'stoneFloor')
    setRoomFloor(`${HOUSE}-basement`, 'darkStoneFloor')
    expect(getRoomStyle(HOUSE)).toEqual({ floorTileId: 'stoneFloor' })
    expect(getRoomStyle(`${HOUSE}-basement`)).toEqual({ floorTileId: 'darkStoneFloor' })
  })

  it('fails open when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(getRoomStyle(HOUSE)).toEqual({})
    expect(() => setRoomFloor(HOUSE, 'stoneFloor')).not.toThrow()
  })
})
