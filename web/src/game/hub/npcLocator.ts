import type { HubArea, HubLocationBundle, HubNpc } from '../../data/hub/loader'
import { getNpcLocation } from './hubNpcSchedule'

const T = 32

export interface NpcPlace {
  /** Human-readable current location (area or building name). */
  name: string
  /** Current tile position. */
  tx: number
  ty: number
  /** Set when the NPC is currently inside a building interior. */
  interiorId?: string
}

/** Name of the area whose rect contains the centre of tile (tx, ty), or null. */
export function areaNameForTile(tx: number, ty: number, areas: HubArea[]): string | null {
  const px = tx * T + T / 2
  const py = ty * T + T / 2
  const area = areas.find(a => px >= a.x && px < a.x + a.w && py >= a.y && py < a.y + a.h)
  return area?.name ?? null
}

/**
 * Resolve where an NPC is *right now* (for the given game hour), returning both a
 * display name and tile coordinates. Falls back to the NPC's base position/building
 * when no schedule entry applies.
 */
export function resolveNpcPlace(npc: HubNpc, gameHour: number, loc: HubLocationBundle): NpcPlace {
  const sched = getNpcLocation(npc, gameHour)

  if (sched?.type === 'interior') {
    return { name: loc.HUB_INTERIORS[sched.buildingId]?.name ?? 'a building', tx: sched.tx, ty: sched.ty, interiorId: sched.buildingId }
  }
  if (sched?.type === 'exterior') {
    return { name: areaNameForTile(sched.tx, sched.ty, loc.HUB_AREAS) ?? loc.HUB_TOWN_NAME, tx: sched.tx, ty: sched.ty }
  }

  // No schedule entry for this hour — use the NPC's base placement.
  if (npc.building) {
    return { name: loc.HUB_INTERIORS[npc.building]?.name ?? 'a building', tx: npc.tx, ty: npc.ty, interiorId: npc.building }
  }
  return { name: areaNameForTile(npc.tx, npc.ty, loc.HUB_AREAS) ?? loc.HUB_TOWN_NAME, tx: npc.tx, ty: npc.ty }
}
