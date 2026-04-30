import { GameState, Unit, BossTraitState, LANE_WIDTH } from '../types'
import { PLAYER_SPAWN_X, OPPONENT_SPAWN_X } from './constants'
import { LANE_POSITIONS, spawnUnit } from './helpers'
import { getBossAIDef, BossTraitDef } from './boss'

export const TRAIT_TILE_PX = 40  // 1 "tile" in trait radius = one lane-spacing in px

// ─── Landing position ─────────────────────────────────────

function chooseTraitLandingPos(target: string | undefined, field: Unit[]): { x: number; y: number } {
  if (target === 'player_side_random') {
    return {
      x: PLAYER_SPAWN_X + 20 + Math.random() * 200,
      y: LANE_POSITIONS[Math.floor(Math.random() * LANE_POSITIONS.length)],
    }
  }
  if (target === 'opposite_flank') {
    return { x: LANE_WIDTH / 2, y: Math.random() < 0.5 ? -80 : 80 }
  }
  if (target === 'battlefield_centre') {
    return { x: LANE_WIDTH / 2, y: 0 }
  }
  if (target === 'player_densest_cluster') {
    const players = field.filter(u => u.owner === 'player' && u.hp > 0)
    let bx = LANE_WIDTH / 4, by = 0, best = 0
    for (const u of players) {
      const count = players.filter(p => Math.hypot(p.x - u.x, p.y - u.y) <= 80).length
      if (count > best) { best = count; bx = u.x; by = u.y }
    }
    return { x: bx, y: by }
  }
  if (target === 'nearest_player_highest_hp') {
    const highHp = field
      .filter(u => u.owner === 'player' && u.hp > 0 && u.moveSpeed > 0)
      .sort((a, b) => b.hp - a.hp)[0]
    if (highHp) return { x: Math.min(highHp.x + 30, LANE_WIDTH / 2), y: highHp.y }
  }
  return {
    x: PLAYER_SPAWN_X + 20 + Math.random() * 220,
    y: LANE_POSITIONS[Math.floor(Math.random() * LANE_POSITIONS.length)],
  }
}

// ─── AOE damage ───────────────────────────────────────────

function applyTraitAOE(
  field: Unit[], cx: number, cy: number, radiusPx: number,
  dmg: number, stunMs: number | undefined,
  log: string[], text: string | undefined
): void {
  if (text) log.push(text)
  let hit = 0
  for (const u of field) {
    if (u.owner !== 'player' || u.hp <= 0) continue
    if (Math.hypot(u.x - cx, u.y - cy) > radiusPx) continue
    if (dmg > 0) u.hp = Math.max(0, u.hp - dmg)
    if (stunMs) { u.stunTimer = stunMs; u.attackTimer = Math.max(u.attackTimer, stunMs) }
    hit++
  }
  if (hit > 0) log.push(`${hit} unit(s) caught in the blast!`)
}

// ─── Split trait ──────────────────────────────────────────

function fireSplitTrait(s: GameState, trait: BossTraitDef, log: string[]): void {
  const count  = trait.mechanics.splitCount ?? 3
  const hpEach = Math.max(5, Math.ceil(s.opponentBase.hp / (trait.mechanics.hpDivisor ?? count)))
  const ts     = s.bossTraitState!

  const positions: Array<{ x: number; y: number }> = [
    { x: OPPONENT_SPAWN_X - 50, y: -80 },
    { x: OPPONENT_SPAWN_X - 50, y:  80 },
    { x: LANE_WIDTH * 0.55,     y: -80 },
    { x: LANE_WIDTH * 0.55,     y:  80 },
  ]

  const splitIds: string[] = []
  for (let i = 0; i < count; i++) {
    const pos = positions[i] ?? { x: OPPONENT_SPAWN_X - 40, y: 0 }
    const frag = spawnUnit({
      name: 'Boss Fragment', attack: 4, maxHp: hpEach,
      isWall: false, bypassWall: true,
      moveSpeed: 0, attackRange: 140, attackCooldownMs: 2500,
    }, 'opponent')
    frag.x = pos.x
    frag.y = pos.y
    splitIds.push(frag.id)
    s.field.push(frag)
  }

  ts.splitActive  = true
  ts.splitUnitIds = splitIds
  log.push('!!' + (trait.splitLog ?? trait.announceText))
  log.push('!!' + `Destroy all ${count} Boss Fragments to win!`)
}

// ─── Invulnerable launch ──────────────────────────────────

function fireInvulnerableLaunch(
  s: GameState, trait: BossTraitDef, ts: BossTraitState, log: string[]
): void {
  const duration = trait.mechanics.invulnerableDurationMs ?? 3000
  ts.baseInvulnerableUntilMs = s.gameTime + duration
  ts.landingAtMs = s.gameTime + duration
  const pos = chooseTraitLandingPos(
    trait.mechanics.repositionTarget ?? trait.mechanics.landingTarget,
    s.field
  )
  ts.landX = pos.x
  ts.landY = pos.y
  log.push('!!' + trait.announceText)
}

// ─── Tick ─────────────────────────────────────────────────

export function tickBossTrait(s: GameState, log: string[]): void {
  if (!s.bossAI || !s.bossTraitState) return
  const def   = getBossAIDef(s.bossAI)
  const trait = def?.trait
  if (!trait || trait.implemented === false) return

  const ts = s.bossTraitState

  // ── Resolve pending landing ───────────────────────────────
  if (ts.landingAtMs !== undefined && s.gameTime >= ts.landingAtMs) {
    const lx      = ts.landX ?? LANE_WIDTH / 4
    const ly      = ts.landY ?? 0
    const radiusPx = (trait.mechanics.landingRadiusTiles ?? 2) * TRAIT_TILE_PX
    const dmg      = trait.mechanics.landingDamage ?? 0
    const stunMs   = trait.mechanics.stunDurationMs

    if (trait.mechanics.wavePushTiles) {
      const pushPx   = trait.mechanics.wavePushTiles * TRAIT_TILE_PX
      const waveDmg  = trait.mechanics.waveDamage ?? 0
      const resolveText = trait.surfaceText ?? trait.landText
      if (resolveText) log.push(resolveText)
      for (const u of s.field) {
        if (u.owner !== 'player' || u.hp <= 0) continue
        if (u.moveSpeed > 0) u.x = Math.max(PLAYER_SPAWN_X, u.x - pushPx)
        if (waveDmg > 0) u.hp = Math.max(0, u.hp - waveDmg)
      }
      log.push(`Your units are pushed back and take ${waveDmg} damage!`)
    } else if (dmg > 0 || stunMs) {
      applyTraitAOE(s.field, lx, ly, radiusPx, dmg, stunMs, log, trait.landText ?? trait.surfaceText)
      if (stunMs && radiusPx >= LANE_WIDTH) {
        for (const u of s.field) {
          if (u.owner !== 'player' || u.hp <= 0) continue
          u.stunTimer = stunMs
          u.attackTimer = Math.max(u.attackTimer, stunMs)
        }
      }
    } else {
      if (trait.landText ?? trait.surfaceText) log.push((trait.landText ?? trait.surfaceText)!)
      if (stunMs) {
        for (const u of s.field) {
          if (u.owner !== 'player' || u.hp <= 0) continue
          u.stunTimer = stunMs
          u.attackTimer = Math.max(u.attackTimer, stunMs)
        }
        log.push('All your units are silenced!')
      }
    }

    ts.baseInvulnerableUntilMs = 0
    ts.landingAtMs = undefined
    ts.landX = undefined
    ts.landY = undefined
    return
  }

  // ── Periodic traits ───────────────────────────────────────
  if (trait.trigger === 'periodic') {
    const interval = trait.triggerIntervalMs ?? 30000
    if (s.gameTime >= interval && s.gameTime - ts.lastTraitFireMs >= interval && ts.landingAtMs === undefined) {
      ts.lastTraitFireMs = s.gameTime
      if (trait.type === 'column_aoe') {
        const dmg      = trait.mechanics.pulseDamage ?? 6
        const colX     = 90 + Math.random() * 320
        const bandWidth = 25
        const slowMs   = trait.mechanics.slowDurationMs ?? 4000
        log.push('!!' + trait.announceText)
        let hit = 0
        for (const u of s.field) {
          if (u.owner !== 'player' || u.hp <= 0) continue
          if (Math.abs(u.x - colX) > bandWidth) continue
          u.hp = Math.max(0, u.hp - dmg)
          u.attackTimer = Math.max(u.attackTimer, slowMs)
          hit++
        }
        if (trait.fireText) log.push(trait.fireText)
        if (hit > 0) log.push(`${hit} unit(s) hit by the pulse!`)
      } else {
        fireInvulnerableLaunch(s, trait, ts, log)
      }
    }
    return
  }

  // ── HP threshold traits ───────────────────────────────────
  // In phase 2, check the boss unit's HP; in phase 1, check the base HP
  const hpPct = (s.bossCardActive && s.bossCard)
    ? (() => {
        const bossUnit = s.field.find(u => u.owner === 'opponent' && u.name === s.bossCard && u.hp > 0)
        return bossUnit ? (bossUnit.hp / bossUnit.maxHp) * 100 : 100
      })()
    : (s.opponentBase.hp / s.opponentBase.maxHp) * 100

  if (trait.trigger === 'hp_pct' && trait.triggerHpPct !== undefined) {
    if (hpPct <= trait.triggerHpPct && !ts.firedThresholds.includes(trait.triggerHpPct)) {
      ts.firedThresholds.push(trait.triggerHpPct)
      if (trait.type === 'split') fireSplitTrait(s, trait, log)
      else                        fireInvulnerableLaunch(s, trait, ts, log)
    }
  }

  if (trait.trigger === 'hp_pct_multi' && trait.triggerHpPcts) {
    for (const threshold of trait.triggerHpPcts) {
      if (hpPct <= threshold && !ts.firedThresholds.includes(threshold) && ts.landingAtMs === undefined) {
        ts.firedThresholds.push(threshold)
        fireInvulnerableLaunch(s, trait, ts, log)
        break
      }
    }
  }

  // ── Once-only game_time_gte ───────────────────────────────
  if (trait.trigger === 'game_time_gte' && trait.triggerGameTimeMs !== undefined) {
    if (s.gameTime >= trait.triggerGameTimeMs && !ts.traitFired && ts.landingAtMs === undefined) {
      ts.traitFired = true
      fireInvulnerableLaunch(s, trait, ts, log)
    }
  }
}
