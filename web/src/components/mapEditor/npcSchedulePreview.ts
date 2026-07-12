import { hourInRange } from '../../game/hub/hubClock'
import type { RawNpc } from './mapEditorTypes'

type ScheduleEntry = NonNullable<RawNpc['schedule']>[number]

/** Index of the schedule entry active at `hour`, or -1 if the NPC has no
 *  schedule or none of its entries cover that hour (static tx/ty applies). */
export function getScheduledEntryIndex(npc: RawNpc, hour: number): number {
  if (!npc.schedule?.length) return -1
  return npc.schedule.findIndex(entry => hourInRange(hour, entry.startHour, entry.endHour))
}

/** Where a scheduled NPC would be at `hour` — mirrors getNpcLocation in
 *  web/src/game/hub/hubNpcSchedule.ts, reimplemented against the editor's
 *  RawNpc (structurally close to HubNpc but not identical) to avoid a cast. */
export function getScheduledLocation(npc: RawNpc, hour: number): ScheduleEntry['location'] | null {
  const i = getScheduledEntryIndex(npc, hour)
  return i === -1 ? null : npc.schedule![i].location
}
