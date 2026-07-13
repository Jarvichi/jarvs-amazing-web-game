import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getRoomSlotDef, getAllRoomSlotDefs, getPurchasedSlotIds, hasPurchasedSlot, purchaseRoomSlot,
  parseSlotBuildingId, buildMainRoomExit, synthesizeSlotInterior,
} from './houseRooms'

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

describe('houseRooms catalog', () => {
  it('lists all five slot types', () => {
    const all = getAllRoomSlotDefs()
    expect(all.map(s => s.id).sort()).toEqual(['basement', 'first-floor', 'left', 'rear', 'right'])
  })

  it('looks up a slot by id', () => {
    expect(getRoomSlotDef('left')).toMatchObject({ id: 'left', name: 'Left Room' })
  })

  it('returns undefined for an unknown slot id', () => {
    expect(getRoomSlotDef('attic')).toBeUndefined()
  })
})

describe('houseRooms purchase persistence', () => {
  beforeEach(() => { installLocalStorageStub() })

  it('starts with nothing purchased', () => {
    expect(getPurchasedSlotIds(HOUSE)).toEqual([])
    expect(hasPurchasedSlot(HOUSE, 'left')).toBe(false)
  })

  it('purchases a slot', () => {
    expect(purchaseRoomSlot(HOUSE, 'left')).toBe(true)
    expect(hasPurchasedSlot(HOUSE, 'left')).toBe(true)
    expect(getPurchasedSlotIds(HOUSE)).toEqual(['left'])
  })

  it('is idempotent — purchasing an already-owned slot returns false', () => {
    purchaseRoomSlot(HOUSE, 'left')
    expect(purchaseRoomSlot(HOUSE, 'left')).toBe(false)
    expect(getPurchasedSlotIds(HOUSE)).toEqual(['left'])
  })

  it('refuses to purchase an unknown slot id', () => {
    expect(purchaseRoomSlot(HOUSE, 'attic')).toBe(false)
    expect(getPurchasedSlotIds(HOUSE)).toEqual([])
  })

  it('scopes purchases per house — buying in one town/building does not affect another', () => {
    purchaseRoomSlot('Millhaven:building-1', 'left')
    expect(hasPurchasedSlot('Ravenwatch:building-1', 'left')).toBe(false)
    expect(getPurchasedSlotIds('Ravenwatch:building-1')).toEqual([])
  })

  it('fails open when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(getPurchasedSlotIds(HOUSE)).toEqual([])
    expect(() => purchaseRoomSlot(HOUSE, 'left')).not.toThrow()
  })
})

describe('parseSlotBuildingId', () => {
  it('matches a valid <mainId>-<slotId> pair', () => {
    expect(parseSlotBuildingId('building-1-left', 'building-1')).toMatchObject({ id: 'left' })
    expect(parseSlotBuildingId('building-1-first-floor', 'building-1')).toMatchObject({ id: 'first-floor' })
  })

  it('returns undefined for ids not prefixed by the main building', () => {
    expect(parseSlotBuildingId('building-2-left', 'building-1')).toBeUndefined()
  })

  it('returns undefined for a suffix that is not a real slot', () => {
    expect(parseSlotBuildingId('building-1-attic', 'building-1')).toBeUndefined()
  })
})

describe('exit synthesis', () => {
  it('builds a main-room exit pointing at the slot sub-interior', () => {
    const slot = getRoomSlotDef('left')!
    const exit = buildMainRoomExit(slot, 'building-1-left')
    expect(exit).toMatchObject({ toInteriorId: 'building-1-left', direction: 'left', label: 'Left Room' })
  })

  it('synthesizes a full playerDecor interior with a return exit to the main room', () => {
    const slot = getRoomSlotDef('basement')!
    const interior = synthesizeSlotInterior('building-1', 'Ocean Heights', slot)
    expect(interior.id).toBe('building-1-basement')
    expect(interior.name).toBe('Ocean Heights — Basement')
    expect(interior.width).toBe(10)
    expect(interior.height).toBe(8)
    expect(interior.playerDecor).toBe(true)
    expect(interior.decor).toEqual([])
    expect(interior.floorTileId).toBeGreaterThan(0)
    expect(interior.exits).toHaveLength(1)
    expect(interior.exits![0]).toMatchObject({ toInteriorId: 'building-1', direction: 'up', label: 'Back' })
  })
})
