import { describe, it, expect } from 'vitest'
import { createHubLocationData, createHubQuestData } from './loader'
import type { RawConfig } from './config'
import type { RawQuestConfig } from './questDefs'
import { buildingWorldTile, pickupWorldTile } from '../../game/hub/npcLocator'
import { computeInteriorShape } from '../../game/hub/interiorShape'
import { getHubWorldData } from './hubWorldFactory'
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

  it('keeps indoor items on actual floor so they stay reachable', () => {
    // computeInteriorShape's floorSet is the walkable interior — the wall
    // ring for a plain rectangle, but also excludes any tile carved out by
    // room.carve (HubInterior.carve), which the old width/height-ring-only
    // arithmetic here wouldn't have caught.
    const offFloor = interior.filter(p => {
      const room = loc.HUB_INTERIORS[p.building!]
      if (!room) return false
      const { floorSet } = computeInteriorShape(room.width, room.height, room.carve)
      return !floorSet.has(`${p.tx},${p.ty}`)
    })
    expect(offFloor.map(p => `${p.id} @ ${p.building} (${p.tx},${p.ty})`)).toEqual([])
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

// Reference integrity for hand-authored quests. A typo in any of these ids does
// not crash anything — the quest just quietly never offers, never advances, or
// never reveals its item — so it is exactly the kind of mistake that survives
// into a build.
describe('Ravenwatch quest references', () => {
  const npcIds = new Set(loc.HUB_NPCS.map(n => n.id))
  const questIds = new Set(quests.HUB_QUEST_DEFS.map(q => q.id))
  const pickupIds = new Set(pickups.map(p => p.id))
  const interactableIds = new Set(loc.HUB_INTERACTABLES.map(i => i.id))
  const authored = quests.HUB_QUEST_DEFS

  it('names a real NPC, animal or interactable as giver and receiver', () => {
    // Animals give and receive quests too (Rover, Pip, the stray cat), and a
    // world object can be the giver (the collapsed gravestone offers The False
    // Grave) — so all three rosters count.
    const receivers = new Set([...npcIds, ...loc.HUB_ANIMALS.map(a => a.id)])
    const givers = new Set([...receivers, ...interactableIds])
    const bad = authored.flatMap(q => [
      ...(givers.has(q.giverNpcId) ? [] : [`${q.id}: giver "${q.giverNpcId}"`]),
      ...(receivers.has(q.receiverNpcId) ? [] : [`${q.id}: receiver "${q.receiverNpcId}"`]),
    ])
    expect(bad).toEqual([])
  })

  it('lists only pickup ids that exist', () => {
    const bad = authored.flatMap(q =>
      (q.steps ?? []).flatMap(s => (s.pickupIds ?? [])
        .filter(id => !pickupIds.has(id))
        .map(id => `${q.id}/${s.key}: "${id}"`)))
    expect(bad).toEqual([])
  })

  it('gates on quests that exist', () => {
    // checkPrerequisite treats an unknown token as satisfied, so a typo'd
    // quest id silently ungates the quest instead of failing loudly.
    const bad = authored.flatMap(q => (q.prerequisite ?? '').split('|')
      .map(t => t.trim())
      .filter(t => t.startsWith('quest:') && !questIds.has(t.slice(6)))
      .map(t => `${q.id}: "${t}"`))
    expect(bad).toEqual([])
  })

  it('chains steps and pickups to pickup ids that exist', () => {
    // A chain pointing at a missing id leaves the chained item permanently
    // hidden, making the quest impossible to finish.
    const badSteps = authored.flatMap(q => (q.steps ?? [])
      .filter(s => s.chain && !pickupIds.has(s.chain))
      .map(s => `${q.id}/${s.key} step chain: "${s.chain}"`))
    const badPickups = pickups
      .filter(p => p.chain && !pickupIds.has(p.chain))
      .map(p => `${p.id} pickup chain: "${p.chain}"`)
    expect([...badSteps, ...badPickups]).toEqual([])
  })

  it('gives every step of a multi-step quest its own progress key', () => {
    // Progress is stored per step key, so a duplicate key makes two steps share
    // a counter and complete together.
    const bad = authored
      .filter(q => new Set((q.steps ?? []).map(s => s.key)).size !== (q.steps ?? []).length)
      .map(q => q.id)
    expect(bad).toEqual([])
  })

  it('covers every step key when activeDialogue is keyed per step', () => {
    // getActiveDialogue falls back to the first entry for an unlisted key, so a
    // missing key shows the wrong hint rather than erroring.
    const bad = authored.flatMap(q => {
      if (typeof q.activeDialogue !== 'object' || q.activeDialogue === null) return []
      const keyed = q.activeDialogue as Record<string, string | undefined>
      return (q.steps ?? [])
        .filter(s => !keyed[s.key])
        .map(s => `${q.id}: no activeDialogue for step "${s.key}"`)
    })
    expect(bad).toEqual([])
  })
})

// An interactable can offer a quest (a scarecrow, a collapsed gravestone). Its
// `quest` reaction calls tryOfferQuest(def.id, ...), which matches on
// `giverNpcId === def.id` — so the quest's giver must be the *interactable's own
// id*, not an NPC and not blank. Get it wrong and there is no error anywhere: the
// reaction chain calls next(), the world object does whatever else it was going
// to do, and the quest is simply unofferable forever. Swept across every town.
const { locationRegistry } = await getHubWorldData()

describe('interactable-given quests', () => {
  for (const [townKey, { locationData, locationQuests }] of Object.entries(locationRegistry)) {
    const byId = new Map(locationQuests.HUB_QUEST_DEFS.map(q => [q.id, q]))
    for (const interactable of locationData.HUB_INTERACTABLES) {
      for (const reaction of interactable.reactions) {
        if (reaction.type !== 'quest') continue
        it(`${townKey}/${interactable.id}: quest "${reaction.questId}" names it as the giver`, () => {
          const quest = byId.get(reaction.questId)
          expect(quest, `no quest "${reaction.questId}" in ${townKey}`).toBeTruthy()
          expect(
            quest!.giverNpcId,
            `${reaction.questId}.giverNpcId must be "${interactable.id}" for the offer to resolve`,
          ).toBe(interactable.id)
        })
      }
    }
  }
})

// A door or interior exit can be gated behind requiredQuest (a graveyard
// entrance that only opens once a quest is solved, a sealed vault). Get the
// id wrong and there is no error anywhere: the gate just never opens — it
// shows a generic "sealed" message forever, indistinguishable from working
// as intended. Swept across every town.
describe('requiredQuest gates name real quests', () => {
  for (const [townKey, { locationData, locationQuests }] of Object.entries(locationRegistry)) {
    const questIds = new Set(locationQuests.HUB_QUEST_DEFS.map(q => q.id))
    for (const door of locationData.HUB_DOORS) {
      if (!door.requiredQuest) continue
      it(`${townKey}/door → "${door.buildingId}": requiredQuest "${door.requiredQuest}" exists`, () => {
        expect(questIds.has(door.requiredQuest!), `no quest "${door.requiredQuest}" in ${townKey}`).toBe(true)
      })
    }
    for (const [interiorId, interior] of Object.entries(locationData.HUB_INTERIORS)) {
      for (const exit of interior.exits ?? []) {
        if (!exit.requiredQuest) continue
        it(`${townKey}/${interiorId} exit → "${exit.toInteriorId}": requiredQuest "${exit.requiredQuest}" exists`, () => {
          expect(questIds.has(exit.requiredQuest!), `no quest "${exit.requiredQuest}" in ${townKey}`).toBe(true)
        })
      }
    }
  }
})
