/**
 * #2292 started from a claim (in the linked issue) that a `targetPriority:
 * 'buildings'` unit only preferred a structure as an attack-target tiebreak
 * once already in range, and never actually walked toward one — i.e. the
 * building-hunter cards on the catalogue were inert for movement. That
 * turned out to be wrong: `findNearestEnemyByPriority` (below) is what
 * `moveUnits` steers by, and it scans the whole field with no range cutoff.
 * These tests lock in the behaviour that made the claim wrong, since the
 * whole point of #2292's answer-card injection is that these units actually
 * cross the field to reach a spawner.
 */
import { describe, it, expect } from 'vitest'
import { findNearestEnemyByPriority, findAttackTarget } from './targeting'
import { Unit } from '../types'

function unit(over: Partial<Unit> = {}): Unit {
  return {
    id: 'u', owner: 'opponent', name: 'Test', attack: 5, maxHp: 20, hp: 20,
    isWall: false, bypassWall: false, moveSpeed: 40, attackRange: 5, attackCooldownMs: 1000,
    x: 700, y: 0, attackTimer: 0,
    ...over,
  }
}

describe('findNearestEnemyByPriority — building-hunter seeking', () => {
  it('finds a structure far across the field, not just one already in range', () => {
    const hunter = unit({ id: 'hunter', owner: 'opponent', targetPriority: 'buildings', x: 900 })
    const farStructure = unit({ id: 'spawner', owner: 'player', moveSpeed: 0, isWall: false, x: 20 })
    const target = findNearestEnemyByPriority([hunter, farStructure], hunter)
    expect(target?.id).toBe('spawner')
  })

  it('picks the nearer of two structures, ignoring a closer mobile unit', () => {
    const hunter = unit({ id: 'hunter', owner: 'opponent', targetPriority: 'buildings', x: 500 })
    const nearMobile   = unit({ id: 'mobile',  owner: 'player', moveSpeed: 30, x: 510 })
    const nearStruct   = unit({ id: 'nearS',   owner: 'player', moveSpeed: 0,  x: 300 })
    const farStruct    = unit({ id: 'farS',    owner: 'player', moveSpeed: 0,  x: 50 })
    const target = findNearestEnemyByPriority([hunter, nearMobile, nearStruct, farStruct], hunter)
    expect(target?.id).toBe('nearS')
  })

  it('ignores walls (moveSpeed 0 but isWall) as a "buildings" target', () => {
    const hunter = unit({ id: 'hunter', owner: 'opponent', targetPriority: 'buildings', x: 500 })
    const wall = unit({ id: 'wall', owner: 'player', moveSpeed: 0, isWall: true, x: 300 })
    expect(findNearestEnemyByPriority([hunter, wall], hunter)).toBeNull()
  })

  it('returns null for a unit with no targetPriority, so movement falls back to findNearestEnemy', () => {
    const plain = unit({ id: 'plain', owner: 'opponent', x: 500 })
    const structure = unit({ id: 'spawner', owner: 'player', moveSpeed: 0, x: 100 })
    expect(findNearestEnemyByPriority([plain, structure], plain)).toBeNull()
  })

  it('never targets behind the unit', () => {
    // Opponent units advance toward decreasing x; a structure behind (higher x) is not "ahead".
    const hunter = unit({ id: 'hunter', owner: 'opponent', targetPriority: 'buildings', x: 100 })
    const behindStruct = unit({ id: 'behind', owner: 'player', moveSpeed: 0, x: 500 })
    expect(findNearestEnemyByPriority([hunter, behindStruct], hunter)).toBeNull()
  })
})

describe('findAttackTarget — building-hunter in-range preference', () => {
  it('prefers a structure over a mobile unit once both are in range', () => {
    const hunter = unit({ id: 'hunter', owner: 'opponent', targetPriority: 'buildings', x: 500, attackRange: 300 })
    const mobile    = unit({ id: 'mobile', owner: 'player', moveSpeed: 30, x: 480 })
    const structure = unit({ id: 'spawner', owner: 'player', moveSpeed: 0, x: 300 })
    const target = findAttackTarget([hunter, mobile, structure], hunter)
    expect(target?.id).toBe('spawner')
  })
})
