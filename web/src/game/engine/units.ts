import { GameState, LANE_WIDTH, TERRAIN_AVOID_SHAPE, Unit, UnitTag } from '../types'
import { BASE_STOP_MARGIN, DAMAGE_FLASH_MS } from './constants'
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

  for (const unit of s.field) {
    if (unit.moveSpeed === 0) continue
    if (unit.spawnGrowTimer != null && unit.spawnGrowTimer > 0) continue
    if (unit.stunTimer      != null && unit.stunTimer      > 0) continue

    const anyEnemies = unit.owner === 'player' ? livingOpponentUnits : livingPlayerUnits

    const nearestAhead = findNearestEnemyByPriority(s.field, unit) ?? findNearestEnemy(s.field, unit)

    let tx: number = unit.owner === 'player' ? LANE_WIDTH : 0
    let ty: number = 0
    let hasTarget = false

    if (nearestAhead) {
      if (unitDist(unit, nearestAhead) <= unit.attackRange) continue
      tx = nearestAhead.x
      ty = nearestAhead.isWall ? unit.y : nearestAhead.y
      hasTarget = true
    } else {
      const behind = findEnemyBehind(s.field, unit)
      if (behind) {
        if (unitDist(unit, behind) <= unit.attackRange) continue
        tx = behind.x
        ty = behind.isWall ? unit.y : behind.y
        hasTarget = true
      }
    }

    // Affinity group movement: seek partner if out of range; leash once bonded
    if (unit.affinity && !unit.isWall) {
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
    if (unit.unitTrait?.fleeFrom?.length && !hasTarget) {
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

    // Unit trait: guard base (active for first 2 minutes only)
    if (unit.unitTrait?.guardBase && s.gameTime < 120000) {
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
    const moatSlowFactor = s.field.reduce((factor, m) => {
      if (!m.isMoat) return factor
      const effect = m.structureEffect as { type: 'slowZone'; slowFactor: number; radius: number } | undefined
      if (!effect || effect.type !== 'slowZone') return factor
      if (Math.abs(unit.x - m.x) <= effect.radius) return Math.min(factor, effect.slowFactor)
      return factor
    }, 1)
    const fogMult     = s.activeBattleEvent?.type === 'fogOfWar' ? 0.5 : 1
    const affMoveMult = (unit.affinityActive && unit.affinity?.effectType === 'moveSpeed')
      ? unit.affinity.effectAmount : 1
    const speed = (inWallZone ? unit.moveSpeed * CLIMB_SPEED_FACTOR : unit.moveSpeed)
      * deltaSec * fogMult * affMoveMult * moatSlowFactor

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
  }
}

// ─── Affinity Processing ──────────────────────────────────

export function processAffinities(field: Unit[]): void {
  for (const unit of field) {
    if (!unit.affinity || unit.hp <= 0 || (unit.masteryLevel ?? 0) < 1) {
      unit.affinityActive = false
      continue
    }
    const aff  = unit.affinity
    const ally = field.find(
      u => u.owner === unit.owner && u.id !== unit.id && u.hp > 0 &&
        u.name === aff.withName && unitDist(unit, u) <= aff.range
    )
    unit.affinityActive = ally !== undefined
  }
}
