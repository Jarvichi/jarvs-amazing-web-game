// ─── Cellar sortings ──────────────────────────────────────────────────────────
//
// Persistence for the hub world's town cellars (docs/minigame-cask-sounding.md
// §5): each town's cellar can be sorted once per real day. Keyed with
// interactableStoreKey(town, CASKS_KEY) — the same convention as dig spots,
// forage spots and wells — mapping to the YYYY-MM-DD it was last put right.
//
// Keyed by town rather than by interactable id on purpose: a town has one
// cellar to sort, and the cooldown is what makes thirteen of them a reason to
// travel rather than a single spot to farm.

import { interactableStoreKey } from './interactables'

const KEY = 'jarv_hub_casks'

/** One cellar per town, so the id half of the store key is a constant. */
const CASKS_KEY = 'casks'

type CaskStore = Record<string, string>

function load(): CaskStore {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as CaskStore) : {}
  } catch {
    return {}
  }
}

function save(store: CaskStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch { /* ignore */ }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function storeKey(town: string): string {
  return interactableStoreKey(town, CASKS_KEY)
}

/** Whether this town's cellar can still be sorted today. */
export function canSortToday(town: string): boolean {
  return load()[storeKey(town)] !== todayKey()
}

/** Record that this town's cellar was sorted today. */
export function recordSort(town: string): void {
  const store = load()
  store[storeKey(town)] = todayKey()
  save(store)
}

// ── Cellarer flavour ──────────────────────────────────────────────────────────

/** Distance at which a cellarer first mentions the casks, and where they get
 *  specific about it. Chebyshev tiles, matching the rest of the hub's
 *  proximity dialogue. */
const FAR = 8
const NEAR = 4

export interface CellarerState {
  /** Whether the player is carrying the cooper's mallet. */
  hasMallet:  boolean
  /** Whether this town's cellar has already been sorted today. */
  sortedToday: boolean
}

/**
 * What the cellarer loitering by a town's casks says as you walk past.
 *
 * The barrel is the only way into Cask Sounding, and a barrel in the street is
 * easy scenery to walk past a hundred times without ever thinking to tap it.
 * The cellarer is the nudge: a line at a distance that something is wrong, and
 * a closer one naming what would fix it — including the mallet, so a player who
 * has never seen one learns it exists and where to buy it. Nothing nagging once
 * the cellar is done for the day.
 */
export function cellarerDialogue(state: CellarerState): { atDistance: number; text: string }[] {
  if (state.sortedToday) {
    return [
      { atDistance: FAR,  text: 'Cellar\'s honest again, thanks to you.' },
      { atDistance: NEAR, text: 'Drawn off the bad ones this morning. It\'ll turn again by tomorrow — it always does.' },
    ]
  }
  if (!state.hasMallet) {
    return [
      { atDistance: FAR,  text: 'Smell that? Something down there\'s turned.' },
      { atDistance: NEAR, text: 'I\'d know a sour cask by the ring of it, if I had the ear. A cooper\'s mallet would do it — Appleford sells them.' },
    ]
  }
  return [
    { atDistance: FAR,  text: 'Smell that? Something down there\'s turned.' },
    { atDistance: NEAR, text: 'You\'ve a mallet on you. Go down and tell me which of them are bad.' },
  ]
}
