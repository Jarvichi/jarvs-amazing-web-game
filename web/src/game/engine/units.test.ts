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
import { Hazard, LANE_WIDTH } from '../types'
import { COMMANDER_HOME_X, COMMANDER_LEASH_PX, DEFEND_ZONE_MAX_X } from './constants'
import { GAS_CLOUD_RADIUS, getCardCatalog } from '../cards'

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

describe('moveUnits — defend stance', () => {
  /** A defend-stance battle with one player defender and one enemy position. */
  function defendBattle(enemyX: number) {
    const s = newGame()
    s.terrain = []
    s.playerStance = 'defend'
    const defender = spawnUnit(MOBILE_TEMPLATE, 'player')
    defender.x = 70
    defender.y = 0
    defender.advanceY = 0
    const enemy = spawnUnit(MOBILE_TEMPLATE, 'opponent')
    enemy.x = enemyX
    enemy.y = 60
    s.field = [defender, enemy]
    return { s, defender, enemy }
  }

  it('breaks formation to intercept an enemy that has breached the line', () => {
    // An enemy this deep is on top of the player's spawners and commander.
    const { s, defender, enemy } = defendBattle(60)
    const startDist = Math.hypot(defender.x - enemy.x, defender.y - enemy.y)

    for (let i = 0; i < 30; i++) moveUnits(s, 100)

    const endDist = Math.hypot(defender.x - enemy.x, defender.y - enemy.y)
    expect(endDist).toBeLessThan(startDist)
  })

  it('holds its assigned slot when no enemy has breached the line', () => {
    // Far up the lane — not a threat, so the defender should stay on the line
    // rather than charging out to meet it.
    const { s, defender } = defendBattle(LANE_WIDTH - 40)

    for (let i = 0; i < 30; i++) moveUnits(s, 100)

    expect(defender.x).toBeLessThanOrEqual(DEFEND_ZONE_MAX_X)
  })

  it('never leaves the zone to chase an enemy sitting just outside it', () => {
    // The reported bug: an enemy parked beyond the zone used to drag defenders
    // out to ~x=190 (38% of the lane) while the base went undefended.
    const { s, defender } = defendBattle(150)

    for (let i = 0; i < 200; i++) moveUnits(s, 100)

    expect(defender.x).toBeLessThanOrEqual(DEFEND_ZONE_MAX_X)
  })

  it('returns to its slot once the enemy it engaged is out of the zone', () => {
    // A defender pushed forward, with an enemy ahead close enough to be within
    // attackRange. The "already in range, don't move" early-continue used to fire
    // before the defend branch, pinning the unit up-field for the rest of the battle.
    const { s, defender, enemy } = defendBattle(200)
    defender.x = 190
    enemy.y = 0

    for (let i = 0; i < 200; i++) moveUnits(s, 100)

    expect(defender.x).toBeLessThanOrEqual(DEFEND_ZONE_MAX_X)
  })

  it('walks home rather than snapping back when DEFEND is tapped up-field', () => {
    // Units caught beyond the zone when the stance changes must not teleport.
    const { s, defender } = defendBattle(LANE_WIDTH - 40)
    defender.x = 300

    moveUnits(s, 100)
    const afterOneTick = defender.x
    expect(afterOneTick).toBeLessThan(300)
    expect(afterOneTick).toBeGreaterThan(DEFEND_ZONE_MAX_X)

    for (let i = 0; i < 200; i++) moveUnits(s, 100)
    expect(defender.x).toBeLessThanOrEqual(DEFEND_ZONE_MAX_X)
  })

  it('routes home around terrain instead of marching toward the enemy base', () => {
    // A terrain-blocked unit is steered by the flow field, and the field's goal used
    // to be the enemy base regardless of stance — so a defender whose direct path
    // home was blocked pathed *forward*, ending around x=310 instead of on its slot.
    // The geometry here is deliberate: the obstacle must block the way home while
    // leaving the defender itself on free ground, since a unit embedded in terrain
    // takes the walk-out path and never consults the field at all.
    const s = newGame()
    s.playerStance = 'defend'
    s.terrainValidated = true
    s.terrain = [{ id: 'block', type: 'rock', x: 130, y: 0, radius: 40 }]
    const defender = spawnUnit(MOBILE_TEMPLATE, 'player')
    defender.id = 'u7' // pin — the Y slot is chosen from the id, and geometry matters here
    defender.x = 200
    defender.y = 0
    defender.advanceY = 0
    s.field = [defender]

    for (let i = 0; i < 300; i++) moveUnits(s, 100)

    expect(defender.x).toBeLessThanOrEqual(DEFEND_ZONE_MAX_X)
  })

  it('spreads defenders across multiple breachers instead of collapsing onto one', () => {
    const s = newGame()
    s.terrain = []
    s.playerStance = 'defend'
    // Both defenders sit beside breacher A, so "nearest threat" alone sends both to
    // A and leaves B free to chew through the base — the claim set is what splits them.
    const defenders = [-58, -62].map(y => {
      const u = spawnUnit(MOBILE_TEMPLATE, 'player')
      u.x = 75; u.y = y; u.advanceY = y
      return u
    })
    const breacherA = spawnUnit(MOBILE_TEMPLATE, 'opponent')
    breacherA.x = 40; breacherA.y = -60; breacherA.moveSpeed = 0 // pinned: measures defender choice only
    const breacherB = spawnUnit(MOBILE_TEMPLATE, 'opponent')
    breacherB.x = 40; breacherB.y = 20; breacherB.moveSpeed = 0
    s.field = [...defenders, breacherA, breacherB]

    for (let i = 0; i < 40; i++) moveUnits(s, 100)

    // Each breacher should have drawn exactly one defender.
    for (const b of [breacherA, breacherB]) {
      const engaged = defenders.filter(d => Math.hypot(d.x - b.x, d.y - b.y) <= d.attackRange)
      expect(engaged.length).toBe(1)
    }
  })

  it('still sends the overflow attackers forward when the army is large', () => {
    const s = newGame()
    s.terrain = []
    s.playerStance = 'defend'
    const defenders = Array.from({ length: 20 }, (_, i) => {
      const u = spawnUnit(MOBILE_TEMPLATE, 'player')
      u.x = 70 + i; u.y = 0; u.advanceY = 0
      return u
    })
    s.field = defenders

    for (let i = 0; i < 100; i++) moveUnits(s, 100)

    // 5 furthest-forward break off and charge; the rest hold the zone.
    const past = defenders.filter(u => u.x > DEFEND_ZONE_MAX_X)
    expect(past.length).toBe(5)
    expect(defenders.filter(u => u.x <= DEFEND_ZONE_MAX_X).length).toBe(15)
  })
})

describe('moveUnits — ruins are a one-tile obstacle on the soft-avoidance path too', () => {
  // Hard blocking sizes ruins by type (obstacleTileRadius in terrainGrid), but
  // nodes that were never terrain-validated still use lateral avoidance, which
  // read the authored radius. A ruin drawn as one icon must not shove units
  // around from 30 game units away just because its data says radius 30.
  const farOffRuin = (radius: number) => {
    const s = newGame()
    s.terrainValidated = false
    s.terrain = [{ id: 'r1', type: 'ruin', x: 120, y: 40, radius }]
    const unit = spawnUnit(MOBILE_TEMPLATE, 'player')
    unit.x = 100
    unit.y = 0
    unit.advanceY = 0
    s.field = [unit]
    for (let i = 0; i < 10; i++) moveUnits(s, 100)
    return Math.abs(unit.y)
  }

  it('does not deflect a unit a whole tile away, whatever radius the data carries', () => {
    // y=0 vs a ruin at y=40 is more than two tiles clear of a one-tile footprint.
    expect(farOffRuin(30)).toBeLessThan(1)
    expect(farOffRuin(18)).toBeLessThan(1)
  })

  it('a rock of the same radius still deflects, so avoidance itself is intact', () => {
    const s = newGame()
    s.terrainValidated = false
    s.terrain = [{ id: 'r1', type: 'rock', x: 120, y: 40, radius: 30 }]
    const unit = spawnUnit(MOBILE_TEMPLATE, 'player')
    unit.x = 100
    unit.y = 20
    unit.advanceY = 20
    s.field = [unit]
    for (let i = 0; i < 10; i++) moveUnits(s, 100)
    expect(unit.y).toBeLessThan(20)
  })
})

describe('moveUnits — gas cloud avoidance', () => {
  const RANGED_TEMPLATE = { ...MOBILE_TEMPLATE, attackRange: 100 }

  /** A cloud matching what a `gascloud`-tagged unit drops (see deriveAttackEffect). */
  function cloud(overrides: Partial<Hazard> = {}): Hazard {
    return {
      id: 'gas1', x: 250, y: 0, radius: GAS_CLOUD_RADIUS, dps: 3,
      owner: 'opponent', expiresAt: 8000, ...overrides,
    }
  }

  function inCloud(unit: { x: number; y: number }, hz: Hazard): boolean {
    return Math.hypot(unit.x - hz.x, unit.y - hz.y) <= hz.radius
  }

  it('a unit fighting inside a cloud drifts out without losing its target', () => {
    // The reported bug: a unit already in attack range early-continues before any steering
    // runs, so it stood in the gas swinging until it died.
    const s = newGame()
    s.terrain = []
    const hz = cloud()
    s.hazards = [hz]

    const unit = spawnUnit(RANGED_TEMPLATE, 'player')
    unit.x = 250; unit.y = 10; unit.advanceY = 10
    const foe = spawnUnit(MOBILE_TEMPLATE, 'opponent')
    foe.x = 260; foe.y = 10
    s.field = [unit, foe]

    expect(inCloud(unit, hz)).toBe(true)
    for (let i = 0; i < 40; i++) {
      moveUnits(s, 100)
      // Drift out, keep fighting — the target never leaves attack range.
      expect(Math.hypot(unit.x - foe.x, unit.y - foe.y)).toBeLessThanOrEqual(unit.attackRange + 1e-6)
    }
    expect(inCloud(unit, hz)).toBe(false)
  })

  it('a cloud dropped exactly on a unit still resolves to a direction', () => {
    const s = newGame()
    s.terrain = []
    const hz = cloud({ x: 250, y: 0 })
    s.hazards = [hz]

    const unit = spawnUnit(RANGED_TEMPLATE, 'player')
    unit.x = 250; unit.y = 0; unit.advanceY = 0
    const foe = spawnUnit(MOBILE_TEMPLATE, 'opponent')
    foe.x = 250; foe.y = 0
    s.field = [unit, foe]

    for (let i = 0; i < 40; i++) moveUnits(s, 100)

    expect(inCloud(unit, hz)).toBe(false)
  })

  it('a unit advancing up the lane steers around a cloud instead of through it', () => {
    const s = newGame()
    s.terrain = []
    const hz = cloud({ x: 250, y: 0 })
    s.hazards = [hz]

    const unit = spawnUnit(MOBILE_TEMPLATE, 'player')
    unit.x = 150; unit.y = 0; unit.advanceY = 0
    s.field = [unit]

    let everInside = false
    for (let i = 0; i < 120; i++) {
      moveUnits(s, 100)
      if (inCloud(unit, hz)) everInside = true
    }

    expect(everInside).toBe(false)
    expect(unit.x).toBeGreaterThan(250) // still made it up the lane
  })

  it('ignores a cloud its own side dropped', () => {
    const s = newGame()
    s.terrain = []
    s.hazards = [cloud({ owner: 'player' })]

    const unit = spawnUnit(MOBILE_TEMPLATE, 'player')
    unit.x = 250; unit.y = 0; unit.advanceY = 0
    s.field = [unit]

    moveUnits(s, 100)

    expect(unit.y).toBeCloseTo(0)
  })

  it('ignores a cloud that has already expired', () => {
    const s = newGame()
    s.terrain = []
    s.gameTime = 9000
    s.hazards = [cloud({ expiresAt: 8000 })]

    const unit = spawnUnit(MOBILE_TEMPLATE, 'player')
    unit.x = 250; unit.y = 0; unit.advanceY = 0
    s.field = [unit]

    moveUnits(s, 100)

    expect(unit.y).toBeCloseTo(0)
  })

  it('a flying unit dodges too — gas damages flyers', () => {
    const s = newGame()
    s.terrain = []
    const hz = cloud({ x: 250, y: 0 })
    s.hazards = [hz]

    const unit = spawnUnit({ ...MOBILE_TEMPLATE, flying: true }, 'player')
    unit.x = 250; unit.y = 0; unit.advanceY = 0
    s.field = [unit]

    for (let i = 0; i < 40; i++) moveUnits(s, 100)

    expect(inCloud(unit, hz)).toBe(false)
  })

  it('a commander drifts away from a cloud but stays on its leash', () => {
    const s = newGame()
    s.terrain = []
    s.hazards = [cloud({ x: COMMANDER_HOME_X, y: 0 })]

    const cmd = spawnUnit(MOBILE_TEMPLATE, 'player')
    cmd.isCommander = true
    cmd.commanderHomeX = COMMANDER_HOME_X
    cmd.x = COMMANDER_HOME_X; cmd.y = 0; cmd.advanceY = 0
    s.field = [cmd]

    for (let i = 0; i < 60; i++) moveUnits(s, 100)

    expect(Math.abs(cmd.y)).toBeGreaterThan(0)
    expect(Math.abs(cmd.x - COMMANDER_HOME_X)).toBeLessThanOrEqual(COMMANDER_LEASH_PX + 1e-6)
  })

  it('every gascloud unit drops a cloud at the radius the avoidance and the art both use', () => {
    // effects.ts draws the cloud straight off hazard.radius and engine.ts damages off the
    // same value, so this is what keeps what you see, what hurts, and what units dodge
    // from drifting apart.
    const gasUnits = getCardCatalog().filter(c => c.unit?.tags?.includes('gascloud'))
    expect(gasUnits.length).toBeGreaterThan(0)
    for (const c of gasUnits) {
      expect(c.unit!.attackEffect?.type).toBe('gascloud')
      expect(c.unit!.attackEffect?.aoeRadius).toBe(GAS_CLOUD_RADIUS)
    }
  })

  it('never pushes a unit into blocked terrain on a terrainValidated node', () => {
    const s = newGame()
    s.terrainValidated = true
    s.terrain = [{ id: 'wall', type: 'rock', x: 250, y: 0, radius: 250 }]
    s.hazards = [cloud({ x: 100, y: 0 })]

    const unit = spawnUnit(RANGED_TEMPLATE, 'player')
    unit.x = 100; unit.y = 0; unit.advanceY = 0
    const foe = spawnUnit(MOBILE_TEMPLATE, 'opponent')
    foe.x = 110; foe.y = 0
    s.field = [unit, foe]

    for (let i = 0; i < 60; i++) moveUnits(s, 100)

    // The rock seals the lane from x≈0 to x≈500; the drift must not tunnel into it.
    expect(unit.x).toBeLessThan(250)
  })
})
