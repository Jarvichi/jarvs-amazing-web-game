import { playBuildingDestroyed } from '../sound'
import { GameState } from '../types'
import { BASE_MAX_MANA, DAMAGE_FLASH_MS } from './constants'
import { getManaBonus } from './getManaBonus'

// ─── Sudden Death Constants ───────────────────────────────

export const SUDDEN_DEATH_MS                   = 60000
export const SUDDEN_DEATH_BUILDING_INTERVAL_MS = 2000   // building damage tick during sudden death
export const SUDDEN_DEATH_FORCE_MS             = 5 * 60 * 1000  // force sudden death after 5 minutes

// ─── Sudden Death Tick ────────────────────────────────────

export function handleSuddentDeath(s: GameState, deltaMs: number, log: string[]): GameState | void {
  if (s.endlessMode)    return  // endless mode has no sudden death
  if (s.bossCardActive) return  // boss phase 2 skips sudden death

  if (!s.suddenDeath) {
    const oppMaxMana    = Math.min(10, BASE_MAX_MANA + getManaBonus(s.field, 'opponent'))
    const allExhausted  =
      s.playerDeck.length === 0 && s.opponentDeck.length === 0 &&
      s.playerHand.every(c => c.cost > s.maxMana) &&
      s.opponentHand.every(c => c.cost > oppMaxMana)
    const timeExpired   = s.gameTime >= SUDDEN_DEATH_FORCE_MS

    if (allExhausted || timeExpired) {
      s.suddenDeath              = true
      s.suddenDeathTimer         = SUDDEN_DEATH_MS
      s.suddenDeathBuildingTimer = SUDDEN_DEATH_BUILDING_INTERVAL_MS
      log.push('⚡ SUDDEN DEATH! 60s remain — buildings crumble, highest score wins!')
    }
    return
  }

  s.suddenDeathTimer -= deltaMs
  if (s.suddenDeathTimer <= 0) {
    const winner = s.playerScore > s.opponentScore ? 'player'
      : s.opponentScore > s.playerScore ? 'opponent'
      : 'draw'
    s.phase = { type: 'gameOver', winner }
    s.log   = [...s.log, ...log]
    return s
  }

  // Damage all buildings by 1 every 2 seconds
  s.suddenDeathBuildingTimer -= deltaMs
  if (s.suddenDeathBuildingTimer <= 0) {
    s.suddenDeathBuildingTimer = SUDDEN_DEATH_BUILDING_INTERVAL_MS
    const buildings = s.field.filter(u => u.moveSpeed === 0 && !u.isWall)
    for (const b of buildings) {
      b.hp -= 1
      b.damageFlashTimer = DAMAGE_FLASH_MS
    }
    const destroyed = buildings.filter(b => b.hp <= 0)
    for (const b of destroyed) {
      playBuildingDestroyed()
      log.push(`💥 ${b.name} crumbles in Sudden Death!`)
    }
    s.field = s.field.filter(u => !destroyed.includes(u))
  }
}
