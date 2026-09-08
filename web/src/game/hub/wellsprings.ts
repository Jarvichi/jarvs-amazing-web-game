// ─── Wellspring restorations ──────────────────────────────────────────────────
//
// Persistence for the hub world's town wells (docs/minigame-wellspring.md §5):
// each town's well can be restored once per real day. Keyed with
// interactableStoreKey(town, WELL_KEY) — the same convention as dig spots and
// forage spots — mapping to the YYYY-MM-DD it was last put right.
//
// Keyed by town rather than by interactable id on purpose: a town has one
// well to fix, and the cooldown is what makes the thirteen of them a reason
// to travel rather than a single spot to farm.

import { interactableStoreKey } from './interactables'

const KEY = 'jarv_hub_wellsprings'

/** One well per town, so the id half of the store key is a constant. */
const WELL_KEY = 'wellspring'

type WellspringStore = Record<string, string>

function load(): WellspringStore {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as WellspringStore) : {}
  } catch {
    return {}
  }
}

function save(store: WellspringStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch { /* ignore */ }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function storeKey(town: string): string {
  return interactableStoreKey(town, WELL_KEY)
}

/** Whether this town's well can still be restored today. */
export function canRestoreToday(town: string): boolean {
  return load()[storeKey(town)] !== todayKey()
}

/** Record that this town's well was put right today. */
export function recordRestore(town: string): void {
  const store = load()
  store[storeKey(town)] = todayKey()
  save(store)
}
