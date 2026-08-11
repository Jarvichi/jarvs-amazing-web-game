import { describe, it, expect } from 'vitest'
import { getHubWorldData } from './hubWorldFactory'
import { isBuildingOpen } from '../../game/hub/hubNpcSchedule'
import { hourInRange } from '../../game/hub/hubClock'

// Guard for #2111: an NPC's schedule can place them inside a building during
// hours that building's own `hours` window says it's closed. Nothing enforced
// this before — HubTownCanvas's schedule-walk just followed the schedule with no
// regard for the interior's own hours — so a mismatch shipped silently: the
// Elder's schedule sent them into Ravenwatch's town-hall from 06:00, two hours
// before its own 08:00 opening. Swept across every town.
const { locationRegistry } = await getHubWorldData()

describe('NPC schedules respect building hours', () => {
  for (const [townKey, { locationData }] of Object.entries(locationRegistry)) {
    for (const npc of locationData.HUB_NPCS) {
      for (const entry of npc.schedule ?? []) {
        if (entry.location.type !== 'interior') continue
        const { buildingId } = entry.location
        const interior = locationData.HUB_INTERIORS[buildingId]
        if (!interior) continue  // a missing interior is a different kind of bug, not this one

        it(`${townKey}/${npc.id}: scheduled in "${buildingId}" only while it's open`, () => {
          const closedHours: number[] = []
          for (let h = 0; h < 24; h++) {
            if (hourInRange(h, entry.startHour, entry.endHour) && !isBuildingOpen(interior, h))
              closedHours.push(h)
          }
          expect(
            closedHours,
            `${npc.id}'s ${entry.startHour}–${entry.endHour} schedule entry places them in ` +
            `"${buildingId}", but it's closed at hour(s) ${closedHours.join(', ')}`,
          ).toEqual([])
        })
      }
    }
  }
})
