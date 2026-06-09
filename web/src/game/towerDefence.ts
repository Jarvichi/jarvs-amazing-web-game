// ─── Tower Defence — pure game logic ──────────────────────────────────────────
// No React imports. All state is plain objects; tick() returns a new state.

import { UnitTemplate, UnitTag, ProjectileType, getProjectileType } from './types'

// ── Grid ──────────────────────────────────────────────────────────────────────

export const TD_COLS = 7
export const TD_ROWS = 13

export type GridPos = { col: number; row: number }

// Portrait path: enters top-left, winds down through 7×13 grid, exits bottom-right.
export const TD_PATH: GridPos[] = [
  // Right along row 0
  { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }, { col: 3, row: 0 }, { col: 4, row: 0 },{ col: 5, row: 0 },
  // Down col 5
  { col: 5, row: 1 }, { col: 5, row: 2 },
  // Left along row 2
  { col: 4, row: 2 },{ col: 3, row: 2 }, { col: 2, row: 2 }, { col: 1, row: 2 },
  // Down col 1
  { col: 1, row: 3 }, { col: 1, row: 4 }, { col: 1, row: 5 },
  // Right along row 5
  { col: 2, row: 5 }, { col: 3, row: 5 }, { col: 4, row: 5 },
  // Up col 5
  { col: 4, row: 4 },
  // Right to col 6
  { col: 5, row: 4 },
  // Down col 6
  { col: 6, row: 4 }, { col: 6, row: 5 }, { col: 6, row: 6 }, { col: 6, row: 7 },
  // Left along row 7
  { col: 5, row: 7 }, { col: 4, row: 7 }, { col: 3, row: 7 }, { col: 2, row: 7 },{ col: 1, row: 7 },
  // Down col 1
  { col: 1, row: 8 }, { col: 1, row: 9 },{ col: 1, row: 10 }, { col: 1, row: 11 },
  // Right along row 9
  { col: 2, row: 11 },{ col: 3, row:11 }, 
  // Up col 3
  { col: 3, row: 10 }, { col: 3, row: 9 }, 
  // Right along row 9
  { col: 4, row: 9 }, { col: 5, row: 9 }, { col: 6, row: 9 },
  // Down col 6
  { col: 6, row: 10 }, { col: 6, row: 11 },{ col: 6, row: 12 },
]

// Set of path cells for O(1) lookup
export const PATH_SET: Set<string> = new Set(TD_PATH.map(p => `${p.col},${p.row}`))
export function isPathCell(col: number, row: number): boolean {
  return PATH_SET.has(`${col},${row}`)
}

// ── Enemy templates ───────────────────────────────────────────────────────────

export interface TDEnemyTemplate {
  id: string
  label: string
  spriteName: string  // name passed to SpriteImg
  hp: number
  speed: number       // path-cells per second
  attack: number      // damage dealt to base on arrival
  reward: number      // gold awarded on kill (city mode) or score points
  tags: UnitTag[]
  flying?: boolean
  immunities?: string[]  // effect types this enemy ignores (burn/freeze/poison/shock/gascloud)
}

const ENEMY_TEMPLATES: Record<string, TDEnemyTemplate> = {
  footSoldier: {
    id: 'footSoldier', label: 'Foot Soldier', spriteName: 'Goblin',
    hp: 80, speed: 0.6, attack: 1, reward: 10,
    tags: ['melee'],
  },
  scout: {
    id: 'scout', label: 'Scout', spriteName: 'Archer',
    hp: 40, speed: 1.3, attack: 1, reward: 8,
    tags: ['fast', 'ranged'],
  },
  brute: {
    id: 'brute', label: 'Brute', spriteName: 'Ogre',
    hp: 280, speed: 0.35, attack: 2, reward: 25,
    tags: ['slow', 'large', 'armored'],
  },
  flyer: {
    id: 'flyer', label: 'Flyer', spriteName: 'Harpy',
    hp: 60, speed: 1.1, attack: 1, reward: 15,
    tags: ['flying', 'fast'],
    flying: true,
  },
  necromancer: {
    id: 'necromancer', label: 'Necromancer', spriteName: 'Necromancer',
    hp: 120, speed: 0.55, attack: 1, reward: 20,
    tags: ['magic', 'undead'],
  },
  siegeEngine: {
    id: 'siegeEngine', label: 'Siege Engine', spriteName: 'Ballista',
    hp: 400, speed: 0.25, attack: 3, reward: 40,
    tags: ['siege', 'slow', 'large', 'armored'],
  },
  emberCrawler: {
    id: 'emberCrawler', label: 'Ember Crawler', spriteName: 'Ember Crawler',
    hp: 90, speed: 1.0, attack: 1, reward: 18,
    tags: ['fast', 'fire'],
    immunities: ['burn'],
  },
  frostDrake: {
    id: 'frostDrake', label: 'Frost Drake', spriteName: 'Frost Drake',
    hp: 130, speed: 0.9, attack: 1, reward: 22,
    tags: ['flying', 'fast', 'frost'],
    flying: true,
    immunities: ['freeze'],
  },
  plagueRat: {
    id: 'plagueRat', label: 'Plague Rat', spriteName: 'Plague Rat',
    hp: 45, speed: 1.6, attack: 1, reward: 10,
    tags: ['fast', 'magic'],
    immunities: ['poison', 'gascloud'],
  },
  lavaTroll: {
    id: 'lavaTroll', label: 'Lava Troll', spriteName: 'Lava Troll',
    hp: 550, speed: 0.28, attack: 3, reward: 48,
    tags: ['slow', 'large', 'armored', 'fire'],
    immunities: ['burn', 'shock'],
  },
  iceWraith: {
    id: 'iceWraith', label: 'Ice Wraith', spriteName: 'Ice Wraith',
    hp: 160, speed: 0.65, attack: 2, reward: 30,
    tags: ['flying', 'magic', 'undead', 'frost'],
    flying: true,
    immunities: ['freeze'],
  },
  // ── Bosses (spawned every 10 waves, HP scales with appearance count) ─────────
  bossBehemoth: {
    id: 'bossBehemoth', label: 'Behemoth', spriteName: 'Behemoth',
    hp: 1200, speed: 0.3, attack: 5, reward: 150,
    tags: ['boss', 'slow', 'large', 'armored'],
  },
  bossCinderwarlord: {
    id: 'bossCinderwarlord', label: 'Cinderwarlord', spriteName: 'Cinderwarlord',
    hp: 1000, speed: 0.45, attack: 4, reward: 175,
    tags: ['boss', 'fire', 'large'],
    immunities: ['burn'],
  },
  bossGlacierTitan: {
    id: 'bossGlacierTitan', label: 'Glacier Titan', spriteName: 'Glacier Titan',
    hp: 1500, speed: 0.2, attack: 6, reward: 200,
    tags: ['boss', 'slow', 'large', 'armored', 'frost'],
    immunities: ['freeze'],
  },
  bossBoneColossus: {
    id: 'bossBoneColossus', label: 'Bone Colossus', spriteName: 'Bone Colossus',
    hp: 1300, speed: 0.35, attack: 5, reward: 180,
    tags: ['boss', 'large', 'undead', 'magic'],
    immunities: ['poison', 'gascloud'],
  },
}

const BOSS_ROTATION = ['bossBehemoth', 'bossCinderwarlord', 'bossGlacierTitan', 'bossBoneColossus']

// ── Wave definitions ──────────────────────────────────────────────────────────

export interface WaveSpawn {
  enemyId: string
  count: number
  intervalMs: number  // delay between each spawn in this group
  hpMult: number      // multiplier on base hp
}

export interface WaveDefinition {
  wave: number
  label: string
  spawns: WaveSpawn[]
}

export const TD_WAVES: WaveDefinition[] = [
  {
    wave: 1, label: 'Wave 1 — Skirmishers',
    spawns: [{ enemyId: 'footSoldier', count: 4, intervalMs: 1200, hpMult: 1 }],
  },
  {
    wave: 2, label: 'Wave 2 — Scouts',
    spawns: [
      { enemyId: 'footSoldier', count: 3, intervalMs: 1200, hpMult: 1 },
      { enemyId: 'scout',       count: 3, intervalMs: 800,  hpMult: 1 },
    ],
  },
  {
    wave: 3, label: 'Wave 3 — The Brute',
    spawns: [
      { enemyId: 'footSoldier', count: 5, intervalMs: 1000, hpMult: 1.1 },
      { enemyId: 'brute',       count: 1, intervalMs: 0,    hpMult: 1   },
    ],
  },
  {
    wave: 4, label: 'Wave 4 — Air Raid',
    spawns: [
      { enemyId: 'flyer',       count: 4, intervalMs: 900,  hpMult: 1.1 },
      { enemyId: 'footSoldier', count: 4, intervalMs: 1100, hpMult: 1.1 },
    ],
  },
  {
    wave: 5, label: 'Wave 5 — Dark Magic',
    spawns: [
      { enemyId: 'necromancer', count: 3, intervalMs: 1500, hpMult: 1.2 },
      { enemyId: 'scout',       count: 5, intervalMs: 700,  hpMult: 1.2 },
    ],
  },
  {
    wave: 6, label: 'Wave 6 — Heavy Push',
    spawns: [
      { enemyId: 'brute',       count: 3, intervalMs: 2000, hpMult: 1.3 },
      { enemyId: 'footSoldier', count: 6, intervalMs: 900,  hpMult: 1.3 },
    ],
  },
  {
    wave: 7, label: 'Wave 7 — Swarm',
    spawns: [
      { enemyId: 'scout',       count: 8, intervalMs: 500,  hpMult: 1.4 },
      { enemyId: 'flyer',       count: 5, intervalMs: 700,  hpMult: 1.4 },
    ],
  },
  {
    wave: 8, label: 'Wave 8 — Siege',
    spawns: [
      { enemyId: 'siegeEngine', count: 2, intervalMs: 3000, hpMult: 1   },
      { enemyId: 'footSoldier', count: 6, intervalMs: 800,  hpMult: 1.5 },
      { enemyId: 'necromancer', count: 3, intervalMs: 1200, hpMult: 1.5 },
    ],
  },
  {
    wave: 9, label: 'Wave 9 — All Forces',
    spawns: [
      { enemyId: 'brute',       count: 4, intervalMs: 1800, hpMult: 1.7 },
      { enemyId: 'flyer',       count: 6, intervalMs: 600,  hpMult: 1.7 },
      { enemyId: 'scout',       count: 8, intervalMs: 500,  hpMult: 1.7 },
    ],
  },
  {
    wave: 10, label: 'Wave 10 — Final Assault',
    spawns: [
      { enemyId: 'siegeEngine', count: 3, intervalMs: 2500, hpMult: 2   },
      { enemyId: 'brute',       count: 4, intervalMs: 1500, hpMult: 2   },
      { enemyId: 'necromancer', count: 4, intervalMs: 1000, hpMult: 2   },
      { enemyId: 'flyer',       count: 6, intervalMs: 500,  hpMult: 2   },
    ],
  },
  {
    wave: 11, label: 'Wave 11 — Embers Rise',
    spawns: [
      { enemyId: 'emberCrawler', count: 6, intervalMs: 700,  hpMult: 1 },
      { enemyId: 'footSoldier',  count: 4, intervalMs: 1000, hpMult: 2.2 },
    ],
  },
  {
    wave: 12, label: 'Wave 12 — Frozen Vanguard',
    spawns: [
      { enemyId: 'frostDrake',  count: 5, intervalMs: 800,  hpMult: 1 },
      { enemyId: 'scout',       count: 5, intervalMs: 600,  hpMult: 2.2 },
    ],
  },
  {
    wave: 13, label: 'Wave 13 — Plague Tide',
    spawns: [
      { enemyId: 'plagueRat',   count: 14, intervalMs: 400, hpMult: 1 },
      { enemyId: 'necromancer', count: 3,  intervalMs: 1200, hpMult: 2.4 },
    ],
  },
  {
    wave: 14, label: 'Wave 14 — Volcanic March',
    spawns: [
      { enemyId: 'lavaTroll',    count: 2, intervalMs: 3500, hpMult: 1 },
      { enemyId: 'emberCrawler', count: 8, intervalMs: 600,  hpMult: 1.2 },
    ],
  },
  {
    wave: 15, label: 'Wave 15 — Spectral Blizzard',
    spawns: [
      { enemyId: 'iceWraith',  count: 5, intervalMs: 900,  hpMult: 1 },
      { enemyId: 'frostDrake', count: 4, intervalMs: 700,  hpMult: 1.2 },
      { enemyId: 'brute',      count: 2, intervalMs: 2000, hpMult: 2.4 },
    ],
  },
  {
    wave: 16, label: 'Wave 16 — Elemental Tide',
    spawns: [
      { enemyId: 'emberCrawler', count: 4, intervalMs: 700,  hpMult: 1.3 },
      { enemyId: 'frostDrake',   count: 4, intervalMs: 700,  hpMult: 1.3 },
      { enemyId: 'plagueRat',    count: 8, intervalMs: 400,  hpMult: 1.3 },
      { enemyId: 'lavaTroll',    count: 2, intervalMs: 3000, hpMult: 1.3 },
    ],
  },
]

// ── Runtime types ─────────────────────────────────────────────────────────────

let _nextId = 1
function nextId() { return _nextId++ }

export type TDTargetingMode = 'first' | 'weakest' | 'strongest' | 'flying'

// Building placed by the player on a non-path cell.
export interface TDTower {
  id: number
  col: number
  row: number
  template: UnitTemplate
  buildingName: string
  upgrades: number            // total upgrades purchased (XP/cost gate)
  upgradeUnits: number        // 0–TD_MAX_UPGRADE_PER_TYPE: extra units spawned
  upgradeSpeed: number        // 0–TD_MAX_UPGRADE_PER_TYPE: attack speed bonus
  upgradeRange: number        // 0–TD_MAX_UPGRADE_PER_TYPE: range bonus (cells)
  upgradeDamage: number       // 0–TD_MAX_UPGRADE_PER_TYPE: damage bonus
  respawnTimers: number[]     // countdown (ms) for each dead unit awaiting respawn
  xp: number                  // kills earned by this tower's units; upgrade unlocks at threshold
  targetingMode: TDTargetingMode
}

// A unit spawned by a building — roams within 1 cell of the building, chases nearby enemies.
export interface TDUnit {
  id: number
  towerId: number
  template: UnitTemplate
  hp: number
  maxHp: number
  x: number
  y: number
  homeX: number           // building cell centre — unit stays within UNIT_REACH_PX of this
  homeY: number
  stationed: boolean      // true = engaged chasing an enemy, false = idle at home
  attackCooldownRemaining: number
  rangeInCells: number
  speedMult: number       // reduces attack cooldown (1 = base, 1.25 = 25% faster, etc.)
  rangeBonus: number      // extra cells of range from tower upgrades
  damageMult: number      // damage multiplier from tower upgrades
}

export interface TDEnemy {
  id: number
  template: TDEnemyTemplate
  hp: number
  maxHp: number
  pathProgress: number    // 0 = start, TD_PATH.length-1 = end
  x: number
  y: number
  unitAttackCd: number    // ms until this enemy next attacks a player unit
  speedMult: number       // 1.05^(waveIndex-10) for waves > 10
  shielded: boolean       // absorbs next hit entirely (introduced wave 30+)
  splitsOnDeath: boolean  // spawns 2 half-hp copies on death (wave 50+)
  slowsUnits: boolean     // emits aura that delays nearby unit attacks (wave 70+)
  burnTimer?: number
  burnDps?: number
  freezeTimer?: number
  freezeSlow?: number
  poisonTimer?: number
  poisonDps?: number
}

// Attack visual event — used by the UI to show projectile + hit spark
export interface TDAttackEvent {
  id: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  expiresAt: number   // game-time ms
  projectileType?: ProjectileType
  aoeRadius?: number
}

// Persistent ground hazard — gas cloud, etc.
export interface TDHazard {
  id: number
  x: number
  y: number
  radius: number
  dps: number
  expiresAt: number  // gameTimeMs when it expires
  sourceTowerId: number
}

// Global passive bonuses accumulated through milestone upgrades
export interface TDPassives {
  attackSpeedMult: number  // divides attack cooldown reset (>1 = faster)
  rangeBonus: number       // extra cells added to each unit's range
  damageMult: number       // multiplied onto damage dealt
  respawnMult: number      // divides respawn timer (>1 = faster)
}

export interface MilestoneUpgrade {
  id: string
  label: string
  description: string
}

export const ALL_MILESTONE_UPGRADES: MilestoneUpgrade[] = [
  { id: 'attack_speed', label: '⚡ Battle Rhythm',   description: 'All units attack 20% faster' },
  { id: 'range',        label: '🎯 Eagle Eye',        description: 'All units gain +1 range' },
  { id: 'damage',       label: '💥 Sharpened Blades', description: 'Units deal 15% more damage' },
  { id: 'mana',         label: '💧 Mana Spring',      description: 'Gain 100 bonus mana' },
  { id: 'life',         label: '❤️ Fortified Walls',  description: 'Gain 2 extra lives' },
  { id: 'respawn',      label: '🔄 Quick Recovery',   description: 'Units respawn twice as fast' },
]

// Pending spawn queue entry
interface SpawnEntry {
  template: TDEnemyTemplate
  hpMult: number
  speedMult: number
  shielded: boolean
  splitsOnDeath: boolean
  slowsUnits: boolean
  spawnAt: number   // game-time ms when this enemy should enter
}

export type TDPhase = 'prep' | 'wave' | 'between' | 'milestone' | 'victory' | 'defeat'

export interface TDGameState {
  phase: TDPhase
  lives: number
  mana: number
  wavesCompleted: number
  currentWaveIndex: number
  gameTimeMs: number
  towers: TDTower[]
  units: TDUnit[]
  enemies: TDEnemy[]
  spawnQueue: SpawnEntry[]
  waveSpawnTotal: number
  nextWaveAt: number
  log: string[]
  score: number
  attackEvents: TDAttackEvent[]
  hazards: TDHazard[]
  availableTemplates: UnitTemplate[]
  remainingPlacements: Record<string, number>
  mode: 'collection' | 'city'
  passives: TDPassives
  milestoneChoices: MilestoneUpgrade[] | null
  enemyKills: number   // total enemies killed this session (for augment souls)
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const TD_MAX_LIVES = 3
export const TD_TOTAL_WAVES = 100
export const TD_MILESTONE_EVERY = 5
export const TD_CELL_PX = 48
export const TD_STARTING_MANA = 120
export const TD_MAX_UNIT_UPGRADES = 3        // units type: allows up to 4 spawned units total
export const TD_MAX_UPGRADE_PER_TYPE = 2     // max levels for speed / range / damage
export const TD_MAX_UPGRADES = TD_MAX_UNIT_UPGRADES + TD_MAX_UPGRADE_PER_TYPE * 3  // = 9
export type TDUpgradeType = 'units' | 'speed' | 'range' | 'damage'
const BETWEEN_WAVE_MS = 5000
const STRENGTH_MULT = 1.5
const RESPAWN_DELAY_MS = 5000
const UNIT_WALK_SPEED_PX = TD_CELL_PX * 3   // px/sec
const UNIT_REACH_PX = TD_CELL_PX * 1.5      // max distance a unit can roam from its building

/** Mana cost to place a building based on its unit stats. */
export function towerCost(template: UnitTemplate): number {
  return Math.max(5, Math.round(template.attack * 2 + template.maxHp / 20))
}

/** Mana cost for the next upgrade purchase (scales linearly with total upgrades purchased). */
export function upgradeCost(tower: TDTower): number {
  return Math.round(towerCost(tower.template) * (tower.upgrades + 1) * 2)
}

/** Total mana spent on a tower (placement + all upgrades). */
export function totalManaSpent(tower: TDTower): number {
  const base = towerCost(tower.template)
  let total = base
  for (let i = 0; i < tower.upgrades; i++) {
    total += Math.round(base * (i + 1) * 2)
  }
  return total
}

/** Sell refund = half of all mana spent on this tower. */
export function sellRefund(tower: TDTower): number {
  return Math.floor(totalManaSpent(tower) * 0.5)
}

/** Kills required to unlock the next upgrade tier. */
export function xpToUpgrade(tower: TDTower): number {
  return Math.round(3 * Math.pow(1.5, tower.upgrades))
}

/** Number of units a building spawns at its current upgrade level. */
export function buildingUnitCount(tower: TDTower): number {
  return tower.upgradeUnits + 1
}


export function hpBarColor(frac: number): string {
  if (frac > 0.6) return '#4caf50'
  if (frac > 0.3) return '#ff9800'
  return '#f44336'
}

/**
 * Generate wave definition for any wave index 0–(TD_TOTAL_WAVES-1).
 *
 * Waves 1–10 use the base definitions directly.
 * Wave 11 onward is cumulative: it starts from wave 10's content and for every
 * wave after that we add the corresponding base wave cycling through 1–10.
 *   wave 11 = wave 10 + wave 1
 *   wave 12 = wave 11 + wave 2
 *   …
 *   wave 20 = wave 19 + wave 10  (= all base waves combined)
 *   wave 100 ≈ wave 10 × 10
 */
export function generateWave(waveIndex: number): WaveDefinition {
  const n   = waveIndex + 1
  const len = TD_WAVES.length  // 10

  let waveDef: WaveDefinition
  if (waveIndex < len) {
    const base = TD_WAVES[waveIndex]
    waveDef = {
      wave: n,
      label: `Wave ${n} — ${base.label.replace(/^Wave \d+ — /, '')}`,
      spawns: base.spawns.map(s => ({ ...s })),
    }
  } else {
    // Merge spawn lists, keyed by enemyId+hpMult+intervalMs to preserve HP variety.
    const merged = new Map<string, WaveSpawn>()
    const add = (baseIdx: number) => {
      for (const s of TD_WAVES[baseIdx].spawns) {
        const key = `${s.enemyId}|${s.hpMult}|${s.intervalMs}`
        const ex  = merged.get(key)
        merged.set(key, ex ? { ...ex, count: ex.count + s.count } : { ...s })
      }
    }

    // Base: always include the last defined wave, then cycle through all waves
    add(len - 1)
    for (let i = len; i <= waveIndex; i++) add((i - len) % len)

    const cycle    = Math.floor((waveIndex - len) / len) + 2
    const addedIdx = (waveIndex - len) % len
    const baseLabel = TD_WAVES[addedIdx].label.replace(/^Wave \d+ — /, '')
    waveDef = {
      wave: n,
      label: `Wave ${n} — ${baseLabel} [Cycle ${cycle}]`,
      spawns: [...merged.values()],
    }
  }

  // Inject a boss every 10 waves — arrives after regular enemies, HP scales per appearance
  if (n % 10 === 0) {
    const bossId    = BOSS_ROTATION[Math.floor(n / 10 - 1) % BOSS_ROTATION.length]
    const bossScale = Math.ceil(n / 10)
    waveDef.spawns  = [...waveDef.spawns, { enemyId: bossId, count: 1, intervalMs: 0, hpMult: bossScale }]
    waveDef.label   = waveDef.label + ' ☠'
  }

  return waveDef
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cellToXY(col: number, row: number): { x: number; y: number } {
  return { x: col * TD_CELL_PX + TD_CELL_PX / 2, y: row * TD_CELL_PX + TD_CELL_PX / 2 }
}

function pathIndexToXY(progress: number): { x: number; y: number } {
  const i = Math.min(Math.floor(progress), TD_PATH.length - 2)
  const frac = progress - i
  const a = TD_PATH[i]
  const b = TD_PATH[Math.min(i + 1, TD_PATH.length - 1)]
  return {
    x: (a.col + (b.col - a.col) * frac) * TD_CELL_PX + TD_CELL_PX / 2,
    y: (a.row + (b.row - a.row) * frac) * TD_CELL_PX + TD_CELL_PX / 2,
  }
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)
}

function unitCanHit(unit: TDUnit, enemy: TDEnemy, rangeBonus: number): boolean {
  if (enemy.template.flying && !unit.template.bypassWall) return false
  return dist(unit.x, unit.y, enemy.x, enemy.y) <= (unit.rangeInCells + rangeBonus) * TD_CELL_PX
}

function unitDamageDealt(unit: TDUnit, enemy: TDEnemy): number {
  let dmg = Math.round(unit.template.attack)
  if (unit.template.strengths?.some(tag => enemy.template.tags.includes(tag))) {
    dmg = Math.round(dmg * STRENGTH_MULT)
  }
  return dmg
}

/** Create a fresh unit starting at its building — it will roam to chase nearby enemies. */
function spawnUnitFromBuilding(tower: TDTower): TDUnit {
  const home = cellToXY(tower.col, tower.row)
  return {
    id: nextId(),
    towerId: tower.id,
    template: tower.template,
    hp: tower.template.maxHp,
    maxHp: tower.template.maxHp,
    x: home.x,
    y: home.y,
    homeX: home.x,
    homeY: home.y,
    stationed: false,
    attackCooldownRemaining: 0,
    rangeInCells: Math.max(1.5, Math.round(tower.template.attackRange / TD_CELL_PX)),
    speedMult:   1 + tower.upgradeSpeed  * 0.10,
    rangeBonus:  tower.upgradeRange,
    damageMult:  1 + tower.upgradeDamage * 0.10,
  }
}

/** Refresh per-unit multipliers on all units belonging to a tower (call after upgrade). */
function refreshTowerUnits(units: TDUnit[], tower: TDTower): TDUnit[] {
  const sm = 1 + tower.upgradeSpeed  * 0.10
  const rb = tower.upgradeRange
  const dm = 1 + tower.upgradeDamage * 0.10
  return units.map(u =>
    u.towerId === tower.id ? { ...u, speedMult: sm, rangeBonus: rb, damageMult: dm } : u
  )
}

function buildSpawnQueue(waveDef: WaveDefinition, startTimeMs: number, waveIndex: number): SpawnEntry[] {
  const speedMult = waveIndex >= 10 ? Math.pow(1.05, waveIndex - 10) : 1
  const hpScale   = waveIndex >= 10 ? Math.pow(1.07, waveIndex - 10) : 1
  const queue: SpawnEntry[] = []
  let t = startTimeMs
  for (const group of waveDef.spawns) {
    const tpl = ENEMY_TEMPLATES[group.enemyId]
    if (!tpl) continue
    const isArmored = tpl.tags.includes('armored')
    const isLarge   = tpl.tags.includes('large')
    const isMagic   = tpl.tags.includes('magic')
    const shielded     = waveIndex >= 30 && isArmored
    const splitsOnDeath = waveIndex >= 50 && isLarge
    const slowsUnits    = waveIndex >= 70 && isMagic
    for (let i = 0; i < group.count; i++) {
      const isBoss = tpl.tags.includes('boss')
      queue.push({ template: tpl, hpMult: group.hpMult * (isBoss ? 1 : hpScale), speedMult: isBoss ? 1 : speedMult, shielded, splitsOnDeath, slowsUnits, spawnAt: t })
      t += group.intervalMs
    }
  }
  // sort ascending so we can pop from the end
  queue.sort((a, b) => b.spawnAt - a.spawnAt)
  return queue
}

function sampleMilestoneChoices(): MilestoneUpgrade[] {
  const shuffled = [...ALL_MILESTONE_UPGRADES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Build initial game state from a set of available unit templates. */
export function createTDGame(
  availableTemplates: UnitTemplate[],
  mode: 'collection' | 'city',
  placementsPerTemplate: Record<string, number>,
): TDGameState {
  _nextId = 1
  return {
    phase: 'prep',
    lives: TD_MAX_LIVES,
    mana: TD_STARTING_MANA,
    wavesCompleted: 0,
    currentWaveIndex: 0,
    gameTimeMs: 0,
    towers: [],
    units: [],
    enemies: [],
    spawnQueue: [],
    waveSpawnTotal: 0,
    nextWaveAt: Infinity,
    log: ['Place your buildings, then press START WAVE.'],
    attackEvents: [],
    hazards: [],
    score: 0,
    availableTemplates,
    remainingPlacements: { ...placementsPerTemplate },
    mode,
    passives: { attackSpeedMult: 1, rangeBonus: 0, damageMult: 1, respawnMult: 1 },
    milestoneChoices: null,
    enemyKills: 0,
  }
}

/** Place a building on the grid. Returns updated state or null if invalid. */
export function placeTower(
  state: TDGameState,
  template: UnitTemplate,
  buildingName: string,
  col: number,
  row: number,
): TDGameState | null {
  if (isPathCell(col, row)) return null
  if (col < 0 || col >= TD_COLS || row < 0 || row >= TD_ROWS) return null
  if (state.towers.some(t => t.col === col && t.row === row)) return null
  const remaining = state.remainingPlacements[template.name] ?? 0
  if (remaining <= 0) return null
  const cost = towerCost(template)
  if (state.mana < cost) return null

  const tower: TDTower = {
    id: nextId(),
    col, row,
    template,
    buildingName,
    upgrades: 0,
    upgradeUnits: 0,
    upgradeSpeed: 0,
    upgradeRange: 0,
    upgradeDamage: 0,
    respawnTimers: [],
    xp: 0,
    targetingMode: 'first',
  }
  const unit = spawnUnitFromBuilding(tower)
  return {
    ...state,
    mana: state.mana - cost,
    towers: [...state.towers, tower],
    units: [...state.units, unit],
    remainingPlacements: {
      ...state.remainingPlacements,
      [template.name]: remaining - 1,
    },
    log: [...state.log.slice(-9), `Placed ${buildingName} — ${template.name} marching out!`],
  }
}

/** Sell a building, recall its units, and refund mana. */
export function removeTower(state: TDGameState, towerId: number): TDGameState {
  const tower = state.towers.find(t => t.id === towerId)
  if (!tower) return state
  const refund = sellRefund(tower)
  return {
    ...state,
    mana: state.mana + refund,
    towers: state.towers.filter(t => t.id !== towerId),
    units: state.units.filter(u => u.towerId !== towerId),
    remainingPlacements: {
      ...state.remainingPlacements,
      [tower.template.name]: (state.remainingPlacements[tower.template.name] ?? 0) + 1,
    },
    log: [...state.log.slice(-9), `Sold ${tower.buildingName} (+${refund} mana).`],
  }
}

/** Upgrade a building — spawns one more unit. Returns null if not affordable or at max. */
const UPGRADE_LABELS: Record<TDUpgradeType, string> = {
  units:  'extra unit dispatched',
  speed:  'attack speed increased',
  range:  'attack range extended',
  damage: 'damage boosted',
}

export function upgradeTowerWith(
  state: TDGameState,
  towerId: number,
  type: TDUpgradeType,
): TDGameState | null {
  const tower = state.towers.find(t => t.id === towerId)
  if (!tower) return null
  if (tower.upgrades >= TD_MAX_UPGRADES) return null
  if (tower.xp < xpToUpgrade(tower)) return null
  const currentLevel = type === 'units'  ? tower.upgradeUnits
                     : type === 'speed'  ? tower.upgradeSpeed
                     : type === 'range'  ? tower.upgradeRange
                     :                    tower.upgradeDamage
  const maxForType = type === 'units' ? TD_MAX_UNIT_UPGRADES : TD_MAX_UPGRADE_PER_TYPE
  if (currentLevel >= maxForType) return null
  const cost = upgradeCost(tower)
  if (state.mana < cost) return null

  const upgradedTower: TDTower = {
    ...tower,
    upgrades:      tower.upgrades + 1,
    xp:            0,
    upgradeUnits:  type === 'units'  ? tower.upgradeUnits  + 1 : tower.upgradeUnits,
    upgradeSpeed:  type === 'speed'  ? tower.upgradeSpeed  + 1 : tower.upgradeSpeed,
    upgradeRange:  type === 'range'  ? tower.upgradeRange  + 1 : tower.upgradeRange,
    upgradeDamage: type === 'damage' ? tower.upgradeDamage + 1 : tower.upgradeDamage,
  }

  let units = refreshTowerUnits(state.units, upgradedTower)
  if (type === 'units') units = [...units, spawnUnitFromBuilding(upgradedTower)]

  return {
    ...state,
    mana: state.mana - cost,
    towers: state.towers.map(t => t.id === towerId ? upgradedTower : t),
    units,
    log: [...state.log.slice(-9), `${tower.buildingName} ★${upgradedTower.upgrades} — ${UPGRADE_LABELS[type]}! (-${cost} mana)`],
  }
}

/** Move a building to a new cell — its units walk to the new nearest path cell. */
export function moveTower(state: TDGameState, towerId: number, col: number, row: number): TDGameState | null {
  if (isPathCell(col, row)) return null
  if (col < 0 || col >= TD_COLS || row < 0 || row >= TD_ROWS) return null
  const tower = state.towers.find(t => t.id === towerId)
  if (!tower) return null
  if (state.towers.some(t => t.id !== towerId && t.col === col && t.row === row)) return null
  const movedTower = { ...tower, col, row }
  const newHome = cellToXY(col, row)
  return {
    ...state,
    towers: state.towers.map(t => t.id === towerId ? movedTower : t),
    units: state.units.map(u =>
      u.towerId !== towerId ? u
        : { ...u, x: newHome.x, y: newHome.y, homeX: newHome.x, homeY: newHome.y, stationed: false }
    ),
    log: [...state.log.slice(-9), `Moved ${tower.buildingName}.`],
  }
}

/** Apply a chosen milestone upgrade and clear the pending choices. */
export function chooseMilestoneUpgrade(state: TDGameState, id: string): TDGameState {
  if (!state.milestoneChoices) return state
  const p = { ...state.passives }
  let extra: Partial<TDGameState> = {}
  switch (id) {
    case 'attack_speed': p.attackSpeedMult *= 1.2; break
    case 'range':        p.rangeBonus += 1; break
    case 'damage':       p.damageMult *= 1.15; break
    case 'mana':         extra = { mana: state.mana + 100 }; break
    case 'life':         extra = { lives: state.lives + 2 }; break
    case 'respawn':      p.respawnMult *= 2; break
  }
  return { ...state, ...extra, passives: p, milestoneChoices: null,
    log: [...state.log.slice(-9), `Upgrade chosen: ${ALL_MILESTONE_UPGRADES.find(u => u.id === id)?.label ?? id}`] }
}

/** Change a tower's targeting priority mode. */
export function setTowerTargetingMode(state: TDGameState, towerId: number, mode: TDTargetingMode): TDGameState {
  return { ...state, towers: state.towers.map(t => t.id === towerId ? { ...t, targetingMode: mode } : t) }
}

/** Begin the next wave from prep, between, or milestone phase. */
export function startWave(state: TDGameState): TDGameState {
  if (state.phase !== 'prep' && state.phase !== 'between' && state.phase !== 'milestone') return state
  if (state.milestoneChoices !== null) return state  // must pick upgrade first
  const waveDef = generateWave(state.currentWaveIndex)
  const queue = buildSpawnQueue(waveDef, state.gameTimeMs, state.currentWaveIndex)
  return {
    ...state,
    phase: 'wave',
    spawnQueue: queue,
    waveSpawnTotal: queue.length,
    nextWaveAt: Infinity,
    log: [...state.log.slice(-9), waveDef.label + '!'],
  }
}

/** Advance simulation by dtMs milliseconds. Returns next state. */
export function tickTD(state: TDGameState, dtMs: number): TDGameState {
  if (state.phase === 'prep' || state.phase === 'victory' || state.phase === 'defeat') return state

  const dtSec = dtMs / 1000
  let s = { ...state, gameTimeMs: state.gameTimeMs + dtMs }
  s.towers = [...s.towers]
  s.units = [...s.units]
  s.enemies = [...s.enemies]
  s.spawnQueue = [...s.spawnQueue]
  s.hazards = [...s.hazards]
  s.log = [...s.log]

  // ── Spawn enemies ─────────────────────────────────────────────────────────
  while (s.spawnQueue.length > 0) {
    const next = s.spawnQueue[s.spawnQueue.length - 1]
    if (next.spawnAt > s.gameTimeMs) break
    s.spawnQueue = s.spawnQueue.slice(0, -1)
    const hp = Math.round(next.template.hp * next.hpMult)
    const startXY = pathIndexToXY(0)
    s.enemies = [...s.enemies, {
      id: nextId(),
      template: next.template,
      hp, maxHp: hp,
      pathProgress: 0,
      x: startXY.x, y: startXY.y,
      unitAttackCd: 0,
      speedMult: next.speedMult,
      shielded: next.shielded,
      splitsOnDeath: next.splitsOnDeath,
      slowsUnits: next.slowsUnits,
    }]
  }

  // Start auto-next-wave countdown when last enemy of this wave spawns.
  // Skip the timer on milestone waves — the player must clear all enemies first.
  if (s.phase === 'wave' && state.spawnQueue.length > 0 && s.spawnQueue.length === 0 && s.nextWaveAt === Infinity) {
    const nextCompleted = s.wavesCompleted + 1
    if (nextCompleted % TD_MILESTONE_EVERY !== 0) {
      s.nextWaveAt = s.gameTimeMs + 5000
    }
  }

  // ── Elemental DoT on enemies ─────────────────────────────────────────────
  s.enemies = s.enemies.map(enemy => {
    let e = { ...enemy }
    if (e.burnTimer != null && e.burnTimer > 0) {
      e.burnTimer = Math.max(0, e.burnTimer - dtMs)
      e.hp = Math.max(0, Math.round(e.hp - (e.burnDps ?? 8) * dtSec))
    }
    if (e.poisonTimer != null && e.poisonTimer > 0) {
      e.poisonTimer = Math.max(0, e.poisonTimer - dtMs)
      e.hp = Math.max(0, Math.round(e.hp - (e.poisonDps ?? 5) * dtSec))
    }
    if (e.freezeTimer != null && e.freezeTimer > 0) {
      e.freezeTimer = Math.max(0, e.freezeTimer - dtMs)
    }
    return e
  })
  // Award score/mana for DoT kills before movement removes them
  for (const e of s.enemies) {
    if (e.hp <= 0) { s.score += e.template.reward; s.mana += e.template.reward }
  }
  s.enemies = s.enemies.filter(e => e.hp > 0)

  // ── Move enemies ──────────────────────────────────────────────────────────
  let livesLost = 0
  const survivingEnemies: TDEnemy[] = []
  for (const enemy of s.enemies) {
    const freezeFactor = (enemy.freezeTimer != null && enemy.freezeTimer > 0 && enemy.freezeSlow != null)
      ? enemy.freezeSlow : 1
    const np = enemy.pathProgress + enemy.template.speed * enemy.speedMult * dtSec * freezeFactor
    if (np >= TD_PATH.length - 1) {
      livesLost += enemy.template.attack
      continue
    }
    const xy = pathIndexToXY(np)
    survivingEnemies.push({ ...enemy, pathProgress: np, x: xy.x, y: xy.y })
  }
  s.enemies = survivingEnemies
  if (livesLost > 0) {
    s.lives = Math.max(0, s.lives - livesLost)
    s.log = [...s.log.slice(-9), `${livesLost} ${livesLost === 1 ? 'enemy' : 'enemies'} reached your base!`]
  }

  // ── Move units — max 1 per cell; overflow to adjacent cells within reach ─
  const claimedUnitCells = new Map<string, number>()  // "col,row" -> unit id

  function claimCellNear(
    preferCol: number, preferRow: number,
    homeX: number, homeY: number,
    claimId: number,
  ): { x: number; y: number } | null {
    // Try preferred cell first, then 8 neighbours, all within UNIT_REACH_PX
    const candidates: Array<{ col: number; row: number }> = [
      { col: preferCol, row: preferRow },
      ...[-1, 0, 1].flatMap(dc => [-1, 0, 1]
        .filter(dr => dc !== 0 || dr !== 0)
        .map(dr => ({ col: preferCol + dc, row: preferRow + dr }))),
    ]
    for (const { col, row } of candidates) {
      if (col < 0 || col >= TD_COLS || row < 0 || row >= TD_ROWS) continue
      const key = `${col},${row}`
      if (claimedUnitCells.has(key)) continue
      const cx = col * TD_CELL_PX + TD_CELL_PX / 2
      const cy = row * TD_CELL_PX + TD_CELL_PX / 2
      if (dist(cx, cy, homeX, homeY) > UNIT_REACH_PX) continue
      claimedUnitCells.set(key, claimId)
      return { x: cx, y: cy }
    }
    return null
  }

  // Group by towerId so all units from the same building move as one entity
  const unitsByTower = new Map<number, TDUnit[]>()
  for (const unit of s.units) {
    const g = unitsByTower.get(unit.towerId) ?? []
    g.push(unit)
    unitsByTower.set(unit.towerId, g)
  }

  const movedUnits: TDUnit[] = []
  for (const [towerId, group] of unitsByTower) {
    const leader = group[0]
    const nearbyEnemy = s.enemies
      .filter(e => dist(e.x, e.y, leader.homeX, leader.homeY) <= UNIT_REACH_PX + TD_CELL_PX * 0.5)
      .sort((a, b) => dist(a.x, a.y, leader.x, leader.y) - dist(b.x, b.y, leader.x, leader.y))[0] ?? null

    // One cell claimed for the whole group (towerId is the claim key)
    const destXY = nearbyEnemy
      ? claimCellNear(
          Math.floor(nearbyEnemy.x / TD_CELL_PX), Math.floor(nearbyEnemy.y / TD_CELL_PX),
          leader.homeX, leader.homeY, towerId,
        )
      : claimCellNear(
          Math.floor(leader.homeX / TD_CELL_PX), Math.floor(leader.homeY / TD_CELL_PX),
          leader.homeX, leader.homeY, towerId,
        )

    // Move every unit in the group toward the same destination
    for (const unit of group) {
      let newX = unit.x, newY = unit.y
      if (destXY) {
        const dx = destXY.x - unit.x, dy = destXY.y - unit.y
        const d = Math.sqrt(dx * dx + dy * dy)
        const step = UNIT_WALK_SPEED_PX * dtSec
        if (d > 2) { newX = unit.x + dx / d * Math.min(step, d); newY = unit.y + dy / d * Math.min(step, d) }
      }
      movedUnits.push({ ...unit, x: newX, y: newY, stationed: nearbyEnemy !== null })
    }
  }
  s.units = movedUnits

  // ── Units attack enemies ──────────────────────────────────────────────────
  const { attackSpeedMult, rangeBonus, damageMult, respawnMult } = s.passives

  // Compute which units are within a slow aura this tick
  const slowedUnitIds = new Set<number>()
  for (const enemy of s.enemies) {
    if (enemy.slowsUnits) {
      for (const unit of s.units) {
        if (dist(unit.x, unit.y, enemy.x, enemy.y) <= TD_CELL_PX * 2) slowedUnitIds.add(unit.id)
      }
    }
  }

  const deadEnemyIds = new Set<number>()
  const shieldedEnemyIds = new Set<number>()  // shield absorbed a hit this tick
  const newAttackEvents: TDAttackEvent[] = s.attackEvents.filter(e => e.expiresAt > s.gameTimeMs)
  const towerXpGains: Record<number, number> = {}

  // Pre-build a map of tower targeting modes for O(1) lookup per unit
  const towerTargetingModes = new Map<number, TDTargetingMode>(s.towers.map(t => [t.id, t.targetingMode]))

  // Accumulate enemy mutations — applied in one pass after the units loop to avoid
  // O(units × enemies) array copies (was up to 4 full enemy-array maps per attacking unit).
  const enemyMutations = new Map<number, Partial<TDEnemy>>()

  s.units = s.units.map(unit => {
    let cd = Math.max(0, unit.attackCooldownRemaining - dtMs)
    if (cd <= 0 && s.enemies.length > 0) {
      const mode = towerTargetingModes.get(unit.towerId) ?? 'first'
      const reachable = s.enemies.filter(e => !deadEnemyIds.has(e.id) && !shieldedEnemyIds.has(e.id) && unitCanHit(unit, e, rangeBonus + unit.rangeBonus))
      const flyingOnly = reachable.filter(e => e.template.flying)
      const pool = mode === 'flying' && flyingOnly.length > 0 ? flyingOnly : reachable
      const targets = pool.sort((a, b) => {
        if (mode === 'weakest')   return a.hp - b.hp
        if (mode === 'strongest') return b.hp - a.hp
        return b.pathProgress - a.pathProgress  // 'first' and 'flying' fallback
      })
      if (targets.length > 0) {
        const target = targets[0]
        if (target.shielded) {
          // Shield absorbs the hit — break it and skip damage
          shieldedEnemyIds.add(target.id)
          const cur = enemyMutations.get(target.id) ?? {}
          enemyMutations.set(target.id, { ...cur, shielded: false })
        } else {
          const dmg = Math.round(unitDamageDealt(unit, target) * damageMult * unit.damageMult)
          // Use pending hp so multiple units hitting the same enemy in one tick is correct
          const effHp = enemyMutations.get(target.id)?.hp ?? target.hp
          const newHp = effHp - dmg
          // Apply elemental on-hit effect
          const eff = unit.template.attackEffect
          if (eff && Math.random() < eff.chance) {
            if (eff.type === 'burn' || eff.type === 'freeze' || eff.type === 'poison' || eff.type === 'shock') {
              if (newHp > 0 && !target.template.immunities?.includes(eff.type)) {
                const cur = enemyMutations.get(target.id) ?? {}
                if (eff.type === 'burn')   enemyMutations.set(target.id, { ...cur, burnTimer:   eff.durationMs, burnDps:   eff.dps ?? 8 })
                if (eff.type === 'freeze') enemyMutations.set(target.id, { ...cur, freezeTimer: eff.durationMs, freezeSlow: eff.slowFactor ?? 0.35 })
                if (eff.type === 'poison') enemyMutations.set(target.id, { ...cur, poisonTimer: eff.durationMs, poisonDps: eff.dps ?? 5 })
                if (eff.type === 'shock')  enemyMutations.set(target.id, { ...cur, freezeTimer: eff.durationMs, freezeSlow: 0 })
              }
            } else if (eff.type === 'aoe' && eff.aoeRadius) {
              // AOE burst: deal same damage to all enemies in radius
              for (const e of s.enemies) {
                if (e.id === target.id || deadEnemyIds.has(e.id)) continue
                if (dist(e.x, e.y, target.x, target.y) > eff.aoeRadius!) continue
                const splashEffHp = enemyMutations.get(e.id)?.hp ?? e.hp
                const splashHp = splashEffHp - dmg
                if (splashHp <= 0) {
                  deadEnemyIds.add(e.id)
                  s.score += e.template.reward
                  s.mana += e.template.reward
                  s.enemyKills++
                  towerXpGains[unit.towerId] = (towerXpGains[unit.towerId] ?? 0) + 1
                } else {
                  const cur = enemyMutations.get(e.id) ?? {}
                  enemyMutations.set(e.id, { ...cur, hp: splashHp })
                }
              }
              // AOE ring visual
              newAttackEvents.push({ id: nextId(), fromX: target.x, fromY: target.y, toX: target.x, toY: target.y, expiresAt: s.gameTimeMs + 500, aoeRadius: eff.aoeRadius })
            } else if (eff.type === 'gascloud' && eff.aoeRadius) {
              // Cap to 2 active clouds per tower — drop the oldest to prevent infinite stacking
              const MAX_CLOUDS_PER_TOWER = 2
              const towerClouds = s.hazards.filter(h => h.sourceTowerId === unit.towerId)
              if (towerClouds.length >= MAX_CLOUDS_PER_TOWER) {
                const oldestId = towerClouds.sort((a, b) => a.expiresAt - b.expiresAt)[0].id
                s.hazards = s.hazards.filter(h => h.id !== oldestId)
              }
              s.hazards = [...s.hazards, { id: nextId(), x: target.x, y: target.y, radius: eff.aoeRadius, dps: eff.dps ?? 3, expiresAt: s.gameTimeMs + eff.durationMs, sourceTowerId: unit.towerId }]
            }
          }
          if (newHp <= 0) {
            deadEnemyIds.add(target.id)
            s.score += target.template.reward
            s.mana += target.template.reward
            s.enemyKills++
            towerXpGains[unit.towerId] = (towerXpGains[unit.towerId] ?? 0) + 1
          } else {
            const cur = enemyMutations.get(target.id) ?? {}
            enemyMutations.set(target.id, { ...cur, hp: newHp })
          }
        }
        newAttackEvents.push({
          id: nextId(),
          fromX: unit.x, fromY: unit.y,
          toX: target.x, toY: target.y,
          expiresAt: s.gameTimeMs + 400,
          projectileType: getProjectileType(unit.template.tags),
          aoeRadius: unit.template.attackEffect?.aoeRadius,
        })
        const slowPenalty = slowedUnitIds.has(unit.id) ? 1.5 : 1
        cd = unit.template.attackCooldownMs / (attackSpeedMult * unit.speedMult) * slowPenalty
      }
    }
    return { ...unit, attackCooldownRemaining: cd }
  })
  s.attackEvents = newAttackEvents

  // Single-pass application of all accumulated enemy mutations
  if (enemyMutations.size > 0) {
    s.enemies = s.enemies.map(e => {
      const mut = enemyMutations.get(e.id)
      return mut ? { ...e, ...mut } : e
    })
  }

  // Split-on-death: collect offspring before removing dead enemies
  const splitOffspring: TDEnemy[] = []
  for (const enemy of s.enemies) {
    if (deadEnemyIds.has(enemy.id) && enemy.splitsOnDeath) {
      const halfHp = Math.max(1, Math.floor(enemy.maxHp / 2))
      for (let i = 0; i < 2; i++) {
        splitOffspring.push({
          ...enemy,
          id: nextId(),
          hp: halfHp, maxHp: halfHp,
          splitsOnDeath: false,
          shielded: false,
        })
      }
    }
  }
  s.enemies = [...s.enemies.filter(e => !deadEnemyIds.has(e.id)), ...splitOffspring]

  // ── Enemies retaliate against stationed units ─────────────────────────────
  const unitHpDeltas: Record<number, number> = {}
  const unitDeaths = new Set<number>()

  s.enemies = s.enemies.map(enemy => {
    let ucd = Math.max(0, enemy.unitAttackCd - dtMs)
    if (ucd <= 0) {
      const target = s.units
        .filter(u => !unitDeaths.has(u.id))
        .sort((a, b) => dist(a.x, a.y, enemy.x, enemy.y) - dist(b.x, b.y, enemy.x, enemy.y))
        .find(u => dist(u.x, u.y, enemy.x, enemy.y) <= TD_CELL_PX * 1.5)
      if (target) {
        const prev = unitHpDeltas[target.id] ?? target.hp
        const next = prev - enemy.template.attack
        unitHpDeltas[target.id] = next
        if (next <= 0) unitDeaths.add(target.id)
        ucd = 1500
      }
    }
    return { ...enemy, unitAttackCd: ucd }
  })

  // Collect dead unit respawn info before removing them
  const respawnAdditions: Record<number, number> = {}
  for (const uid of unitDeaths) {
    const u = s.units.find(u => u.id === uid)
    if (u) {
      respawnAdditions[u.towerId] = (respawnAdditions[u.towerId] ?? 0) + 1
      s.log = [...s.log.slice(-9), `${u.template.name} fell in battle — reinforcements en route!`]
    }
  }

  s.units = s.units
    .filter(u => !unitDeaths.has(u.id))
    .map(u => unitHpDeltas[u.id] !== undefined ? { ...u, hp: Math.max(1, unitHpDeltas[u.id]) } : u)

  // ── Tick respawn timers and spawn new units ────────────────────────────────
  const newlySpawned: TDUnit[] = []
  s.towers = s.towers.map(tower => {
    let timers = tower.respawnTimers.map(t => t - dtMs)
    const addCount = respawnAdditions[tower.id] ?? 0
    for (let i = 0; i < addCount; i++) timers.push(RESPAWN_DELAY_MS / respawnMult)
    const toSpawn = timers.filter(t => t <= 0).length
    timers = timers.filter(t => t > 0)
    for (let i = 0; i < toSpawn; i++) newlySpawned.push(spawnUnitFromBuilding(tower))
    return { ...tower, respawnTimers: timers }
  })
  s.units = [...s.units, ...newlySpawned]

  // ── Hazard damage on enemies ─────────────────────────────────────────────
  s.hazards = s.hazards.filter(h => h.expiresAt > s.gameTimeMs)
  if (s.hazards.length > 0) {
    const hazardDeadIds = new Set<number>()
    s.enemies = s.enemies.map(enemy => {
      let e = { ...enemy }
      for (const hazard of s.hazards) {
        if (dist(e.x, e.y, hazard.x, hazard.y) <= hazard.radius && !e.template.immunities?.includes('gascloud')) {
          e.hp = Math.max(0, Math.round(e.hp - hazard.dps * dtSec))
          if (e.hp <= 0 && !hazardDeadIds.has(e.id)) {
            hazardDeadIds.add(e.id)
            s.score += e.template.reward
            s.mana += e.template.reward
            towerXpGains[hazard.sourceTowerId] = (towerXpGains[hazard.sourceTowerId] ?? 0) + 1
          }
        }
      }
      return e
    })
    s.enemies = s.enemies.filter(e => !hazardDeadIds.has(e.id))
  }

  // Award kill XP to towers (from direct attacks and gas cloud kills)
  if (Object.keys(towerXpGains).length > 0) {
    s.towers = s.towers.map(t =>
      towerXpGains[t.id] ? { ...t, xp: t.xp + towerXpGains[t.id] } : t
    )
  }

  // ── Check defeat ──────────────────────────────────────────────────────────
  if (s.lives <= 0) {
    s.log = [...s.log.slice(-9), 'Your base has fallen!']
    return { ...s, phase: 'defeat' }
  }

  // ── Check wave complete: all clear, or 5 s after last spawn ─────────────
  const allSpawned = s.spawnQueue.length === 0
  const autoStart  = allSpawned && s.gameTimeMs >= s.nextWaveAt
  if (s.phase === 'wave' && allSpawned && (s.enemies.length === 0 || autoStart)) {
    s.wavesCompleted += 1
    if (s.wavesCompleted >= TD_TOTAL_WAVES) {
      s.log = [...s.log.slice(-9), 'All 100 waves defeated! Legendary victory!']
      return { ...s, phase: 'victory' }
    }
    s.currentWaveIndex += 1
    if (s.wavesCompleted % TD_MILESTONE_EVERY === 0) {
      s.log = [...s.log.slice(-9), `🎉 ${s.wavesCompleted} waves cleared! Choose a reward, then reorganise!`]
      return { ...s, phase: 'milestone', milestoneChoices: sampleMilestoneChoices(), nextWaveAt: Infinity }
    }
    const nextWave = generateWave(s.currentWaveIndex)
    const queue = buildSpawnQueue(nextWave, s.gameTimeMs, s.currentWaveIndex)
    s.log = [...s.log.slice(-9), nextWave.label + '!']
    return { ...s, phase: 'wave', spawnQueue: queue, waveSpawnTotal: queue.length, nextWaveAt: Infinity }
  }

  if (s.phase === 'between' && s.gameTimeMs >= s.nextWaveAt) return startWave(s)

  return s
}

/** Move all units toward their home positions without any combat logic.
 *  Called during 'milestone' phase so units visibly return to their buildings
 *  while the player is choosing a reward. */
export function tickUnitsHomeOnly(state: TDGameState, dtMs: number): TDGameState {
  const dtSec = dtMs / 1000
  const step = UNIT_WALK_SPEED_PX * dtSec
  const units = state.units.map(unit => {
    const dx = unit.homeX - unit.x
    const dy = unit.homeY - unit.y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < 2) return unit
    return { ...unit, x: unit.x + dx / d * Math.min(step, d), y: unit.y + dy / d * Math.min(step, d), stationed: false }
  })
  return { ...state, units, attackEvents: [], hazards: [] }
}

/** Compute ticket reward for arcade mode based on waves cleared. */
export function calcTicketReward(wavesCompleted: number): number {
  return wavesCompleted * 10
}

/** Compute city gold reward for city mode based on waves cleared. */
export function calcGoldReward(wavesCompleted: number): number {
  return wavesCompleted * 2500
}

export { ENEMY_TEMPLATES }
