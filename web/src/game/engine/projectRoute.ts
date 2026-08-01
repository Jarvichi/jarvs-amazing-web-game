import type { GameState } from '../types'
import { moveUnits } from './units'

export interface RoutePoint { x: number; y: number }

/** Game-units of movement below which a step isn't worth its own polyline vertex. */
const MIN_STEP = 0.5
/** Consecutive near-stationary steps after which the unit is treated as parked. */
const STALL_STEPS = 12

/**
 * Projects where a unit will actually go, by running the real movement code
 * forward on a throwaway copy of the battle.
 *
 * Deliberately not a flow-field trace: the flow field is only consulted when a
 * unit is blocked, so a grid path would show a tidy route the unit may never
 * take — it ignores enemy chasing, road following and detour hysteresis. Since
 * the point of this is debugging movement, the projection has to be able to
 * show the unit doing something wrong.
 *
 * The whole field is simulated, not just the tracked unit, so targets keep
 * moving and the projection stays realistic.
 *
 * Caveats worth knowing when reading the line:
 *  - `moveUnits` seeds `guardY` from `Math.random()` on a unit's first tick, so
 *    a projection taken before that fires isn't perfectly reproducible.
 *  - Only movement is simulated. Combat, spawns and card play are not, so the
 *    further out the line goes the more it diverges from what will really
 *    happen — it answers "where is this unit heading right now", not "where
 *    will it be in 12 seconds".
 */
export function projectUnitRoute(
  state: GameState,
  unitId: string,
  steps = 120,
  dtMs = 100,
): RoutePoint[] {
  const index = state.field.findIndex(u => u.id === unitId)
  if (index < 0) return []

  // Copy everything moveUnits writes to (unit position//state and each unit's
  // waypoint queue) so the live battle is untouched. terrainGridCache is shared
  // deliberately: moveUnits only reads its tile maps and memoises flow fields
  // into it, so sharing is safe and skips rebuilding the BFS.
  const sim: GameState = {
    ...state,
    field: state.field.map(u => ({
      ...u,
      roadWaypoints: u.roadWaypoints?.map(p => ({ ...p })),
    })),
  }

  const tracked = sim.field[index]
  const route: RoutePoint[] = [{ x: tracked.x, y: tracked.y }]
  let last = route[0]
  let stalled = 0

  for (let i = 0; i < steps; i++) {
    moveUnits(sim, dtMs)
    if (tracked.hp <= 0) break
    if (Math.hypot(tracked.x - last.x, tracked.y - last.y) < MIN_STEP) {
      if (++stalled >= STALL_STEPS) break
      continue
    }
    stalled = 0
    last = { x: tracked.x, y: tracked.y }
    route.push(last)
  }
  return route
}
