import { GameState, Card, UnitTemplate, CardRarity, LANE_WIDTH } from './types'
import { makeDeck, makeNodeDeck, HERO_CARDS, getCardUnit, getCardCatalog, flushCardValidationErrors } from './cards'
import { loadPlayerStats } from './playerStats'

import { moveUnits, processAffinities } from './engine/units'
import { processAttacks } from './engine/combat'
import { BASE_MAX_MANA, BLOOD_POOL_FADE_MS, BASE_STOP_MARGIN, MANA_REGEN_MS, OPPONENT_INTERVAL_MS, PLAYER_SPAWN_X, SPAWN_GROW_MS, COMMANDER_HOME_X } from './engine/constants'
import { genericBossAI, getBossAIDef } from './engine/boss'
import { tickBossTrait } from './engine/bossTraits'
import { getManaBonus, getManaSpeedMult } from './engine/bonusEffects'
import { uid, shuffle, spawnUnit } from './engine/helpers'
import { MAX_UPGRADE_LEVEL } from './engine/cards'
import { unitDist } from './engine/targeting'
import { opponentAI } from './engine/opponentAI'
import { triggerBattleEvent, BATTLE_EVENT_BASE_MS } from './engine/battleEvents'
import { generateTerrain } from './engine/terrain'
import { processEndlessModeAdditions, triggerNextEndlessWave } from './engine/endlessMode'
import { handleSuddentDeath } from './engine/suddenDeath'





// ─── New Game ────────────────────────────────────────────

export const MAX_HANDICAP = 20

/**
 * Start a new game.
 * @param playerCards  Optional custom deck for the player (defaults to makeDeck()).
 * @param opponentHandicap  Cards removed from the opponent's deck (adaptive difficulty).
 *   Increases by 1 on each player loss, decreases by 1 on each win (floor 0).
 */
// ─── Difficulty scaling ───────────────────────────────────
//
// The handicap (0–20) controls what rarities the opponent can draw.
// 0  = hardest (full deck, legendaries included) — player is on a win-streak
// 20 = easiest (commons only) — player has been losing repeatedly
//
// Thresholds also apply to campaign nodes: a node with handicap 8 puts the
// opponent on uncommon-max, making early acts beatable with a starter deck.

const RARITY_RANK: Record<CardRarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 }

const QUICKPLAY_DECK_SIZE    = 20
const QUICKPLAY_MIN_UNITS    = 3
const QUICKPLAY_MIN_LOW_COST = 3
const QUICKPLAY_MAX_AVG_COST = 4.0

function generateBalancedOpponentDeck(maxRarity: CardRarity, cardPool?: Card[]): Card[] {
  const catalog = (cardPool ?? getCardCatalog()).filter(c => RARITY_RANK[c.rarity] <= RARITY_RANK[maxRarity])
  for (let attempt = 0; attempt < 10; attempt++) {
    const pool = shuffle([...catalog])
    const seen = new Set<string>()
    const deck: Card[] = []
    for (const card of pool) {
      if (!seen.has(card.name)) {
        seen.add(card.name)
        deck.push(card)
        if (deck.length >= QUICKPLAY_DECK_SIZE) break
      }
    }
    const unitCount    = deck.filter(c => c.cardType === 'unit').length
    const lowCostCount = deck.filter(c => c.cost <= 3).length
    const avgCost      = deck.reduce((s, c) => s + c.cost, 0) / deck.length
    if (unitCount >= QUICKPLAY_MIN_UNITS && lowCostCount >= QUICKPLAY_MIN_LOW_COST && avgCost <= QUICKPLAY_MAX_AVG_COST) {
      return shuffle(deck)
    }
  }
  return shuffle(catalog)
}

function maxRarityForHandicap(h: number): CardRarity {
  if (h >= 12) return 'common'
  if (h >= 7)  return 'uncommon'
  if (h >= 3)  return 'rare'
  return 'legendary'
}

/** Opponent acts faster at low handicap (player is skilled), slower at high handicap (player is struggling). */
function opponentIntervalForHandicap(h: number): number {
  if (h >= 10) return 8000
  if (h >= 5)  return 7000
  return OPPONENT_INTERVAL_MS  // 6000
}

const STRATEGIES: GameState['opponentStrategy'][] = ['swarm', 'turtle', 'rush']
const STRATEGY_LABELS: Record<GameState['opponentStrategy'], string> = {
  swarm:  'Swarming with cheap units!',
  turtle: 'Fortifying with structures!',
  rush:   'Unleashing heavy hitters!',
}

/** Inject one hero card into the first ~8 positions of a shuffled deck. */
function spawnCommander(owner: 'player' | 'opponent', hp: number): import('./types').Unit {
  const homeX = owner === 'player' ? COMMANDER_HOME_X : LANE_WIDTH - COMMANDER_HOME_X
  const unit = spawnUnit(
    { name: owner === 'player' ? 'Commander' : 'Warlord',
      attack: 15, maxHp: hp, isWall: false, bypassWall: false,
      moveSpeed: 8, attackRange: 35, attackCooldownMs: 2000, size: 'large' },
    owner
  )
  unit.isCommander    = true
  unit.commanderHomeX = homeX
  unit.x              = homeX
  unit.y              = 0
  return unit
}

function injectHero(deck: Card[], heroPool: Card[]): void {
  if (heroPool.length === 0) return
  const hero = heroPool[Math.floor(Math.random() * heroPool.length)]
  const pos = Math.floor(Math.random() * Math.min(8, deck.length + 1))
  deck.splice(pos, 0, { ...hero, id: `hero-${uid()}` })
}

export interface NewGameOptions {
  playerCards?: Card[]
  opponentHandicap?: number
  bossAI?: string
  bossCard?: string
  bossName?: string
  bossHpMultiplier?: number
  /** Preset enemy deck (card names). Makes each node deterministic and learnable. */
  enemyDeckNames?: string[]
  /** Pre-built enemy Card array (e.g. for daily challenge where cards are already seeded). */
  prebuiltOpponentDeck?: Card[]
  /** Pre-built player Card array already in seeded order — skips the random reshuffle. */
  prebuiltPlayerDeck?: Card[]
  /** Node ID used to seed terrain generation deterministically. */
  terrainSeed?: string
  /** Act environment ('forest' | 'citadel' | 'ashen') — themes terrain and log. */
  environment?: string
  /** Override opponent play interval (ms). Defined per-node in act JSON. */
  opponentIntervalMs?: number
  /** Override opponent base HP. Defined per-node in act JSON. */
  opponentBaseHp?: number
  /** Extra cards dealt to opponent at game start (from replay modifiers). */
  opponentStartCards?: number
  /** Start in Endless Mode (wave survival). */
  endlessMode?: boolean
  /** Fraction of player mobile units killed by boss shockwave (0.0–1.0). Default 0.5. Scales with run count. */
  bossSpawnKillPct?: number
  /** Reduce the initial opponent timer so the first card is played within ~25% of the normal interval. */
  quickStart?: boolean
  /** Limit the opponent's card pool to these cards (Quick Battle: collection-based matching). Falls back to full catalog if pool is too small. */
  opponentCardPool?: Card[]
  /** Allow the player to have unlimited maximum mana. */
  forgiveManaLimit?: boolean
  /** Daily challenge mode: sets max mana floor to the highest card cost in the player's deck. */
  isDailyChallenge?: boolean
}

export function newGame(
  playerCardsOrOpts?: Card[] | NewGameOptions,
  opponentHandicap = 0,
  bossAI?: string,
): GameState {
  // Send any card-definition validation errors (detected at module init) to Rollbar now
  // that the logger has been initialised by main.tsx.
  flushCardValidationErrors()

  // Support both old positional API and new options object
  let opts: NewGameOptions
  if (Array.isArray(playerCardsOrOpts) || playerCardsOrOpts === undefined) {
    opts = { playerCards: playerCardsOrOpts, opponentHandicap, bossAI }
  } else {
    opts = playerCardsOrOpts
  }

  const {
    playerCards,
    opponentHandicap: handicap = 0,
    bossAI: boss,
    bossCard,
    bossName,
    bossHpMultiplier,
    opponentStartCards = 0,
    enemyDeckNames,
    endlessMode,
    prebuiltOpponentDeck,
    prebuiltPlayerDeck,
    terrainSeed,
    environment,
    opponentIntervalMs: intervalOverride,
    opponentBaseHp: hpOverride,
    bossSpawnKillPct,
    opponentCardPool,
    forgiveManaLimit,
    isDailyChallenge,
  } = opts

  // Pre-built decks are already in seeded order — don't re-shuffle with Math.random()
  const playerDeck = prebuiltPlayerDeck && prebuiltPlayerDeck.length > 0
    ? [...prebuiltPlayerDeck]
    : shuffle(playerCards ?? makeDeck())
  const clamp = Math.min(Math.max(0, handicap), MAX_HANDICAP)

  // Build opponent deck: boss AI > prebuilt > preset node deck > handicap-filtered random
  let opponentDeck: Card[]
  if (prebuiltOpponentDeck && prebuiltOpponentDeck.length > 0) {
    opponentDeck = [...prebuiltOpponentDeck]   // already seeded — preserve order
  } else if (enemyDeckNames && enemyDeckNames.length > 0) {
    // Preset node deck — deterministic and learnable
    const nodeDeck = makeNodeDeck(enemyDeckNames)
    // Fall back to random deck if all names were unrecognised (prevents silent empty-hand bug)
    if (nodeDeck.length > 0) {
      opponentDeck = nodeDeck
    } else {
      const maxRarity = maxRarityForHandicap(clamp)
      const filtered  = makeDeck().filter(c => RARITY_RANK[c.rarity] <= RARITY_RANK[maxRarity])
      opponentDeck = shuffle(filtered)
    }
  } else {
    const maxRarity = maxRarityForHandicap(clamp)
    // If a collection-limited pool is provided and large enough, use it instead of the full catalog
    const MIN_POOL_SIZE = 20
    if (opponentCardPool && opponentCardPool.length >= MIN_POOL_SIZE) {
      const filtered = opponentCardPool.filter(c => RARITY_RANK[c.rarity] <= RARITY_RANK[maxRarity])
      const pool = filtered.length >= MIN_POOL_SIZE ? filtered : opponentCardPool
      opponentDeck = generateBalancedOpponentDeck(maxRarity, pool)
    } else {
      opponentDeck = generateBalancedOpponentDeck(maxRarity)
    }
  }

  // Inject one hero card per side (not for bosses — they have their own identity)
  injectHero(playerDeck, HERO_CARDS)
  if (!boss) injectHero(opponentDeck, HERO_CARDS)

  const playerHand   = playerDeck.splice(0, 4)
  const opponentHand = opponentDeck.splice(0, 4 + opponentStartCards)

  const strategy      = STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)]
  const maxRarity     = boss ? 'legendary' : maxRarityForHandicap(clamp)
  const bossDef = boss ? getBossAIDef(boss) : undefined
  const oppIntervalMs = intervalOverride
    ?? bossDef?.intervalMs
    ?? opponentIntervalForHandicap(clamp)

  const diffLabel =
    maxRarity === 'common'    ? 'common-only' :
    maxRarity === 'uncommon'  ? 'no rares/legendaries' :
    maxRarity === 'rare'      ? 'no legendaries' :
    'full strength'

  const openingLog: string[] = bossDef
    ? bossDef.openingLog
    : [
        clamp > 0
          ? `Battle begins! (Enemy difficulty: ${diffLabel})`
          : 'Battle begins! Tap cards to deploy.',
        `Enemy strategy: ${STRATEGY_LABELS[strategy]}`,
      ]

  const deckMaxMana = isDailyChallenge && playerDeck.length > 0
    ? playerDeck.reduce((m, c) => Math.max(m, c.cost), 0)
    : undefined
  const maxMana = forgiveManaLimit ? 9 : Math.max(BASE_MAX_MANA, deckMaxMana ?? 0, loadPlayerStats().maxMana)

  const baseOpponentHp = hpOverride ?? (boss ? 95 : 82)
  const initialField: import('./types').Unit[] = []
  let opponentBaseHp  = baseOpponentHp
  let bossPhase2Hp: number | undefined

  if (bossCard && !endlessMode) {
    // Boss battle: spawn boss immediately with combined HP (base portion + boss portion)
    const template = getCardUnit(bossCard)
    if (template) {
      const mult       = bossHpMultiplier ?? 25
      const boostedHp  = Math.round(template.maxHp * mult)
      const totalHp    = boostedHp + baseOpponentHp
      const bossUnit   = spawnUnit({ ...template, maxHp: totalHp }, 'opponent')
      initialField.push(bossUnit)
      opponentBaseHp = totalHp
      bossPhase2Hp   = boostedHp   // phase 2 triggers when boss.hp drops to this
    }
  } else if (!endlessMode) {
    // Normal/elite battle: spawn commander units at each base
    initialField.push(spawnCommander('player', 50))
    initialField.push(spawnCommander('opponent', baseOpponentHp))
  }

  return {
    playerBase: { hp: 50, maxHp: 50 },
    opponentBase: { hp: opponentBaseHp, maxHp: opponentBaseHp },
    field: initialField,
    playerHand,
    playerDeck,
    opponentHand,
    opponentDeck,
    mana: 3,
    maxMana,
    manaAccum: 0,
    playerManaRegenMs: loadPlayerStats().manaRegenMs,
    log: openingLog,
    phase: { type: 'playing' },
    opponentTimer: opts.quickStart ? Math.round(oppIntervalMs * 0.25) : oppIntervalMs,
    opponentIntervalMs: oppIntervalMs,
    opponentStrategy: strategy,
    gameTime: 0,
    playerScore: 0,
    opponentScore: 0,
    suddenDeath: false,
    suddenDeathTimer: 0,
    suddenDeathBuildingTimer: 0,
    battleEventTimer: BATTLE_EVENT_BASE_MS,
    activeBattleEvent: null,
    bossAI: boss,
    bossCard,
    bossName,
    bossCardActive: false,
    bossHpMultiplier: bossHpMultiplier ?? (bossCard ? 25 : undefined),
    bossTraitState: boss ? {
      firedThresholds: [],
      lastTraitFireMs: 0,
      traitFired: false,
      baseInvulnerableUntilMs: 0,
    } : undefined,
    terrain: generateTerrain(terrainSeed, environment),
    environment,
    battleStats: { cardsPlayed: {}, playerKills: 0, playerUnitsLost: 0 },
    animEvents: [],
    bloodPools: [],
    endlessMode: endlessMode ?? false,
    endlessWave: endlessMode ? 1 : undefined,
    endlessSurvivalMs: endlessMode ? 0 : undefined,
    endlessPlayerDeckTemplate: endlessMode ? [...playerDeck] : undefined,
    endlessOpponentDeckTemplate: endlessMode ? [...opponentDeck] : undefined,
    bossSpawnKillPct: bossSpawnKillPct ?? 0.5,
    forgiveManaLimit: forgiveManaLimit ?? false,
    deckMaxMana,
    bossPhase2Hp,
  }
}

// ─── Game Over Check ──────────────────────────────────────

const VICTORY_BONUS = 500

function checkGameOver(s: GameState): boolean {
  // Split trait active — player wins only when all fragments are dead
  if (s.bossTraitState?.splitActive) {
    if (s.playerBase.hp <= 0) {
      s.opponentScore += VICTORY_BONUS
      s.phase = { type: 'gameOver', winner: 'opponent' }
      return true
    }
    const splitIds = s.bossTraitState.splitUnitIds ?? []
    const anyAlive = splitIds.some(id => s.field.some(u => u.id === id && u.hp > 0))
    if (!anyAlive) {
      s.playerScore += VICTORY_BONUS
      s.phase = { type: 'celebration', winner: 'player' }
      return true
    }
    return false
  }

  // Phase 2 active — win when boss unit dies; normal base HP is irrelevant
  if (s.bossCardActive && s.bossCard) {
    const bossAlive = s.field.some(u => u.owner === 'opponent' && u.name === s.bossCard)
    if (!bossAlive) {
      s.playerScore += VICTORY_BONUS
      s.phase = { type: 'celebration', winner: 'player' }
      return true
    }
    if (s.playerBase.hp <= 0) {
      s.opponentScore += VICTORY_BONUS
      s.phase = { type: 'gameOver', winner: 'opponent' }
      return true
    }
    return false
  }

  // Normal checks
  if (s.playerBase.hp <= 0) {
    s.opponentScore += VICTORY_BONUS
    s.phase = { type: 'gameOver', winner: 'opponent' }
    return true
  }

  // Boss battle phase 2: boss spawns at game start — trigger phase 2 when HP drops to the threshold
  if (s.bossCard && !s.bossCardActive && s.bossPhase2Hp !== undefined && !s.endlessMode) {
    const bossUnit = s.field.find(u => u.owner === 'opponent' && u.name === s.bossCard && u.hp > 0)
    if (bossUnit && bossUnit.hp <= s.bossPhase2Hp) {
      const displayName = s.bossName ?? s.bossCard
      // Clear minions but keep the boss unit
      s.field = s.field.filter(u => u.owner !== 'opponent' || u.name === s.bossCard)
      s.field.forEach(u => { if (u.owner === 'player') u.x = PLAYER_SPAWN_X })
      s.log.push(`!!⚡ PHASE 2! ${displayName} stomps the ground in fury!`)
      s.log.push(`!!Destroy ${displayName} to win!`)

      // Shockwave: kills a scaling fraction of player's mobile non-hero units, always leaving at least 3
      const shockwavePool = s.field.filter(
        u => u.owner === 'player' && u.moveSpeed > 0 && !u.isHero && !u.dyingTimer
      )
      const MIN_SURVIVORS = 3
      const killPct = Math.min(1.0, s.bossSpawnKillPct ?? 0.5)
      let killCount = Math.floor(shockwavePool.length * killPct)
      killCount = Math.min(killCount, Math.max(0, shockwavePool.length - MIN_SURVIVORS))
      if (killCount > 0) {
        const shuffled = [...shockwavePool]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        const victims = shuffled.slice(0, killCount)
        const victimIds = new Set(victims.map(u => u.id))
        s.field = s.field.filter(u => !victimIds.has(u.id))
        s.log.push(`💥 The shockwave obliterates ${victims.map(u => u.name).join(', ')}!`)
      }

      s.bossCardActive = true
      // Reset boss trait state so hp_pct thresholds re-fire in phase 2
      if (s.bossTraitState) {
        s.bossTraitState.firedThresholds = []
        s.bossTraitState.traitFired = false
        const bDef = s.bossAI ? getBossAIDef(s.bossAI) : undefined
        if (bDef?.trait?.trigger === 'periodic') {
          const interval = bDef.trait.triggerIntervalMs ?? 30000
          s.bossTraitState.lastTraitFireMs = s.gameTime - interval + 5000
        } else {
          s.bossTraitState.lastTraitFireMs = s.gameTime
        }
      }
      return false
    }
    return false
  }

  // Endless mode: wave clear when opponent base reaches 0
  if (s.opponentBase.hp <= 0 && s.endlessMode) return triggerNextEndlessWave(s)

  // Non-boss win: opponent commander dead (synced to opponentBase.hp)
  if (s.opponentBase.hp <= 0 && !s.bossCard) {
    s.playerScore += VICTORY_BONUS
    s.phase = { type: 'celebration', winner: 'player' }
    return true
  }

  return false
}



// ─── Tick (called every ~100 ms) ─────────────────────────

export function tick(state: GameState, deltaMs: number): GameState {
  if (state.phase.type !== 'playing') return state

  const s = structuredClone(state)
  const log: string[] = []

  s.gameTime += deltaMs

  // 0. Expire timed stance → revert to auto, start cooldown
  if (s.stanceActiveUntil !== undefined && s.gameTime >= s.stanceActiveUntil) {
    s.playerStance = 'auto'
    s.stanceActiveUntil = undefined
    if (s.stanceRules?.cooldownMs !== undefined) {
      s.stanceCooldownUntil = s.gameTime + s.stanceRules.cooldownMs
    }
  }

  // 1. Mana regen
  regenerateMana(s, deltaMs)

  // 1b. apply tick effects (periodic relic buffs)
  applyTickEffects(s, deltaMs)

  // 2. Move all units
  moveUnits(s, deltaMs)

  // 3b. Update affinity states (proximity buffs)
  processAffinities(s.field)

  // 4. Process per-unit attacks
  processAttacks(s, deltaMs, log)

  // 4a. Sync commander/boss HP → base HP so game-over check and UI bars are accurate
  const playerCmd = s.field.find(u => u.isCommander && u.owner === 'player')
  if (playerCmd) {
    s.playerBase.hp = Math.max(0, playerCmd.hp)
  } else if (s.field.some(u => u.isCommander && u.owner === 'player')) {
    s.playerBase.hp = 0  // commander is dying (dyingTimer still running)
  }
  if (s.bossCard && !s.endlessMode) {
    const bossUnit = s.field.find(u => u.owner === 'opponent' && u.name === s.bossCard && u.hp > 0)
    if (bossUnit) s.opponentBase.hp = bossUnit.hp
  } else {
    const opCmd = s.field.find(u => u.isCommander && u.owner === 'opponent')
    if (opCmd) s.opponentBase.hp = Math.max(0, opCmd.hp)
    else if (s.field.some(u => u.isCommander && u.owner === 'opponent')) s.opponentBase.hp = 0
  }

  // 4b. Check for game over before processing timers, so player still gets credit for killing a boss in the same tick that it kills them
  if (checkGameOver(s)) {
    s.log = [...s.log, ...log]
    return s
  }

  // 5. Tick spawn-grow timers, death/damage animation timers, climb flag, spawner/aura buildings
  performUnitMaintenance(s, deltaMs, log)

  // 6. Opponent timer
  processOpponentTurn(s, deltaMs, log)

  // 6b. Boss trait tick
  processOpponentBossTraits(s, deltaMs, log)

  // 7. Battle events
  processBattleEvents(s, deltaMs, log)

  // 8. Purge expired animation events and fully-faded blood pools
  tidyBattlefield(s)

  // 9. Endless mode: reshuffle cards when deck + hand empty; handle wave progression
  processEndlessModeAdditions(s, deltaMs, log)

  // 10. Sudden death — suppressed in endless mode (death only by base reaching 0)
  handleSuddentDeath(s, deltaMs, log)

  if (log.length > 0) s.log = [...s.log, ...log]
  return s
}

/**
 * tidyBattlefield - checks the battlefield for any graphical elements that need to be removed to prevent memory bloat. 
 */
function tidyBattlefield(s: GameState) {
  s.animEvents = s.animEvents.filter(e => e.expiresAt > s.gameTime)
  s.bloodPools = s.bloodPools.filter(p => p.fadingAt === undefined || s.gameTime - p.fadingAt <= BLOOD_POOL_FADE_MS)
}

function processBattleEvents(s: GameState, deltaMs: number, log: string[]) {
  if (s.activeBattleEvent) {
    s.activeBattleEvent.remainingMs -= deltaMs
    if (s.activeBattleEvent.remainingMs <= 0) s.activeBattleEvent = null
  }
  s.battleEventTimer -= deltaMs
  if (s.battleEventTimer <= 0) {
    triggerBattleEvent(s, log)
    s.battleEventTimer = 24000 + Math.random() * 8000
  }
}

function processOpponentTurn(s: GameState, deltaMs: number, log: string[]) {
  s.opponentTimer -= deltaMs
  if (s.opponentTimer <= 0) {
    const bossDef2 = s.bossAI ? getBossAIDef(s.bossAI) : undefined
    if (bossDef2) {
      genericBossAI(s, log, bossDef2)
    } else {
      opponentAI(s, log)
    }
    s.opponentTimer = s.opponentIntervalMs
  }
}

function processOpponentBossTraits(s: GameState, deltaMs: number, log: string[]) {
  if (s.bossAI && s.bossTraitState) {
    tickBossTrait(s, log)
    if (checkGameOver(s)) {
      s.log = [...s.log, ...log]
      return s
    }
  }

}

function performUnitMaintenance(s: GameState, deltaMs: number, log: string[]) {
  for (const unit of s.field) {
    if (unit.spawnGrowTimer != null && unit.spawnGrowTimer > 0) {
      unit.spawnGrowTimer = Math.max(0, unit.spawnGrowTimer - deltaMs)
    }
    if (unit.dyingTimer != null && unit.dyingTimer > 0) {
      unit.dyingTimer = Math.max(0, unit.dyingTimer - deltaMs)
    }
    if (unit.damageFlashTimer != null && unit.damageFlashTimer > 0) {
      unit.damageFlashTimer = Math.max(0, unit.damageFlashTimer - deltaMs)
    }
    if (unit.killFlashTimer != null && unit.killFlashTimer > 0) {
      unit.killFlashTimer = Math.max(0, unit.killFlashTimer - deltaMs)
    }
    if (unit.stunTimer != null && unit.stunTimer > 0) {
      unit.stunTimer = Math.max(0, unit.stunTimer - deltaMs)
    }
    // Update climbing flag: true when climber unit is inside an enemy wall zone
    if (unit.climber && unit.moveSpeed > 0) {
      unit.climbing = s.field.some(w => w.isWall && w.owner !== unit.owner && w.hp > 0 &&
        Math.abs(unit.x - w.x) <= 30
      )
    }

    // Teleport ability: blink forward every cooldownMs
    if (unit.teleportAbility && unit.moveSpeed > 0 && unit.hp > 0) {
      if (unit.teleportTimer == null) unit.teleportTimer = unit.teleportAbility.cooldownMs
      unit.teleportTimer -= deltaMs
      if (unit.teleportTimer <= 0) {
        const dist = unit.teleportAbility.distancePx
        if (unit.owner === 'player') {
          unit.x = Math.min(LANE_WIDTH - BASE_STOP_MARGIN, unit.x + dist)
        } else {
          unit.x = Math.max(BASE_STOP_MARGIN, unit.x - dist)
        }
        unit.damageFlashTimer = 150
        unit.teleportTimer = unit.teleportAbility.cooldownMs
        log.push(`${unit.name} blinks forward!`)
      }
    }

    // Invisibility ability: cycle between active (invisible) and cooldown phases
    if (unit.invisibilityAbility && unit.moveSpeed > 0 && unit.hp > 0) {
      if (unit.invisTimer == null && unit.invisCooldownTimer == null) {
        unit.invisTimer = unit.invisibilityAbility.activeMs
        log.push(`!!${unit.name} vanishes into shadow!`)
      } else if (unit.invisTimer != null && unit.invisTimer > 0) {
        unit.invisTimer = Math.max(0, unit.invisTimer - deltaMs)
        if (unit.invisTimer === 0) {
          unit.invisCooldownTimer = unit.invisibilityAbility.cooldownMs
        }
      } else if (unit.invisCooldownTimer != null && unit.invisCooldownTimer > 0) {
        unit.invisCooldownTimer = Math.max(0, unit.invisCooldownTimer - deltaMs)
        if (unit.invisCooldownTimer === 0) {
          unit.invisTimer = unit.invisibilityAbility.activeMs
          log.push(`!!${unit.name} vanishes again!`)
        }
      }
    }

    // Blood summon ability: consume a nearby blood pool to raise a minion
    if (unit.bloodSummonAbility && unit.moveSpeed > 0 && unit.hp > 0) {
      if (unit.bloodSummonTimer == null) unit.bloodSummonTimer = unit.bloodSummonAbility.cooldownMs
      unit.bloodSummonTimer -= deltaMs
      if (unit.bloodSummonTimer <= 0) {
        const pool = s.bloodPools.find(
          p => p.fadingAt === undefined &&
               Math.hypot(p.x - unit.x, p.y - unit.y) <= unit.bloodSummonAbility!.range
        )
        if (pool) {
          pool.fadingAt = s.gameTime
          const minion = spawnUnit(unit.bloodSummonAbility.minionTemplate, unit.owner)
          minion.x = pool.x
          minion.y = pool.y
          minion.spawnGrowTimer = SPAWN_GROW_MS
          s.field.push(minion)
          const who = unit.owner === 'player' ? 'Your' : 'Enemy'
          log.push(`!!${who} ${unit.name} raises a ${minion.name} from the fallen!`)
        }
        unit.bloodSummonTimer = unit.bloodSummonAbility.cooldownMs
      }
    }

    // Builder ability: repair/upgrade buildings (3 charges), then run to enemy base and detonate
    if (unit.unitTrait?.builderMode && unit.moveSpeed > 0 && unit.hp > 0) {
      if (unit.builderChargesLeft == null) {
        unit.builderChargesLeft = unit.unitTrait.buildCharges ?? 3
      }

      if (unit.builderSaboteurMode) {
        // Detonate on contact with any enemy building
        const enemyBuilding = s.field.find(
          b => b.owner !== unit.owner && b.moveSpeed === 0 && !b.isWall && b.hp > 0 &&
               unitDist(unit, b) <= 40
        )
        if (enemyBuilding) {
          const who = unit.owner === 'player' ? 'Your' : 'Enemy'
          log.push(`!!${who} ${unit.name} detonates at ${enemyBuilding.name}, destroying it!`)
          enemyBuilding.hp = 0
          unit.hp = 0
        }
      } else {
        const buildInterval = unit.unitTrait.buildIntervalMs ?? 3000
        const repairAmt = unit.unitTrait.buildRepairAmount ?? 8
        if (unit.buildTimer == null) unit.buildTimer = buildInterval
        unit.buildTimer -= deltaMs
        if (unit.buildTimer <= 0) {
          const nearBuilding = s.field.find(
            b => b.owner === unit.owner && b.moveSpeed === 0 && !b.isWall && b.hp > 0 &&
                 unitDist(unit, b) <= 60
          )
          if (nearBuilding) {
            let actionTaken = false
            if (nearBuilding.hp < nearBuilding.maxHp) {
              nearBuilding.hp = Math.min(nearBuilding.maxHp, nearBuilding.hp + repairAmt)
              const who = unit.owner === 'player' ? 'Your' : 'Enemy'
              log.push(`${who} ${unit.name} repaired ${nearBuilding.name} for ${repairAmt} HP.`)
              actionTaken = true
            } else if ((nearBuilding.upgradeLevel ?? 1) < MAX_UPGRADE_LEVEL) {
              nearBuilding.maxHp *= 2
              nearBuilding.hp = nearBuilding.maxHp
              nearBuilding.upgradeLevel = (nearBuilding.upgradeLevel ?? 1) + 1
              let note = 'HP×2'
              if (nearBuilding.structureEffect?.type === 'spawn') {
                const eff = nearBuilding.structureEffect as { type: 'spawn'; unitTemplate: UnitTemplate; intervalMs: number }
                eff.intervalMs = Math.max(1500, Math.floor(eff.intervalMs / 2))
                if (nearBuilding.spawnTimer != null) nearBuilding.spawnTimer = Math.min(nearBuilding.spawnTimer, eff.intervalMs)
                note += ', spawn×2'
              }
              if (nearBuilding.structureEffect?.type === 'mana') {
                (nearBuilding.structureEffect as { type: 'mana'; amount: number }).amount += 1
                note += ', mana+1'
              }
              if (nearBuilding.structureEffect?.type === 'healAura') {
                const eff = nearBuilding.structureEffect as { type: 'healAura'; amount: number; intervalMs: number }
                eff.intervalMs = Math.max(2000, Math.floor(eff.intervalMs / 2))
                note += ', heal×2'
              }
              if (nearBuilding.structureEffect?.type === 'repairAura') {
                const eff = nearBuilding.structureEffect as { type: 'repairAura'; amount: number; intervalMs: number }
                eff.intervalMs = Math.max(2000, Math.floor(eff.intervalMs / 2))
                note += ', repair×2'
              }
              const who = unit.owner === 'player' ? 'Your' : 'Enemy'
              log.push(`!!${who} ${unit.name} upgraded ${nearBuilding.name}! (${note})`)
              actionTaken = true
            }

            if (actionTaken) {
              unit.builderChargesLeft! -= 1
              unit.builderLastBuildingId = nearBuilding.id
              if (unit.builderChargesLeft! <= 0) {
                unit.builderSaboteurMode = true
                const who = unit.owner === 'player' ? 'Your' : 'Enemy'
                log.push(`!!${who} ${unit.name} has used all charges — running to the enemy base!`)
              }
            }
          }
          unit.buildTimer = buildInterval
        }
      }
    }

    const sEffect = unit.structureEffect
    if (unit.spawnTimer == null || !sEffect) continue
    if (sEffect.type !== 'spawn' && sEffect.type !== 'healAura' && sEffect.type !== 'repairAura') continue
    unit.spawnTimer -= deltaMs
    if (unit.spawnTimer <= 0) {
      if (sEffect.type === 'spawn') {
        const effect = sEffect as { type: 'spawn'; unitTemplate: UnitTemplate; intervalMs: number} 
        const spawned = spawnUnit(effect.unitTemplate, unit.owner)
        spawned.x = unit.x
        spawned.y = unit.y
        spawned.spawnGrowTimer = SPAWN_GROW_MS
        s.field.push(spawned)
        const who = unit.owner === 'player' ? 'Your' : 'Enemy'
        log.push(`${who} ${unit.name} spawned a ${spawned.name}!`)
        unit.spawnTimer = effect.intervalMs
      } else if (sEffect.type === 'healAura') {
        const { amount, intervalMs } = sEffect as { type: 'healAura'; amount: number; intervalMs: number} 
        const targets = s.field.filter(u => u.owner === unit.owner && u.moveSpeed > 0 && u.hp < u.maxHp)
        for (const t of targets) t.hp = Math.min(t.maxHp, t.hp + amount)
        if (targets.length > 0) {
          const who = unit.owner === 'player' ? 'Your' : 'Enemy'
          log.push(`${who} ${unit.name} healed ${targets.length} unit(s) for ${amount} HP.`)
        }
        unit.spawnTimer = intervalMs
      } else if (sEffect.type === 'repairAura') {
        const { amount, intervalMs } = sEffect as { type: 'repairAura'; amount: number; intervalMs: number} 
        // Walls with mastery 5 repairAura can repair themselves; others only repair neighbours
        const targets = s.field.filter(u => u.owner === unit.owner && u.moveSpeed === 0 && (u !== unit || unit.isWall) && u.hp < u.maxHp)
        for (const t of targets) t.hp = Math.min(t.maxHp, t.hp + amount)
        if (targets.length > 0) {
          const who = unit.owner === 'player' ? 'Your' : 'Enemy'
          log.push(`${who} ${unit.name} repaired ${targets.length} structure(s) for ${amount} HP.`)
        }
        unit.spawnTimer = intervalMs
      }
    }
  }
}

function applyTickEffects(s: GameState, deltaMs: number) {
  if (!s.tickEffects?.length) return
  for (const effect of s.tickEffects) {
    if (effect.type === 'healPlayerUnits') {
      effect.timer -= deltaMs
      if (effect.timer <= 0) {
        for (const u of s.field) {
          if (u.owner === 'player' && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + effect.amount)
        }
        effect.timer += effect.intervalMs
      }
    }
  }
}

function regenerateMana(s: GameState, deltaMs: number) {
  const manaBonus = getManaBonus(s.field, 'player')
  const effectiveBase = Math.max(BASE_MAX_MANA, s.deckMaxMana ?? 0)
  s.maxMana = s.forgiveManaLimit ? 9 : Math.min(10, effectiveBase + manaBonus + (s.relicManaBonus ?? 0))

  if (s.mana < s.maxMana) {
    const speedMult = 1 + getManaSpeedMult(s.field, 'player')
    s.manaAccum += (deltaMs / (s.playerManaRegenMs ?? MANA_REGEN_MS)) * speedMult
    while (s.manaAccum >= 1 && s.mana < s.maxMana) {
      s.mana++
      s.manaAccum -= 1
    }
    if (s.mana >= s.maxMana) s.manaAccum = 0
  }
}


