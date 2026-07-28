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

/** Nodes whose terrain actually blocks — the ones pathfinding has to solve. */
const blockingNodes = Object.values(act.nodes)
  .filter(n => ['battle', 'elite', 'boss'].includes(n.type))
  .filter(n => (n.terrainValidated ?? act.terrainValidated) === true)
  // roadFollowing routes units by waypoint rather than toward the base, which
  // is a separate movement mode with its own (pre-existing) stalling issue.
  .filter(n => (n.roadFollowing ?? act.roadFollowing) !== true)

describe('unit pathfinding around blocking terrain', () => {
  it('has act 1 nodes with hard blocking to exercise', () => {
    expect(blockingNodes.length).toBeGreaterThan(0)
  })

  it.each(blockingNodes.map(n => ({ id: n.id, label: n.label, node: n })))(
    'units cross $id ($label) instead of wedging against terrain',
    { timeout: 30_000 },
    ({ node }) => {
      const finals = marchAcross(resolvedNodeOpts(node, act, 1, []) as never)
      for (const x of finals) expect(x).toBeGreaterThan(LANE_WIDTH * 0.8)
    },
  )

  it('units cross procedurally-generated Quick Play terrain', { timeout: 60_000 }, () => {
    let crossed = 0
    let total = 0
    for (let i = 0; i < 25; i++) {
      for (const x of marchAcross({ terrainSeed: `pathfind-${i}` })) {
        total++
        if (x > LANE_WIDTH * 0.8) crossed++
      }
    }
    // Allow a small margin for pathological scatters rather than pinning 100%,
    // but this must stay far above the pre-pathfinding behaviour, where units
    // stalled at the first obstacle in nearly every seed.
    expect(crossed / total).toBeGreaterThan(0.97)
  })
})
