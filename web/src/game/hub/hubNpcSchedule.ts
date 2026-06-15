import { hourInRange } from './hubClock'
import type { HubNpc, HubInterior, NpcScheduleEntry, NpcActivity } from '../../data/hub/loader'

/**
 * Single source of truth for activity → emote glyph shown above an NPC while it
 * performs the activity at its scheduled location. Adding an activity = an entry
 * here + (optionally) a `{sprite}-{activity}.svg` pose sprite.
 */
export const ACTIVITY_EMOTES: Record<NpcActivity, string> = {
  work: '🔨',
  eat: '🍲',
  'idle-chat': '💬',
  sleep: '💤',
  sweep: '🧹',
  fish: '🎣',
}

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

/** Emote glyph for an activity, or null. */
export function getActivityEmote(activity: NpcActivity | null | undefined): string | null {
  return activity ? ACTIVITY_EMOTES[activity] ?? null : null
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
