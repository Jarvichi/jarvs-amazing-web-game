import { describe, it, expect } from 'vitest'
import { newGame } from '../engine'
import { moveUnits } from './units'
import { spawnUnit } from './helpers'
import { resolvedNodeOpts } from '../campaignHelpers'
import { LANE_WIDTH } from '../types'
import type { Act } from '../questline'
import act1Json from '../../data/acts/act1.json'

// Hard tile blocking without a route makes units grind against terrain forever:
// local collision response alone has no way around a wall, and the lateral
// nudge that used to paper over it is switched off wherever blocking is on.
// These tests drive the real engine and assert units actually reach the far
// side, which is the only thing that distinguishes "blocked correctly" from
// "wedged permanently".

const act = act1Json as unknown as Act
const UNIT = {
  name: 'Goblin', maxHp: 25, attack: 6, moveSpeed: 32, attackRange: 35,
  attackCooldownMs: 1000, isWall: false, bypassWall: false,
}
const SPAWN_YS = [-70, -35, 0, 35, 70]
const TICK_MS = 100
const TICKS = 900

/** Advances a battle with no enemies present and returns how far each unit got. */
function marchAcross(opts: Record<string, unknown>): number[] {
  const s = newGame(opts as never)
  s.field = []
  for (const y of SPAWN_YS) {
    const u = spawnUnit(UNIT as never, 'player')
    u.x = 20
    u.y = y
    u.spawnGrowTimer = 0
    s.field.push(u)
  }
  // Keep the battle alive so nothing short-circuits movement.
  s.opponentBase.hp = 9999
  for (let t = 0; t < TICKS; t++) moveUnits(s, TICK_MS)
  return s.field.map(u => u.x)
}

const battleNodes = Object.values(act.nodes).filter(n => ['battle', 'elite', 'boss'].includes(n.type))

describe('unit pathfinding around blocking terrain', () => {
  it('has act 1 battle nodes to exercise', () => {
    expect(battleNodes.length).toBeGreaterThan(0)
  })

  it.each(battleNodes.map(n => ({ id: n.id, label: n.label, node: n })))(
    'units cross $id ($label) instead of wedging against terrain',
    { timeout: 30_000 },
    ({ node }) => {
      const finals = marchAcross(resolvedNodeOpts(node, act, 1, []) as never)
      for (const x of finals) expect(x).toBeGreaterThan(LANE_WIDTH * 0.8)
    },
  )

  it('units cross procedurally-generated Quick Play terrain', { timeout: 60_000 }, () => {
    for (let i = 0; i < 25; i++) {
      for (const x of marchAcross({ terrainSeed: `pathfind-${i}` })) {
        expect(x).toBeGreaterThan(LANE_WIDTH * 0.8)
      }
    }
  })

  it('units that spawn inside terrain walk out instead of freezing', () => {
    // Obstacles reach down over the spawn rows, so this really happens — and a
    // unit in a blocked tile fails every enterable check unless it is allowed
    // to escape.
    const finals = marchAcross({
      terrain: [{ id: 'spawnblock', type: 'rock', x: 40, y: 0, radius: 28 }],
      terrainValidated: true,
    })
    for (const x of finals) expect(x).toBeGreaterThan(LANE_WIDTH * 0.8)
  })
})

describe('road following', () => {
  const roadNodes = battleNodes.filter(n => (n.roadFollowing ?? act.roadFollowing) === true)

  it('has act 1 road-following nodes to exercise', () => {
    expect(roadNodes.length).toBeGreaterThan(0)
  })

  it.each(roadNodes.map(n => ({ id: n.id, label: n.label, node: n })))(
    'units follow the road across $id ($label) rather than parking on a waypoint',
    { timeout: 30_000 },
    ({ node }) => {
      // Authored roads run off the lane, so waypoints outside it must be
      // clamped — a unit can never satisfy the arrival distance check for a
      // point it is physically clamped away from, and would chase it forever.
      const finals = marchAcross(resolvedNodeOpts(node, act, 1, []) as never)
      for (const x of finals) expect(x).toBeGreaterThan(LANE_WIDTH * 0.8)
    },
  )
})
