import { Unit, LANE_WIDTH } from '../types'

// ─── Distance ─────────────────────────────────────────────

/**
 * Effective gameplay distance between two units.
 * Walls span the full lateral axis, so only the forward (X) gap matters for
 * them. All other units use true 2-D Euclidean distance so that units in
 * different lanes must physically close the gap before attacking.
 */
export function unitDist(a: Unit, b: Unit): number {
  if (b.isWall) return Math.abs(a.x - b.x)
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

// ─── Enemy-finding ────────────────────────────────────────

/** Nearest enemy that is AHEAD (forward X) of this unit. Flying/climber units ignore walls. */
export function findNearestEnemy(field: Unit[], unit: Unit): Unit | null {
  let nearest: Unit | null = null
  let nearestDist = Infinity
  for (const other of field) {
    if (other.owner === unit.owner || other.hp <= 0) continue
    if (other.isWall && (unit.flying || unit.climber)) continue
    if (unit.owner === 'player'   && other.x < unit.x) continue
    if (unit.owner === 'opponent' && other.x > unit.x) continue
    if (other.invisTimer != null && other.invisTimer > 0) continue
    const d = unitDist(unit, other)
    if (d < nearestDist) { nearestDist = d; nearest = other }
  }
  return nearest
}

/**
 * Nearest enemy AHEAD that matches the unit's targetPriority type.
 * Returns null if no priority preference or no matching target found.
 */
export function findNearestEnemyByPriority(field: Unit[], unit: Unit): Unit | null {
  const pri = unit.targetPriority
  if (!pri) return null
  const isPlayer = unit.owner === 'player'
  let nearest: Unit | null = null
  let nearestDist = Infinity
  for (const other of field) {
    if (other.owner === unit.owner || other.hp <= 0) continue
    if (other.isWall && (unit.flying || unit.climber)) continue
    const ahead = isPlayer ? other.x >= unit.x : other.x <= unit.x
    if (!ahead) continue
    if (other.invisTimer != null && other.invisTimer > 0) continue
    const matches = (pri === 'walls' && other.isWall) ||
      (pri === 'buildings' && other.moveSpeed === 0 && !other.isWall) ||
      (pri === 'boss' && !!other.isHero) ||
      (pri === 'ranged_first' && other.bypassWall)
    if (!matches) continue
    const d = unitDist(unit, other)
    if (d < nearestDist) { nearestDist = d; nearest = other }
  }
  return nearest
}

/** Nearest enemy that has slipped BEHIND this unit — used to turn around. */
export function findEnemyBehind(field: Unit[], unit: Unit): Unit | null {
  let nearest: Unit | null = null
  let nearestDist = Infinity
  for (const other of field) {
    if (other.owner === unit.owner || other.hp <= 0) continue
    if (other.isWall && (unit.flying || unit.climber)) continue
    if (unit.owner === 'player'   && other.x >= unit.x) continue
    if (unit.owner === 'opponent' && other.x <= unit.x) continue
    if (other.invisTimer != null && other.invisTimer > 0) continue
    const d = unitDist(unit, other)
    if (d < nearestDist) { nearestDist = d; nearest = other }
  }
  return nearest
}

/**
 * Nearest enemy within attack range (2-D).
 * bypassWall/climber units prefer mobile targets; if none in range they fall
 * back to attacking the wall (except flying units which truly soar over walls).
 * targetPriority biases selection: walls, buildings, boss, ranged_first.
 */
export function findAttackTarget(field: Unit[], unit: Unit): Unit | null {
  const candidates: Array<{ other: Unit; d: number }> = []

  for (const other of field) {
    if (other.owner === unit.owner || other.hp <= 0) continue
    if (other.isMoat) continue
    if (other.isWall && (unit.bypassWall || unit.climber)) continue
    if (other.invisTimer != null && other.invisTimer > 0) continue
    const d = unitDist(unit, other)
    if (d > unit.attackRange) continue
    if (unit.targetUnitType === 'flying'     && !other.flying)  continue
    if (unit.targetUnitType === 'not_flying' &&  other.flying)  continue
    if (unit.targetUnitType === 'hero'       && !other.isHero)  continue
    candidates.push({ other, d })
  }

  // Ranged non-flying: walls as fallback when nothing else in range
  if (candidates.length === 0 && unit.bypassWall && !unit.flying) {
    for (const other of field) {
      if (other.owner === unit.owner || other.hp <= 0) continue
      if (other.isMoat || !other.isWall) continue
      const d = unitDist(unit, other)
      if (d > unit.attackRange) continue
      candidates.push({ other, d })
    }
  }

  if (candidates.length === 0) return null

  const pri = unit.targetPriority
  if (pri) {
    let preferred: Array<{ other: Unit; d: number }> = []
    if (pri === 'walls')        preferred = candidates.filter(c => c.other.isWall)
    if (pri === 'buildings')    preferred = candidates.filter(c => c.other.moveSpeed === 0 && !c.other.isWall)
    if (pri === 'boss')         preferred = candidates.filter(c => c.other.isHero)
    if (pri === 'ranged_first') preferred = candidates.filter(c => c.other.bypassWall)
    if (preferred.length > 0) return preferred.reduce((a, b) => a.d < b.d ? a : b).other
  }

  // Retaliate against last attacker
  if (unit.lastAttackerId) {
    const retaliate = candidates.find(c => c.other.id === unit.lastAttackerId)
    if (retaliate) return retaliate.other
  }

  // Prefer targets this unit has strength advantage against; de-conflict with allies
  const strongAgainst = candidates.filter(c =>
    (unit.strengths ?? []).some(t => (c.other.tags ?? []).includes(t))
  )
  const friendlyTargetIds = new Set(field.filter(u => u.owner === unit.owner && u.targetId).map(u => u.targetId))
  const untargetedStrong = strongAgainst.filter(c => !friendlyTargetIds.has(c.other.id))
  if (untargetedStrong.length > 0) return untargetedStrong.reduce((a, b) => a.d < b.d ? a : b).other

  // Prefer spawner structures (they generate more enemies)
  const spawners = candidates.filter(c =>
    c.other.moveSpeed === 0 && !c.other.isWall && c.other.structureEffect?.type === 'spawn'
  )
  if (spawners.length > 0) return spawners.reduce((a, b) => a.d < b.d ? a : b).other

  // Prefer hero/boss unit
  const hero = candidates.find(c => c.other.isHero)
  if (hero) return hero.other

  return candidates.reduce((a, b) => a.d < b.d ? a : b).other
}
