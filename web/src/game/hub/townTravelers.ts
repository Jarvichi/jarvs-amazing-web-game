// ─── Ambient travelers between towns (#2111) ────────────────────────────────
//
// An anonymous ambient NPC that walks off the map via an exit tile has "left
// town" — but towns don't simulate concurrently (only one HubTownCanvas is
// ever mounted at a time), so there's no live journey to animate them
// through. There's also no per-exit-tile "leads to Millhaven" data and no
// town-adjacency graph anywhere in the game (the world map is a flat picker),
// so a departure can't be routed to a specific destination town without
// inventing geography the game doesn't have.
//
// Instead this is one shared, town-agnostic counter: "how many wanderers are
// currently on the road." A departure from any town increments it; the next
// town the player visits can claim one as a fresh arrival. Genuine
// cross-session, cross-town population conservation, just honest about not
// knowing where any particular traveler went.

import { logError } from '../../logger'

const KEY = 'jarv_hub_travelers'

interface Store {
  onRoad: number
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Store) : { onRoad: 0 }
  } catch {
    return { onRoad: 0 }
  }
}

function save(data: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch (e) {
    logError('saveTownTravelers failed', { error: String(e) })
  }
}

/** An ambient NPC left town via an exit tile. */
export function recordDeparture(): void {
  const data = load()
  data.onRoad += 1
  save(data)
}

/** How many wanderers are currently on the road, awaiting an arrival claim. */
export function getTravelersOnRoad(): number {
  return load().onRoad
}

/**
 * Claim one traveler as arriving in the current town. Returns whether one was
 * actually available — never drains the counter below zero.
 */
export function claimArrival(): boolean {
  const data = load()
  if (data.onRoad <= 0) return false
  data.onRoad -= 1
  save(data)
  return true
}
