// ─── Flame state ──────────────────────────────────────────────────────────────
//
// Persistence for the `stokeFlame` interactable reaction (docs/hubworld.md §7):
// once a flame decor entry has been fed (e.g. a log tossed on a campfire), its
// upgraded FlameType persists across reloads. Entries are keyed with
// interactableStoreKey(town, id) — the same convention as interactable
// grants/digs/forages — mapping to the current FlameType.

import type { FlameType } from '../../data/hub/loader'

const KEY = 'jarv_hub_flame_state'

type FlameStore = Record<string, FlameType>

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

/** This interactable's current flame type, falling back to `fallback` (its authored default) if never stoked. */
export function getFlameType(storeKey: string, fallback: FlameType): FlameType {
  return load()[storeKey] ?? fallback
}

/** Record this interactable's flame as upgraded/changed to `type`. */
export function setFlameType(storeKey: string, type: FlameType): void {
  const store = load()
  store[storeKey] = type
  save(store)
}
