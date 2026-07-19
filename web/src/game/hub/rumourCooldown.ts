// ─── Rumour cooldown ──────────────────────────────────────────────────────────
//
// Persistence for the "Ask about news" NPC interaction: an NPC with authored
// `innRumours` can only reveal one rumour per real day. Keyed by bare npcId,
// same convention as talkCooldown.ts/giftCooldown.ts, mapping to the
// YYYY-MM-DD the NPC last shared a rumour.

import { logError } from '../../logger'

const KEY = 'jarv_hub_rumour_cooldown'

type RumourCooldownStore = Record<string, string>

function load(): RumourCooldownStore {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as RumourCooldownStore) : {}
  } catch {
    return {}
  }
}

function save(store: RumourCooldownStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch (e) {
    logError('rumourCooldown save failed', { error: String(e) })
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Whether this NPC can still reveal a rumour today. */
export function canHearRumourToday(npcId: string): boolean {
  return load()[npcId] !== todayKey()
}

/** Record that this NPC revealed a rumour today. */
export function recordRumourHeard(npcId: string): void {
  const store = load()
  store[npcId] = todayKey()
  save(store)
}
