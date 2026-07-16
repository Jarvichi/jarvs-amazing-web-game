import { hourInRange } from './hubClock'
import { isCampaignComplete } from '../questline'
import type { HubNpc, HubInterior, NpcScheduleEntry, NpcActivity } from '../../data/hub/loader'

/**
 * Canonical list of NPC activities (single source of truth for editor dropdowns
 * and validation). Each activity optionally renders a `{sprite}-{activity}.svg`
 * pose sprite while the NPC performs it at its scheduled location.
 */
export const NPC_ACTIVITIES: NpcActivity[] = ['work', 'eat', 'idle-chat', 'sleep', 'sweep', 'fish']

export function getNpcLocation(npc: HubNpc, gameHour: number): NpcScheduleEntry['location'] | null {
  if (!npc.schedule?.length) return null
  for (const entry of npc.schedule) {
    if (hourInRange(gameHour, entry.startHour, entry.endHour)) return entry.location
  }
  return null
}

/** Returns the activity scheduled for the given hour, or null if none. */
export function getNpcActivity(npc: HubNpc, gameHour: number): NpcActivity | null {
  if (!npc.schedule?.length) return null
  for (const entry of npc.schedule) {
    if (hourInRange(gameHour, entry.startHour, entry.endHour)) return entry.activity ?? null
  }
  return null
}

/** The dialogue pool an NPC should draw from right now: the activity-specific
 *  pool when one is authored for the current scheduled activity, otherwise the
 *  post-campaign lines once campaign 1 is complete, otherwise the flat
 *  `dialogue` array. */
export function getNpcDialoguePool(npc: HubNpc, gameHour: number): string[] {
  const activity = getNpcActivity(npc, gameHour)
  const pool = activity ? npc.dialogueByActivity?.[activity] : undefined
  if (pool?.length) return pool
  if (npc.postCampaignDialogue?.length && isCampaignComplete('c1')) return npc.postCampaignDialogue
  return npc.dialogue
}

/** True while the NPC's schedule has them sleeping. */
export function isNpcAsleep(npc: HubNpc, gameHour: number): boolean {
  return getNpcActivity(npc, gameHour) === 'sleep'
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
