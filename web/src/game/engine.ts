import { GameState, Card, Unit, UnitTemplate, UpgradeEffect, CardRarity, LANE_WIDTH, BattleEventState, TerrainObstacle, TerrainType, BuffTag, TERRAIN_AVOID_SHAPE } from './types'
import { makeDeck, makeThorlordDeck, makeKraggDeck, makeAshwalkerDeck, makeNodeDeck, HERO_CARDS, getCardUnit } from './cards'
import { playUnitDeath, playBuildingDestroyed } from './sound'
import { isNoDamageMode } from './debug'

// ─── Constants ────────────────────────────────────────────

const OPPONENT_INTERVAL_MS = 6000
const MANA_REGEN_MS = 3000       // 1 mana every 3 seconds
const BASE_MAX_MANA = 5
const SUDDEN_DEATH_MS = 60000
const BATTLE_EVENT_BASE_MS = 30000  // first event after 30s, then every 24-32s
const SPAWN_GROW_MS = 1500           // building-spawn grow-in animation duration

const PLAYER_SPAWN_X = 30        // where player units appear
const OPPONENT_SPAWN_X = LANE_WIDTH - 30  // where opponent units appear
const BASE_STOP_MARGIN = 0       // units may reach the base character position exactly

// ─── Helpers ─────────────────────────────────────────────

let _unitId = 0
function uid(): string { return `unit-${++_unitId}` }

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
}

export function newGame(
  playerCardsOrOpts?: Card[] | NewGameOptions,
  opponentHandicap = 0,
  bossAI?: string,
): GameState {
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
    terrainSeed,
    environment,
    opponentIntervalMs: intervalOverride,
    opponentBaseHp: hpOverride,
  } = opts

  const playerDeck = shuffle(playerCards ?? makeDeck())
  const clamp = Math.min(Math.max(0, handicap), MAX_HANDICAP)

  // Build opponent deck: boss AI > preset node deck > handicap-filtered random
  let opponentDeck: Card[]
  if (boss === 'thornlord') {
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
  const oppIntervalMs = intervalOverride
    ?? (boss === 'thornlord'  ? 5000
    :   boss === 'kragg'      ? 5000
    :   boss === 'ashwalker'  ? 4500
    :   boss === 'archivist'  ? 5000
    :   opponentIntervalForHandicap(clamp))

  const diffLabel =
    maxRarity === 'common'    ? 'common-only' :
    maxRarity === 'uncommon'  ? 'no rares/legendaries' :
    maxRarity === 'rare'      ? 'no legendaries' :
    'full strength'

  const openingLog: string[] =
    boss === 'thornlord'  ? ['THE THORNLORD awakens! Ancient guardian of the Verdant Shard.', 'Walls of bark and root rise from the earth — prepare for a siege!']
    : boss === 'kragg'    ? ['WARLORD KRAGG takes the field! Iron discipline, iron walls, iron will.', 'The siege weapons are already loaded. The gate does not open for you.']
    : boss === 'ashwalker' ? ['THE ASHWALKER stirs. The ash rises. The dead remember.', 'An undying horde answers the call — destroy them before they overwhelm you!']
    : boss === 'archivist' ? ['THE ARCHIVIST opens the archive. Every spell in the Dominion catalogue — ready.', 'Arcane constructs flood the field. At turn eight, his mana becomes limitless — act fast!']
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
    opponentTimer: oppIntervalMs,
    opponentIntervalMs: oppIntervalMs,
    opponentStrategy: strategy,
    gameTime: 0,
    playerScore: 0,
    opponentScore: 0,
    suddenDeath: false,
    suddenDeathTimer: 0,
    battleEventTimer: BATTLE_EVENT_BASE_MS,
    activeBattleEvent: null,
    bossAI: boss,
    bossCard,
    bossName,
    bossCardActive: false,
    bossHpMultiplier: bossHpMultiplier ?? (bossCard ? 10 : undefined),
    terrain: generateTerrain(terrainSeed, environment),
    environment,
    battleStats: { cardsPlayed: {}, playerKills: 0, playerUnitsLost: 0 },
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
    // If playing a structure and one of the same type already exists, upgrade it instead
    if (card.cardType === 'structure') {
      const template = card.unit!
      const existing = s.field.find(u => u.owner === owner && u.name === template.name)
      if (existing) {
        existing.maxHp *= 2
        existing.hp = Math.min(existing.hp * 2, existing.maxHp)
        existing.upgradeLevel = (existing.upgradeLevel ?? 1) + 1
        let note = 'HP×2'
        if (existing.structureEffect?.type === 'spawn') {
          const spawnEffect = existing.structureEffect as { type: 'spawn'; unitTemplate: UnitTemplate; intervalMs: number }
          spawnEffect.intervalMs = Math.max(3000, Math.floor(spawnEffect.intervalMs / 2))
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
    const unit = spawnUnit(card.unit!, owner)
    if (card.lore) unit.lore = card.lore
    // Hero units use the card's display name but keep the base unit sprite
    if (card.isHero) {
      unit.spriteName = unit.name   // preserve original name for sprite lookup
      unit.name = card.name
      unit.isHero = true
    }
    // Assign a stable lateral slot to non-wall structures so that units
    // spawned from them start at the same horizontal position.
    if (card.cardType === 'structure' && !card.unit!.isWall) {
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

function moveUnits(s: GameState, deltaMs: number): void {
  const deltaSec = deltaMs / 1000

  for (const unit of s.field) {
    if (unit.moveSpeed === 0) continue
    if (unit.spawnGrowTimer != null && unit.spawnGrowTimer > 0) continue

    const nearestAhead = findNearestEnemy(s.field, unit)

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
      // Respect developer no-damage mode for player-owned targets
      if (target.owner === 'player' && isNoDamageMode()) {
        log.push(`${unit.name} would damage ${target.name} (dev mode — no damage)`)
      } else {
        target.hp -= dmg
        const actualDamage = prevHp - Math.max(0, target.hp)
        if (isPlayer) s.playerScore += actualDamage
        else s.opponentScore += actualDamage
        if (target.hp <= 0) {
          log.push(`${unit.name} destroyed ${target.name}!`)
          if (target.moveSpeed === 0) playBuildingDestroyed()
          else playUnitDeath()
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
          const prev = s.opponentBase.hp
          s.opponentBase.hp = Math.max(0, s.opponentBase.hp - dmg)
          s.playerScore += prev - s.opponentBase.hp
          log.push(`${unit.name} hits Enemy Base! -${dmg}HP`)
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
  s.field = s.field.filter(u => u.hp > 0 || u.isMoat)
}

// ─── Game Over Check ──────────────────────────────────────

const VICTORY_BONUS = 500

function checkGameOver(s: GameState): boolean {
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
  let mana = Math.min(10, BASE_MAX_MANA + manaBonus)

  const strategy = s.opponentStrategy
  const maxPlays = strategy === 'swarm' ? 3 : 2

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
    // Others have a random early-stop chance
    if (played === 1 && Math.random() > 0.5) break
  }

  if (played === 0) log.push('Opponent holds.')
}

// ─── Thornlord Boss AI ───────────────────────────────────
//
// Priority order each turn:
//   1. Stone Wall (walls every turn is the theme)
//   2. Spawn-structure (Barracks, Crypt, etc.)
//   3. Mana structure (Farm)
//   4. Cheapest available unit
//   5. Any upgrade
// Plays up to 3 cards per turn; uses a 6s interval (set in newGame).

function thornlordAI(s: GameState, log: string[]): void {
  const manaBonus = getManaBonus(s.field, 'opponent')
  let mana = Math.min(10, BASE_MAX_MANA + manaBonus)

  function tryPlay(): boolean {
    const hand = s.opponentHand.filter(c => c.cost <= mana && isPlayable(c, s.gameTime))
    if (hand.length === 0) return false

    // Priority 1: walls
    const walls = hand.filter(c => c.cardType === 'structure' && c.unit?.isWall)
    // Priority 2: spawner structures
    const spawners = hand.filter(c => c.cardType === 'structure' && c.unit?.structureEffect?.type === 'spawn')
    // Priority 3: mana structures
    const manaStructs = hand.filter(c => c.cardType === 'structure' && c.unit?.structureEffect?.type === 'mana')
    // Priority 4: units (cheapest)
    const units = hand.filter(c => c.cardType === 'unit').sort((a, b) => a.cost - b.cost)
    // Priority 5: upgrades
    const upgrades = hand.filter(c => c.cardType === 'upgrade')

    const pick = (walls[0] ?? spawners[0] ?? manaStructs[0] ?? units[0] ?? upgrades[0])
    if (!pick) return false

    s.opponentHand.splice(s.opponentHand.indexOf(pick), 1)
    mana -= pick.cost
    deployCard(s, pick, 'opponent', log)
    drawCard(s.opponentDeck, s.opponentHand)
    return true
  }

  let played = 0
  while (played < 3 && tryPlay()) played++

  if (played === 0) log.push('The Thornlord is still…')
}

// ─── Kragg AI ─────────────────────────────────────────────
// Warlord Kragg: siege-weapon heavy. Prioritises Catapults and Ballistae,
// keeps walls up, then floods with infantry. Plays up to 3 cards per turn.
// Uses a 5s interval (faster than Thornlord but with heavier individual cards).

function kraggAI(s: GameState, log: string[]): void {
  const manaBonus = getManaBonus(s.field, 'opponent')
  let mana = Math.min(10, BASE_MAX_MANA + manaBonus)

  function tryPlay(): boolean {
    const hand = s.opponentHand.filter(c => c.cost <= mana && isPlayable(c, s.gameTime))
    if (hand.length === 0) return false

    // Priority 1: siege weapons (Catapult, Ballista, Siege Works)
    const siege = hand.filter(c => c.cardType === 'structure' && !c.unit?.isWall &&
      ['Catapult', 'Ballista', 'Siege Works'].includes(c.name))
    // Priority 2: walls
    const walls = hand.filter(c => c.unit?.isWall)
    // Priority 3: upgrades (War Drums / Fortify)
    const upgrades = hand.filter(c => c.cardType === 'upgrade')
    // Priority 4: heavy melee (Knight, Shield Guard)
    const heavy = hand.filter(c => c.cardType === 'unit' && !c.unit?.isWall)
      .sort((a, b) => b.cost - a.cost)

    const pick = siege[0] ?? walls[0] ?? upgrades[0] ?? heavy[0]
    if (!pick) return false

    s.opponentHand.splice(s.opponentHand.indexOf(pick), 1)
    mana -= pick.cost
    deployCard(s, pick, 'opponent', log)
    drawCard(s.opponentDeck, s.opponentHand)
    return true
  }

  let played = 0
  while (played < 3 && tryPlay()) played++

  if (played === 0) log.push('Kragg waits behind the wall…')
}

// ─── Ashwalker AI ─────────────────────────────────────────
// The Ashwalker: undead swarm with sacrificial surges. Floods cheap skeletons
// every turn; occasionally dumps burst damage via Bloodlust on a full field.
// Uses a 4.5s interval — fast and aggressive.

function ashwalkerAI(s: GameState, log: string[]): void {
  const manaBonus = getManaBonus(s.field, 'opponent')
  let mana = Math.min(10, BASE_MAX_MANA + manaBonus)

  function tryPlay(): boolean {
    const hand = s.opponentHand.filter(c => c.cost <= mana && isPlayable(c, s.gameTime))
    if (hand.length === 0) return false

    const oppUnits = s.field.filter(u => u.owner === 'opponent' && !u.isWall)

    // Priority 1: Bloodlust upgrade when 3+ units on field (sacrifice surge)
    if (oppUnits.length >= 3) {
      const bloodlust = hand.find(c => c.name === 'Bloodlust')
      if (bloodlust) {
        s.opponentHand.splice(s.opponentHand.indexOf(bloodlust), 1)
        mana -= bloodlust.cost
        deployCard(s, bloodlust, 'opponent', log)
        drawCard(s.opponentDeck, s.opponentHand)
        return true
      }
    }
    // Priority 2: Crypt / Dark Shrine spawner structures
    const spawners = hand.filter(c => c.cardType === 'structure' && c.unit?.structureEffect?.type === 'spawn')
    // Priority 3: cheapest unit (flood the field)
    const units = hand.filter(c => c.cardType === 'unit' && !c.unit?.isWall)
      .sort((a, b) => a.cost - b.cost)
    // Priority 4: other upgrades
    const upgrades = hand.filter(c => c.cardType === 'upgrade' && c.name !== 'Bloodlust')

    const pick = spawners[0] ?? units[0] ?? upgrades[0]
    if (!pick) return false

    s.opponentHand.splice(s.opponentHand.indexOf(pick), 1)
    mana -= pick.cost
    deployCard(s, pick, 'opponent', log)
    drawCard(s.opponentDeck, s.opponentHand)
    return true
  }

  let played = 0
  while (played < 3 && tryPlay()) played++

  if (played === 0) log.push('The ash stirs…')
}

// ─── Archivist AI ─────────────────────────────────────────
// The Archivist: upgrade-heavy arcane scholar. Methodical until turn 8
// (≈120s elapsed), then the archive opens — near-unlimited mana.
// Prioritises Arcane Tower / Shadow Academy structures, then upgrades,
// then mages. Plays up to 3 cards normally; after 120s plays up to 6.

function archivistAI(s: GameState, log: string[]): void {
  const manaBonus = getManaBonus(s.field, 'opponent')
  const lateGame = s.gameTime >= 120000
  // After 120s the archive is "open" — treat mana as effectively unlimited
  let mana = lateGame ? 99 : Math.min(10, BASE_MAX_MANA + manaBonus)
  const maxPlays = lateGame ? 6 : 3

  if (lateGame && s.gameTime < 121000) {
    log.push('THE ARCHIVE OPENS — The Archivist\'s mana becomes limitless!')
  }

  function tryPlay(): boolean {
    const hand = s.opponentHand.filter(c => c.cost <= mana && isPlayable(c, s.gameTime))
    if (hand.length === 0) return false

    // Priority 1: mana structures (Shadow Academy) — flood units
    const manaStructs = hand.filter(c => c.cardType === 'structure' && c.unit?.structureEffect?.type === 'spawn')
    // Priority 2: ranged tower structures (Arcane Tower, Mage Tower)
    const towers = hand.filter(c => c.cardType === 'structure' && !c.unit?.isWall && !c.unit?.structureEffect)
    // Priority 3: upgrades (buff the whole field)
    const upgrades = hand.filter(c => c.cardType === 'upgrade').sort((a, b) => b.cost - a.cost)
    // Priority 4: mages / arcane units (most expensive first — flood with power)
    const units = hand.filter(c => c.cardType === 'unit' && !c.unit?.isWall)
      .sort((a, b) => b.cost - a.cost)

    const pick = manaStructs[0] ?? towers[0] ?? upgrades[0] ?? units[0]
    if (!pick) return false

    s.opponentHand.splice(s.opponentHand.indexOf(pick), 1)
    mana -= pick.cost
    deployCard(s, pick, 'opponent', log)
    drawCard(s.opponentDeck, s.opponentHand)
    return true
  }

  let played = 0
  while (played < maxPlays && tryPlay()) played++

  if (played === 0) log.push('The Archivist catalogues…')
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

  // 5. Tick spawn-grow timers and spawner/aura buildings
  for (const unit of s.field) {
    if (unit.spawnGrowTimer != null && unit.spawnGrowTimer > 0) {
      unit.spawnGrowTimer = Math.max(0, unit.spawnGrowTimer - deltaMs)
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
    if (s.bossAI === 'thornlord') {
      thornlordAI(s, log)
    } else if (s.bossAI === 'kragg') {
      kraggAI(s, log)
    } else if (s.bossAI === 'ashwalker') {
      ashwalkerAI(s, log)
    } else if (s.bossAI === 'archivist') {
      archivistAI(s, log)
    } else {
      opponentAI(s, log)
    }
    s.opponentTimer = s.opponentIntervalMs
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

  // 9. Sudden death — trigger when all cards have been drawn and played
  // Suppress during phase 2: boss unit death determines the winner
  if (s.bossCardActive) { /* skip sudden death */ }
  else if (!s.suddenDeath) {
    const allExhausted =
      s.playerDeck.length === 0 && s.playerHand.length === 0 &&
      s.opponentDeck.length === 0 && s.opponentHand.length === 0
    if (allExhausted) {
      s.suddenDeath = true
      s.suddenDeathTimer = SUDDEN_DEATH_MS
      log.push('⚡ SUDDEN DEATH! 60s remain — highest score wins!')
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
  }

  if (log.length > 0) s.log = [...s.log, ...log]
  return s
}
