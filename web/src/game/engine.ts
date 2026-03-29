import { GameState, Card, Unit, UnitTemplate, UpgradeEffect, CardRarity, LANE_WIDTH, BattleEventState, TerrainObstacle, TerrainType, BuffTag, TERRAIN_AVOID_SHAPE, AnimEvent, BossTraitState, UnitTag } from './types'
import { makeDeck, makeThorlordDeck, makeKraggDeck, makeAshwalkerDeck, makeNodeDeck, HERO_CARDS, getCardUnit, flushCardValidationErrors } from './cards'
import { playUnitDeath, playBuildingDestroyed } from './sound'
import { logError } from '../logger'
import { isNoDamageMode } from './debug'
import bossAIDefsRaw from '../data/bossAIs.json'

// ─── Boss AI config types ──────────────────────────────────

interface BossAIPriority {
  cardType: 'unit' | 'structure' | 'upgrade'
  isWall?: boolean
  structureEffect?: 'spawn' | 'mana' | 'none' | string
  flying?: boolean
  nameIn?: string[]
  costGte?: number
  costLt?: number
  sortBy?: 'cost_asc' | 'cost_desc'
}

interface BossAIPhaseCondition {
  gameTimeGte?: number
  gameTimeLt?: number
  opponentFieldCountGte?: number
  wavePhaseEven?: boolean
}

interface BossAIPhase {
  condition: BossAIPhaseCondition | null
  priorities: BossAIPriority[]
  manaOverride?: number
  maxPlaysOverride?: number
  announceOnce?: string
}

interface BossTraitMechanics {
  invulnerableDurationMs?: number
  landingDamage?: number
  landingRadiusTiles?: number
  stunDurationMs?: number
  waveDamage?: number
  wavePushTiles?: number
  pulseDamage?: number
  slowDurationMs?: number
  slowFactor?: number
  splitCount?: number
  hpDivisor?: number
  allMustDie?: boolean
  repositionTarget?: string
  landingTarget?: string
}

interface BossTraitDef {
  name: string
  implemented: boolean
  trigger: string
  triggerHpPct?: number
  triggerHpPcts?: number[]
  triggerIntervalMs?: number
  triggerGameTimeMs?: number
  type: 'burrow' | 'fly' | 'split' | 'jump_aoe' | 'column_aoe'
  mechanics: BossTraitMechanics
  announceText: string
  landText?: string
  surfaceText?: string
  splitLog?: string
  fireText?: string
}

interface BossAIDef {
  id: string
  intervalMs: number
  idleMessage: string
  maxPlaysPerTurn: number
  openingLog: string[]
  phases: BossAIPhase[]
  trait?: BossTraitDef
}

const BOSS_AI_DEFS: BossAIDef[] = bossAIDefsRaw as BossAIDef[]
const BOSS_AI_MAP: Record<string, BossAIDef> = Object.fromEntries(BOSS_AI_DEFS.map(d => [d.id, d]))

export function getBossAIDef(id: string): BossAIDef | undefined {
  return BOSS_AI_MAP[id]
}

// ─── Constants ────────────────────────────────────────────

const OPPONENT_INTERVAL_MS = 6000
const MANA_REGEN_MS = 3000       // 1 mana every 3 seconds
const BASE_MAX_MANA = 5
const SUDDEN_DEATH_MS = 60000
const SUDDEN_DEATH_BUILDING_INTERVAL_MS = 2000  // building damage tick during sudden death
const SUDDEN_DEATH_FORCE_MS = 5 * 60 * 1000    // force sudden death after 5 minutes
const BATTLE_EVENT_BASE_MS = 30000  // first event after 30s, then every 24-32s
const SPAWN_GROW_MS = 1500           // building-spawn grow-in animation duration
const DEATH_LINGER_MS = 1200         // how long a dying unit stays visible
const DAMAGE_FLASH_MS = 200          // how long the damage-flash effect lasts
const KILL_FLASH_MS   = 500          // how long the kill-flash glow lasts
const BLOOD_POOL_MAX  = 25           // FIFO cap — older pools begin fading when exceeded
const BLOOD_POOL_FADE_MS = 2000     // how long a fading blood pool takes to disappear
const PROJECTILE_SPEED_PX_MS = 0.4  // projectile travel speed in game-px per ms
const ANIM_EVENT_PROJECTILE_MS = 600 // max projectile lifetime (cap)

const PLAYER_SPAWN_X = 30        // where player units appear
const OPPONENT_SPAWN_X = LANE_WIDTH - 30  // where opponent units appear
const BASE_STOP_MARGIN = 0       // units may reach the base character position exactly
const TRAIT_TILE_PX = 40         // 1 "tile" in trait radius = one lane-spacing in pixels

// ─── Helpers ─────────────────────────────────────────────

let _unitId = 0
function uid(): string { return `unit-${++_unitId}` }
let _recycleId = 0
function recycleCardId(): string { return `rc-${++_recycleId}` }

let _animId = 0
function animUid(): string { return `anim-${++_animId}` }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function drawCard(deck: Card[], hand: Card[]): void {
  if (deck.length > 0) hand.push(deck.shift()!)
}

// Five lanes evenly spread across the battle-field's lateral (Y) axis.
// Y=0 is centre; units move continuously between these positions.
const LANE_POSITIONS = [-80, -40, 0, 40, 80] as const
const LANE_MIN_Y = -80
const LANE_MAX_Y =  80

function spawnUnit(template: UnitTemplate, owner: 'player' | 'opponent'): Unit {
  if (!template || typeof template.maxHp !== 'number') {
    logError('spawnUnit: invalid template — maxHp missing', { templateName: (template as UnitTemplate | undefined)?.name, owner })
    // Return a minimal safe unit so the game can continue without crashing
    return { id: uid(), owner, name: 'Unknown', attack: 0, maxHp: 1, hp: 1, isWall: false, bypassWall: false, moveSpeed: 0, attackRange: 0, attackCooldownMs: 2000, x: owner === 'player' ? PLAYER_SPAWN_X : OPPONENT_SPAWN_X, y: 0, attackTimer: 0 }
  }
  const unit: Unit = {
    ...template,
    id: uid(),
    owner,
    hp: template.maxHp,
    x: owner === 'player' ? PLAYER_SPAWN_X : OPPONENT_SPAWN_X,
    y: 0,
    attackTimer: 0,
  }
  const effect = template.structureEffect
  if (effect?.type === 'spawn' || effect?.type === 'healAura' || effect?.type === 'repairAura') {
    const intervalMs = (effect as { intervalMs?: number }).intervalMs ?? 8000
    unit.spawnTimer = intervalMs
  }
  // Structures stay at base; walls are placed further out to form a defensive line
  // Moats are placed just in front of the wall (enemy-side of it)
  if (template.moveSpeed === 0) {
    unit.x = template.isMoat
      ? (owner === 'player' ? 185 : LANE_WIDTH - 185)
      : template.isWall
        ? (owner === 'player' ? 150 : LANE_WIDTH - 150)
        : (owner === 'player' ? 10 : LANE_WIDTH - 10)
    unit.upgradeLevel = 1
  } else {
    // Mobile units spawn in a random lane
    unit.y = LANE_POSITIONS[Math.floor(Math.random() * LANE_POSITIONS.length)]
  }
  return unit
}

// ─── Mana bonus from Farms ────────────────────────────────

function getManaBonus(field: Unit[], owner: 'player' | 'opponent'): number {
  return field
    .filter(u => u.owner === owner && u.structureEffect?.type === 'mana')
    .reduce((sum, u) => sum + (u.structureEffect as { type: 'mana'; amount: number }).amount, 0)
}

function getManaSpeedMult(field: Unit[], owner: 'player' | 'opponent'): number {
  return field
    .filter(u => u.owner === owner && u.structureEffect?.type === 'manaSpeed')
    .reduce((mult, u) => mult + (u.structureEffect as { type: 'manaSpeed'; speedMult: number }).speedMult, 0)
}

function getAttackAura(field: Unit[], owner: 'player' | 'opponent'): number {
  return field
    .filter(u => u.owner === owner && u.structureEffect?.type === 'attackAura')
    .reduce((sum, u) => sum + (u.structureEffect as { type: 'attackAura'; amount: number }).amount, 0)
}

// ─── New Game ────────────────────────────────────────────

// ─── Terrain Generation ───────────────────────────────────
//
// Scatter rocks, trees, water, and ruins across the mid-field.
// Three Y corridors (–55, 0, +55) are guaranteed clear so units
// always have at least 3 walkable paths from base to base.

const TERRAIN_CLEAR_Y   = [-70, 70] as const  // two edge corridors units route around
const TERRAIN_CLEAR_HALF = 12                  // half-width of each corridor (px)

/**
 * Tiny seeded PRNG (mulberry32) — deterministic given the same seed.
 * Used so each node always produces the same terrain layout.
 */
function makeRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (Math.imul(s ^ (s >>> 15), s | 1) ^ ((s ^ (Math.imul(s ^ (s >>> 7), s | 61))) >>> 14)) >>> 0
    return s / 4294967296
  }
}

/** Hash a string to a uint32 for use as a terrain seed. */
function hashStr(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  }
  return h >>> 0
}

/**
 * Generate terrain for a battle.
 * @param seed  Optional string seed (node ID). When provided, the layout is deterministic.
 * @param environment  Act environment — biases which obstacle types appear.
 */
function generateTerrain(seed?: string, environment?: string): TerrainObstacle[] {
  const rng = seed ? makeRng(hashStr(seed)) : Math.random.bind(Math)

  // Bias obstacle types by environment
  const TYPES: TerrainType[] =
    environment === 'forest' ? ['tree', 'tree', 'tree', 'rock', 'water']
    : environment === 'citadel' ? ['rock', 'rock', 'ruin', 'ruin', 'water']
    : environment === 'ashen'  ? ['ruin', 'ruin', 'rock', 'rock', 'tree']
    : ['rock', 'tree', 'water', 'ruin']

  const obstacles: TerrainObstacle[] = []
  const count = 4 + Math.floor(rng() * 5)  // 4–8 obstacles per battle
  let id = 0
  let tries = 0

  while (obstacles.length < count && tries++ < 150) {
    const x      = 90  + rng() * 320        // 90–410, away from spawn zones
    const y      = (rng() * 150) - 75       // –75 to 75
    const radius = 20  + rng() * 12         // 20–32 px
    const type   = TYPES[Math.floor(rng() * TYPES.length)]

    // Reject if it would block any guaranteed corridor
    if (TERRAIN_CLEAR_Y.some(cy => Math.abs(y - cy) < TERRAIN_CLEAR_HALF + radius)) continue

    // Reject if it overlaps an existing obstacle (with a small gap buffer)
    if (obstacles.some(o => Math.hypot(x - o.x, y - o.y) < radius + o.radius + 10)) continue

    obstacles.push({ id: `t${++id}`, type, x, y, radius })
  }

  return obstacles
}

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

const RARITY_RANK: Record<CardRarity, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 }

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
  } else if (boss === 'thornlord') {
    opponentDeck = shuffle(makeThorlordDeck())
  } else if (boss === 'kragg') {
    opponentDeck = shuffle(makeKraggDeck())
  } else if (boss === 'ashwalker') {
    opponentDeck = shuffle(makeAshwalkerDeck())
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
    const filtered  = makeDeck().filter(c => RARITY_RANK[c.rarity] <= RARITY_RANK[maxRarity])
    opponentDeck = shuffle(filtered)
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

  return {
    playerBase: { hp: 50, maxHp: 50 },
    opponentBase: { hp: hpOverride ?? (boss ? 95 : 82), maxHp: hpOverride ?? (boss ? 95 : 82) },
    field: [],
    playerHand,
    playerDeck,
    opponentHand,
    opponentDeck,
    mana: 3,
    maxMana: BASE_MAX_MANA,
    manaAccum: 0,
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
    bossHpMultiplier: bossHpMultiplier ?? (bossCard ? 10 : undefined),
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
  }
}

// ─── Play Card (immediate deploy + cooldown) ─────────────

export const MAX_UPGRADE_LEVEL = 4

export function playCard(state: GameState, cardId: string): GameState {
  if (state.phase.type !== 'playing') return state

  const cardIdx = state.playerHand.findIndex(c => c.id === cardId)
  if (cardIdx === -1) return state

  const card = state.playerHand[cardIdx]
  if (state.mana < card.cost) return state

  // Prevent playing a structure that is already at max upgrade level
  if (card.cardType === 'structure' && card.unit) {
    const existing = state.field.find(u => u.owner === 'player' && u.name === card.unit!.name)
    if (existing && (existing.upgradeLevel ?? 1) >= MAX_UPGRADE_LEVEL) {
      const s = structuredClone(state)
      s.log.push(`${existing.name} is already at max level — upgrade blocked.`)
      return s
    }
  }

  // Endless mode: block new (non-upgrade) structures beyond 3 rows from player base
  if (state.endlessMode && card.cardType === 'structure' && card.unit && !card.unit.isWall) {
    const existing = state.field.find(u => u.owner === 'player' && u.name === card.unit!.name)
    // Count current player structures to determine next row position
    const playerStructures = state.field.filter(u => u.owner === 'player' && u.moveSpeed === 0 && !u.isWall)
    const nextIdx = existing ? playerStructures.findIndex(u => u.name === card.unit!.name) : playerStructures.length
    // Each structure sits at x=10 base; rows push x outward by ~44px step — 3 rows ≈ x ≤ 60
    // Block new structures that would land in row 3+ (0-indexed: rows 0,1,2 = max 18 buildings)
    const row = Math.floor(nextIdx / 6)
    if (!existing && row >= 3) {
      const s = structuredClone(state)
      s.log.push('Endless mode: buildings are limited to 3 rows from your base.')
      return s
    }
  }

  const s = structuredClone(state)
  s.playerHand.splice(cardIdx, 1)
  s.mana -= card.cost

  deployCard(s, card, 'player', s.log)
  drawCard(s.playerDeck, s.playerHand)
  return s
}

// ─── Apply Upgrade ────────────────────────────────────────

function applyUpgrade(s: GameState, effect: UpgradeEffect, owner: 'player' | 'opponent', log: string[]): void {
  const units = s.field.filter(u => u.owner === owner)
  const label = owner === 'player' ? 'Your' : 'Enemy'
  const addBuff = (u: Unit, tag: BuffTag) => {
    if (!u.buffs) u.buffs = []
    if (!u.buffs.includes(tag)) u.buffs.push(tag)
  }
  if (effect.type === 'buffAttack') {
    for (const u of units) { u.attack += effect.amount; addBuff(u, 'atk') }
    log.push(`${label} units gain +${effect.amount} attack!`)
  } else if (effect.type === 'healUnits') {
    for (const u of units) u.hp = Math.min(u.maxHp, u.hp + effect.amount)
    log.push(`${label} units healed ${effect.amount} HP.`)
  } else if (effect.type === 'buffSpeed') {
    for (const u of units) if (u.moveSpeed > 0) { u.moveSpeed += effect.amount; addBuff(u, 'spd') }
    log.push(`${label} units surge +${effect.amount} speed!`)
  } else if (effect.type === 'buffMaxHp') {
    for (const u of units) if (u.moveSpeed > 0) { u.maxHp += effect.amount; u.hp = Math.min(u.hp + effect.amount, u.maxHp); addBuff(u, 'hp') }
    log.push(`${label} units gain +${effect.amount} max HP!`)
  } else if (effect.type === 'buffRange') {
    for (const u of units) if (u.attackRange > 0) { u.attackRange += effect.amount; addBuff(u, 'range') }
    log.push(`${label} units gain +${effect.amount} attack range!`)
  }
}

// ─── Deploy a card onto the field ────────────────────────

function deployCard(s: GameState, card: Card, owner: 'player' | 'opponent', log: string[]): void {
  if (card.cardType === 'unit' || card.cardType === 'structure') {
    if (!card.unit || typeof card.unit.maxHp !== 'number') {
      logError('deployCard: card has no valid unit template', { cardName: card.name, cardType: card.cardType, owner })
      return
    }
    // If playing a structure and one of the same type already exists, upgrade it instead
    if (card.cardType === 'structure') {
      const template = card.unit
      const existing = s.field.find(u => u.owner === owner && u.name === template.name)
      if (existing) {
        existing.maxHp *= 2
        existing.hp = Math.min(existing.hp * 2, existing.maxHp)
        existing.upgradeLevel = (existing.upgradeLevel ?? 1) + 1
        let note = 'HP×2'
        if (existing.structureEffect?.type === 'spawn') {
          const spawnEffect = existing.structureEffect as { type: 'spawn'; unitTemplate: UnitTemplate; intervalMs: number }
          spawnEffect.intervalMs = Math.max(1500, Math.floor(spawnEffect.intervalMs / 2))
          if (existing.spawnTimer != null) {
            existing.spawnTimer = Math.min(existing.spawnTimer, spawnEffect.intervalMs)
          }
          note += ', spawn×2'
        }
        if (existing.structureEffect?.type === 'mana') {
          const manaEffect = existing.structureEffect as { type: 'mana'; amount: number }
          manaEffect.amount += 1
          note += ', mana+1'
        }
        if (existing.structureEffect?.type === 'manaSpeed') {
          const msEffect = existing.structureEffect as { type: 'manaSpeed'; speedMult: number }
          msEffect.speedMult += 0.5
          note += ', speed+50%'
        }
        if (existing.structureEffect?.type === 'healAura') {
          const hEffect = existing.structureEffect as { type: 'healAura'; amount: number; intervalMs: number }
          hEffect.intervalMs = Math.max(2000, Math.floor(hEffect.intervalMs / 2))
          if (existing.spawnTimer != null) existing.spawnTimer = Math.min(existing.spawnTimer, hEffect.intervalMs)
          note += ', heal×2'
        }
        if (existing.structureEffect?.type === 'repairAura') {
          const rEffect = existing.structureEffect as { type: 'repairAura'; amount: number; intervalMs: number }
          rEffect.intervalMs = Math.max(2000, Math.floor(rEffect.intervalMs / 2))
          if (existing.spawnTimer != null) existing.spawnTimer = Math.min(existing.spawnTimer, rEffect.intervalMs)
          note += ', repair×2'
        }
        if (existing.structureEffect?.type === 'attackAura') {
          const aEffect = existing.structureEffect as { type: 'attackAura'; amount: number }
          aEffect.amount += 2
          note += ', atk+2'
        }
        const who = owner === 'player' ? 'You' : 'Opponent'
        log.push(`${who} upgraded ${existing.name}! (${note})`)
        return
      }
    }
    const unit = spawnUnit(card.unit, owner)
    if (owner === 'player' && s.relicGearHeart) unit.attack = Math.max(0, unit.attack + 1)
    if (card.lore) unit.lore = card.lore
    // Hero units use the card's display name but keep the base unit sprite
    if (card.isHero) {
      unit.spriteName = unit.name   // preserve original name for sprite lookup
      unit.name = card.name
      unit.isHero = true
    }
    // Assign a stable lateral slot to non-wall structures so that units
    // spawned from them start at the same horizontal position.
    if (card.cardType === 'structure' && !card.unit.isWall) {
      // Spread buildings evenly; pick first slot not already occupied by a same-side structure
      const STRUCTURE_Y_SLOTS = [-65, -40, -15, 15, 40, 65, -55, -25, 5, 30, 55, 0, -75, -50, 50, 75]
      const usedY = new Set(
        s.field.filter(u => u.moveSpeed === 0 && !u.isWall && u.owner === owner).map(u => u.y)
      )
      unit.y = STRUCTURE_Y_SLOTS.find(y => !usedY.has(y)) ?? STRUCTURE_Y_SLOTS[0]
    }
    s.field.push(unit)
    const verb = card.cardType === 'structure' ? 'built' : 'deployed'
    const who = owner === 'player' ? 'You' : 'Opponent'
    // Hero cards deploy their unit AND apply a buff to all friendly units
    if (card.isHero && card.heroEffect) {
      log.push(`★ HERO ${card.name} unleashed by ${who}!`)
      applyUpgrade(s, card.heroEffect, owner, log)
    } else {
      log.push(`${who} ${verb} ${unit.name}.`)
    }
  } else if (card.cardType === 'upgrade' && card.upgradeEffect) {
    applyUpgrade(s, card.upgradeEffect, owner, log)
  }
}

// ─── Distance helpers ─────────────────────────────────────

/**
 * Effective gameplay distance between two units.
 * Walls span the full lateral axis, so only the forward (X) gap matters for
 * them. All other units use true 2-D Euclidean distance so that units in
 * different lanes must physically close the gap before attacking.
 */
function unitDist(a: Unit, b: Unit): number {
  if (b.isWall) return Math.abs(a.x - b.x)
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

// ─── Enemy-finding helpers ────────────────────────────────

// Nearest enemy that is AHEAD (forward X) of this unit.
// flying/climber units ignore walls entirely.
function findNearestEnemy(field: Unit[], unit: Unit): Unit | null {
  let nearest: Unit | null = null
  let nearestDist = Infinity

  for (const other of field) {
    if (other.owner === unit.owner || other.hp <= 0) continue
    if (other.isWall && (unit.flying || unit.climber)) continue
    // "Ahead" is still defined on the X axis (direction toward enemy base)
    if (unit.owner === 'player'   && other.x < unit.x) continue
    if (unit.owner === 'opponent' && other.x > unit.x) continue

    const d = unitDist(unit, other)
    if (d < nearestDist) { nearestDist = d; nearest = other }
  }
  return nearest
}

// Nearest enemy AHEAD that matches the unit's targetPriority type.
// Returns null if no priority preference or no matching target found.
function findNearestEnemyByPriority(field: Unit[], unit: Unit): Unit | null {
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
    const matches =
      (pri === 'walls'        && other.isWall) ||
      (pri === 'buildings'    && other.moveSpeed === 0 && !other.isWall) ||
      (pri === 'boss'         && !!other.isHero) ||
      (pri === 'ranged_first' && other.bypassWall)
    if (!matches) continue
    const d = unitDist(unit, other)
    if (d < nearestDist) { nearestDist = d; nearest = other }
  }
  return nearest
}

// Nearest enemy that has slipped BEHIND this unit — used to turn around.
function findEnemyBehind(field: Unit[], unit: Unit): Unit | null {
  let nearest: Unit | null = null
  let nearestDist = Infinity

  for (const other of field) {
    if (other.owner === unit.owner || other.hp <= 0) continue
    if (other.isWall && (unit.flying || unit.climber)) continue
    if (unit.owner === 'player'   && other.x >= unit.x) continue
    if (unit.owner === 'opponent' && other.x <= unit.x) continue

    const d = unitDist(unit, other)
    if (d < nearestDist) { nearestDist = d; nearest = other }
  }
  return nearest
}

// Nearest enemy within attack range (2-D).
// bypassWall/climber units prefer mobile targets; if none in range they fall
// back to attacking the wall (except flying units which truly soar over walls).
// targetPriority biases selection: walls, buildings, boss, ranged_first.
function findAttackTarget(field: Unit[], unit: Unit): Unit | null {
  // Collect all enemies within attack range (respecting wall-bypass rules)
  const candidates: Array<{ other: Unit; d: number }> = []

  for (const other of field) {
    if (other.owner === unit.owner || other.hp <= 0) continue
    if (other.isMoat) continue  // moats are indestructible terrain — never targeted
    if (other.isWall && (unit.bypassWall || unit.climber)) continue
    const d = unitDist(unit, other)
    if (d > unit.attackRange) continue
    // Respect targeting restriction if set
    if (unit.targetUnitType === 'flying' && !other.flying) continue
    if (unit.targetUnitType === 'not_flying' && other.flying) continue
    if (unit.targetUnitType === 'hero' && !other.isHero) continue
    candidates.push({ other, d })
  }

  // Ranged non-flying: walls as fallback when nothing else in range
  if (candidates.length === 0 && unit.bypassWall && !unit.flying) {
    for (const other of field) {
      if (other.owner === unit.owner || other.hp <= 0) continue
      if (other.isMoat) continue
      if (!other.isWall) continue
      const d = unitDist(unit, other)
      if (d > unit.attackRange) continue
      candidates.push({ other, d })
    }
  }

  if (candidates.length === 0) return null

  // Apply targetPriority: try preferred bucket first, fall back to nearest
  const pri = unit.targetPriority
  if (pri) {
    let preferred: Array<{ other: Unit; d: number }> = []
    if (pri === 'walls')        preferred = candidates.filter(c => c.other.isWall)
    if (pri === 'buildings')    preferred = candidates.filter(c => c.other.moveSpeed === 0 && !c.other.isWall)
    if (pri === 'boss')         preferred = candidates.filter(c => c.other.isHero)
    if (pri === 'ranged_first') preferred = candidates.filter(c => c.other.bypassWall)
    if (preferred.length > 0) {
      return preferred.reduce((a, b) => a.d < b.d ? a : b).other
    }
  }

  return candidates.reduce((a, b) => a.d < b.d ? a : b).other
}

// ─── Movement ─────────────────────────────────────────────

const CLIMB_SPEED_FACTOR = 0.25   // climbers move at 25 % speed through wall zones
const WALL_CLIMB_ZONE   = 30      // px radius around a wall that counts as "wall zone"

const BLOOD_CLUSTER_RADIUS = 70   // px — pools within this distance count as "same area"
const BLOOD_CLUSTER_MIN    = 2    // minimum pools in a cluster to trigger avoidance
const MAX_BASE_GUARDS      = 2    // max units per side allowed to stay in guard-base mode

function moveUnits(s: GameState, deltaMs: number): void {
  const deltaSec = deltaMs / 1000

  // Tracks how many units per owner have decided to guard this tick.
  // Once MAX_BASE_GUARDS is reached, additional guardBase units advance instead.
  const guardDecisionCount: Record<string, number> = {}

  // Pre-compute which active blood pools are part of a dense cluster (3+).
  // Done once per tick rather than per unit to keep the cost O(pools²).
  const activePools = s.bloodPools.filter(p => p.fadingAt === undefined)
  const densePools = activePools.filter(pool => {
    const nearby = activePools.filter(
      p => p !== pool &&
        Math.abs(p.x - pool.x) < BLOOD_CLUSTER_RADIUS &&
        Math.abs(p.y - pool.y) < BLOOD_CLUSTER_RADIUS,
    )
    return nearby.length >= BLOOD_CLUSTER_MIN - 1
  })

  for (const unit of s.field) {
    if (unit.moveSpeed === 0) continue
    if (unit.spawnGrowTimer != null && unit.spawnGrowTimer > 0) continue
    if (unit.stunTimer != null && unit.stunTimer > 0) continue

    const nearestAhead = findNearestEnemyByPriority(s.field, unit) ?? findNearestEnemy(s.field, unit)

    // Determine movement target and vector
    // Default: converge toward the base character at centre of the enemy edge (y=0)
    let tx: number = unit.owner === 'player' ? LANE_WIDTH : 0
    let ty: number = 0
    let hasTarget = false

    if (nearestAhead) {
      // If already in attack range, stand still
      if (unitDist(unit, nearestAhead) <= unit.attackRange) continue
      tx = nearestAhead.x
      // Walls span the whole lateral axis — approach straight ahead; don't drift Y
      ty = nearestAhead.isWall ? unit.y : nearestAhead.y
      hasTarget = true
    } else {
      // No enemies ahead — check if one slipped behind us
      const behind = findEnemyBehind(s.field, unit)
      if (behind) {
        if (unitDist(unit, behind) <= unit.attackRange) continue
        tx = behind.x
        ty = behind.isWall ? unit.y : behind.y
        hasTarget = true
      }
    }

    // Affinity group movement: seek partner if out of range; leash once bonded
    // Only redirect movement when the unit has no active combat target — we
    // never want affinity to pause a unit that is already engaging an enemy.
    if (unit.affinity && !unit.isWall) {
      const aff = unit.affinity
      const partner = s.field.find(
        u => u.owner === unit.owner && u.id !== unit.id && u.hp > 0 && u.name === aff.withName
      )
      if (partner) {
        const partnerDist = unitDist(unit, partner)
        const isPlayerUnit = unit.owner === 'player'
        // "ahead" means closer to the enemy base
        const unitIsAhead = isPlayerUnit ? unit.x > partner.x : unit.x < partner.x
        if (partnerDist > aff.range) {
          // Seeking: only redirect when not already engaging a target
          if (!hasTarget) {
            if (unitIsAhead) {
              // We're ahead — hold position and let partner catch up
              tx = unit.x
              ty = unit.y
            } else {
              // Partner is ahead — rush toward them
              tx = partner.x
              ty = partner.y
            }
          }
        } else {
          // Cohesion: bonded — don't advance more than half the affinity range ahead of partner
          const leash = aff.range * 0.5
          if (isPlayerUnit) {
            tx = Math.min(tx, partner.x + leash)
          } else {
            tx = Math.max(tx, partner.x - leash)
          }
        }
      }
    }

    // ── Unit trait: flee ─────────────────────────────────────
    // Only flee when there is no active attack target — if the unit has something
    // to fight it should engage rather than run. If there is no target at all,
    // advancing normally is better than aimless retreat.
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
        const len = Math.sqrt(fvx * fvx + fvy * fvy) || 1
        const rawTx = unit.x + (fvx / len) * 200
        // Cap retreat: unit may only flee up to 80 px toward its own base from
        // its current position — prevents units fleeing all the way home.
        const MAX_RETREAT = 80
        tx = unit.owner === 'player'
          ? Math.max(rawTx, unit.x - MAX_RETREAT)
          : Math.min(rawTx, unit.x + MAX_RETREAT)
        ty = unit.y + (fvy / len) * 40
        hasTarget = true
      }
    }

    // ── Unit trait: guard base ───────────────────────────────
    // At most MAX_BASE_GUARDS units per side may guard at once; once that quota
    // is filled additional guardBase units fall through to normal forward movement
    // so they advance and attack instead of piling up near their own base.
    if (unit.unitTrait?.guardBase && s.gameTime < 120_000) {
      const ownBaseX       = unit.owner === 'player' ? 0 : LANE_WIDTH
      const engageRange    = unit.unitTrait.engageRange    ?? 180
      const baseGuardRange = unit.unitTrait.baseGuardRange ?? 80
      const enemyNearBase  = s.field.some(other =>
        other.owner !== unit.owner &&
        other.hp > 0 &&
        Math.abs(other.x - ownBaseX) < engageRange
      )
      const guardsThisTick = guardDecisionCount[unit.owner] ?? 0
      if (!enemyNearBase && guardsThisTick < MAX_BASE_GUARDS) {
        guardDecisionCount[unit.owner] = guardsThisTick + 1
        // Assign a persistent random y to this unit so guards spread across the field
        // rather than all converging on the same point.
        if (unit.guardY === undefined) {
          unit.guardY = (Math.random() * 2 - 1) * LANE_MAX_Y
        }
        const guardX = unit.owner === 'player'
          ? ownBaseX + baseGuardRange
          : ownBaseX - baseGuardRange
        tx = guardX
        ty = unit.guardY
        hasTarget = true
      }
      // If threat detected, or guard quota is full, fall through — normal movement engages
    }
    // After 2 minutes guarding units begin a slow advance — guard logic is skipped
    // and normal movement takes over, pushing them toward the opponent.

    const dx = tx - unit.x
    const dy = ty - unit.y
    const d  = Math.sqrt(dx * dx + dy * dy)
    if (d === 0) continue

    // Climbers slow down when passing through an enemy wall zone
    const inWallZone = unit.climber && s.field.some(w =>
      w.isWall && w.owner !== unit.owner && w.hp > 0 &&
      Math.abs(unit.x - w.x) <= WALL_CLIMB_ZONE
    )
    // Moat slow zone — any unit (enemy or ally) crossing a moat is slowed
    const moatSlowFactor = s.field.reduce((factor, m) => {
      if (!m.isMoat) return factor
      const effect = m.structureEffect as { type: 'slowZone'; slowFactor: number; radius: number } | undefined
      if (!effect || effect.type !== 'slowZone') return factor
      if (Math.abs(unit.x - m.x) <= effect.radius) return Math.min(factor, effect.slowFactor)
      return factor
    }, 1)
    // Fog of War battle event halves all movement
    const fogMult = s.activeBattleEvent?.type === 'fogOfWar' ? 0.5 : 1
    const affMoveMult = (unit.affinityActive && unit.affinity?.effectType === 'moveSpeed')
      ? unit.affinity.effectAmount : 1
    const speed = (inWallZone ? unit.moveSpeed * CLIMB_SPEED_FACTOR : unit.moveSpeed) * deltaSec * fogMult * affMoveMult * moatSlowFactor

    // Terrain avoidance: lateral repulsion from nearby obstacles.
    // Uses a per-type ellipse (TERRAIN_AVOID_SHAPE) so tall narrow trees
    // repel units along the forward axis while wide water repels laterally.
    // Flying units soar over terrain; structures are already skipped above.
    let avoidY = 0
    if (!unit.flying) {
      for (const obs of s.terrain) {
        const toObsX = obs.x - unit.x
        const toObsY = obs.y - unit.y
        const shape  = TERRAIN_AVOID_SHAPE[obs.type]
        const ax     = obs.radius * shape.fx + 4  // forward half-extent
        const ay     = obs.radius * shape.fy + 4  // lateral half-extent
        // Normalised distance inside the avoidance ellipse (< 1 = inside)
        const normDist = Math.sqrt((toObsX / ax) ** 2 + (toObsY / ay) ** 2)
        if (normDist < 1 && normDist > 0) {
          const strength = 1 - normDist  // 0..1, stronger when closer to centre
          // Determine lateral push direction. When a unit approaches nearly head-on
          // (toObsY ≈ 0), the normal formula gives zero push and units walk through
          // the obstacle. Break symmetry deterministically using the unit id.
          let lateralDir: number
          if (Math.abs(toObsY) < 5) {
            // head-on: pick a side based on unit id so the same unit always goes the same way
            const idNum = parseInt(unit.id.replace(/\D/g, ''), 10) || 0
            lateralDir = (idNum % 2 === 0) ? -1 : 1
          } else {
            lateralDir = -Math.sign(toObsY)
          }
          avoidY += lateralDir * strength * unit.moveSpeed * 1.8
        }
      }

      // Blood pool cluster avoidance: steer around areas with overlapping death pools.
      // Clusters ahead of the unit (in its direction of travel) get stronger deflection
      // so units route around kill-zones before entering them, not just while inside.
      for (const pool of densePools) {
        const toPoolX = pool.x - unit.x
        const toPoolY = pool.y - unit.y
        const dist = Math.sqrt(toPoolX ** 2 + toPoolY ** 2)
        if (dist < BLOOD_CLUSTER_RADIUS && dist > 0) {
          const strength = 1 - dist / BLOOD_CLUSTER_RADIUS
          const lateralDir = Math.abs(toPoolY) < 5
            ? ((parseInt(unit.id.replace(/\D/g, ''), 10) || 0) % 2 === 0 ? -1 : 1)
            : -Math.sign(toPoolY)
          // Clusters in the unit's forward direction warrant stronger avoidance
          const isAhead = unit.owner === 'player' ? toPoolX > 0 : toPoolX < 0
          const deflectMult = isAhead ? 1.8 : 1.2
          avoidY += lateralDir * strength * unit.moveSpeed * deflectMult
        }
      }
    }

    // Move at full speed toward target, clamped so we don't overshoot
    const step = Math.min(speed, d)
    unit.x = Math.min(LANE_WIDTH - BASE_STOP_MARGIN, Math.max(BASE_STOP_MARGIN, unit.x + (dx / d) * step))
    unit.y = Math.min(LANE_MAX_Y, Math.max(LANE_MIN_Y, unit.y + (dy / d) * step + avoidY * deltaSec))
  }
}

// ─── Affinity Processing ──────────────────────────────────

function processAffinities(field: Unit[]): void {
  for (const unit of field) {
    if (!unit.affinity || unit.hp <= 0 || (unit.masteryLevel ?? 0) < 1) { unit.affinityActive = false; continue }
    const aff = unit.affinity
    const ally = field.find(
      u => u.owner === unit.owner && u.id !== unit.id && u.hp > 0 &&
           u.name === aff.withName && unitDist(unit, u) <= aff.range
    )
    unit.affinityActive = ally !== undefined
  }
}

// ─── Per-unit Combat ──────────────────────────────────────

function processAttacks(s: GameState, deltaMs: number, log: string[]): void {
  const playerAtkAura = getAttackAura(s.field, 'player')
  const opponentAtkAura = getAttackAura(s.field, 'opponent')

  for (const unit of s.field) {
    if (unit.attack === 0 || unit.hp <= 0) continue

    if (unit.attackTimer > 0) {
      unit.attackTimer -= deltaMs
      continue
    }

    const target = findAttackTarget(s.field, unit)
    const isPlayer = unit.owner === 'player'
    const atkAura = isPlayer ? playerAtkAura : opponentAtkAura

    if (target) {
      const prevHp = target.hp
      const bloodMoonMult = s.activeBattleEvent?.type === 'bloodMoon' ? 2 : 1
      // Strength/weakness multiplier: ×1.5 if attacker's strengths match any target tag
      const targetTags = target.tags ?? []
      const swMult = (unit.strengths ?? []).some(t => targetTags.includes(t)) ? 1.5 : 1
      // Affinity damage multiplier (>1 = bonus, <1 = damage reduction on target)
      const affDmgMult = (unit.affinityActive && unit.affinity?.effectType === 'damage')
        ? unit.affinity.effectAmount : 1
      // Mastery 5 elite bonus: +10% damage
      const masteryEliteMult = (unit.masteryLevel ?? 0) >= 5 ? 1.1 : 1
      const dmg = Math.round((unit.attack + atkAura) * bloodMoonMult * swMult * affDmgMult * masteryEliteMult)

      // Emit projectile animation for ranged (bypassWall) attackers
      if (unit.bypassWall && !unit.isWall) {
        const dist = Math.hypot(target.x - unit.x, target.y - unit.y)
        const travelMs = Math.min(ANIM_EVENT_PROJECTILE_MS, dist / PROJECTILE_SPEED_PX_MS)
        const projEvent: AnimEvent = {
          id: animUid(),
          kind: 'projectile',
          fromUnitId: unit.id,
          fromX: unit.x, fromY: unit.y,
          toX: target.x, toY: target.y,
          expiresAt: s.gameTime + travelMs,
        }
        s.animEvents.push(projEvent)
      }

      // Respect developer no-damage mode for player-owned targets
      if (target.owner === 'player' && isNoDamageMode()) {
        log.push(`${unit.name} would damage ${target.name} (dev mode — no damage)`)
      } else {
        target.hp -= dmg
        const actualDamage = prevHp - Math.max(0, target.hp)
        if (isPlayer) s.playerScore += actualDamage
        else s.opponentScore += actualDamage
        // Damage flash
        target.damageFlashTimer = DAMAGE_FLASH_MS
        // Emit hit spark at target position
        s.animEvents.push({
          id: animUid(),
          kind: 'hit',
          fromX: target.x, fromY: target.y,
          toX: target.x, toY: target.y,
          expiresAt: s.gameTime + 300,
        })
        if (target.hp <= 0) {
          log.push(`${unit.name} destroyed ${target.name}!`)
          if (target.moveSpeed === 0) playBuildingDestroyed()
          else playUnitDeath()
          // Start death linger for mobile units (not walls/structures — they snap away)
          if (target.moveSpeed > 0 && !target.isWall) {
            target.dyingTimer = DEATH_LINGER_MS
            if (!target.flying) {
              s.bloodPools.push({ id: target.id, x: target.x, y: target.y })
              const activePools = s.bloodPools.filter(p => p.fadingAt === undefined)
              if (activePools.length > BLOOD_POOL_MAX) activePools[0].fadingAt = s.gameTime
            }
          }
          // Kill flash on the attacker
          unit.killFlashTimer = KILL_FLASH_MS
        }
      }
      const affSpeedMult = (unit.affinityActive && unit.affinity?.effectType === 'attackSpeed')
        ? unit.affinity.effectAmount : 1
      unit.attackTimer = unit.attackCooldownMs / affSpeedMult
    } else {
      // No enemies in range — attack the base if close enough
      // Unit must be within attackRange of the base character (centre of the enemy edge)
      const baseDist = isPlayer
        ? Math.hypot(LANE_WIDTH - unit.x, unit.y)
        : Math.hypot(unit.x, unit.y)
      const atEnemyBase = baseDist <= unit.attackRange

      if (atEnemyBase) {
        const bloodMoonMult = s.activeBattleEvent?.type === 'bloodMoon' ? 2 : 1
        const dmg = (unit.attack + atkAura) * bloodMoonMult
        if (isPlayer) {
          const traitProtected = s.bossTraitState != null &&
            s.bossTraitState.baseInvulnerableUntilMs > s.gameTime
          if (s.endlessWaveTruceMs != null && s.endlessWaveTruceMs > 0) {
            log.push(`${unit.name} hits Enemy Base! (truce — no damage)`)
          } else if (traitProtected) {
            log.push(`${unit.name} hits Enemy Base — it's protected!`)
          } else {
          const prev = s.opponentBase.hp
          s.opponentBase.hp = Math.max(0, s.opponentBase.hp - dmg)
          s.playerScore += prev - s.opponentBase.hp
          log.push(`${unit.name} hits Enemy Base! -${dmg}HP`)
          }
        } else {
          if (!isNoDamageMode()) {
            const prev = s.playerBase.hp
            s.playerBase.hp = Math.max(0, s.playerBase.hp - dmg)
            s.opponentScore += prev - s.playerBase.hp
            log.push(`${unit.name} hits Your Base! -${dmg}HP`)
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

  // Soulstone relic: auto-revive the first dead player unit once per battle
  if (s.soulstoneReviveAvailable) {
    const deadPlayerUnit = s.field.find(u => u.owner === 'player' && u.hp <= 0 && u.moveSpeed > 0)
    if (deadPlayerUnit) {
      deadPlayerUnit.hp = Math.ceil(deadPlayerUnit.maxHp / 2)
      s.soulstoneReviveAvailable = false
      log.push(`💎 Soulstone! ${deadPlayerUnit.name} rises from the dead!`)
    }
  }

  // Count kills for battle stats
  for (const u of s.field) {
    if (u.hp <= 0 && u.moveSpeed > 0 && !u.isWall) {
      if (u.owner === 'opponent') s.battleStats.playerKills++
      else                        s.battleStats.playerUnitsLost++
    }
  }

  // Remove dead units (moats are indestructible — keep them even at 0 hp)
  // Mobile units with a dyingTimer linger briefly for death animation
  s.field = s.field.filter(u => u.hp > 0 || u.isMoat || (u.dyingTimer != null && u.dyingTimer > 0))
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
      s.phase = { type: 'gameOver', winner: 'player' }
      return true
    }
    return false
  }

  // Phase 2 active — win when boss unit dies; normal base HP is irrelevant
  if (s.bossCardActive && s.bossCard) {
    const bossAlive = s.field.some(u => u.owner === 'opponent' && u.name === s.bossCard)
    if (!bossAlive) {
      s.playerScore += VICTORY_BONUS
      s.phase = { type: 'gameOver', winner: 'player' }
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
  if (s.opponentBase.hp <= 0) {
    // Endless mode: spawn next (stronger) wave instead of ending
    if (s.endlessMode) {
      const wave = (s.endlessWave ?? 1) + 1
      s.endlessWave = wave
      const hpMult = 1 + (wave - 1) * 0.8
      s.opponentBase = { hp: Math.round(82 * hpMult), maxHp: Math.round(82 * hpMult) }
      // Scale opponent speed aggressively each wave (min 2000ms)
      s.opponentIntervalMs = Math.max(2000, s.opponentIntervalMs - 500)
      s.opponentTimer = s.opponentIntervalMs
      // Boost opponent mana regen each wave (capped at 2.5x)
      s.endlessOpponentManaMult = Math.min(2.5, (s.endlessOpponentManaMult ?? 1) + 0.2)
      // Clear opponent units + reshuffle opponent deck
      s.field = s.field.filter(u => u.owner !== 'opponent')
      const fresh = shuffle([...(s.endlessOpponentDeckTemplate ?? [])])
      s.opponentDeck = fresh
      // Draw bonus cards into opponent hand based on wave number
      const bonusDraws = Math.min(4, wave - 1)
      for (let i = 0; i < bonusDraws; i++) drawCard(s.opponentDeck, s.opponentHand)
      // Reset player spawn building timers so they don't immediately flood the wave
      s.field.forEach(u => {
        if (u.owner === 'player' && u.spawnTimer != null && u.structureEffect?.type === 'spawn') {
          const se = u.structureEffect as { type: 'spawn'; intervalMs: number }
          u.spawnTimer = se.intervalMs
        }
      })
      // Finger smash: a giant finger crushes 75-95% of the player's units/structures
      const playerUnits = s.field.filter(u => u.owner === 'player' && !u.dyingTimer)
      const smashFraction = 0.75 + Math.random() * 0.20 // 75–95%
      const smashCount = Math.round(playerUnits.length * smashFraction)
      const smashedNames: string[] = []
      const smashPool = [...playerUnits]
      for (let i = 0; i < smashCount && smashPool.length > 0; i++) {
        const idx = Math.floor(Math.random() * smashPool.length)
        const [victim] = smashPool.splice(idx, 1)
        smashedNames.push(victim.name)
        s.field = s.field.filter(u => u.id !== victim.id)
        // Leave a blood pool at the squish site for non-flying mobile units
        if (victim.moveSpeed > 0 && !victim.flying) {
          s.bloodPools.push({ id: `smash-${victim.id}`, x: victim.x, y: victim.y ?? 0 })
          const activePools = s.bloodPools.filter(p => p.fadingAt === undefined)
          if (activePools.length > BLOOD_POOL_MAX) activePools[0].fadingAt = s.gameTime
        }
      }
      if (smashedNames.length > 0) {
        s.log.push(`👇 A giant finger smashes ${smashedNames.join(', ')}!`)
      }
      // Grant opponent a truce window (counts down once game resumes)
      s.endlessWaveTruceMs = 5000
      // Always pause for the finger smash animation; reward only on every 5th wave
      const completedWave = wave - 1
      const rewardDue = completedWave % 5 === 0
      s.phase = { type: 'fingerSmash', wave: completedWave, smashedNames, rewardDue }
      s.log.push(rewardDue
        ? `Wave ${completedWave} cleared! Choose your reward before the next wave.`
        : `Wave ${completedWave} cleared! Next wave incoming...`
      )
      return false
    }
    if (s.bossCard && !s.bossCardActive) {
      // Trigger phase 2: restore base, clear opponent minions, push player units back, deploy boss
      s.opponentBase.hp = s.opponentBase.maxHp
      s.field = s.field.filter(u => u.owner !== 'opponent')
      s.field.forEach(u => { if (u.owner === 'player') u.x = PLAYER_SPAWN_X })
      const template = getCardUnit(s.bossCard)
      if (template) {
        const mult = s.bossHpMultiplier ?? 10
        const boostedTemplate = { ...template, maxHp: Math.round(template.maxHp * mult) }
        const bossUnit = spawnUnit(boostedTemplate, 'opponent')
        s.field.push(bossUnit)
        const displayName = s.bossName ?? s.bossCard
        s.log.push(`⚡ PHASE 2! ${displayName} rises from the ruins!`)
        s.log.push(`Destroy ${displayName} to win!`)

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
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
          }
          const victims = shuffled.slice(0, killCount)
          const victimIds = new Set(victims.map(u => u.id))
          s.field = s.field.filter(u => !victimIds.has(u.id))
          s.log.push(`💥 The shockwave obliterates ${victims.map(u => u.name).join(', ')}!`)
        }
      }
      s.bossCardActive = true
      return false
    }
    s.playerScore += VICTORY_BONUS
    s.phase = { type: 'gameOver', winner: 'player' }
    return true
  }
  return false
}

// ─── Opponent AI ─────────────────────────────────────────

/** Hero cards are locked for the first 30 s — same rule as the player. */
function isPlayable(card: Card, gameTime: number): boolean {
  return !(card.isHero && gameTime < 30000)
}

function opponentAI(s: GameState, log: string[]): void {
  const manaBonus = getManaBonus(s.field, 'opponent')
  const manaMult = s.endlessOpponentManaMult ?? 1
  let mana = Math.min(15, Math.round((BASE_MAX_MANA + manaBonus) * manaMult))

  const strategy = s.opponentStrategy
  const wave = s.endlessMode ? (s.endlessWave ?? 1) : 1
  const baseMax = strategy === 'swarm' ? 3 : 2
  const maxPlays = Math.min(6, baseMax + Math.floor((wave - 1) / 2))
  // Early-stop chance after 1st card: 50% wave 1-2, 25% wave 3-4, 0% wave 5+
  const earlyStopChance = wave <= 2 ? 0.5 : wave <= 4 ? 0.25 : 0

  let played = 0
  while (played < maxPlays) {
    const affordable = s.opponentHand.filter(c => c.cost <= mana && isPlayable(c, s.gameTime))
    if (affordable.length === 0) break

    let preferred: Card[]
    if (strategy === 'swarm') {
      // Prefer cheap units; flood the board
      preferred = affordable.filter(c => c.cost <= 2 && c.cardType === 'unit')
    } else if (strategy === 'turtle') {
      // Prefer structures; be defensive
      preferred = affordable.filter(c => c.cardType === 'structure')
    } else {
      // rush: prefer expensive units
      preferred = affordable.filter(c => c.cost >= 3 && c.cardType !== 'structure')
    }
    const pool = preferred.length > 0 ? preferred : affordable

    const card = pool[Math.floor(Math.random() * pool.length)]
    s.opponentHand.splice(s.opponentHand.indexOf(card), 1)
    mana -= card.cost
    played++

    deployCard(s, card, 'opponent', log)
    drawCard(s.opponentDeck, s.opponentHand)

    // Turtle only plays 1 card per turn
    if (strategy === 'turtle') break
    // Others have a wave-scaled early-stop chance
    if (played === 1 && Math.random() < earlyStopChance) break
  }

  if (played === 0) log.push('Opponent holds.')
}

// ─── Generic Boss AI ──────────────────────────────────────

function matchesPriority(c: Card, p: BossAIPriority): boolean {
  if (c.cardType !== p.cardType) return false
  const u = c.unit
  if (p.isWall !== undefined && !!(u?.isWall) !== p.isWall) return false
  if (p.flying !== undefined && !!(u?.flying) !== p.flying) return false
  if (p.nameIn !== undefined && !p.nameIn.includes(c.name)) return false
  if (p.costGte !== undefined && c.cost < p.costGte) return false
  if (p.costLt !== undefined && c.cost >= p.costLt) return false
  if (p.structureEffect !== undefined) {
    if (p.structureEffect === 'none') {
      if (u?.structureEffect) return false
    } else {
      if (u?.structureEffect?.type !== p.structureEffect) return false
    }
  }
  return true
}

function sortByField(cards: Card[], sortBy?: string): Card[] {
  if (sortBy === 'cost_desc') return [...cards].sort((a, b) => b.cost - a.cost)
  if (sortBy === 'cost_asc')  return [...cards].sort((a, b) => a.cost - b.cost)
  return cards
}

function phaseMatches(cond: BossAIPhaseCondition | null, s: GameState): boolean {
  if (cond === null) return true
  if (cond.gameTimeGte !== undefined && s.gameTime < cond.gameTimeGte) return false
  if (cond.gameTimeLt  !== undefined && s.gameTime >= cond.gameTimeLt) return false
  if (cond.opponentFieldCountGte !== undefined) {
    const count = s.field.filter(u => u.owner === 'opponent' && !u.isWall).length
    if (count < cond.opponentFieldCountGte) return false
  }
  if (cond.wavePhaseEven !== undefined) {
    const isEven = Math.floor(s.gameTime / 20000) % 2 === 0
    if (isEven !== cond.wavePhaseEven) return false
  }
  return true
}

function genericBossAI(s: GameState, log: string[], def: BossAIDef): void {
  const manaBonus = getManaBonus(s.field, 'opponent')
  const phase = def.phases.find(p => phaseMatches(p.condition, s)) ?? def.phases[def.phases.length - 1]

  // Announce once when a timed phase is first entered (within the first second of the trigger)
  if (phase.announceOnce && phase.condition?.gameTimeGte !== undefined) {
    const t = phase.condition.gameTimeGte
    if (s.gameTime >= t && s.gameTime < t + 1000) {
      log.push(phase.announceOnce)
    }
  }

  let mana = phase.manaOverride ?? Math.min(10, BASE_MAX_MANA + manaBonus)
  const maxPlays = phase.maxPlaysOverride ?? def.maxPlaysPerTurn

  function tryPlay(): boolean {
    const hand = s.opponentHand.filter(c => c.cost <= mana && isPlayable(c, s.gameTime))
    if (hand.length === 0) return false
    for (const priority of phase.priorities) {
      const candidates = sortByField(hand.filter(c => matchesPriority(c, priority)), priority.sortBy)
      const pick = candidates[0]
      if (!pick) continue
      s.opponentHand.splice(s.opponentHand.indexOf(pick), 1)
      mana -= pick.cost
      deployCard(s, pick, 'opponent', log)
      drawCard(s.opponentDeck, s.opponentHand)
      return true
    }
    return false
  }

  let played = 0
  while (played < maxPlays && tryPlay()) played++
  if (played === 0) log.push(def.idleMessage)
}

// ─── Boss Trait System ────────────────────────────────────

/**
 * Pick a landing position based on the repositionTarget / landingTarget value
 * from the trait mechanics JSON.
 */
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
  // default: random position on the player's half
  return {
    x: PLAYER_SPAWN_X + 20 + Math.random() * 220,
    y: LANE_POSITIONS[Math.floor(Math.random() * LANE_POSITIONS.length)],
  }
}

/** Deal AOE damage (and optional stun) to player units within radius of (cx, cy). */
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
    if (stunMs) {
      u.stunTimer = stunMs
      u.attackTimer = Math.max(u.attackTimer, stunMs)
    }
    hit++
  }
  if (hit > 0) log.push(`${hit} unit(s) caught in the blast!`)
}

/** Spawn split fragments and activate the allMustDie win condition. */
function fireSplitTrait(s: GameState, trait: BossTraitDef, log: string[]): void {
  const count = trait.mechanics.splitCount ?? 3
  const hpEach = Math.max(5, Math.ceil(s.opponentBase.hp / (trait.mechanics.hpDivisor ?? count)))
  const ts = s.bossTraitState!

  // Four corners of the battlefield (opponent side + mid-field)
  const positions: Array<{ x: number; y: number }> = [
    { x: OPPONENT_SPAWN_X - 50, y: -80 },
    { x: OPPONENT_SPAWN_X - 50, y:  80 },
    { x: LANE_WIDTH * 0.55,    y: -80 },
    { x: LANE_WIDTH * 0.55,    y:  80 },
  ]

  const splitIds: string[] = []
  for (let i = 0; i < count; i++) {
    const pos = positions[i] ?? { x: OPPONENT_SPAWN_X - 40, y: 0 }
    const fragTemplate: UnitTemplate = {
      name: 'Boss Fragment',
      attack: 4,
      maxHp: hpEach,
      isWall: false,
      bypassWall: true,
      moveSpeed: 0,
      attackRange: 140,
      attackCooldownMs: 2500,
    }
    const frag = spawnUnit(fragTemplate, 'opponent')
    frag.x = pos.x
    frag.y = pos.y
    splitIds.push(frag.id)
    s.field.push(frag)
  }

  ts.splitActive = true
  ts.splitUnitIds = splitIds
  log.push(trait.splitLog ?? trait.announceText)
  log.push(`Destroy all ${count} Boss Fragments to win!`)
}

/** Begin the invulnerable-window + scheduled landing for burrow/fly/jump_aoe traits. */
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
  log.push(trait.announceText)
}

/**
 * Called every tick when a boss fight is active.
 * Checks trait triggers and fires effects.
 */
function tickBossTrait(s: GameState, log: string[]): void {
  if (!s.bossAI || !s.bossTraitState) return
  const def = getBossAIDef(s.bossAI)
  const trait = def?.trait
  if (!trait || trait.implemented === false) return

  const ts = s.bossTraitState

  // ── Resolve a pending landing ─────────────────────────────
  if (ts.landingAtMs !== undefined && s.gameTime >= ts.landingAtMs) {
    const lx = ts.landX ?? LANE_WIDTH / 4
    const ly = ts.landY ?? 0
    const radiusPx = (trait.mechanics.landingRadiusTiles ?? 2) * TRAIT_TILE_PX
    const dmg = trait.mechanics.landingDamage ?? 0
    const stunMs = trait.mechanics.stunDurationMs

    if (trait.mechanics.wavePushTiles) {
      // Riptide: push all player units back, then wave damage to all
      const pushPx = trait.mechanics.wavePushTiles * TRAIT_TILE_PX
      const waveDmg = trait.mechanics.waveDamage ?? 0
      const resolveText = trait.surfaceText ?? trait.landText
      if (resolveText) log.push(resolveText)
      for (const u of s.field) {
        if (u.owner !== 'player' || u.hp <= 0) continue
        if (u.moveSpeed > 0) u.x = Math.max(PLAYER_SPAWN_X, u.x - pushPx)
        if (waveDmg > 0) u.hp = Math.max(0, u.hp - waveDmg)
      }
      log.push(`Your units are pushed back and take ${waveDmg} damage!`)
    } else if (dmg > 0 || stunMs) {
      // Standard radius AOE with optional stun
      applyTraitAOE(s.field, lx, ly, radiusPx, dmg, stunMs, log, trait.landText ?? trait.surfaceText)
      // For silence/stun with very large radius (covers whole field) also stun units outside radius
      if (stunMs && radiusPx >= LANE_WIDTH) {
        for (const u of s.field) {
          if (u.owner !== 'player' || u.hp <= 0) continue
          u.stunTimer = stunMs
          u.attackTimer = Math.max(u.attackTimer, stunMs)
        }
      }
    } else {
      // No-damage landing (e.g. pure silence from Archivist)
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
    if (
      s.gameTime >= interval &&
      s.gameTime - ts.lastTraitFireMs >= interval &&
      ts.landingAtMs === undefined
    ) {
      ts.lastTraitFireMs = s.gameTime

      if (trait.type === 'column_aoe') {
        const dmg = trait.mechanics.pulseDamage ?? 6
        const colX = 90 + Math.random() * 320
        const bandWidth = 25
        const slowMs = trait.mechanics.slowDurationMs ?? 4000
        log.push(trait.announceText)
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
        // Periodic burrow/fly/jump — launch the invulnerable sequence
        fireInvulnerableLaunch(s, trait, ts, log)
      }
    }
    return
  }

  // ── HP threshold traits ───────────────────────────────────
  const hpPct = (s.opponentBase.hp / s.opponentBase.maxHp) * 100

  if (trait.trigger === 'hp_pct' && trait.triggerHpPct !== undefined) {
    if (hpPct <= trait.triggerHpPct && !ts.firedThresholds.includes(trait.triggerHpPct)) {
      ts.firedThresholds.push(trait.triggerHpPct)
      if (trait.type === 'split') {
        fireSplitTrait(s, trait, log)
      } else {
        fireInvulnerableLaunch(s, trait, ts, log)
      }
    }
  }

  if (trait.trigger === 'hp_pct_multi' && trait.triggerHpPcts) {
    for (const threshold of trait.triggerHpPcts) {
      if (hpPct <= threshold && !ts.firedThresholds.includes(threshold) && ts.landingAtMs === undefined) {
        ts.firedThresholds.push(threshold)
        fireInvulnerableLaunch(s, trait, ts, log)
        break  // only one threshold fires per tick
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

// ─── Battle Events ────────────────────────────────────────

function triggerBattleEvent(s: GameState, log: string[]): void {
  const roll = Math.random()
  let event: BattleEventState

  if (roll < 0.25) {
    // Blood Moon: all attacks deal double damage for 15s
    event = { type: 'bloodMoon', label: '🌑 BLOOD MOON! Double damage for 15s!', remainingMs: 15000 }
  } else if (roll < 0.5) {
    // Fog of War: all units move at half speed for 12s
    event = { type: 'fogOfWar', label: '🌫 FOG OF WAR! Movement halved for 12s!', remainingMs: 12000 }
  } else if (roll < 0.75) {
    // Supply Drop: both sides gain +3 mana instantly
    const bonus = 3
    s.mana = Math.min(s.maxMana, s.mana + bonus)
    const oppBonus = Math.min(10, BASE_MAX_MANA + getManaBonus(s.field, 'opponent'))
    void oppBonus  // opponent mana is virtual per-turn; just note the event
    event = { type: 'supplyDrop', label: `📦 SUPPLY DROP! Both sides gain +${bonus} mana!`, remainingMs: 3000 }
    log.push(`Supply Drop! You gained +${bonus} mana.`)
  } else {
    // Earthquake: all walls take 20 damage
    const dmg = 20
    for (const u of s.field) {
      if (!u.isWall) continue
      // Don't damage player-owned walls in dev no-damage mode
      if (u.owner === 'player' && isNoDamageMode()) continue
      u.hp = Math.max(0, u.hp - dmg)
    }
    for (const u of s.field) {
      if (u.hp <= 0 && u.moveSpeed > 0 && !u.isWall) {
        if (u.owner === 'opponent') s.battleStats.playerKills++
        else                        s.battleStats.playerUnitsLost++
      }
    }
    s.field = s.field.filter(u => u.hp > 0)
    event = { type: 'earthquake', label: `🌋 EARTHQUAKE! All walls took ${dmg} damage!`, remainingMs: 3000 }
    log.push(`Earthquake! All walls shook for ${dmg} damage!`)
  }

  s.activeBattleEvent = event
  log.push(event.label)
}

// ─── Tick (called every ~100 ms) ─────────────────────────

export function tick(state: GameState, deltaMs: number): GameState {
  if (state.phase.type !== 'playing') return state

  const s = structuredClone(state)
  const log: string[] = []

  s.gameTime += deltaMs

  // 1. Mana regen
  const manaBonus = getManaBonus(s.field, 'player')
  s.maxMana = Math.min(10, BASE_MAX_MANA + manaBonus + (s.relicManaBonus ?? 0))

  if (s.mana < s.maxMana) {
    const speedMult = 1 + getManaSpeedMult(s.field, 'player')
    s.manaAccum += (deltaMs / MANA_REGEN_MS) * speedMult
    while (s.manaAccum >= 1 && s.mana < s.maxMana) {
      s.mana++
      s.manaAccum -= 1
    }
    if (s.mana >= s.maxMana) s.manaAccum = 0
  }

  // 1b. Spore Bloom relic — heal all player units 1 HP every 3s
  if (s.relicSporeBloom) {
    s.relicSporeBloomTimer = (s.relicSporeBloomTimer ?? 3000) - deltaMs
    if (s.relicSporeBloomTimer <= 0) {
      for (const u of s.field) {
        if (u.owner === 'player' && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + 1)
      }
      s.relicSporeBloomTimer += 3000
    }
  }

  // 2. Move all units
  moveUnits(s, deltaMs)

  // 3b. Update affinity states (proximity buffs)
  processAffinities(s.field)

  // 4. Process per-unit attacks
  processAttacks(s, deltaMs, log)
  if (checkGameOver(s)) {
    s.log = [...s.log, ...log]
    return s
  }

  // 5. Tick spawn-grow timers, death/damage animation timers, climb flag, spawner/aura buildings
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
      unit.climbing = s.field.some(w =>
        w.isWall && w.owner !== unit.owner && w.hp > 0 &&
        Math.abs(unit.x - w.x) <= 30
      )
    }
    const sEffect = unit.structureEffect
    if (unit.spawnTimer == null || !sEffect) continue
    if (sEffect.type !== 'spawn' && sEffect.type !== 'healAura' && sEffect.type !== 'repairAura') continue
    unit.spawnTimer -= deltaMs
    if (unit.spawnTimer <= 0) {
      if (sEffect.type === 'spawn') {
        const effect = sEffect as { type: 'spawn'; unitTemplate: UnitTemplate; intervalMs: number }
        const spawned = spawnUnit(effect.unitTemplate, unit.owner)
        spawned.x = unit.x
        spawned.y = unit.y
        spawned.spawnGrowTimer = SPAWN_GROW_MS
        s.field.push(spawned)
        const who = unit.owner === 'player' ? 'Your' : 'Enemy'
        log.push(`${who} ${unit.name} spawned a ${spawned.name}!`)
        unit.spawnTimer = effect.intervalMs
      } else if (sEffect.type === 'healAura') {
        const { amount, intervalMs } = sEffect as { type: 'healAura'; amount: number; intervalMs: number }
        const targets = s.field.filter(u => u.owner === unit.owner && u.moveSpeed > 0 && u.hp < u.maxHp)
        for (const t of targets) t.hp = Math.min(t.maxHp, t.hp + amount)
        if (targets.length > 0) {
          const who = unit.owner === 'player' ? 'Your' : 'Enemy'
          log.push(`${who} ${unit.name} healed ${targets.length} unit(s) for ${amount} HP.`)
        }
        unit.spawnTimer = intervalMs
      } else if (sEffect.type === 'repairAura') {
        const { amount, intervalMs } = sEffect as { type: 'repairAura'; amount: number; intervalMs: number }
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

  // 6. Opponent timer
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

  // 6b. Boss trait tick
  if (s.bossAI && s.bossTraitState) {
    tickBossTrait(s, log)
    if (checkGameOver(s)) {
      s.log = [...s.log, ...log]
      return s
    }
  }

  // 7. Battle events
  if (s.activeBattleEvent) {
    s.activeBattleEvent.remainingMs -= deltaMs
    if (s.activeBattleEvent.remainingMs <= 0) s.activeBattleEvent = null
  }
  s.battleEventTimer -= deltaMs
  if (s.battleEventTimer <= 0) {
    triggerBattleEvent(s, log)
    s.battleEventTimer = 24000 + Math.random() * 8000
  }

  // 8. Purge expired animation events and fully-faded blood pools
  s.animEvents = s.animEvents.filter(e => e.expiresAt > s.gameTime)
  s.bloodPools = s.bloodPools.filter(p => p.fadingAt === undefined || s.gameTime - p.fadingAt <= BLOOD_POOL_FADE_MS)

  // 9. Endless mode: reshuffle cards when deck + hand empty; handle wave progression
  if (s.endlessMode) {
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
        // Opponent difficulty params
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
        // Player state
        playerBaseHp: s.playerBase.hp,
        playerBaseMaxHp: s.playerBase.maxHp,
        playerHandSize: s.playerHand.length,
        playerDeckSize: s.playerDeck.length,
        playerHand: s.playerHand.map(c => `${c.name}(${c.cost})`),
        playerScore: s.playerScore,
        mana: s.mana,
        maxMana: s.maxMana,
        // Field
        playerUnitsOnField: s.field.filter(u => u.owner === 'player' && u.hp > 0).length,
        opponentUnitsOnField: s.field.filter(u => u.owner === 'opponent' && u.hp > 0).length,
      }))
    } catch { /* ignore */ }

    // Infinite card draw: reshuffle template when deck runs out; assign fresh IDs to avoid key duplication
    if (s.playerDeck.length === 0 && s.playerHand.length < 4) {
      const fresh = shuffle((s.endlessPlayerDeckTemplate ?? []).map(c => ({ ...c, id: recycleCardId() })))
      s.playerDeck.push(...fresh)
    }
    if (s.opponentDeck.length === 0 && s.opponentHand.length < 4) {
      const fresh = shuffle((s.endlessOpponentDeckTemplate ?? []).map(c => ({ ...c, id: recycleCardId() })))
      s.opponentDeck.push(...fresh)
    }
    // Draw up to 4 each
    while (s.playerHand.length < 4 && s.playerDeck.length > 0) drawCard(s.playerDeck, s.playerHand)
    while (s.opponentHand.length < 4 && s.opponentDeck.length > 0) drawCard(s.opponentDeck, s.opponentHand)
  }
  // 10. Sudden death — suppressed in endless mode (death only by base reaching 0)
  else if (s.bossCardActive) { /* skip sudden death */ }
  else if (!s.suddenDeath) {
    const oppMaxMana = Math.min(10, BASE_MAX_MANA + getManaBonus(s.field, 'opponent'))
    const allExhausted =
      s.playerDeck.length === 0 && s.opponentDeck.length === 0 &&
      s.playerHand.every(c => c.cost > s.maxMana) &&
      s.opponentHand.every(c => c.cost > oppMaxMana)
    const timeExpired = s.gameTime >= SUDDEN_DEATH_FORCE_MS
    if (allExhausted || timeExpired) {
      s.suddenDeath = true
      s.suddenDeathTimer = SUDDEN_DEATH_MS
      s.suddenDeathBuildingTimer = SUDDEN_DEATH_BUILDING_INTERVAL_MS
      log.push('⚡ SUDDEN DEATH! 60s remain — buildings crumble, highest score wins!')
    }
  } else {
    s.suddenDeathTimer -= deltaMs
    if (s.suddenDeathTimer <= 0) {
      const winner = s.playerScore > s.opponentScore ? 'player'
        : s.opponentScore > s.playerScore ? 'opponent'
        : 'draw'
      s.phase = { type: 'gameOver', winner }
      s.log = [...s.log, ...log]
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

  if (log.length > 0) s.log = [...s.log, ...log]
  return s
}
