// ─── Crate packings ───────────────────────────────────────────────────────────
//
// Persistence for the hub world's town crates (docs/minigame-stowage.md §5):
// each town's crate can be packed once per real day. Keyed with
// interactableStoreKey(town, STOWAGE_KEY) — the same convention as dig spots,
// forage spots, wells and cellars — mapping to the YYYY-MM-DD it was last
// packed.
//
// Keyed by town rather than by interactable id on purpose: a town has one load
// going out, and the cooldown is what makes thirteen of them a reason to travel
// rather than a single spot to farm.

import { interactableStoreKey } from './interactables'

const KEY = 'jarv_hub_stowage'

/** One crate per town, so the id half of the store key is a constant. */
const STOWAGE_KEY = 'stowage'

type StowageStore = Record<string, string>

function load(): StowageStore {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as StowageStore) : {}
  } catch {
    return {}
  }
}

function save(store: StowageStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch { /* ignore */ }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function storeKey(town: string): string {
  return interactableStoreKey(town, STOWAGE_KEY)
}

/** Whether this town's crate can still be packed today. */
export function canPackToday(town: string): boolean {
  return load()[storeKey(town)] !== todayKey()
}

/** Record that this town's crate was packed today. */
export function recordPack(town: string): void {
  const store = load()
  store[storeKey(town)] = todayKey()
  save(store)
}

// ── Stowhand flavour ──────────────────────────────────────────────────────────

/** Distance at which a stowhand first mentions the crate, and where they get
 *  specific about it. Chebyshev tiles, matching the rest of the hub's
 *  proximity dialogue. */
const FAR = 8
const NEAR = 4

export interface StowhandState {
  /** Whether the player is carrying the stevedore's hook. */
  hasHook:    boolean
  /** Whether this town's crate has already been packed today. */
  packedToday: boolean
}

/**
 * What the stowhand loitering by a town's crate says as you walk past.
 *
 * The crate is the only way into Stowage, and a crate in the street is easy
 * scenery to walk past a hundred times without ever thinking to tap it. The
 * stowhand is the nudge: a line at a distance that something is wrong, and a
 * closer one naming what would fix it — including the hook, so a player who has
 * never seen one learns it exists and where to buy it. Nothing nagging once the
 * load is away for the day.
 */
export function stowhandDialogue(state: StowhandState): { atDistance: number; text: string }[] {
  if (state.packedToday) {
    return [
      { atDistance: FAR,  text: 'Tight as a drum, that one.' },
      { atDistance: NEAR, text: 'Packed square this morning. Nothing left to shift till the next load comes in.' },
    ]
  }
  if (!state.hasHook) {
    return [
      { atDistance: FAR,  text: "That load's packed by somebody in a hurry." },
      { atDistance: NEAR, text: "Half of it's air and the rest is about to fall out. You'd want a stevedore's hook to shift those — Millhaven's harbour stalls sell them." },
    ]
  }
  return [
    { atDistance: FAR,  text: "That load's packed by somebody in a hurry." },
    { atDistance: NEAR, text: "You've a hook on you. Go on then — see if you can get the lot in." },
  ]
}
