import { describe, it, expect } from 'vitest'
import { getHubWorldData, LOCATION_KEY_BY_MAP_ID } from './hubWorldFactory'
import { hourInRange } from '../../game/hub/hubClock'
import type { MapId } from './mapIds'

// Guard for #2111 phase 4: a 'travel' schedule entry names the town an NPC
// should actually be found in. For the game to genuinely place them there —
// not just hide them at home — that destination town's own config.json must
// separately author a full HubNpc record with the same id, present (not
// itself traveling) during the hours the home-town side claims they're away.
// There's no cross-town NPC registry at runtime to enforce this automatically
// (each town's HUB_NPCS is strictly that town's own data), so a typo'd
// destination or an un-mirrored schedule fails silently: the NPC just vanishes
// with nowhere to reappear. Swept across every town.
const { locationRegistry } = await getHubWorldData()

const MAP_ID_BY_LOCATION_KEY: Record<string, MapId> = Object.fromEntries(
  (Object.entries(LOCATION_KEY_BY_MAP_ID) as [MapId, string][]).map(([mapId, key]) => [key, mapId]),
)

describe('NPC travel entries target a real town with a matching present record', () => {
  for (const [townKey, { locationData }] of Object.entries(locationRegistry)) {
    const ownMapId = MAP_ID_BY_LOCATION_KEY[townKey]
    for (const npc of locationData.HUB_NPCS) {
      for (const entry of npc.schedule ?? []) {
        if (entry.location.type !== 'travel') continue
        const destTown = entry.location.town
        const destKey = LOCATION_KEY_BY_MAP_ID[destTown] as string | undefined

        it(`${townKey}/${npc.id}: travels to a real, different town`, () => {
          expect(destTown, `${npc.id} is marked traveling to their own town (${townKey})`).not.toBe(ownMapId)
          expect(destKey && locationRegistry[destKey], `no such town "${destTown}"`).toBeTruthy()
        })

        if (!destKey || !locationRegistry[destKey]) continue

        it(`${townKey}/${npc.id}: has a matching record in "${destTown}" actually present ${entry.startHour}–${entry.endHour}`, () => {
          const destNpc = locationRegistry[destKey].locationData.HUB_NPCS.find(n => n.id === npc.id)
          expect(destNpc, `no NPC with id "${npc.id}" authored in ${destTown}'s config.json`).toBeTruthy()
          if (!destNpc) return

          const badHours: number[] = []
          for (let h = 0; h < 24; h++) {
            if (!hourInRange(h, entry.startHour, entry.endHour)) continue
            const destLoc = destNpc.schedule?.find(e => hourInRange(h, e.startHour, e.endHour))?.location
            if (!destLoc || destLoc.type === 'travel') badHours.push(h)
          }
          expect(
            badHours,
            `${npc.id} is marked traveling to ${destTown} at hour(s) ${badHours.join(', ')}, but their ` +
            `${destTown} record doesn't resolve them present there then`,
          ).toEqual([])
        })
      }
    }
  }
})

// Guard: within a single town, HUB_NPCS.find(n => n.id === npcId) (used by
// every tap/quest/dialogue lookup in HubWorld.tsx) always resolves to the
// FIRST matching record. Two NPCs sharing an id in the same config.json
// silently shadow one another — the second one's dialogueTree/quest wiring
// becomes unreachable even though its sprite still renders and shows its own
// flavour dialogue. (Cross-town id reuse is fine and expected — that's how
// 'travel' schedule entries above work.)
describe('NPC ids are unique within a single town', () => {
  for (const [townKey, { locationData }] of Object.entries(locationRegistry)) {
    it(`${townKey}: no duplicate npc ids`, () => {
      const seen = new Map<string, number>()
      for (const npc of locationData.HUB_NPCS) {
        seen.set(npc.id, (seen.get(npc.id) ?? 0) + 1)
      }
      const dupes = [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id)
      expect(dupes, `duplicate npc id(s) in ${townKey}'s config.json: ${dupes.join(', ')}`).toEqual([])
    })
  }
})
