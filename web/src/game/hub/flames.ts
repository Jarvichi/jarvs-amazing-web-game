// ─── Flame state ──────────────────────────────────────────────────────────────
//
// Persistence for the `stokeFlame` interactable reaction (docs/hubworld.md §7):
// feeding a flame decor entry (e.g. tossing a log on a campfire) upgrades its
// FlameType for the rest of the day, the same once-per-real-day shape as
// digs.ts/forages.ts — the upgrade automatically lapses back to the authored
// default once the stored date is no longer today, with no explicit reset
// needed (the gate is just recomputed fresh on each read, same trick
// canDigToday uses). Entries are keyed with interactableStoreKey(town, id) —
// the same convention as interactable grants/digs/forages.

import type { FlameType } from '../../data/hub/loader'

const KEY = 'jarv_hub_flame_state'

interface FlameEntry { type: FlameType; date: string }
type FlameStore = Record<string, FlameEntry>

function load(): FlameStore {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as FlameStore) : {}
  } catch {
    return {}
  }
}

function save(store: FlameStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch { /* ignore */ }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * This interactable's current flame type, falling back to `fallback` (its
 * authored default) if never stoked today — a stoke from a previous day (or
 * an old pre-daily-reset save, which stored a plain FlameType string with no
 * `date`) reads back as `undefined` here and falls back the same way.
 */
export function getFlameType(storeKey: string, fallback: FlameType): FlameType {
  const entry = load()[storeKey]
  if (!entry || entry.date !== todayKey()) return fallback
  return entry.type
}

/** Record this interactable's flame as upgraded/changed to `type` for today. */
export function setFlameType(storeKey: string, type: FlameType): void {
  const store = load()
  store[storeKey] = { type, date: todayKey() }
  save(store)
}
