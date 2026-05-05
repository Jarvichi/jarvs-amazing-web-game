import { isNoDamageMode } from '../debug'
import { playBuildingDestroyed, playUnitDeath, playUnitAttack, playBaseHit } from '../sound'
import { AnimEvent, GameState, LANE_WIDTH, Unit } from '../types'
import { DAMAGE_FLASH_MS, BLOOD_POOL_MAX } from './constants'
import { getAttackAura } from './bonusEffects'
import { animUid, spawnUnit } from './helpers'
import { findAttackTarget, unitDist } from './targeting'

// ─── Combat Constants ─────────────────────────────────────

export const DEATH_LINGER_MS          = 1200
export const KILL_FLASH_MS            = 500
export const PROJECTILE_SPEED_PX_MS   = 0.4   // game-px per ms
export const ANIM_EVENT_PROJECTILE_MS = 600    // max projectile lifetime (cap)

// ─── Per-unit Combat ──────────────────────────────────────

export function processAttacks(s: GameState, deltaMs: number, log: string[]): void {
  const playerAtkAura   = getAttackAura(s.field, 'player')
  const opponentAtkAura = getAttackAura(s.field, 'opponent')

  for (const unit of s.field) {
    if (unit.attack === 0 || unit.hp <= 0) continue

    if (unit.attackTimer > 0) {
      unit.attackTimer -= deltaMs
      continue
    }

    // Sticky targeting: reuse locked-on target if still valid (alive + in range)
    let target: Unit | null = null
    if (unit.targetId) {
      const sticky = s.field.find(u => u.id === unit.targetId)
      if (sticky && sticky.hp > 0 && sticky.owner !== unit.owner && unitDist(unit, sticky) <= unit.attackRange * 1.5) {
        target = sticky
      } else {
        unit.targetId = undefined
      }
    }
    if (!target) {
      target = findAttackTarget(s.field, unit)
      if (target) unit.targetId = target.id
    }

    const isPlayer  = unit.owner === 'player'
    const atkAura   = isPlayer ? playerAtkAura : opponentAtkAura

    if (target) {
      if (unit.owner === 'player') playUnitAttack()
      const prevHp         = target.hp
      const bloodMoonMult  = s.activeBattleEvent?.type === 'bloodMoon' ? 2 : 1
      const targetTags     = target.tags ?? []
      const swMult         = (unit.strengths ?? []).some(t => targetTags.includes(t)) ? 1.5 : 1
      const affDmgMult     = (unit.affinityActive && unit.affinity?.effectType === 'damage')
        ? unit.affinity.effectAmount : 1
      const masteryEliteMult = (unit.masteryLevel ?? 0) >= 5 ? 1.1 : 1
      const dmg = Math.round((unit.attack + atkAura) * bloodMoonMult * swMult * affDmgMult * masteryEliteMult)

      // Emit projectile animation for ranged (bypassWall) attackers
      if (unit.bypassWall && !unit.isWall) {
        const dist    = Math.hypot(target.x - unit.x, target.y - unit.y)
        const travelMs = Math.min(ANIM_EVENT_PROJECTILE_MS, dist / PROJECTILE_SPEED_PX_MS)
        const proj: AnimEvent = {
          id: animUid(),
          kind: 'projectile',
          fromUnitId: unit.id,
          fromX: unit.x, fromY: unit.y,
          toX: target.x, toY: target.y,
          expiresAt: s.gameTime + travelMs,
        }
        s.animEvents.push(proj)
      }

      if (target.owner === 'player' && isNoDamageMode()) {
        log.push(`${unit.name} would damage ${target.name} (dev mode — no damage)`)
      } else {
        target.hp -= dmg
        const actualDamage = prevHp - Math.max(0, target.hp)
        if (isPlayer) s.playerScore += actualDamage
        else          s.opponentScore += actualDamage
        target.lastAttackerId = unit.id
        if (target.targetId && target.targetId !== unit.id && target.attack > 0) {
          target.targetId = unit.id
        }
        target.damageFlashTimer = DAMAGE_FLASH_MS
        s.animEvents.push({
          id: animUid(), kind: 'hit',
          fromX: target.x, fromY: target.y,
          toX: target.x,   toY: target.y,
          expiresAt: s.gameTime + 300,
        })
        // Half-health explosion: fires once when unit first drops to ≤50% HP
        if (
          !target.halfHealthFired &&
          target.halfHealthEffect &&
          target.hp > 0 &&
          target.hp <= target.maxHp / 2
        ) {
          target.halfHealthFired = true
          const { damage: aoeDmg, range: aoeRange } = target.halfHealthEffect
          const enemies = s.field.filter(
            e => e.owner !== target.owner && e.hp > 0 &&
                 Math.hypot(e.x - target.x, e.y - target.y) <= aoeRange
          )
          for (const e of enemies) {
            e.hp -= aoeDmg
            e.damageFlashTimer = DAMAGE_FLASH_MS
          }
          log.push(`!!💥 ${target.name} erupts! AOE blast hits ${enemies.length} enemy unit${enemies.length !== 1 ? 's' : ''}!`)
        }
        if (target.hp <= 0) {
          if (target.onDeathEffect) {
            const { damage: aoeDmg, range: aoeRange } = target.onDeathEffect
            const blastTargets = s.field.filter(
              e => e.owner !== target.owner && e.hp > 0 &&
                   Math.hypot(e.x - target.x, e.y - target.y) <= aoeRange
            )
            for (const e of blastTargets) {
              e.hp = Math.max(0, e.hp - aoeDmg)
              e.damageFlashTimer = DAMAGE_FLASH_MS
            }
            log.push(`!!💥 ${target.name} explodes! ${blastTargets.length} unit${blastTargets.length !== 1 ? 's' : ''} caught in the blast!`)
          }
          log.push(`${unit.name} destroyed ${target.name}!`)
          if (target.moveSpeed === 0) playBuildingDestroyed()
          else                        playUnitDeath()
          if (target.moveSpeed > 0 && !target.isWall) {
            target.dyingTimer = DEATH_LINGER_MS
            if (!target.flying) {
              s.bloodPools.push({ id: target.id, x: target.x, y: target.y })
              const active = s.bloodPools.filter(p => p.fadingAt === undefined)
              if (active.length > BLOOD_POOL_MAX) active[0].fadingAt = s.gameTime
            }
          }
          unit.killFlashTimer = KILL_FLASH_MS
          for (const ally of s.field) {
            if (ally.targetId === target.id) ally.targetId = undefined
          }
        }
      }
      const affSpeedMult = (unit.affinityActive && unit.affinity?.effectType === 'attackSpeed')
        ? unit.affinity.effectAmount : 1
      unit.attackTimer = unit.attackCooldownMs / affSpeedMult
    } else {
      // No enemies in range — attack the base if close enough
      const baseDist = isPlayer
        ? Math.hypot(LANE_WIDTH - unit.x, unit.y)
        : Math.hypot(unit.x, unit.y)

      if (baseDist <= unit.attackRange) {
        const bloodMoonMult = s.activeBattleEvent?.type === 'bloodMoon' ? 2 : 1
        const dmg = (unit.attack + atkAura) * bloodMoonMult
        if (isPlayer) {
          const traitProtected = s.bossTraitState != null && s.bossTraitState.baseInvulnerableUntilMs > s.gameTime
          if (s.endlessWaveTruceMs != null && s.endlessWaveTruceMs > 0) {
            log.push(`${unit.name} hits Enemy Base! (truce — no damage)`)
          } else if (traitProtected) {
            log.push(`${unit.name} hits Enemy Base — it's protected!`)
          } else {
            const prev = s.opponentBase.hp
            s.opponentBase.hp = Math.max(0, s.opponentBase.hp - dmg)
            s.playerScore += prev - s.opponentBase.hp
            log.push(`${unit.name} hits Enemy Base! -${dmg}HP`)
            playBaseHit()
          }
        } else {
          if (!isNoDamageMode()) {
            const prev = s.playerBase.hp
            s.playerBase.hp = Math.max(0, s.playerBase.hp - dmg)
            s.opponentScore += prev - s.playerBase.hp
            log.push(`${unit.name} hits Your Base! -${dmg}HP`)
            playBaseHit()
          } else {
            log.push(`${unit.name} hits Your Base! (dev mode — no damage)`)
          }
        }
        const affSpeedMult2 = (unit.affinityActive && unit.affinity?.effectType === 'attackSpeed')
          ? unit.affinity.effectAmount : 1
        unit.attackTimer = unit.attackCooldownMs / affSpeedMult2
      }
    }
  }

  // Auto-revive: once per battle, restore the first dead player unit
  if (s.unitReviveHp !== undefined) {
    const dead = s.field.find(u => u.owner === 'player' && u.hp <= 0 && u.moveSpeed > 0)
    if (dead) {
      dead.hp = s.unitReviveHp === 'half' ? Math.ceil(dead.maxHp / 2) : s.unitReviveHp === 'full' ? dead.maxHp : s.unitReviveHp
      s.unitReviveHp = undefined
      log.push(`${dead.name} rises from the dead!`)
    }
  }

  // Count kills for battle stats
  for (const u of s.field) {
    if (u.hp <= 0 && u.moveSpeed > 0 && !u.isWall) {
      if (u.owner === 'opponent') s.battleStats.playerKills++
      else                        s.battleStats.playerUnitsLost++
    }
  }

  // Spawn buildings: leave a unit behind when destroyed
  for (const u of s.field) {
    if (u.hp <= 0 && u.moveSpeed === 0 && u.structureEffect?.type === 'spawn') {
      const se = u.structureEffect as { type: 'spawn'; unitTemplate: { name: string; maxHp: number } & Parameters<typeof spawnUnit>[0]; intervalMs: number }
      const survivor = spawnUnit(se.unitTemplate, u.owner)
      survivor.x = u.x
      survivor.y = u.y
      s.field.push(survivor)
      log.push(`${u.name} collapses — a ${survivor.name} emerges from the rubble!`)
    }
  }

  s.field = s.field.filter(u => u.hp > 0 || u.isMoat || (u.dyingTimer != null && u.dyingTimer > 0))
}

