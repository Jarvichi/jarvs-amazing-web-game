import { describe, it, expect } from 'vitest'
import { resolveNpcPlace, buildingWorldTile, areaNameForTile } from './npcLocator'
import type { HubLocationBundle, HubNpc } from '../../data/hub/loader'

// Minimal bundle with only the fields the locator reads.
const loc = {
  HUB_TOWN_NAME: 'Testville',
  HUB_AREAS: [{ id: 'sq', name: 'Town Square', x: 0, y: 0, w: 32 * 10, h: 32 * 10 }],
  HUB_DOORS: [{ buildingId: 'inn', tx: 10, ty: 12 }],
  HUB_BUILDINGS: [
    { rect: [8, 8, 12, 12], id: 'inn' },
    { rect: [20, 20, 24, 24], id: 'smithy' }, // no door → footprint centre
  ],
  HUB_INTERIORS: {
    inn:    { id: 'inn',    name: 'The Sleepy Inn', width: 6, height: 6, decor: [] },
    smithy: { id: 'smithy', name: "Smith's Forge",  width: 6, height: 6, decor: [] },
  },
} as unknown as HubLocationBundle

const base: HubNpc = { id: 'x', name: 'X', sprite: 's', tx: 3, ty: 3, dialogue: [] }

describe('buildingWorldTile', () => {
  it('uses the door entrance when available', () => {
    expect(buildingWorldTile('inn', loc)).toEqual({ tx: 10, ty: 12 })
  })
  it('falls back to the footprint centre when there is no door', () => {
    expect(buildingWorldTile('smithy', loc)).toEqual({ tx: 22, ty: 22 })
  })
  it('returns null for an unknown building', () => {
    expect(buildingWorldTile('nope', loc)).toBeNull()
  })
})

describe('areaNameForTile', () => {
  it('names the area containing the tile centre', () => {
    expect(areaNameForTile(3, 3, loc.HUB_AREAS)).toBe('Town Square')
  })
  it('returns null outside any area', () => {
    expect(areaNameForTile(50, 50, loc.HUB_AREAS)).toBeNull()
  })
})

describe('resolveNpcPlace', () => {
  it('maps a scheduled interior NPC to the building world door, not interior-local coords', () => {
    const npc: HubNpc = { ...base, schedule: [{ startHour: 6, endHour: 20, location: { type: 'interior', buildingId: 'inn', tx: 1, ty: 1 } }] }
    expect(resolveNpcPlace(npc, 12, loc)).toEqual({ name: 'The Sleepy Inn', tx: 10, ty: 12, interiorId: 'inn' })
  })

  it('maps a building NPC with no schedule to the building world position', () => {
    const npc: HubNpc = { ...base, building: 'smithy', tx: 1, ty: 1 }
    expect(resolveNpcPlace(npc, 9, loc)).toEqual({ name: "Smith's Forge", tx: 22, ty: 22, interiorId: 'smithy' })
  })

  it('resolves a scheduled exterior NPC to its area and tile', () => {
    const npc: HubNpc = { ...base, schedule: [{ startHour: 6, endHour: 20, location: { type: 'exterior', tx: 3, ty: 3 } }] }
    expect(resolveNpcPlace(npc, 12, loc)).toEqual({ name: 'Town Square', tx: 3, ty: 3 })
  })

  it('uses the town name when an exterior tile is in no named area', () => {
    const npc: HubNpc = { ...base, tx: 50, ty: 50 }
    expect(resolveNpcPlace(npc, 12, loc)).toEqual({ name: 'Testville', tx: 50, ty: 50 })
  })
})
