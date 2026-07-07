// ─── Forage spots ─────────────────────────────────────────────────────────────
//
// Persistence for the `forage` interactable reaction (docs/hubworld.md §7):
// each forage spot can be foraged once per real day. Entries are keyed with
// interactableStoreKey(town, id) — the same convention as interactable
// grants and dig spots (digs.ts) — mapping to the YYYY-MM-DD the spot was
// last foraged.

import { logError } from '../../logger'

const KEY = 'jarv_hub_forages'

type ForageStore = Record<string, string>

function load(): ForageStore {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ForageStore) : {}
  } catch {
    return {}
  }
}

function save(store: ForageStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch (e) {
    logError('forages save failed', { error: String(e) })
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Whether this forage spot can still be foraged today. */
export function canForageToday(storeKey: string): boolean {
  return load()[storeKey] !== todayKey()
}

/** Record that this forage spot was foraged today. */
export function recordForage(storeKey: string): void {
  const store = load()
  store[storeKey] = todayKey()
  save(store)
}
