// ─── Dig spots ────────────────────────────────────────────────────────────────
//
// Persistence for the `dig` interactable reaction (docs/hubworld.md §7):
// each dig spot can be dug once per real day. Entries are keyed with
// interactableStoreKey(town, id) — the same convention as interactable
// grants — mapping to the YYYY-MM-DD the spot was last dug.

const KEY = 'jarv_hub_digs'

type DigStore = Record<string, string>

function load(): DigStore {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as DigStore) : {}
  } catch {
    return {}
  }
}

function save(store: DigStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch { /* ignore */ }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Whether this dig spot can still be dug today. */
export function canDigToday(storeKey: string): boolean {
  return load()[storeKey] !== todayKey()
}

/** Record that this dig spot was dug today. */
export function recordDig(storeKey: string): void {
  const store = load()
  store[storeKey] = todayKey()
  save(store)
}
