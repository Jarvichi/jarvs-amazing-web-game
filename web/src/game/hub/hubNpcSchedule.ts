import { hourInRange } from './hubClock'
import { isCampaignComplete } from '../questline'
import { getQuestState } from './quests'
import type { HubNpc, HubInterior, NpcScheduleEntry, NpcActivity } from '../../data/hub/loader'

/** True once the NPC's `questVariant.requireQuest` has been completed. */
function isQuestVariantActive(npc: HubNpc): boolean {
  return !!npc.questVariant && getQuestState(npc.questVariant.requireQuest).status === 'completed'
}

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
  if (isQuestVariantActive(npc) && npc.questVariant!.dialogue?.length) return npc.questVariant!.dialogue
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

/**
 * Where an NPC should render inside `buildingId` right now, or null if they
 * aren't there at all (#2111). An NPC with no `schedule` keeps the original,
 * always-present behaviour — shown at their static `tx`/`ty` whenever the
 * player is in their static `building`. An NPC *with* a schedule is shown only
 * while it currently places them in this exact building, at that schedule
 * entry's own `tx`/`ty` — which is often not their static spot (a shopkeeper's
 * `work` post vs. their static position, or a sleep entry pointing at a
 * different sub-room entirely). Deliberately has no fallback for an hour a
 * schedule doesn't cover: a gap means "not here," which is also how a gap in
 * 24-hour coverage gets caught (see npcScheduleIntegrity.test.ts) rather than
 * silently papered over by defaulting back to their static position.
 */
export function resolveNpcInteriorPresence(
  npc: HubNpc,
  buildingId: string,
  gameHour: number,
): { tx: number; ty: number } | null {
  const base = !npc.schedule?.length
    ? (npc.building === buildingId ? { tx: npc.tx, ty: npc.ty } : null)
    : (() => {
        const loc = getNpcLocation(npc, gameHour)
        return loc?.type === 'interior' && loc.buildingId === buildingId ? { tx: loc.tx, ty: loc.ty } : null
      })()
  if (!base) return null
  if (isQuestVariantActive(npc) && npc.questVariant!.tx != null && npc.questVariant!.ty != null) {
    return { tx: npc.questVariant!.tx, ty: npc.questVariant!.ty }
  }
  return base
}

export function isBuildingOpen(interior: HubInterior, gameHour: number): boolean {
  if (!interior.hours || interior.hours === 'always') return true
  const { open, close } = interior.hours as { open: number; close: number }
  return hourInRange(gameHour, open, close)
}
