import { GameState, LANE_WIDTH, TERRAIN_AVOID_SHAPE, RUIN_FOOTPRINT_RADIUS, Unit, UnitTag } from '../types'
import {
  BASE_STOP_MARGIN, COMMANDER_LEASH_PX, DAMAGE_FLASH_MS, DEFEND_ZONE_MAX_X, PLAYER_SPAWN_X,
} from './constants'
import { LANE_MAX_Y, LANE_MIN_Y } from './helpers'
import { unitDist, findNearestEnemy, findNearestEnemyByPriority, findEnemyBehind } from './targeting'
import { computeRoadWaypoints } from './roads'
import {
  gameToContainingTile, buildObstacleTileMap, buildRoadTileMap, isTilePassable,
  buildFlowField, flowFieldStep, tileToGame, type MovementProfile,
} from './terrainGrid'

// Cache parsed numeric suffix of unit IDs — avoids regex+parseInt on every movement tick.
const _idNumCache = new Map<string, number>()
function idNum(id: string): number {
  let n = _idNumCache.get(id)
  if (n === undefined) {
    n = parseInt(id.replace(/\D/g, ''), 10) || 0
    _idNumCache.set(id, n)
  }
  return n
}

// ─── Movement ─────────────────────────────────────────────

const CLIMB_SPEED_FACTOR   = 0.25  // climbers move at 25% speed through wall zones
const WALL_CLIMB_ZONE      = 30    // px radius around a wall that counts as "wall zone"
const BLOOD_CLUSTER_RADIUS = 70    // px — pools within this distance count as "same area"
const BLOOD_CLUSTER_MIN    = 2     // minimum pools in a cluster to trigger avoidance
const MAX_BASE_GUARDS      = 2     // max units per side allowed to stay in guard-base mode
const ROAD_WAYPOINT_ARRIVE_PX = 15 // distance within which a road waypoint counts as "reached"

// ─── Ground-hazard (gas cloud) avoidance ──────────────────
// Units used to stand inside an enemy gas cloud trading blows, or walk straight through
// one, until the damage-per-second killed them — nothing in movement read s.hazards.
// The push below is 2-D, unlike the lateral-only terrain/blood repulsion: a cloud centred
// in the lane is wide enough that sidestepping alone can't clear it within ±LANE_MAX_Y.
/** Deflection band outside the damaging radius, so units skirt a cloud rather than clip it. */
const HAZARD_AVOID_MARGIN = 12
/** Fraction of moveSpeed used when shuffling clear of a cloud while engaged — a shuffle, so
 *  under 1 to keep it from overshooting the fight it's trying to stay in. */
const HAZARD_DRIFT_SPEED_FACTOR = 0.9
/** Deflection strength for a unit that's still steering, as a multiple of moveSpeed. Must
 *  exceed 1 or advancing units grind forward into a cloud faster than it pushes them out —
 *  the same reason the terrain and blood-pool deflections sit at 1.8. */
const HAZARD_DEFLECT_FACTOR = 1.8
/** Below this distance from a cloud's centre the away-vector is degenerate; pick a side. */
const HAZARD_CENTRE_EPSILON = 5

/**
 * Direction to move to get clear of every enemy-owned hazard near this unit, plus how hard to
 * commit to it: full strength anywhere inside the damaging radius (standing in gas is never
 * something to leave half-heartedly), tapering to nothing across the margin band outside it so
 * units passing by are deflected smoothly instead of snapping at the boundary. Strength 0 means
 * the unit is clear and the vector is meaningless.
 *
 * Not gated on `flying` — engine.ts gasses flying units too, so they need to dodge as well.
 */
function hazardEscapeVector(
  unit: Unit,
  hazards: GameState['hazards'],
): { hx: number; hy: number; strength: number } {
  let hx = 0, hy = 0, strongest = 0
  for (const hz of hazards) {
    if (hz.owner === unit.owner) continue
    const toUnitX = unit.x - hz.x
    const toUnitY = unit.y - hz.y
    const dist    = Math.hypot(toUnitX, toUnitY)
    if (dist >= hz.radius + HAZARD_AVOID_MARGIN) continue
    const strength = dist <= hz.radius ? 1 : 1 - (dist - hz.radius) / HAZARD_AVOID_MARGIN
    strongest = Math.max(strongest, strength)
    // Break ties deterministically by id parity — the same trick the terrain and blood-pool
    // blocks use head-on, and it also splits a crowd around the cloud rather than sending
    // every unit the same way.
    const lateralDir = idNum(unit.id) % 2 === 0 ? -1 : 1
    if (dist < HAZARD_CENTRE_EPSILON) {
      // Clouds are dropped directly onto the unit they're aimed at, so "standing on the
      // centre" is the common case here, not an edge case.
      hy += lateralDir * strength
    } else {
      hx += (toUnitX / dist) * strength
      hy += (toUnitY / dist) * strength
      // Approaching along the cloud's own lane: the away-vector is purely backwards, so
      // following it just stalls the unit nose-first against the gas. Add a sideways term
      // so it rounds the cloud instead.
      if (Math.abs(toUnitY) < HAZARD_CENTRE_EPSILON) hy += lateralDir * strength
    }
  }
  const len = Math.hypot(hx, hy)
  if (len === 0) return { hx: 0, hy: 0, strength: 0 }
  return { hx: hx / len, hy: hy / len, strength: strongest }
}

export function moveUnits(s: GameState, deltaMs: number): void {
  const deltaSec = deltaMs / 1000
  const stance = s.playerStance ?? 'auto'

  const guardDecisionCount: Record<string, number> = {}

  // Pre-compute which active blood pools are part of a dense cluster.
  // Done once per tick rather than per unit to keep cost O(pools²).
  const activePools = s.bloodPools.filter(p => p.fadingAt === undefined)
  const densePools  = activePools.filter(pool => {
    const nearby = activePools.filter(
      p => p !== pool &&
        Math.abs(p.x - pool.x) < BLOOD_CLUSTER_RADIUS &&
        Math.abs(p.y - pool.y) < BLOOD_CLUSTER_RADIUS
    )
    return nearby.length >= BLOOD_CLUSTER_MIN - 1
  })

  // Hazards still burning this tick. tidyBattlefield purges expired ones at the *end* of the
  // tick, well after movement, so the expiry has to be re-checked here.
  const liveHazards = (s.hazards ?? []).filter(h => h.expiresAt > s.gameTime)

  // Tile grid + road map, built once per battle (s.terrain/s.roads don't change mid-battle)
  // and shared by the hard-blocking steering below and the hazard drift.
  const ensureTerrainGrid = () => (s.terrainGridCache ??= {
    obstacleTiles: buildObstacleTileMap(s.terrain),
    roadTiles: buildRoadTileMap(s.roads ?? []),
    flowFields: new Map(),
  })

  /** Whether `unit` may stand at (x, y). Always true where hard tile blocking is off. */
  const canUnitEnter = (unit: Unit, x: number, y: number): boolean => {
    if (!s.terrainValidated || unit.flying) return true
    const { obstacleTiles, roadTiles } = ensureTerrainGrid()
    const profile: MovementProfile = unit.tags?.includes('burrowing') ? 'burrowing' : 'ground'
    const swims = unit.tags?.includes('swim') ?? false
    const { tcx, tcy } = gameToContainingTile(x, y)
    return isTilePassable(obstacleTiles, roadTiles, tcx, tcy, profile, swims)
  }

  /**
   * Shuffle a unit clear of any gas cloud it's standing in, for the paths that skip steering
   * entirely — a unit already in attack range, or one sitting on its movement target. Those
   * early-`continue`s are why a unit would stand in a cloud swinging until it died.
   *
   * `engaged` is the unit it's currently in range of, if any: the drift is capped so that unit
   * stays inside attackRange, making this "drift out, keep fighting" rather than a retreat.
   * These paths bypass the end-of-loop clamps, so the leash and defend backstop are reapplied
   * here.
   */
  const driftFromHazards = (unit: Unit, engaged: Unit | undefined, defending: boolean): void => {
    if (liveHazards.length === 0) return
    const { hx, hy, strength } = hazardEscapeVector(unit, liveHazards)
    if (strength === 0) return

    let step = unit.moveSpeed * HAZARD_DRIFT_SPEED_FACTOR * strength * deltaSec
    if (engaged) {
      // Furthest the unit can travel along (hx, hy) with its target still in range: solve
      // |P + t·D − T| = attackRange for t. Guarded on the target already being in range, so
      // the discriminant can't go negative.
      const cx = unit.x - engaged.x
      const cy = unit.y - engaged.y
      const proj = cx * hx + cy * hy
      const disc = proj * proj - (cx * cx + cy * cy) + unit.attackRange * unit.attackRange
      if (disc <= 0) return
      step = Math.min(step, Math.max(0, -proj + Math.sqrt(disc)))
    }
    if (step <= 0) return

    const xStart = unit.x
    const nx = Math.min(LANE_WIDTH - BASE_STOP_MARGIN, Math.max(BASE_STOP_MARGIN, unit.x + hx * step))
    const ny = Math.min(LANE_MAX_Y, Math.max(LANE_MIN_Y, unit.y + hy * step))
    if (canUnitEnter(unit, nx, ny))          { unit.x = nx; unit.y = ny }
    else if (canUnitEnter(unit, unit.x, ny))   unit.y = ny
    else if (canUnitEnter(unit, nx, unit.y))   unit.x = nx

    if (defending) unit.x = Math.min(unit.x, Math.max(DEFEND_ZONE_MAX_X, xStart))
    if (unit.isCommander && unit.commanderHomeX !== undefined) {
      unit.x = Math.min(unit.commanderHomeX + COMMANDER_LEASH_PX, Math.max(unit.commanderHomeX - COMMANDER_LEASH_PX, unit.x))
    }
  }

  const livingOpponentUnits = s.field.some(u => u.owner === 'opponent' && u.hp > 0)
  const livingPlayerUnits   = s.field.some(u => u.owner === 'player'   && u.hp > 0)

  // Pre-find commanders so rally logic can reference them without re-scanning per unit.
  const playerCommander   = s.field.find(u => u.owner === 'player'   && u.isCommander && u.hp > 0)
  const opponentCommander = s.field.find(u => u.owner === 'opponent' && u.isCommander && u.hp > 0)

  // Distance within which units rally to protect their commander.
  const COMMANDER_RALLY_PX  = 180
  // Distance within which the commander itself retreats from enemies.
  const COMMANDER_FLEE_PX   = 90

  // Defend overflow: if ≥15 defenders, the 5 furthest-forward units charge instead.
  const defendOverflowAttackers = new Set<string>()
  if (stance === 'defend') {
    const defenders = s.field.filter(
      u => u.owner === 'player' && u.hp > 0 && u.moveSpeed > 0 &&
           (u.spawnGrowTimer == null || u.spawnGrowTimer <= 0) &&
           (u.stunTimer      == null || u.stunTimer      <= 0)
    )
    if (defenders.length >= 15) {
      defenders.sort((a, b) => b.x - a.x)
      defenders.slice(0, 5).forEach(u => defendOverflowAttackers.add(u.id))
    }
  }

  // Y positions defenders spread across so they don't all converge on a single point.
  const DEFEND_Y_SLOTS = [-64, -40, -20, 0, 20, 40, 64]

  // The line defenders form up on. Sits just inside DEFEND_ZONE_MAX_X so units
  // holding formation have room to shuffle without touching the boundary.
  const DEFEND_LINE_X = PLAYER_SPAWN_X + 40

  // Enemies that have entered the defensive zone — where the player's spawners,
  // walls and commander all sit. Defenders break formation only for these, and
  // never leave the zone to reach one. Anything outside is still shot at by
  // whoever's attackRange covers it; processAttacks is stance-agnostic.
  // Moats are walked through rather than targeted (see targeting.ts).
  const defendThreats = stance === 'defend'
    ? s.field.filter(u => u.owner === 'opponent' && u.hp > 0 && !u.isMoat && u.x <= DEFEND_ZONE_MAX_X)
    : []

  // Threats already claimed by a defender this tick. Without this every defender
  // independently picks the globally nearest intruder, so a single breacher pulls
  // the whole line off its slots and leaves the other lanes open.
  const claimedThreats = new Set<string>()

  for (const unit of s.field) {
    if (unit.moveSpeed === 0) continue
    if (unit.spawnGrowTimer != null && unit.spawnGrowTimer > 0) continue
    if (unit.stunTimer      != null && unit.stunTimer      > 0) continue

    // Hold: player units freeze in place (combat system still handles attacks)
    if (unit.owner === 'player' && stance === 'hold') continue

    const anyEnemies = unit.owner === 'player' ? livingOpponentUnits : livingPlayerUnits

    // Defenders steer entirely from the defend branch below. Overflow units are
    // excluded — they charge like any attacker.
    const isDefending = unit.owner === 'player' && stance === 'defend'
      && !defendOverflowAttackers.has(unit.id)

    const nearestAhead = findNearestEnemyByPriority(s.field, unit) ?? findNearestEnemy(s.field, unit)

    // Advancing units head for their own lateral lane rather than dead centre.
    // Sending everyone to y=0 collapsed the army onto the centre line within
    // seconds, which wasted the flanks and — because the flow field is shared
    // and deterministic — meant every blocked unit then detoured round terrain
    // on the identical side. A per-unit lane fans them out, so they meet
    // obstacles at different points and naturally split around them.
    if (unit.advanceY === undefined) unit.advanceY = (Math.random() * 2 - 1) * LANE_MAX_Y
    let tx: number = unit.owner === 'player' ? LANE_WIDTH : 0
    let ty: number = unit.advanceY
    let hasTarget = false

    // Road-following: lazily compute this unit's path onto the nearest authored road the
    // first time it's processed (mirrors the guardY "lazy, set on first tick" pattern —
    // spawnUnit() has no GameState access, so this can't be done at spawn time). Only
    // used as the *default* target below; every higher-priority block further down still
    // overrides tx/ty exactly as before, so this never touches hasTarget.
    if (s.roadFollowing && !unit.flying && unit.roadWaypoints === undefined) {
      unit.roadWaypoints = computeRoadWaypoints(unit.x, unit.y, tx, s.roads) ?? []
    }
    if (unit.roadWaypoints && unit.roadWaypoints.length > 0) {
      tx = unit.roadWaypoints[0].x
      ty = unit.roadWaypoints[0].y
    }

    // Defend runs before the chase block rather than after it. The
    // "already in range, don't move" early-continue below fires for any enemy
    // ahead regardless of stance, so while it ran first a defender facing a
    // steady stream of enemies never reached this branch and never walked back
    // to its slot — it stayed parked wherever the last intercept left it.
    if (isDefending) {
      // Intercept whatever has entered the zone, otherwise hold formation spread
      // across Y slots. Nearest *unclaimed* threat wins so the line spreads over
      // several breachers; nearest overall is the fallback once all are claimed.
      let threat: Unit | undefined
      let threatDist = Infinity
      let nearest: Unit | undefined
      let nearestDist = Infinity
      for (const other of defendThreats) {
        const d = unitDist(unit, other)
        if (d < nearestDist) { nearestDist = d; nearest = other }
        if (claimedThreats.has(other.id)) continue
        if (d < threatDist) { threatDist = d; threat = other }
      }
      if (!threat) { threat = nearest; threatDist = nearestDist }
      if (threat) {
        claimedThreats.add(threat.id)
        // Already engaging it — combat handles the attack, don't crowd closer.
        if (threatDist <= unit.attackRange) { driftFromHazards(unit, threat, true); continue }
        tx = threat.x
        ty = threat.isWall ? unit.y : threat.y
        hasTarget = true
      } else {
        tx = DEFEND_LINE_X
        ty = DEFEND_Y_SLOTS[idNum(unit.id) % DEFEND_Y_SLOTS.length]
        hasTarget = false
      }
    } else if (nearestAhead) {
      if (unitDist(unit, nearestAhead) <= unit.attackRange) { driftFromHazards(unit, nearestAhead, false); continue }
      // Attack: don't chase enemies — keep charging toward destination
      if (unit.owner !== 'player' || stance === 'auto') {
        tx = nearestAhead.x
        ty = nearestAhead.isWall ? unit.y : nearestAhead.y
        hasTarget = true
      }
    } else if (unit.owner !== 'player' || stance === 'auto') {
      // Only turn back for enemies behind in auto mode
      const behind = findEnemyBehind(s.field, unit)
      if (behind) {
        if (unitDist(unit, behind) <= unit.attackRange) { driftFromHazards(unit, behind, false); continue }
        tx = behind.x
        ty = behind.isWall ? unit.y : behind.y
        hasTarget = true
      }
    }

    // Trait-based movement overrides are suppressed in attack/defend/hold stances
    const useTraitMovement = unit.owner !== 'player' || stance === 'auto'

    // Affinity group movement: seek partner if out of range; leash once bonded
    if (useTraitMovement && unit.affinity && !unit.isWall) {
      const aff     = unit.affinity
      const partner = s.field.find(
        u => u.owner === unit.owner && u.id !== unit.id && u.hp > 0 && u.name === aff.withName
      )
      if (partner) {
        const partnerDist  = unitDist(unit, partner)
        const isPlayerUnit = unit.owner === 'player'
        const unitIsAhead  = isPlayerUnit ? unit.x > partner.x : unit.x < partner.x
        if (partnerDist > aff.range) {
          if (!hasTarget) {
            if (unitIsAhead && anyEnemies) {
              // Hold position and let partner catch up; only when enemies remain
              tx = unit.x
              ty = unit.y
            } else if (!unitIsAhead) {
              tx = partner.x
              ty = partner.y
            }
            // else: unitIsAhead && !anyEnemies → fall through to base movement
          }
        } else {
          // Cohesion: bonded — don't advance more than half affinity range ahead of partner
          const leash = aff.range * 0.5
          if (isPlayerUnit) tx = Math.min(tx, partner.x + leash)
          else              tx = Math.max(tx, partner.x - leash)
        }
      }
    }

    // Unit trait: flee
    if (useTraitMovement && unit.unitTrait?.fleeFrom?.length && !hasTarget) {
      const fleeRange = unit.unitTrait.fleeRange ?? 80
      let fvx = 0, fvy = 0, fleeCount = 0
      for (const other of s.field) {
        if (other.owner === unit.owner || other.hp <= 0) continue
        const dist = unitDist(unit, other)
        if (dist > fleeRange || dist === 0) continue
        if (other.tags?.some(t => unit.unitTrait!.fleeFrom!.includes(t as UnitTag))) {
          fvx += unit.x - other.x
          fvy += unit.y - other.y
          fleeCount++
        }
      }
      if (fleeCount > 0) {
        const len      = Math.sqrt(fvx * fvx + fvy * fvy) || 1
        const rawTx    = unit.x + (fvx / len) * 200
        const MAX_RETREAT = 80
        tx = unit.owner === 'player'
          ? Math.max(rawTx, unit.x - MAX_RETREAT)
          : Math.min(rawTx, unit.x + MAX_RETREAT)
        ty = unit.y + (fvy / len) * 40
        hasTarget = true
      }
    }

    // Builder trait: seek nearest friendly building; once charges exhausted, run to enemy base
    if (useTraitMovement && unit.unitTrait?.builderMode) {
      if (unit.builderSaboteurMode) {
        // Sprint to enemy base, steering away from nearby enemies
        const enemyBaseX = unit.owner === 'player' ? LANE_WIDTH : 0
        const fleeRange = 80
        let fvx = 0, fvy = 0, fleeCount = 0
        for (const other of s.field) {
          if (other.owner === unit.owner || other.hp <= 0) continue
          const dist = unitDist(unit, other)
          if (dist > fleeRange || dist === 0) continue
          fvx += unit.x - other.x
          fvy += unit.y - other.y
          fleeCount++
        }
        if (fleeCount > 0) {
          const len = Math.sqrt(fvx * fvx + fvy * fvy) || 1
          tx = enemyBaseX + (fvx / len) * 80
          ty = unit.y + (fvy / len) * 40
        } else {
          tx = enemyBaseX
          ty = 0
        }
        hasTarget = true
      } else {
        // Normal mode: seek nearest friendly building, skipping the one last serviced
        let buildings = s.field.filter(
          b => b.owner === unit.owner && b.moveSpeed === 0 && !b.isWall && b.hp > 0 &&
               b.id !== unit.builderLastBuildingId
        )
        if (buildings.length === 0) {
          buildings = s.field.filter(b => b.owner === unit.owner && b.moveSpeed === 0 && !b.isWall && b.hp > 0)
        }
        if (buildings.length > 0) {
          const nearest = buildings.reduce((a, b) => unitDist(unit, a) < unitDist(unit, b) ? a : b)
          const dist = unitDist(unit, nearest)
          if (dist <= 30) {
            tx = unit.x
            ty = unit.y
          } else {
            tx = nearest.x
            ty = nearest.y
          }
          hasTarget = true
        }
      }
    }

    // Commander: retreat from nearby enemies rather than engaging them directly.
    // Moves back toward commanderHomeX so allies can intercept first.
    if (unit.isCommander && unit.commanderHomeX !== undefined && useTraitMovement) {
      const threats = s.field.filter(
        e => e.owner !== unit.owner && e.hp > 0 && unitDist(unit, e) <= COMMANDER_FLEE_PX
      )
      if (threats.length > 0) {
        tx = unit.commanderHomeX
        // Recenter to the home lane (y=0) rather than holding the lateral position the
        // commander drifted to while chasing — otherwise a commander that chased an enemy
        // to an extreme lane gets pinned in the corner, clips off-screen, and stalls the game.
        ty = 0
        hasTarget = true
      }
    }

    // Ally rally: when the commander is actively taking damage, nearby allies override their
    // movement target to intercept the commander's attacker.
    if (!unit.isCommander && useTraitMovement) {
      const ownCommander = unit.owner === 'player' ? playerCommander : opponentCommander
      if (
        ownCommander &&
        ownCommander.damageFlashTimer != null && ownCommander.damageFlashTimer > 0 &&
        ownCommander.lastAttackerId &&
        unitDist(unit, ownCommander) <= COMMANDER_RALLY_PX
      ) {
        const attacker = s.field.find(u => u.id === ownCommander.lastAttackerId && u.hp > 0)
        if (attacker) {
          if (unitDist(unit, attacker) <= unit.attackRange) { driftFromHazards(unit, attacker, false); continue }
          tx = attacker.x
          ty = attacker.y
          hasTarget = true
        }
      }
    }

    // Unit trait: guard base (active for first 2 minutes only)
    if (useTraitMovement && unit.unitTrait?.guardBase && s.gameTime < 120000) {
      const ownBaseX      = unit.owner === 'player' ? 0 : LANE_WIDTH
      const engageRange   = unit.unitTrait.engageRange   ?? 180
      const baseGuardRange = unit.unitTrait.baseGuardRange ?? 80
      const enemyNearBase = s.field.some(other =>
        other.owner !== unit.owner && other.hp > 0 && Math.abs(other.x - ownBaseX) < engageRange
      )
      const guardsThisTick = guardDecisionCount[unit.owner] ?? 0
      if (!enemyNearBase && guardsThisTick < MAX_BASE_GUARDS && anyEnemies) {
        guardDecisionCount[unit.owner] = guardsThisTick + 1
        if (unit.guardY === undefined) unit.guardY = (Math.random() * 2 - 1) * LANE_MAX_Y
        const guardX = unit.owner === 'player' ? ownBaseX + baseGuardRange : ownBaseX - baseGuardRange
        tx = guardX
        ty = unit.guardY
        hasTarget = true
      }
    }

    // Position at the start of this tick — the defend clamp below needs it so a
    // unit already past the zone when the stance was tapped can walk home
    // instead of being teleported back to the boundary.
    const xBefore = unit.x

    const dx = tx - unit.x
    const dy = ty - unit.y
    const d  = Math.sqrt(dx * dx + dy * dy)
    // Already standing on its target (holding a slot, waiting on an affinity partner, …).
    // Nothing to steer, but a cloud landing here still has to be walked out of.
    if (d === 0) { driftFromHazards(unit, undefined, isDefending); continue }

    const inWallZone = unit.climber && s.field.some(w =>
      w.isWall && w.owner !== unit.owner && w.hp > 0 && Math.abs(unit.x - w.x) <= WALL_CLIMB_ZONE
    )
    let moatSlowFactor = 1
    if (!unit.flying) {
      for (const m of s.field) {
        if (!m.isMoat) continue
        const effect = m.structureEffect as { type: 'slowZone'; slowFactor: number; radius: number; damagePerSec?: number } | undefined
        if (!effect || effect.type !== 'slowZone') continue
        if (m.owner !== unit.owner && Math.abs(unit.x - m.x) <= effect.radius) {
          if (unit.tags?.includes('swim')) {
            moatSlowFactor = Math.max(moatSlowFactor, 1.25)
          } else {
            moatSlowFactor = Math.min(moatSlowFactor, effect.slowFactor)
          }
          if (effect.damagePerSec && unit.hp > 0) {
            if (unit.moatDamageTimer == null) unit.moatDamageTimer = 0
            unit.moatDamageTimer -= deltaMs
            if (unit.moatDamageTimer <= 0) {
              const pulse = Math.round(effect.damagePerSec * 0.4)
              unit.hp = Math.max(0, unit.hp - pulse)
              unit.damageFlashTimer = 80
              unit.moatDamageTimer = 1000
            }
          }
        }
      }
    }
    // Moat never halts a unit: effective speed stays ≥ 1 px/s
    const clampedMoatFactor = unit.moveSpeed > 0
      ? Math.max(moatSlowFactor, 1 / unit.moveSpeed)
      : moatSlowFactor
    const fogMult     = s.activeBattleEvent?.type === 'fogOfWar' ? 0.5 : 1
    const affMoveMult = (unit.affinityActive && unit.affinity?.effectType === 'moveSpeed')
      ? unit.affinity.effectAmount : 1
    const freezeFactor = (unit.freezeTimer != null && unit.freezeTimer > 0 && unit.freezeSlow != null)
      ? unit.freezeSlow : 1
    const speed = (inWallZone ? unit.moveSpeed * CLIMB_SPEED_FACTOR : unit.moveSpeed)
      * deltaSec * fogMult * affMoveMult * clampedMoatFactor * freezeFactor

    // Steering repulsion, folded into the step below.
    let avoidX = 0
    let avoidY = 0

    // Gas clouds. Unlike terrain and blood pools this pushes on both axes and applies to
    // flying units too: a cloud is wide enough that sidestepping alone can't clear it inside
    // LANE_MIN_Y..LANE_MAX_Y, and gas damages flyers.
    if (liveHazards.length > 0) {
      const { hx, hy, strength } = hazardEscapeVector(unit, liveHazards)
      if (strength > 0) {
        const push = unit.moveSpeed * HAZARD_DEFLECT_FACTOR * strength
        avoidX += hx * push
        avoidY += hy * push
      }
    }

    if (!unit.flying) {
      // Terrain avoidance: lateral repulsion from nearby obstacles. Skipped when
      // `terrainValidated` is on — that node uses hard tile blocking below
      // instead (see game/engine/terrainGrid.ts). Untouched otherwise, so every
      // existing act/node (terrainValidated absent/false) behaves exactly as
      // before.
      if (!s.terrainValidated) {
        for (const obs of s.terrain) {
          const toObsX = obs.x - unit.x
          const toObsY = obs.y - unit.y
          const shape  = TERRAIN_AVOID_SHAPE[obs.type]
          // Ruins draw a single icon, so they deflect over one tile rather than
          // their authored radius — see RUIN_FOOTPRINT_RADIUS.
          const radius = obs.type === 'ruin' ? RUIN_FOOTPRINT_RADIUS : obs.radius
          const ax     = radius * shape.fx + 4
          const ay     = radius * shape.fy + 4
          const normDist = Math.sqrt((toObsX / ax) ** 2 + (toObsY / ay) ** 2)
          if (normDist < 1 && normDist > 0) {
            const strength = 1 - normDist
            let lateralDir: number
            if (Math.abs(toObsY) < 5) {
                lateralDir = (idNum(unit.id) % 2 === 0) ? -1 : 1
            } else {
              lateralDir = -Math.sign(toObsY)
            }
            avoidY += lateralDir * strength * unit.moveSpeed * 1.8
          }
        }
      }

      // Blood pool cluster avoidance — unrelated to terrain blocking, always runs.
      for (const pool of densePools) {
        const toPoolX = pool.x - unit.x
        const toPoolY = pool.y - unit.y
        const dist    = Math.sqrt(toPoolX ** 2 + toPoolY ** 2)
        if (dist < BLOOD_CLUSTER_RADIUS && dist > 0) {
          const strength    = 1 - dist / BLOOD_CLUSTER_RADIUS
          const lateralDir  = Math.abs(toPoolY) < 5
            ? (idNum(unit.id) % 2 === 0 ? -1 : 1)
            : -Math.sign(toPoolY)
          const isAhead     = unit.owner === 'player' ? toPoolX > 0 : toPoolX < 0
          const deflectMult = isAhead ? 1.8 : 1.2
          avoidY += lateralDir * strength * unit.moveSpeed * deflectMult
        }
      }
    }

    const step = Math.min(speed, d)
    const candX = Math.min(LANE_WIDTH - BASE_STOP_MARGIN, Math.max(BASE_STOP_MARGIN, unit.x + (dx / d) * step + avoidX * deltaSec))
    const candY = Math.min(LANE_MAX_Y, Math.max(LANE_MIN_Y, unit.y + (dy / d) * step + avoidY * deltaSec))

    if (!s.terrainValidated || unit.flying) {
      unit.x = candX
      unit.y = candY
    } else {
      // Hard tile-based blocking. The direct move is taken whenever the target
      // tile is free; otherwise the unit routes around the terrain by following
      // a flow field (see buildFlowField in ./terrainGrid.ts). Grid and fields
      // are built once per battle and cached, since s.terrain/s.roads don't
      // change mid-battle.
      const grid = ensureTerrainGrid()
      const { obstacleTiles, roadTiles } = grid
      const profile: MovementProfile = unit.tags?.includes('burrowing') ? 'burrowing' : 'ground'
      const swims = unit.tags?.includes('swim') ?? false
      const canEnter = (x: number, y: number) => {
        const { tcx, tcy } = gameToContainingTile(x, y)
        return isTilePassable(obstacleTiles, roadTiles, tcx, tcy, profile, swims)
      }
      const movesX = Math.abs(candX - unit.x) > 1e-6
      const movesY = Math.abs(candY - unit.y) > 1e-6
      const wants = movesX || movesY
      const directOpen = wants && canEnter(candX, candY)

      // Flow field toward this unit's goal edge, built lazily per profile/goal.
      // Defenders route toward their own base: the field is what steers a
      // terrain-blocked unit, and pointing it at the enemy base marched
      // defenders across the map the moment an obstacle got in the way.
      const goalX = isDefending ? 0 : (unit.owner === 'player' ? LANE_WIDTH : 0)
      const fieldKey = `${profile}|${swims}|${goalX}`
      let field = grid.flowFields.get(fieldKey)
      if (!field) {
        field = buildFlowField(obstacleTiles, roadTiles, profile, swims, goalX)
        grid.flowFields.set(fieldKey, field)
      }
      const here = gameToContainingTile(unit.x, unit.y)
      const hereDist = field.get(`${here.tcx},${here.tcy}`)
      const dest = gameToContainingTile(candX, candY)
      const destDist = field.get(`${dest.tcx},${dest.tcy}`)

      // A direct move is "productive" only if it actually gets the unit closer
      // to the goal along the real route. Merely being unblocked isn't enough:
      // a dead-end corridor is wide open, and walking up it feels like progress
      // while strictly increasing the remaining path length.
      const directProductive = directOpen && hereDist !== undefined
        && destDist !== undefined && destDist < hereDist

      // Enter detour mode when blocked; leave it only once going direct would
      // genuinely make progress. Exiting as soon as the path merely looks open
      // makes units ping-pong at the mouth of a dead end forever — they step
      // out, the corridor looks clear, they walk back in, and repeat.
      if (unit.detourFlowDist !== undefined && directProductive) {
        unit.detourFlowDist = undefined
      } else if (!directOpen && wants && unit.detourFlowDist === undefined) {
        unit.detourFlowDist = hereDist ?? Infinity
      }

      if (!canEnter(unit.x, unit.y) && field.size > 0) {
        // Standing inside terrain — obstacles reach over the spawn rows, so
        // units really do start embedded in rock. Every enterable check fails
        // from in there (including the neighbours the flow field would route
        // through), so blocking has to yield: the unit walks out under normal
        // steering and collision resumes the moment it reaches legal ground.
        // Requires a non-empty field, i.e. somewhere legal actually exists to
        // walk out to — a lane sealed end to end keeps the unit blocked rather
        // than letting it phase through the wall.
        unit.x = candX
        unit.y = candY
      } else if (directOpen && unit.detourFlowDist === undefined) {
        unit.x = candX
        unit.y = candY
      } else if (wants) {
        // Routing around terrain: step toward the neighbouring tile that is
        // closest to the goal. Axis-only sliding used to live here instead, but
        // it silently defeats itself — a unit heading for the enemy base drifts
        // a hair in y each tick, so the y-only branch always "succeeded" with a
        // sub-pixel move. Forward progress was zero, yet the unit never looked
        // stuck to the code; it just ground against the obstacle for the rest
        // of the battle.
        // Steer the detour toward this unit's own lane so an army splits around
        // an obstacle instead of every unit tracing the identical shortest route.
        const preferTcx = gameToContainingTile(unit.x, unit.advanceY ?? unit.y).tcx
        const next = flowFieldStep(field, here.tcx, here.tcy, preferTcx)
        if (next) {
          const target = tileToGame(next.tcx, next.tcy)
          const toX = target.x - unit.x
          const toY = target.y - unit.y
          const toDist = Math.hypot(toX, toY)
          if (toDist > 0) {
            const detourStep = Math.min(speed, toDist)
            const nx = Math.min(LANE_WIDTH - BASE_STOP_MARGIN, Math.max(BASE_STOP_MARGIN, unit.x + (toX / toDist) * detourStep))
            const ny = Math.min(LANE_MAX_Y, Math.max(LANE_MIN_Y, unit.y + (toY / toDist) * detourStep))
            // Only commit to an enterable step — the flow field works in whole
            // tiles, so a partial step can still clip a corner.
            if (canEnter(nx, ny)) { unit.x = nx; unit.y = ny }
            else if (canEnter(unit.x, ny)) { unit.y = ny }
            else if (canEnter(nx, unit.y)) { unit.x = nx }
          }
        } else if (directOpen) {
          // No downhill neighbour (already at the goal row, or sealed in):
          // take the direct move if it's available rather than freezing.
          unit.detourFlowDist = undefined
          unit.x = candX
          unit.y = candY
        }
        // else: genuinely sealed in — hold position, re-try next tick.
      }
    }

    // Backstop on the zone. Redundant by design: steering can't exceed the
    // boundary (every defend target is at most DEFEND_ZONE_MAX_X and a step never
    // overshoots its target), and the detour field points home. It's here because
    // the branches above write unit.x directly on several paths — the terrain
    // detour and the walk-out-of-an-obstacle escape hatch — so a future change to
    // any of them can't quietly put defenders back on the field. Clamping to
    // xBefore rather than the boundary means a unit caught up-field when DEFEND
    // is tapped walks home under normal steering instead of teleporting back.
    if (isDefending) unit.x = Math.min(unit.x, Math.max(DEFEND_ZONE_MAX_X, xBefore))

    // Advance past the current road waypoint once reached — gated on !hasTarget so a unit
    // pulled off-path by a higher-priority target this tick isn't credited with "arriving"
    // just because unrelated movement happened to land it near the waypoint. Defenders are
    // excluded outright: holding a slot leaves hasTarget false, so drifting near a waypoint
    // would silently consume it.
    if (!hasTarget && !isDefending && unit.roadWaypoints && unit.roadWaypoints.length > 0) {
      const wp = unit.roadWaypoints[0]
      if (Math.hypot(unit.x - wp.x, unit.y - wp.y) <= ROAD_WAYPOINT_ARRIVE_PX) {
        unit.roadWaypoints.shift()
      }
    }

    // Commanders cannot stray beyond their leash radius
    if (unit.isCommander && unit.commanderHomeX !== undefined) {
      unit.x = Math.min(unit.commanderHomeX + COMMANDER_LEASH_PX, Math.max(unit.commanderHomeX - COMMANDER_LEASH_PX, unit.x))
    }
  }
}

// ─── Affinity Processing ──────────────────────────────────

export function processAffinities(field: Unit[]): void {
  const byOwnerName = new Map<string, Unit[]>()
  for (const u of field) {
    if (u.hp <= 0) continue
    const key = `${u.owner}:${u.name}`
    const arr = byOwnerName.get(key)
    if (arr) arr.push(u)
    else byOwnerName.set(key, [u])
  }

  for (const unit of field) {
    if (!unit.affinity || unit.hp <= 0 || (unit.masteryLevel ?? 0) < 1) {
      unit.affinityActive = false
      continue
    }
    const candidates = byOwnerName.get(`${unit.owner}:${unit.affinity.withName}`) ?? []
    unit.affinityActive = candidates.some(u => u.id !== unit.id && unitDist(unit, u) <= unit.affinity!.range)
  }
}
