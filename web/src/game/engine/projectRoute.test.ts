import { describe, it, expect } from 'vitest'
import { newGame } from '../engine'
import { spawnUnit } from './helpers'
import { projectUnitRoute } from './projectRoute'
import { LANE_WIDTH } from '../types'
import { LANE_MIN_Y, LANE_MAX_Y } from './helpers'

const UNIT = {
  name: 'Goblin', maxHp: 25, attack: 6, moveSpeed: 32, attackRange: 35,
  attackCooldownMs: 1000, isWall: false, bypassWall: false,
}

/** A battle with one player unit and a rock straight ahead of it. */
function battleWithObstacle() {
  const s = newGame({
    terrain: [{ id: 'rock', type: 'rock', x: 250, y: 0, radius: 26 }],
    terrainValidated: true,
  } as never)
  const u = spawnUnit(UNIT as never, 'player')
  u.x = 20
  u.y = 0
  u.spawnGrowTimer = 0
  s.field = [u]
  s.opponentBase.hp = 9999
  return { s, unitId: u.id }
}

describe('projectUnitRoute', () => {
  it('returns an empty route for an unknown unit', () => {
    const { s } = battleWithObstacle()
    expect(projectUnitRoute(s, 'no-such-unit')).toEqual([])
  })

  it('projects a route that advances toward the goal', () => {
    const { s, unitId } = battleWithObstacle()
    const route = projectUnitRoute(s, unitId)
    expect(route.length).toBeGreaterThan(1)
    expect(route[route.length - 1].x).toBeGreaterThan(route[0].x)
  })

  it('keeps every projected point inside the lane', () => {
    const { s, unitId } = battleWithObstacle()
    for (const p of projectUnitRoute(s, unitId)) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(LANE_WIDTH)
      expect(p.y).toBeGreaterThanOrEqual(LANE_MIN_Y)
      expect(p.y).toBeLessThanOrEqual(LANE_MAX_Y)
    }
  })

  it('routes around the obstacle rather than through it', () => {
    const { s, unitId } = battleWithObstacle()
    const route = projectUnitRoute(s, unitId)
    // The unit starts dead centre with a rock dead ahead, so getting past it
    // requires leaving the centre line at some point.
    expect(Math.max(...route.map(p => Math.abs(p.y)))).toBeGreaterThan(5)
  })

  it('does not mutate the live battle state', () => {
    const { s, unitId } = battleWithObstacle()
    const before = s.field.map(u => ({ x: u.x, y: u.y, hp: u.hp, wp: u.roadWaypoints?.length ?? -1 }))
    projectUnitRoute(s, unitId)
    const after = s.field.map(u => ({ x: u.x, y: u.y, hp: u.hp, wp: u.roadWaypoints?.length ?? -1 }))
    expect(after).toEqual(before)
  })
})
