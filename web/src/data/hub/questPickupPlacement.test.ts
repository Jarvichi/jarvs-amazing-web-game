import { describe, it, expect } from 'vitest'
import { createHubLocationData, createHubQuestData } from './loader'
import type { RawConfig } from './config'
import type { RawQuestConfig } from './questDefs'
import { buildingWorldTile, pickupWorldTile } from '../../game/hub/npcLocator'
import ravenwatchConfig from './ravenwatch/config.json'
import ravenwatchQuests from './ravenwatch/questDefs.json'

// Placement invariants for Ravenwatch's quest items. Quest dialogue describes
// where an item is ("by the pond", "in the games hall"), but nothing links the
// prose to the coordinates, so items drift when the town layout is rebuilt.
// These checks catch the mechanical half of that drift: items that cannot be
// found at all, or that name a building they are not in.
const loc = createHubLocationData(ravenwatchConfig as unknown as RawConfig)
const quests = createHubQuestData(ravenwatchQuests as unknown as RawQuestConfig)

const pickups = quests.HUB_PICKUP_ITEMS
const exterior = pickups.filter(p => !p.building)
const interior = pickups.filter(p => p.building)

const tileKey = (tx: number, ty: number) => `${tx},${ty}`
const pondTiles = new Set(loc.HUB_POND_TILES.map(([tx, ty]) => tileKey(tx, ty)))
const buildingTiles = new Set(loc.HUB_BUILDING_TILES.map(([tx, ty]) => tileKey(tx, ty)))

describe('Ravenwatch quest pickups', () => {
  it('has items to check', () => {
    expect(exterior.length).toBeGreaterThan(100)
    expect(interior.length).toBeGreaterThan(50)
  })

  it('places every exterior item inside the map', () => {
    const outside = exterior.filter(p =>
      p.tx < 0 || p.ty < 0 || p.tx * 32 >= loc.MAP_W || p.ty * 32 >= loc.MAP_H)
    expect(outside.map(p => p.id)).toEqual([])
  })

  it('never leaves an exterior item floating on open water', () => {
    const drowned = exterior.filter(p => pondTiles.has(tileKey(p.tx, p.ty)))
    expect(drowned.map(p => p.id)).toEqual([])
  })

  it('never hides an exterior item under a building footprint', () => {
    const buried = exterior.filter(p => buildingTiles.has(tileKey(p.tx, p.ty)))
    expect(buried.map(p => p.id)).toEqual([])
  })

  it('resolves every indoor item to a building placed on the map', () => {
    // An unresolvable building means the minimap has no honest tile to pin, and
    // the item's interior-local coords would otherwise be read as world coords.
    const unplaceable = interior.filter(p => pickupWorldTile(p, loc) === null)
    expect(unplaceable.map(p => p.id)).toEqual([])
  })

  it('names a real interior and sits within its grid', () => {
    const bad = interior.filter(p => {
      const room = loc.HUB_INTERIORS[p.building!]
      return !room || p.tx < 0 || p.ty < 0 || p.tx >= room.width || p.ty >= room.height
    })
    expect(bad.map(p => `${p.id} @ ${p.building}`)).toEqual([])
  })

  it('keeps indoor items off the interior wall ring so they stay reachable', () => {
    // Interiors are walkable on 1..width-2 / 1..height-2 (HubTownCanvas builds the
    // walkable set that way); the outer ring is wall.
    const inWall = interior.filter(p => {
      const room = loc.HUB_INTERIORS[p.building!]
      if (!room) return false
      return p.tx < 1 || p.ty < 1 || p.tx > room.width - 2 || p.ty > room.height - 2
    })
    expect(inWall.map(p => `${p.id} @ ${p.building} (${p.tx},${p.ty})`)).toEqual([])
  })
})

describe('Ravenwatch quest targets', () => {
  it('delivers only to NPCs or animals that exist in the town', () => {
    // Delivery steps pointing at an animal (the stray cat) resolve through
    // HUB_ANIMALS, not HUB_NPCS — a lookup that only checks NPCs silently
    // produces no map pin for those steps.
    const npcIds = new Set(loc.HUB_NPCS.map(n => n.id))
    const animalIds = new Set(loc.HUB_ANIMALS.map(a => a.id))
    const unknown: string[] = []
    for (const quest of quests.HUB_QUEST_DEFS) {
      for (const step of quest.steps ?? []) {
        const target = step.targetNpcId
        if (!target) continue
        if (!npcIds.has(target) && !animalIds.has(target)) unknown.push(`${quest.id} → ${target}`)
      }
    }
    expect(unknown).toEqual([])
  })

  it('resolves every quest-giver in a building to a placeable location', () => {
    const stranded = loc.HUB_NPCS
      .filter(n => n.building && buildingWorldTile(n.building, loc) === null)
      .map(n => `${n.id} @ ${n.building}`)
    expect(stranded).toEqual([])
  })
})
