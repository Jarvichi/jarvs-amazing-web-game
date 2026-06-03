import { hourInRange } from './hubClock'
import type { HubNpc, HubInterior, NpcScheduleEntry } from '../../data/hub/loader'

export function getNpcLocation(npc: HubNpc, gameHour: number): NpcScheduleEntry['location'] | null {
  if (!npc.schedule?.length) return null
  for (const entry of npc.schedule) {
    if (hourInRange(gameHour, entry.startHour, entry.endHour)) return entry.location
  }
  return null
}

export function isNpcInBuilding(npc: HubNpc, buildingId: string, gameHour: number): boolean {
  const loc = getNpcLocation(npc, gameHour)
  return loc?.type === 'interior' && loc.buildingId === buildingId
}

export function isBuildingOpen(interior: HubInterior, gameHour: number): boolean {
  if (!interior.hours || interior.hours === 'always') return true
  const { open, close } = interior.hours as { open: number; close: number }
  return hourInRange(gameHour, open, close)
}
