/**
 * Integration tests for road-following movement in moveUnits (engine/units.ts) —
 * verifies the lazy path assignment, default-target substitution, and the invariant
 * that higher-priority targeting (combat, defend stance) always overrides it.
 */
import { describe, it, expect } from 'vitest'
import { newGame } from '../engine'
import { moveUnits } from './units'
import { spawnUnit } from './helpers'
import { RoadDef, TerrainObstacle } from './terrain'
import { LANE_WIDTH } from '../types'

const MOBILE_TEMPLATE = {
  name: 'Test Runner', maxHp: 30, attack: 5, moveSpeed: 40,
  attackRange: 20, attackCooldownMs: 1000, isWall: false, bypassWall: false,
}

const BURROWING_TEMPLATE = { ...MOBILE_TEMPLATE, tags: ['burrowing' as const] }
const SWIM_TEMPLATE = { ...MOBILE_TEMPLATE, tags: ['swim' as const] }

describe('moveUnits — road following', () => {
  it('does nothing when roadFollowing is off (regression parity with straight-line movement)', () => {
    const s = newGame()
    s.terrain = [] // isolate road-following from procedurally-generated obstacle avoidance
    s.roadFollowing = false
    s.roads = [{ points: [{ x: 0, y: 40 }, { x: LANE_WIDTH, y: 40 }] }]
    const unit = spawnUnit(MOBILE_TEMPLATE, 'player')
    unit.y = 0 // pin — spawnUnit() otherwise picks a random lane from LANE_POSITIONS
    unit.advanceY = 0 // pin — advancing units otherwise head for a random lateral lane
    s.field = [unit]

    moveUnits(s, 100)

    expect(unit.roadWaypoints).toBeUndefined()
    // Straight toward the opponent base at the unit's own lane — y should not have
    // moved toward the road's y=40.
    expect(unit.y).toBeCloseTo(0)
  })

  it('lazily assigns a waypoint queue and bends the trajectory onto the road', () => {
    const s = newGame()
    s.terrain = [] // isolate road-following from procedurally-generated obstacle avoidance
    s.roadFollowing = true
    const roads: RoadDef[] = [{ points: [{ x: 0, y: 40 }, { x: LANE_WIDTH, y: 40 }] }]
    s.roads = roads
    const unit = spawnUnit(MOBILE_TEMPLATE, 'player')
    unit.y = 0
    s.field = [unit]

    moveUnits(s, 100)

    expect(unit.roadWaypoints).toBeDefined()
    // Unit should have moved laterally toward y=40 (the road), not stayed at y=0.
    expect(unit.y).toBeGreaterThan(0)
  })

  it('waypoint queue shrinks as the unit reaches each point', () => {
    const s = newGame()
    s.terrain = [] // isolate road-following from procedurally-generated obstacle avoidance
    s.roadFollowing = true
    // Road with a waypoint very close to the player's spawn so it's reached quickly.
    const roads: RoadDef[] = [{ points: [{ x: 32, y: 0 }, { x: 100, y: 0 }, { x: LANE_WIDTH, y: 0 }] }]
    s.roads = roads
    const unit = spawnUnit(MOBILE_TEMPLATE, 'player')
    unit.y = 0
    s.field = [unit]

    moveUnits(s, 100)
    const initialLen = unit.roadWaypoints!.length

    for (let i = 0; i < 50; i++) moveUnits(s, 100)

    expect(unit.roadWaypoints!.length).toBeLessThan(initialLen)
  })

  it('a road that never reaches the enemy base falls back to straight-line pursuit once exhausted', () => {
    const s = newGame()
    s.terrain = [] // isolate road-following from procedurally-generated obstacle avoidance
    s.roadFollowing = true
    // Short road right at the player's spawn — exhausted almost immediately.
    const roads: RoadDef[] = [{ points: [{ x: 30, y: 0 }, { x: 45, y: 0 }] }]
    s.roads = roads
    const unit = spawnUnit(MOBILE_TEMPLATE, 'player')
    unit.y = 0
    unit.advanceY = 0 // pin — advancing units otherwise head for a random lateral lane
    s.field = [unit]

    for (let i = 0; i < 100; i++) moveUnits(s, 100)

    expect(unit.roadWaypoints).toEqual([])
    // With the road exhausted, the unit should be progressing straight toward the
    // opponent base (increasing x, y pinned back to its lane).
    expect(unit.x).toBeGreaterThan(45)
    expect(unit.y).toBeCloseTo(0)
  })

  it('higher-priority targeting (a pursuable enemy) overrides road-following that tick', () => {
    const s = newGame()
    s.terrain = [] // isolate road-following from procedurally-generated obstacle avoidance
    s.roadFollowing = true
    // Road pulls toward y=+60; the enemy sits at y=-30 — opposite directions, so the
    // sign of the unit's resulting y movement tells us which one actually won.
    s.roads = [{ points: [{ x: 0, y: 60 }, { x: LANE_WIDTH, y: 60 }] }]
    const unit = spawnUnit(MOBILE_TEMPLATE, 'player')
    unit.y = 0
    const enemy = spawnUnit(MOBILE_TEMPLATE, 'opponent')
    // Ahead of the unit but outside attackRange (20), so targeting engages without
    // the unit hitting the "already in range, don't move" early-continue.
    enemy.x = unit.x + 50
    enemy.y = -30
    s.field = [unit, enemy]

    moveUnits(s, 100)

    // Moved toward the enemy (negative y), not toward the road (positive y).
    expect(unit.y).toBeLessThan(0)
  })

  it('defend stance overrides road-following and pulls the unit back toward spawn', () => {
    const s = newGame()
    s.terrain = [] // isolate road-following from procedurally-generated obstacle avoidance
    s.roadFollowing = true
    s.roads = [{ points: [{ x: 0, y: 70 }, { x: LANE_WIDTH, y: 70 }] }]
    s.playerStance = 'defend'
    const unit = spawnUnit(MOBILE_TEMPLATE, 'player')
    unit.x = 200
    unit.y = 0
    s.field = [unit]

    moveUnits(s, 100)

    // Defend stance pulls back toward PLAYER_SPAWN_X + 40, not toward the road's y=70.
    expect(unit.x).toBeLessThan(200)
  })
})

describe('moveUnits — hard terrain blocking (terrainValidated)', () => {
  // A radius this large fully seals every lateral column for a wide forward
  // band once tile-rasterized (see game/engine/terrainGrid.ts) — deliberately
  // oversized so the test isn't sensitive to exact tile-grid geometry, only
  // to whether the movement type in question is blocked at all.
  const WALL: TerrainObstacle = { id: 'wall', type: 'rock', x: 250, y: 0, radius: 250 }
  const WATER_WALL: TerrainObstacle = { id: 'wall', type: 'water', x: 250, y: 0, radius: 250 }

  it('does nothing when terrainValidated is off (regression parity — legacy soft avoidance)', () => {
    const s = newGame()
    s.terrainValidated = false
    s.terrain = [WALL]
    const unit = spawnUnit(MOBILE_TEMPLATE, 'player')
    unit.y = 0
    s.field = [unit]

    for (let i = 0; i < 50; i++) moveUnits(s, 100)

    // Soft avoidance never hard-stops a unit — it keeps advancing in x.
    expect(unit.x).toBeGreaterThan(30)
  })

  it('a ground unit is hard-blocked by a rock wall', () => {
    const s = newGame()
    s.terrainValidated = true
    s.terrain = [WALL]
    const unit = spawnUnit(MOBILE_TEMPLATE, 'player')
    unit.y = 0
    s.field = [unit]

    for (let i = 0; i < 200; i++) moveUnits(s, 100)

    expect(unit.x).toBeLessThan(100)
  })

  it('a burrowing unit ignores a rock wall entirely', () => {
    const s = newGame()
    s.terrainValidated = true
    s.terrain = [WALL]
    const unit = spawnUnit(BURROWING_TEMPLATE, 'player')
    unit.y = 0
    s.field = [unit]

    for (let i = 0; i < 200; i++) moveUnits(s, 100)

    expect(unit.x).toBeGreaterThan(400)
  })

  it('a burrowing unit is still blocked by a water wall', () => {
    const s = newGame()
    s.terrainValidated = true
    s.terrain = [WATER_WALL]
    const unit = spawnUnit(BURROWING_TEMPLATE, 'player')
    unit.y = 0
    s.field = [unit]

    for (let i = 0; i < 200; i++) moveUnits(s, 100)

    expect(unit.x).toBeLessThan(100)
  })

  it('a ground unit is hard-blocked by a water wall', () => {
    const s = newGame()
    s.terrainValidated = true
    s.terrain = [WATER_WALL]
    const unit = spawnUnit(MOBILE_TEMPLATE, 'player')
    unit.y = 0
    s.field = [unit]

    for (let i = 0; i < 200; i++) moveUnits(s, 100)

    expect(unit.x).toBeLessThan(100)
  })

  it('a swim-tagged unit crosses a water wall that blocks plain ground units', () => {
    const s = newGame()
    s.terrainValidated = true
    s.terrain = [WATER_WALL]
    const unit = spawnUnit(SWIM_TEMPLATE, 'player')
    unit.y = 0
    s.field = [unit]

    for (let i = 0; i < 200; i++) moveUnits(s, 100)

    expect(unit.x).toBeGreaterThan(400)
  })

  it('a flying unit is unaffected by terrainValidated (still bypasses everything)', () => {
    const s = newGame()
    s.terrainValidated = true
    s.terrain = [WATER_WALL]
    const unit = spawnUnit({ ...MOBILE_TEMPLATE, flying: true }, 'player')
    unit.y = 0
    s.field = [unit]

    for (let i = 0; i < 200; i++) moveUnits(s, 100)

    expect(unit.x).toBeGreaterThan(400)
  })

  it('a road with default zIndex bridges a water wall for a plain ground unit', () => {
    const s = newGame()
    s.terrainValidated = true
    s.terrain = [WATER_WALL]
    const roads: RoadDef[] = [{ points: [{ x: 5, y: 0 }, { x: 495, y: 0 }] }] // default zIndex 1 > obstacle default 0
    s.roads = roads
    const unit = spawnUnit(MOBILE_TEMPLATE, 'player')
    unit.y = 0
    s.field = [unit]

    for (let i = 0; i < 200; i++) moveUnits(s, 100)

    expect(unit.x).toBeGreaterThan(400)
  })
})
