// ─── Unified Tick ────────────────────────────────────────────────────────────
// Single entry-point that advances both city and farm together so resource
// computation is identical regardless of which screen is currently visible.
//
// Import order matters: farmingSim imports from cityBuilder, so tickAll lives
// here to avoid a circular dependency between the two modules.

import { CityState, tickCity, distributeIncomingResources } from './cityBuilder'
import { FarmState, tickFarm } from './farmingSim'

/**
 * Advances both city and farm to nowMs in a single pass.
 *
 * Order:
 *  1. tickFarm  — produces resources and accumulates in farm pool
 *  2. distributeIncomingResources — deposits shipped resources into city cell
 *     stocks so they survive the next aggregateResources() recomputation
 *  3. tickCity  — aggregates stocks, runs consumption, carriers, happiness
 */
export function tickAll(
  city: CityState,
  farm: FarmState,
  nowMs = Date.now(),
): { nextCity: CityState; nextFarm: FarmState } {
  const { nextState: nextFarm, resourcesForCity } = tickFarm(farm, nowMs)
  const cityWithFarm = distributeIncomingResources(city, resourcesForCity)
  const nextCity = tickCity(cityWithFarm, nowMs)
  return { nextCity, nextFarm }
}
