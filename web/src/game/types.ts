// ─── Structure & Upgrade Effects ─────────────────────────

export type StructureEffect =
  | { type: 'mana'; amount: number }
  | { type: 'spawn'; unitTemplate: UnitTemplate; intervalMs: number }
  | { type: 'manaSpeed'; speedMult: number }
  | { type: 'healAura'; amount: number; intervalMs: number }
  | { type: 'repairAura'; amount: number; intervalMs: number }
  | { type: 'attackAura'; amount: number }
  | { type: 'slowZone'; slowFactor: number; radius: number }

export type UpgradeEffect =
  | { type: 'buffAttack'; amount: number }
  | { type: 'healUnits';  amount: number }
  | { type: 'buffSpeed';  amount: number }   // adds to moveSpeed of all mobile units
  | { type: 'buffMaxHp';  amount: number }   // increases maxHp and heals by same amount
  | { type: 'buffRange';  amount: number }   // increases attackRange of all attacking units

// ─── Cards ───────────────────────────────────────────────

export type CardRarity = 'common' | 'uncommon' | 'rare' | 'legendary'
export type CardType = 'unit' | 'structure' | 'upgrade'

export interface UnitTemplate {
  name: string
  attack: number
  maxHp: number
  isWall: boolean
  /** True for moat terrain — indestructible, untargetable, slows units that cross it. */
  isMoat?: boolean
  /** True if this unit skips walls when choosing attack targets (ranged / magic). */
  bypassWall: boolean
  /** True if this unit physically flies over walls — never stopped by them. */
  flying?: boolean
  /** True if this unit can scale walls — passes through at 25 % speed instead of stopping. */
  climber?: boolean
  moveSpeed: number          // pixels per second (0 = stationary structure)
  attackRange: number        // pixels — distance at which unit can attack
  attackCooldownMs: number   // ms between attacks
  structureEffect?: StructureEffect
  /** Descriptive tags used for strength/weakness matching. */
  tags?: UnitTag[]
  /** Tags of unit types this unit deals ×1.5 damage to. */
  strengths?: UnitTag[]
  /** Tags of unit types that deal ×1.5 damage to this unit. */
  weaknesses?: UnitTag[]
  /** Biases target selection away from default nearest-enemy behaviour. */
  targetPriority?: TargetPriority
  /** Proximity buff triggered when a named ally is within range. */
  affinity?: AffinityDef
  /** Flavour text shown in the inspect panel. */
  lore?: string
  /** Mastery level of this card from the player's collection (0 = unmastered). */
  masteryLevel?: number
}

export type BuffTag = 'atk' | 'spd' | 'hp' | 'range'

export type UnitTag = 'flying' | 'ranged' | 'melee' | 'fast' | 'slow' | 'large' | 'magic' | 'undead' | 'beast' | 'armored' | 'siege' | 'fire'
export type TargetPriority = 'walls' | 'buildings' | 'boss' | 'ranged_first'

export interface AffinityDef {
  withName: string        // name of ally unit that triggers the affinity
  range: number           // px proximity to activate
  effectType: 'attackSpeed' | 'damage' | 'moveSpeed'
  effectAmount: number    // multiplier (e.g. 1.3 = +30%; 0.8 = −20% incoming damage)
  label: string           // e.g. "Archer's Tempo"
}

export interface Unit extends UnitTemplate {
  id: string
  owner: 'player' | 'opponent'
  hp: number
  x: number                  // forward axis: 0=player base, LANE_WIDTH=opponent base
  y: number                  // lateral axis: one of [-80,-40,0,40,80] (5 lanes, continuous during movement)
  attackTimer: number        // ms until this unit can attack again
  spawnTimer?: number        // ms until next spawn (spawner buildings only)
  upgradeLevel?: number      // 1 = base, 2+ = upgraded (structures only)
  spawnGrowTimer?: number    // ms remaining in grow-in animation (building spawns only)
  buffs?: BuffTag[]          // active buff tags for UI display
  isHero?: boolean           // true for units deployed from hero cards
  spriteName?: string        // sprite lookup override — hero units retain their base unit's sprite name
  affinityActive?: boolean   // runtime: affinity buff currently in effect
  /** True while unit is passing through an enemy wall zone (enables climb animation). */
  climbing?: boolean
  /** ms remaining in death animation — unit lingers on field while > 0. */
  dyingTimer?: number
  /** ms remaining in damage-flash animation. */
  damageFlashTimer?: number
}

// ─── Animation Events ─────────────────────────────────────

export type AnimEventKind = 'projectile' | 'hit'

export interface AnimEvent {
  id: string
  kind: AnimEventKind
  /** ID of the unit that originated this event (used to align with visual jitter). */
  fromUnitId?: string
  /** Game-coordinate origin of the event. */
  fromX: number
  fromY: number
  /** Game-coordinate destination (projectiles travel toward this). */
  toX: number
  toY: number
  /** Absolute game-time (ms) when this event expires and should be removed. */
  expiresAt: number
}

export interface Card {
  id: string
  name: string
  rarity: CardRarity
  cost: number
  cardType: CardType
  unit?: UnitTemplate
  upgradeEffect?: UpgradeEffect
  description: string
  lore?: string              // flavour text shown in the card detail view
  isHero?: boolean           // hero cards deploy a unit AND trigger a heroEffect buff
  heroEffect?: UpgradeEffect // the permanent buff applied to all friendly units when played
}

// ─── Battle Events ────────────────────────────────────────

export type BattleEventType = 'bloodMoon' | 'fogOfWar' | 'supplyDrop' | 'earthquake'

export interface BattleEventState {
  type: BattleEventType
  label: string
  remainingMs: number        // duration; instant events use ~3000 just for banner display
}

// ─── Terrain ─────────────────────────────────────────────

export type TerrainType = 'rock' | 'tree' | 'water' | 'ruin'

/**
 * Per-type avoidance ellipse multipliers (applied to obs.radius).
 * fx = forward axis (game x, maps to screen vertical).
 * fy = lateral axis (game y, maps to screen horizontal).
 * Derived from each SVG's width/height ratios so the avoidance shape
 * matches the visual: pine trees are tall+narrow, water pools are wide, etc.
 */
export const TERRAIN_AVOID_SHAPE: Record<TerrainType, { fx: number; fy: number }> = {
  rock:  { fx: 1.1, fy: 0.9 },  // mountain peaks: slightly taller than wide
  tree:  { fx: 1.3, fy: 0.5 },  // pine/fruit/blob trees: tall, narrow trunk
  water: { fx: 0.6, fy: 1.5 },  // pond: wide and flat
  ruin:  { fx: 1.0, fy: 0.9 },  // ruins/farmhouse/watchtower: roughly square
}

export interface TerrainObstacle {
  id: string
  type: TerrainType
  x: number      // forward axis (same coords as units); kept 80–420
  y: number      // lateral axis; –75 to 75
  radius: number // base avoidance radius in game units, 12–22
}

// ─── Game ────────────────────────────────────────────────

export interface Base {
  hp: number
  maxHp: number
}

export type GamePhase =
  | { type: 'playing' }
  | { type: 'gameOver'; winner: 'player' | 'opponent' | 'draw' }

export const LANE_WIDTH = 500

/** In endless mode, player structures may not be placed beyond this forward x-coordinate (3 rows from base). */
export const ENDLESS_STRUCTURE_MAX_X = 60

export type OpponentStrategy = 'swarm' | 'turtle' | 'rush'

export interface BattleStats {
  cardsPlayed: Record<string, number>  // card name → times played this battle
  playerKills: number                   // opponent mobile units destroyed
  playerUnitsLost: number              // player mobile units destroyed
}

export interface GameState {
  playerBase: Base
  opponentBase: Base
  field: Unit[]
  playerHand: Card[]
  playerDeck: Card[]
  opponentHand: Card[]
  opponentDeck: Card[]
  mana: number
  maxMana: number
  manaAccum: number          // fractional mana toward next point (0–1)
  log: string[]
  phase: GamePhase
  opponentTimer: number      // ms until opponent next acts
  opponentIntervalMs: number // ms between opponent turns (scales with difficulty)
  opponentStrategy: OpponentStrategy
  gameTime: number           // total elapsed game time in ms
  playerScore: number        // cumulative damage dealt to opponent
  opponentScore: number      // cumulative damage dealt to player
  suddenDeath: boolean       // true once all cards exhausted
  suddenDeathTimer: number   // ms remaining in sudden death (60 000 at start)
  battleEventTimer: number   // ms until next battle event fires
  activeBattleEvent: BattleEventState | null
  bossAI?: string            // 'thornlord' etc. — drives boss-specific opponent logic
  bossCard?: string          // card name of the phase-2 boss unit
  bossName?: string          // display name for the boss (e.g. 'The Thornlord')
  bossCardActive?: boolean   // true once the phase-2 unit has been deployed
  bossHpMultiplier?: number  // HP multiplier applied when boss card spawns (default 10)
  terrain: TerrainObstacle[]
  environment?: string       // battlefield background theme ('forest' | 'ruins' | 'camp' | 'citadel' | 'ashen')
  soulstoneReviveAvailable?: boolean  // Soulstone relic: one unit auto-revives per battle
  relicManaBonus?: number             // Prism Lens relic: +N to maxMana cap
  battleStats: BattleStats
  /** Transient animation events (projectiles, hit flashes). Cleared each tick after expiry. */
  animEvents: AnimEvent[]
  /** True when running in Endless Mode (wave survival). */
  endlessMode?: boolean
  /** Current wave number in Endless Mode (starts at 1). */
  endlessWave?: number
  /** Survival time in ms (Endless Mode only). */
  endlessSurvivalMs?: number
  /** Cached opponent deck template for wave respawning. */
  endlessOpponentDeckTemplate?: Card[]
}
