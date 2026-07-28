import { describe, it, expect } from 'vitest'
import { generateTerrain } from './terrain'
import { generatePassableTerrain } from './terrainGrid'
import type { TerrainObstacle } from './terrain'
import { checkAllProfilesReachable, buildObstacleTileMap, gameToTile } from './terrainGrid'

// Procedural scatter now opts into hard tile-based blocking (see newGame in
// game/engine.ts), so — unlike authored terrain, which the battlefield editor
// validates at save time — the generator itself has to guarantee the lane never
// seals. These tests pin that guarantee, and the tuning it depends on.

const SEEDS = Array.from({ length: 250 }, (_, i) => `seed-${i}`)
const ENVIRONMENTS = [undefined, 'forest', 'citadel', 'ashen']

function isPassable(terrain: TerrainObstacle[]): boolean {
  const report = checkAllProfilesReachable(terrain, [])
  return report.ground.reachable && report.burrowing.reachable
}

/** Collision tile columns the lane's full lateral span (game y -80..80) occupies. */
const LANE_COLUMNS = (() => {
  const a = gameToTile(250, -80)
  const b = gameToTile(250, 80)
  return { lo: Math.min(a.tcx, b.tcx), hi: Math.max(a.tcx, b.tcx) }
})()

/** How many of the lane's lateral tile columns this obstacle rasterizes onto. */
function columnsCovered(obs: TerrainObstacle): number {
  const covered = new Set<number>()
  for (const key of buildObstacleTileMap([obs]).keys()) {
    const tcx = Number(key.split(',')[0])
    if (tcx >= LANE_COLUMNS.lo && tcx <= LANE_COLUMNS.hi) covered.add(tcx)
  }
  return covered.size
}

describe('generatePassableTerrain', () => {
  it('always yields a lane ground and burrowing units can cross', { timeout: 30_000 }, () => {
    for (const env of ENVIRONMENTS) {
      for (const seed of SEEDS) {
        expect(isPassable(generatePassableTerrain(seed, env, []))).toBe(true)
      }
    }
  })

  it('is deterministic for a given seed', () => {
    expect(generatePassableTerrain('repeat-me', 'forest', []))
      .toEqual(generatePassableTerrain('repeat-me', 'forest', []))
  })

  it('prunes the scatter rather than clearing the field', { timeout: 30_000 }, () => {
    let kept = 0
    let generated = 0
    for (const seed of SEEDS) {
      kept += generatePassableTerrain(seed, undefined, []).length
      generated += generateTerrain(seed, undefined).length
    }
    // Pruning should be the exception: the generator's own tuning already
    // leaves most scatters traversable.
    expect(kept / generated).toBeGreaterThan(0.85)
  })
})

describe('generateTerrain tuning for the collision tile grid', () => {
  it('never emits an obstacle wide enough to span the lane on its own', () => {
    // The lane's whole lateral span is only 9 collision tile columns, and an
    // obstacle rasterizes to a disc of tile-radius round(radius * 0.12). Once
    // radius reaches ~29 that rounds to 4 — covering all 9 columns — and a
    // single obstacle seals the lane no matter where it lands.
    const laneWidth = LANE_COLUMNS.hi - LANE_COLUMNS.lo + 1
    for (const env of ENVIRONMENTS) {
      for (const seed of SEEDS) {
        for (const obs of generateTerrain(seed, env)) {
          expect(columnsCovered(obs)).toBeLessThan(laneWidth)
        }
      }
    }
  })

  it('leaves most scatters traversable before any pruning is needed', { timeout: 30_000 }, () => {
    const passing = SEEDS.filter(seed => isPassable(generateTerrain(seed, undefined))).length
    expect(passing / SEEDS.length).toBeGreaterThan(0.7)
  })
})
