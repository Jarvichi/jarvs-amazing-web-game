// ─── Gift cooldown ────────────────────────────────────────────────────────────
//
// Persistence for the generic "Give a gift" NPC interaction (§7d/§7f):
// each NPC can only receive a gift once per real day, mirroring
// talkCooldown.ts's "Make conversation" gate. Keyed by bare npcId, same
// convention as friendship.ts/talkCooldown.ts, mapping to the YYYY-MM-DD
// the NPC was last gifted.

import { logError } from '../../logger'

const KEY = 'jarv_hub_gift_cooldown'

type GiftCooldownStore = Record<string, string>

function load(): GiftCooldownStore {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as GiftCooldownStore) : {}
  } catch {
    return {}
  }
}

function save(store: GiftCooldownStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch (e) {
    logError('giftCooldown save failed', { error: String(e) })
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Whether this NPC can still receive a gift today. */
export function canGiftToday(npcId: string): boolean {
  return load()[npcId] !== todayKey()
}

/** Record that this NPC received a gift today. */
export function recordGift(npcId: string): void {
  const store = load()
  store[npcId] = todayKey()
  save(store)
}
