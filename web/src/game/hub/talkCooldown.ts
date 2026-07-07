// ─── Talk cooldown ────────────────────────────────────────────────────────────
//
// Persistence for the generic "Make conversation" NPC interaction (§7c/§7d):
// each NPC can only grant conversation friendship/relationship once per real
// day. Keyed by bare npcId, same convention as friendship.ts/relationships.ts,
// mapping to the YYYY-MM-DD the NPC was last talked to.

import { logError } from '../../logger'

const KEY = 'jarv_hub_talk_cooldown'

type TalkCooldownStore = Record<string, string>

function load(): TalkCooldownStore {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as TalkCooldownStore) : {}
  } catch {
    return {}
  }
}

function save(store: TalkCooldownStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch (e) {
    logError('talkCooldown save failed', { error: String(e) })
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Whether this NPC can still grant "Make conversation" progress today. */
export function canTalkToday(npcId: string): boolean {
  return load()[npcId] !== todayKey()
}

/** Record that this NPC's "Make conversation" progress was granted today. */
export function recordTalk(npcId: string): void {
  const store = load()
  store[npcId] = todayKey()
  save(store)
}
