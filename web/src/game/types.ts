// ─── Relic Engine Hook Effects ────────────────────────────

/** Periodic effect applied each engine tick (e.g. heal all player units every N ms). */
export type TickEffect = {
  type: 'healPlayerUnits'
  amount: number
  intervalMs: number
  timer: number
}

/** Effect applied each time the player plays a card. */
export type OnCardPlayedEffect = {
  attackBonus: number
}

// ─── Structure & Upgrade Effects ─────────────────────────

export type StructureEffect =
  | { type: 'mana'; amount: number }
  | { type: 'spawn'; unitTemplate: UnitTemplate; intervalMs: number }
  | { type: 'manaSpeed'; speedMult: number }
  | { type: 'healAura'; amount: number; intervalMs: number }
  | { type: 'repairAura'; amount: number; intervalMs: number }
  | { type: 'attackAura'; amount: number }
  | { type: 'slowZone'; slowFactor: number; radius: number; damagePerSec?: number }

export type UpgradeEffect =
  | { type: 'buffAttack'; amount: number }
  | { type: 'healUnits';  amount: number }
  | { type: 'buffSpeed';  amount: number }         // adds to moveSpeed of all mobile units
  | { type: 'buffMaxHp';  amount: number }         // increases maxHp and heals by same amount
  | { type: 'buffRange';  amount: number }         // increases attackRange of all attacking units
  | { type: 'aoe'; damage?: number; range?: number; amount?: number }  // AOE damage: range-limited or global
  | { type: 'buffHp'; amount: number }             // increases current HP of all friendly units (not maxHp)
  | { type: 'buffAttackCooldown'; amount: number } // adjusts attackCooldownMs for all friendly units (negative = faster)
  | { type: 'buffHeal'; amount: number }           // one-time heal of all friendly units

// ─── Cards ───────────────────────────────────────────────

export type CardRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'shiny' | 'holofoil' | 'glass'
/** Rarities that are secret — hidden in collections until obtained. */
export const SECRET_RARITIES: ReadonlySet<CardRarity> = new Set(['mythic', 'shiny', 'holofoil', 'glass'])
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
  /** Restricts which unit types this unit can attack. */
  targetUnitType?: 'flying' | 'hero' | 'not_flying'
  /** Proximity buff triggered when a named ally is within range. */
  affinity?: AffinityDef
  /** Hidden behavioural trait — flee, guard, or priority movement. */
  unitTrait?: UnitTrait
  /** Flavour text shown in the inspect panel. */
  lore?: string
  /** Visual size of the unit sprite on the battlefield. Defaults to 'medium'. */
  size?: 'small' | 'medium' | 'large'
  /** Secret-rarity visual tag — applied to units spawned from shiny/holofoil/glass/mythic cards. */
  cardVariant?: 'shiny' | 'holofoil' | 'glass' | 'mythic'
  /** Mastery level of this card from the player's collection (0 = unmastered). */
  masteryLevel?: number
  /** AOE explosion triggered once when this unit first drops to ≤50% HP. */
  halfHealthEffect?: { damage: number; range: number }
  /** AOE explosion triggered when this unit dies. */
  onDeathEffect?: { damage: number; range: number }
  /** Periodic forward blink — unit teleports ahead every cooldownMs ms. */
  teleportAbility?: { cooldownMs: number; distancePx: number }
  /** Periodic invisibility — unit becomes untargetable for activeMs, then enters cooldownMs cooldown. */
  invisibilityAbility?: { activeMs: number; cooldownMs: number }
  /** Blood pool consumption — unit raises a minion from a nearby blood pool every cooldownMs. */
  bloodSummonAbility?: { cooldownMs: number; minionTemplate: UnitTemplate; range: number }
  /** Elemental on-hit effect applied when this unit attacks. Auto-derived from tags when not set. */
  attackEffect?: AttackEffect
}

export type BuffTag = 'atk' | 'spd' | 'hp' | 'range'

export type UnitTag = 'flying' | 'ranged' | 'melee' | 'fast' | 'slow' | 'large' | 'magic' | 'undead' | 'beast' | 'armored' | 'siege' | 'fire' | 'swim' | 'ember' | 'frost' | 'glacier' | 'lightning' | 'poison'

/** Elemental on-hit effect applied by units with matching tags (fire→burn, frost→freeze, etc.). */
export interface AttackEffect {
  type: 'burn' | 'freeze' | 'poison' | 'shock'
  /** 0–1 probability per hit. */
  chance: number
  /** Duration in ms. */
  durationMs: number
  /** Damage per second — for burn and poison. */
  dps?: number
  /** 0–1 speed multiplier while frozen — 0 = complete stop, 0.35 = 35 % speed. */
  slowFactor?: number
}
export type TargetPriority = 'walls' | 'buildings' | 'boss' | 'ranged_first'

export interface AffinityDef {
  withName: string        // name of ally unit that triggers the affinity
  range: number           // px proximity to activate
  effectType: 'attackSpeed' | 'damage' | 'moveSpeed'
  effectAmount: number    // multiplier (e.g. 1.3 = +30%; 0.8 = −20% incoming damage)
  label: string           // e.g. "Archer's Tempo"
}

export interface UnitTrait {
  /** Tags of enemy units this unit flees from when within fleeRange px. */
  fleeFrom?: UnitTag[]
  /** Flee trigger distance in px (default 80). */
  fleeRange?: number
  /** If true: hang back near own base; only engage if an enemy comes within engageRange px. */
  guardBase?: boolean
  /** How far from own base this unit patrols when guarding (default 80 px). */
  baseGuardRange?: number
  /** Enemy proximity to own base that breaks the guard stance (default 180 px). */
  engageRange?: number
  /** Builder mode — unit moves to nearest friendly building, repairing and upgrading it. */
  builderMode?: boolean
  /** ms between builder repair/upgrade ticks (default 3000). */
  buildIntervalMs?: number
  /** HP healed to a damaged building per builder tick (default 8). */
  buildRepairAmount?: number
  /** Total number of repair/upgrade charges before entering saboteur mode (default 3). */
  buildCharges?: number
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
  /** ms remaining in kill-flash animation (brief glow when this unit lands a kill). */
  killFlashTimer?: number
  /** ms remaining stunned — unit cannot move or attack while > 0 (boss trait effect). */
  stunTimer?: number
  /** True for commander units — the base avatar that fights on the field. */
  isCommander?: boolean
  /** X position the commander is leashed to; cannot wander beyond COMMANDER_LEASH_PX from here. */
  commanderHomeX?: number
  /** Persistent random y position assigned to a guardBase unit (lazy, set on first guard tick). */
  guardY?: number
  /** ID of the enemy unit this unit is currently locked onto as an attack target. */
  targetId?: string
  /** ID of the last enemy unit that dealt damage to this unit (used for target-switch on hit). */
  lastAttackerId?: string
  /** True once the halfHealthEffect has fired — prevents re-triggering. */
  halfHealthFired?: boolean
  /** ms until next teleport blink. */
  teleportTimer?: number
  /** ms remaining invisible (> 0 = invisible; enemies cannot target this unit). */
  invisTimer?: number
  /** ms remaining in invisibility cooldown before the next active phase. */
  invisCooldownTimer?: number
  /** ms until next blood pool summon attempt. */
  bloodSummonTimer?: number
  /** ms until next builder repair/upgrade tick. */
  buildTimer?: number
  /** Remaining charges before the builder enters saboteur mode. */
  builderChargesLeft?: number
  /** True once all charges are spent — builder runs to enemy base to self-destruct. */
  builderSaboteurMode?: boolean
  /** ID of the last building the builder serviced — excluded when picking next target. */
  builderLastBuildingId?: string
  /** ms remaining burning — unit takes burnDps damage per second while > 0. */
  burnTimer?: number
  burnDps?: number
  /** ms remaining frozen — unit's move speed is multiplied by freezeSlow while > 0. */
  freezeTimer?: number
  freezeSlow?: number
  /** ms remaining poisoned — unit takes poisonDps damage per second while > 0. */
  poisonTimer?: number
  poisonDps?: number
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
  /** Secret variant type — set on dynamically-generated shiny/holofoil/glass cards. */
  variant?: 'shiny' | 'holofoil' | 'glass'
  /** Glass cards: probability (0–1) the card shatters when played (unit instantly dies). */
  glassBreakChance?: number
}

// ─── Boss Trait State ─────────────────────────────────────

export interface BossTraitState {
  /** HP percentage thresholds that have already fired (e.g. [50, 33]). */
  firedThresholds: number[]
  /** gameTime (ms) of the last periodic trait activation. */
  lastTraitFireMs: number
  /** True once a game_time_gte trait has fired (once-only guard). */
  traitFired: boolean
  /** gameTime (ms) at which the pending landing effect resolves (burrow/fly/jump). */
  landingAtMs?: number
  /** Target X coordinate for the landing effect. */
  landX?: number
  /** Target Y coordinate for the landing effect. */
  landY?: number
  /** gameTime until which the opponent base cannot take damage. */
  baseInvulnerableUntilMs: number
  /** True once a split trait has fired; win requires all fragment units dead. */
  splitActive?: boolean
  /** IDs of live split fragment units (all must die to win). */
  splitUnitIds?: string[]
}

// ─── Battle Events ────────────────────────────────────────

export type BattleEventType = 'bloodMoon' | 'fogOfWar' | 'supplyDrop' | 'earthquake'

export interface BattleEventState {
  type: BattleEventType
  label: string
  remainingMs: number        // duration; instant events use ~3000 just for banner display
}

// ─── Terrain ─────────────────────────────────────────────
// Types and constants owned by engine/terrain.ts; re-exported here for
// consumers that import from the top-level types module.

import type { TerrainObstacle as _TerrainObstacle } from './engine/terrain'
export type { TerrainType, TerrainObstacle } from './engine/terrain'
export { TERRAIN_AVOID_SHAPE } from './engine/terrain'
type TerrainObstacle = _TerrainObstacle

// ─── Game ────────────────────────────────────────────────

export interface Base {
  hp: number
  maxHp: number
}

export type GamePhase =
  | { type: 'playing' }
  | { type: 'celebration'; winner: 'player' }
  | { type: 'gameOver'; winner: 'player' | 'opponent' | 'draw' }
  | { type: 'fingerSmash'; wave: number; smashedNames: string[]; rewardDue: boolean }
  | { type: 'waveReward'; wave: number; smashedNames: string[] }

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
  suddenDeathBuildingTimer: number  // ms until next building damage tick (2 000 interval)
  battleEventTimer: number   // ms until next battle event fires
  activeBattleEvent: BattleEventState | null
  bossAI?: string            // 'thornlord' etc. — drives boss-specific opponent logic
  bossCard?: string          // card name of the phase-2 boss unit
  bossName?: string          // display name for the boss (e.g. 'The Thornlord')
  bossCardActive?: boolean   // true once the phase-2 unit has been deployed
  bossHpMultiplier?: number  // HP multiplier applied when boss card spawns (default 10)
  /** Live state for the active boss's trait system. Undefined when not in a boss fight. */
  bossTraitState?: BossTraitState
  terrain: TerrainObstacle[]
  environment?: string       // battlefield background theme ('forest' | 'ruins' | 'camp' | 'citadel' | 'ashen')
  unitReviveHp?: 'half' | 'full' | number      // pending one-time unit revive at this HP value (set by Soulstone/Salvage Hook relics)
  relicManaBonus?: number             // passive +N to maxMana cap (set by Prism Lens relic)
  playerManaRegenMs?: number          // player's upgraded mana regen interval (default 3000 ms)
  tickEffects?: TickEffect[]          // periodic effects applied each engine tick
  onCardPlayedEffects?: OnCardPlayedEffect[]  // effects applied when the player plays a card
  bossSpawnKillPct?: number           // Fraction of player units killed by boss shockwave (0.5 base, scales with run count)
  battleStats: BattleStats
  /** Transient animation events (projectiles, hit flashes). Cleared each tick after expiry. */
  animEvents: AnimEvent[]
  /** Persistent blood pool stains left by fallen units. FIFO-capped at 25; older pools fade out. */
  bloodPools: Array<{ id: string; x: number; y: number; fadingAt?: number }>
  /** True when running in Endless Mode (wave survival). */
  endlessMode?: boolean
  /** Current wave number in Endless Mode (starts at 1). */
  endlessWave?: number
  /** Survival time in ms (Endless Mode only). */
  endlessSurvivalMs?: number
  /** Cached player deck template for infinite card draw. */
  endlessPlayerDeckTemplate?: Card[]
  /** Cached opponent deck template for wave respawning. */
  endlessOpponentDeckTemplate?: Card[]
  /** Remaining ms of wave-start truce (opponent base invulnerable while > 0). */
  endlessWaveTruceMs?: number
  /** Mana multiplier applied to opponent each turn; increases per wave. */
  endlessOpponentManaMult?: number
  /** Allow the player to have unlimited maximum mana. */
  forgiveManaLimit?: boolean
  /** Daily challenge: floor for maxMana equal to the highest card cost in the player's deck. */
  deckMaxMana?: number
  /** Player unit movement stance. Defaults to 'auto' (original behaviour). */
  playerStance?: 'auto' | 'attack' | 'hold' | 'defend'
  /** Rules governing stance availability; undefined = no restrictions (current behaviour). */
  stanceRules?: StanceRules
  /** gameTime ms at which the current non-auto stance auto-expires. */
  stanceActiveUntil?: number
  /** gameTime ms before which no non-auto stance can be activated (cooldown). */
  stanceCooldownUntil?: number
  /** Boss HP value at which phase 2 triggers (boss battles only — boss spawned at game start). */
  bossPhase2Hp?: number
  /** Names of secret-rare cards obtained during this game session (flushed to collection on win/end). */
  secretRaresObtained?: string[]
  /** Count of glass cards that shattered on play this session. */
  glassShatterCount?: number
}

export interface StanceRules {
  allowed: Array<'auto' | 'attack' | 'hold' | 'defend'>
  /** How long a non-auto stance lasts before auto-reverting to 'auto' (ms). Omit for no limit. */
  durationMs?: number
  /** How long the player must wait after a stance expires before activating another (ms). */
  cooldownMs?: number
}
