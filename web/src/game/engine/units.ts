import { GameState, LANE_WIDTH, TERRAIN_AVOID_SHAPE, Unit, UnitTag } from '../types'
import { BASE_STOP_MARGIN, COMMANDER_LEASH_PX, DAMAGE_FLASH_MS, PLAYER_SPAWN_X } from './constants'
import { LANE_MAX_Y, LANE_MIN_Y } from './helpers'
import { unitDist, findNearestEnemy, findNearestEnemyByPriority, findEnemyBehind } from './targeting'

// ─── Movement ─────────────────────────────────────────────

const CLIMB_SPEED_FACTOR   = 0.25  // climbers move at 25% speed through wall zones
const WALL_CLIMB_ZONE      = 30    // px radius around a wall that counts as "wall zone"
const BLOOD_CLUSTER_RADIUS = 70    // px — pools within this distance count as "same area"
const BLOOD_CLUSTER_MIN    = 2     // minimum pools in a cluster to trigger avoidance
const MAX_BASE_GUARDS      = 2     // max units per side allowed to stay in guard-base mode

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

  for (const unit of s.field) {
    if (unit.moveSpeed === 0) continue
    if (unit.spawnGrowTimer != null && unit.spawnGrowTimer > 0) continue
    if (unit.stunTimer      != null && unit.stunTimer      > 0) continue

    // Hold: player units freeze in place (combat system still handles attacks)
    if (unit.owner === 'player' && stance === 'hold') continue

    const anyEnemies = unit.owner === 'player' ? livingOpponentUnits : livingPlayerUnits

    const nearestAhead = findNearestEnemyByPriority(s.field, unit) ?? findNearestEnemy(s.field, unit)

    let tx: number = unit.owner === 'player' ? LANE_WIDTH : 0
    let ty: number = 0
    let hasTarget = false

    if (nearestAhead) {
      if (unitDist(unit, nearestAhead) <= unit.attackRange) continue
      // Attack/defend: don't chase enemies — keep charging toward destination
      if (unit.owner !== 'player' || stance === 'auto') {
        tx = nearestAhead.x
        ty = nearestAhead.isWall ? unit.y : nearestAhead.y
        hasTarget = true
      }
    } else if (unit.owner !== 'player' || stance === 'auto') {
      // Only turn back for enemies behind in auto mode
      const behind = findEnemyBehind(s.field, unit)
      if (behind) {
        if (unitDist(unit, behind) <= unit.attackRange) continue
        tx = behind.x
        ty = behind.isWall ? unit.y : behind.y
        hasTarget = true
      }
    }

    // Defend: pull back toward spawn, spread across Y slots; overflow units charge forward.
    if (unit.owner === 'player' && stance === 'defend' && !defendOverflowAttackers.has(unit.id)) {
      const idNum = parseInt(unit.id.replace(/\D/g, ''), 10) || 0
      tx = PLAYER_SPAWN_X + 40
      ty = DEFEND_Y_SLOTS[idNum % DEFEND_Y_SLOTS.length]
      hasTarget = false
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
        ty = unit.y
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
          if (unitDist(unit, attacker) <= unit.attackRange) continue
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

    const dx = tx - unit.x
    const dy = ty - unit.y
    const d  = Math.sqrt(dx * dx + dy * dy)
    if (d === 0) continue

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

    // Terrain avoidance: lateral repulsion from nearby obstacles
    let avoidY = 0
    if (!unit.flying) {
      for (const obs of s.terrain) {
        const toObsX = obs.x - unit.x
        const toObsY = obs.y - unit.y
        const shape  = TERRAIN_AVOID_SHAPE[obs.type]
        const ax     = obs.radius * shape.fx + 4
        const ay     = obs.radius * shape.fy + 4
        const normDist = Math.sqrt((toObsX / ax) ** 2 + (toObsY / ay) ** 2)
        if (normDist < 1 && normDist > 0) {
          const strength = 1 - normDist
          let lateralDir: number
          if (Math.abs(toObsY) < 5) {
            const idNum = parseInt(unit.id.replace(/\D/g, ''), 10) || 0
            lateralDir = (idNum % 2 === 0) ? -1 : 1
          } else {
            lateralDir = -Math.sign(toObsY)
          }
          avoidY += lateralDir * strength * unit.moveSpeed * 1.8
        }
      }

      // Blood pool cluster avoidance
      for (const pool of densePools) {
        const toPoolX = pool.x - unit.x
        const toPoolY = pool.y - unit.y
        const dist    = Math.sqrt(toPoolX ** 2 + toPoolY ** 2)
        if (dist < BLOOD_CLUSTER_RADIUS && dist > 0) {
          const strength    = 1 - dist / BLOOD_CLUSTER_RADIUS
          const lateralDir  = Math.abs(toPoolY) < 5
            ? ((parseInt(unit.id.replace(/\D/g, ''), 10) || 0) % 2 === 0 ? -1 : 1)
            : -Math.sign(toPoolY)
          const isAhead     = unit.owner === 'player' ? toPoolX > 0 : toPoolX < 0
          const deflectMult = isAhead ? 1.8 : 1.2
          avoidY += lateralDir * strength * unit.moveSpeed * deflectMult
        }
      }
    }

    const step = Math.min(speed, d)
    unit.x = Math.min(LANE_WIDTH - BASE_STOP_MARGIN, Math.max(BASE_STOP_MARGIN, unit.x + (dx / d) * step))
    unit.y = Math.min(LANE_MAX_Y, Math.max(LANE_MIN_Y, unit.y + (dy / d) * step + avoidY * deltaSec))

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
