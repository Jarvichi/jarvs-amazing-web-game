import { GameState } from '../types'
import { BLOOD_POOL_MAX, PLAYER_SPAWN_X } from './constants'
import { shuffle, drawCard, recycleCardId, spawnCommander } from './helpers'

// ─── Wave transition ──────────────────────────────────────

/**
 * Called from checkGameOver when opponentBase.hp hits 0 in endless mode.
 * Advances the wave counter, scales difficulty, triggers the finger-smash
 * phase, and returns false so the game continues.
 */
export function triggerNextEndlessWave(s: GameState): false {
  const wave   = (s.endlessWave ?? 1) + 1
  s.endlessWave = wave

  const hpMult  = 1 + (wave - 1) * 0.8
  const newOpHp = Math.round(82 * hpMult)
  s.opponentBase = { hp: newOpHp, maxHp: newOpHp }

  // Scale opponent speed aggressively each wave (min 2000ms)
  s.opponentIntervalMs = Math.max(2000, s.opponentIntervalMs - 500)
  s.opponentTimer      = s.opponentIntervalMs

  // Boost opponent mana regen each wave (capped at 2.5×)
  s.endlessOpponentManaMult = Math.min(2.5, (s.endlessOpponentManaMult ?? 1) + 0.2)

  // Clear opponent units + reshuffle opponent deck, then spawn fresh opponent commander
  s.field = s.field.filter(u => u.owner !== 'opponent')
  s.field.push(spawnCommander('opponent', newOpHp))
  s.opponentDeck = shuffle([...(s.endlessOpponentDeckTemplate ?? [])])

  // Draw bonus cards into opponent hand based on wave number
  const bonusDraws = Math.min(4, wave - 1)
  for (let i = 0; i < bonusDraws; i++) drawCard(s.opponentDeck, s.opponentHand)

  // Reset player spawn building timers so they don't immediately flood the next wave
  s.field.forEach(u => {
    if (u.owner === 'player' && u.spawnTimer != null && u.structureEffect?.type === 'spawn') {
      const se = u.structureEffect as { type: 'spawn'; intervalMs: number }
      u.spawnTimer = se.intervalMs
    }
  })

  // Finger smash: a giant finger crushes 75–95% of the player's units/structures (commander is spared)
  const playerUnits   = s.field.filter(u => u.owner === 'player' && !u.dyingTimer && !u.isCommander)
  const smashFraction = 0.75 + Math.random() * 0.20
  const smashCount    = Math.round(playerUnits.length * smashFraction)
  const smashedNames: string[] = []
  const smashPool = [...playerUnits]

  for (let i = 0; i < smashCount && smashPool.length > 0; i++) {
    const idx = Math.floor(Math.random() * smashPool.length)
    const [victim] = smashPool.splice(idx, 1)
    smashedNames.push(victim.name)
    s.field = s.field.filter(u => u.id !== victim.id)
    if (victim.moveSpeed > 0 && !victim.flying) {
      s.bloodPools.push({ id: `smash-${victim.id}`, x: victim.x, y: victim.y ?? 0 })
      const active = s.bloodPools.filter(p => p.fadingAt === undefined)
      if (active.length > BLOOD_POOL_MAX) active[0].fadingAt = s.gameTime
    }
  }

  if (smashedNames.length > 0) s.log.push(`👇 A giant finger smashes ${smashedNames.join(', ')}!`)

  s.endlessWaveTruceMs = 5000

  const completedWave = wave - 1
  const rewardDue     = completedWave % 5 === 0
  s.phase = { type: 'fingerSmash', wave: completedWave, smashedNames, rewardDue }
  s.log.push(rewardDue
    ? `Wave ${completedWave} cleared! Choose your reward before the next wave.`
    : `Wave ${completedWave} cleared! Next wave incoming...`
  )
  return false
}

// ─── Per-tick endless mode processing ────────────────────

export function processEndlessModeAdditions(s: GameState, deltaMs: number, log: string[]): void {
  if (!s.endlessMode) return

  s.endlessSurvivalMs = (s.endlessSurvivalMs ?? 0) + deltaMs
  if (s.endlessWaveTruceMs != null && s.endlessWaveTruceMs > 0) {
    s.endlessWaveTruceMs = Math.max(0, s.endlessWaveTruceMs - deltaMs)
  }

  // Debug: write current difficulty snapshot to localStorage for inspection in DevTools
  try {
    const wave = s.endlessWave ?? 1
    localStorage.setItem('endlessDebug', JSON.stringify({
      wave,
      survivalMs: Math.round(s.endlessSurvivalMs ?? 0),
      gameTime: Math.round(s.gameTime),
      opponentStrategy: s.opponentStrategy,
      opponentIntervalMs: s.opponentIntervalMs,
      opponentTimer: Math.round(s.opponentTimer),
      opponentHandSize: s.opponentHand.length,
      opponentDeckSize: s.opponentDeck.length,
      opponentHand: s.opponentHand.map(c => `${c.name}(${c.cost})`),
      opponentBaseHp: s.opponentBase.hp,
      opponentBaseMaxHp: s.opponentBase.maxHp,
      opponentScore: s.opponentScore,
      maxPlays: Math.min(6, (s.opponentStrategy === 'swarm' ? 3 : 2) + Math.floor((wave - 1) / 2)),
      earlyStopChance: wave <= 2 ? 0.5 : wave <= 4 ? 0.25 : 0,
      truceMs: Math.round(s.endlessWaveTruceMs ?? 0),
      playerBaseHp: s.playerBase.hp,
      playerBaseMaxHp: s.playerBase.maxHp,
      playerHandSize: s.playerHand.length,
      playerDeckSize: s.playerDeck.length,
      playerHand: s.playerHand.map(c => `${c.name}(${c.cost})`),
      playerScore: s.playerScore,
      mana: s.mana,
      maxMana: s.maxMana,
      playerUnitsOnField: s.field.filter(u => u.owner === 'player' && u.hp > 0).length,
      opponentUnitsOnField: s.field.filter(u => u.owner === 'opponent' && u.hp > 0).length,
    }))
  } catch { /* ignore */ }

  // Infinite card draw: reshuffle template when deck runs out
  if (s.playerDeck.length === 0 && s.playerHand.length < 4) {
    const fresh = shuffle((s.endlessPlayerDeckTemplate ?? []).map(c => ({ ...c, id: recycleCardId() })))
    s.playerDeck.push(...fresh)
  }
  if (s.opponentDeck.length === 0 && s.opponentHand.length < 4) {
    const fresh = shuffle((s.endlessOpponentDeckTemplate ?? []).map(c => ({ ...c, id: recycleCardId() })))
    s.opponentDeck.push(...fresh)
  }

  while (s.playerHand.length < 4   && s.playerDeck.length > 0)   drawCard(s.playerDeck, s.playerHand)
  while (s.opponentHand.length < 4 && s.opponentDeck.length > 0) drawCard(s.opponentDeck, s.opponentHand)
}
