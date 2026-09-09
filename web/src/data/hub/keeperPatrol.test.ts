import { describe, it, expect } from 'vitest'
import { getHubWorldData } from './hubWorldFactory'
import {
  pickPatrolTile, isAtLandmark, tileDistance,
  PATROL_LANDMARK_CLEARANCE, PATROL_SPEAK_RADIUS,
} from '../../game/hub/npcPatrol'

const { locationRegistry: LOCATION_REGISTRY } = await getHubWorldData()

// The three mini-game keepers — well keeper, cellarer, stowhand — point at a
// piece of town scenery that opens a game. They used to stand still beside it,
// which parked a ~5-tile-wide speech bubble on top of the very thing they were
// pointing at, so they now walk a beat (game/hub/npcPatrol.ts).
//
// That only works if the beat is authored correctly in every town, and none of
// it is visible at runtime: a keeper with no patrol silently goes back to
// standing there, and a keeper whose beat can never reach speaking range of
// their landmark silently stops mentioning it at all. Both fail the build here
// instead.

const KEEPERS = [
  { suffix: '-well-keeper', screenPrefix: 'hub-wellspring' },
  { suffix: '-cellarer',    screenPrefix: 'hub-casks' },
  { suffix: '-stowhand',    screenPrefix: 'hub-stowage' },
]

/** Where a patroller may actually stand: street tiles, less the ones marked
 *  unwalkable and the ones with solid decor on them. Mirrors how
 *  HubTownCanvas builds `pathSet` closely enough to prove a beat is usable. */
function walkableTiles(locationData: any): Set<string> {
  const walkable = new Set<string>(
    (locationData.HUB_STREET_TILES as [number, number][]).map(([tx, ty]) => `${tx},${ty}`))
  for (const [tx, ty] of locationData.HUB_STREET_NONWALKABLE_TILES as [number, number][]) {
    walkable.delete(`${tx},${ty}`)
  }
  for (const d of locationData.EXTERIOR_DECOR as { tx: number; ty: number; zlayer?: string }[]) {
    if (d.zlayer === 'solid') walkable.delete(`${d.tx},${d.ty}`)
  }
  return walkable
}

describe('every mini-game keeper patrols a beat that reaches its landmark', () => {
  for (const [townKey, { locationData }] of Object.entries(LOCATION_REGISTRY)) {
    for (const { suffix, screenPrefix } of KEEPERS) {
      const npc = locationData.EXTERIOR_NPCS.find(n => n.id.endsWith(suffix))
      const trigger = locationData.HUB_INTERACTABLES.find(i =>
        i.reactions.some(r => r.type === 'screen' && r.screen.startsWith(screenPrefix)))

      it(`${townKey}${suffix}: patrols around the scenery it talks about`, () => {
        expect(npc, `${townKey} has no ${suffix}`).toBeTruthy()
        expect(trigger, `${townKey} has no ${screenPrefix} interactable`).toBeTruthy()
        if (!npc || !trigger) return

        expect(npc.patrol, `${townKey}${suffix} has no patrol — it would stand on its bubble`).toBeTruthy()
        // The landmark is what the beat avoids stopping on and what gates the
        // proximity line, so pointing it at the wrong tile is worse than
        // leaving it out.
        expect(npc.patrol!.landmark).toEqual({ tx: trigger.tx, ty: trigger.ty })
        expect(npc.patrol!.radius).toBeGreaterThan(PATROL_LANDMARK_CLEARANCE)
      })

      it(`${townKey}${suffix}: has no schedule competing with its beat`, () => {
        // A scheduled NPC has somewhere to be, so the canvas skips patrolling
        // them entirely — authoring both would silently disable the beat.
        if (!npc) return
        expect(npc.schedule ?? []).toHaveLength(0)
      })

      it(`${townKey}${suffix}: its beat covers the landmark`, () => {
        if (!npc?.patrol || !trigger) return
        expect(tileDistance({ tx: npc.tx, ty: npc.ty }, { tx: trigger.tx, ty: trigger.ty }))
          .toBeLessThanOrEqual(npc.patrol.radius)
      })

      it(`${townKey}${suffix}: can actually stand somewhere it can be heard from`, () => {
        if (!npc?.patrol || !trigger) return
        const landmark = { tx: trigger.tx, ty: trigger.ty }
        const walkable = walkableTiles(locationData)

        // Every tile the beat could pick, per pickPatrolTile's own rules.
        const beat: { tx: number; ty: number }[] = []
        for (let dy = -npc.patrol.radius; dy <= npc.patrol.radius; dy++) {
          for (let dx = -npc.patrol.radius; dx <= npc.patrol.radius; dx++) {
            const tile = { tx: npc.tx + dx, ty: npc.ty + dy }
            if (!walkable.has(`${tile.tx},${tile.ty}`)) continue
            if (tileDistance(tile, landmark) <= PATROL_LANDMARK_CLEARANCE) continue
            beat.push(tile)
          }
        }

        const speaking = beat.filter(t => isAtLandmark(t, landmark))
        expect(speaking.length,
          `${townKey}${suffix} can never get within ${PATROL_SPEAK_RADIUS} tiles of its landmark, ` +
          `so it would never mention the mini-game`,
        ).toBeGreaterThan(0)

        // ...and somewhere else to go, so it is a patrol rather than a shuffle
        // between two tiles.
        expect(beat.length, `${townKey}${suffix}'s beat is too cramped to walk`).toBeGreaterThan(2)
      })

      it(`${townKey}${suffix}: never picks a tile on top of the scenery`, () => {
        if (!npc?.patrol || !trigger) return
        const landmark = { tx: trigger.tx, ty: trigger.ty }
        const walkable = walkableTiles(locationData)
        let rngState = 1
        const rng = () => { rngState = (rngState * 1664525 + 1013904223) >>> 0; return rngState / 0x100000000 }
        let current = { tx: npc.tx, ty: npc.ty }
        for (let step = 0; step < 60; step++) {
          const next = pickPatrolTile(
            { tx: npc.tx, ty: npc.ty }, npc.patrol.radius, current, walkable, landmark, rng)
          if (!next) break
          expect(tileDistance(next, landmark)).toBeGreaterThan(PATROL_LANDMARK_CLEARANCE)
          current = next
        }
      })
    }
  }
})
