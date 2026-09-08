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

// ── Well-keeper flavour ───────────────────────────────────────────────────────

/** Distance at which a keeper first mentions the well, and where they get
 *  specific about it. Chebyshev tiles, matching the rest of the hub's
 *  proximity dialogue. */
const FAR = 8
const NEAR = 4

export interface WellKeeperState {
  /** Whether the player is carrying the winding crank. */
  hasCrank:      boolean
  /** Whether this town's well has already been put right today. */
  restoredToday: boolean
}

/**
 * What the NPC loitering by a town's well says as you walk past.
 *
 * The well is the only way into the Wellspring puzzle, and a stone well is
 * easy scenery to walk past a hundred times without ever thinking to tap it.
 * The keeper is the nudge: a line at a distance that something is wrong, and
 * a closer one naming what would fix it — including the crank, so a player
 * who has never seen one learns it exists and where to buy it.
 */
export function wellKeeperDialogue(state: WellKeeperState): { atDistance: number; text: string }[] {
  if (state.restoredToday) {
    return [
      { atDistance: FAR,  text: 'Water\'s running clean today.' },
      { atDistance: NEAR, text: 'Whoever saw to the channels down there has my thanks.' },
    ]
  }
  if (!state.hasCrank) {
    return [
      { atDistance: FAR,  text: 'The well\'s dry again.' },
      { atDistance: NEAR, text: 'Winding gear\'s seized solid. You\'d want a crank off Gearford to shift it.' },
    ]
  }
  return [
    { atDistance: FAR,  text: 'The well\'s dry again.' },
    { atDistance: NEAR, text: 'Someone ought to climb down and see to the channels.' },
  ]
}
