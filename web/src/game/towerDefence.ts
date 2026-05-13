// ─── Tower Defence — pure game logic ──────────────────────────────────────────
// No React imports. All state is plain objects; tick() returns a new state.

import { UnitTemplate, UnitTag } from './types'

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
}

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
]

// ── Runtime types ─────────────────────────────────────────────────────────────

let _nextId = 1
function nextId() { return _nextId++ }

// Building placed by the player on a non-path cell.
export interface TDTower {
  id: number
  col: number
  row: number
  template: UnitTemplate
  buildingName: string        // card name for building sprite
  upgrades: number            // 0–TD_MAX_UPGRADES; determines how many units it spawns
  respawnTimers: number[]     // countdown (ms) for each dead unit awaiting respawn
}

// A unit spawned by a building — walks to the nearest path cell and fights there.
export interface TDUnit {
  id: number
  towerId: number
  template: UnitTemplate
  hp: number
  maxHp: number
  x: number               // current pixel position
  y: number
  targetX: number         // nearest path-cell centre
  targetY: number
  stationed: boolean      // false = still walking, true = at path cell fighting
  attackCooldownRemaining: number
  rangeInCells: number
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
}

// Attack visual event — used by the UI to show projectile + hit spark
export interface TDAttackEvent {
  id: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  expiresAt: number   // game-time ms
}

// Pending spawn queue entry
interface SpawnEntry {
  template: TDEnemyTemplate
  hpMult: number
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
  availableTemplates: UnitTemplate[]
  remainingPlacements: Record<string, number>
  mode: 'collection' | 'city'
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const TD_MAX_LIVES = 3
export const TD_TOTAL_WAVES = 100
export const TD_MILESTONE_EVERY = 10
export const TD_CELL_PX = 48
export const TD_STARTING_MANA = 120
export const TD_MAX_UPGRADES = 2
const BETWEEN_WAVE_MS = 5000
const STRENGTH_MULT = 1.5
const RESPAWN_DELAY_MS = 5000     // ms before a dead unit respawns
const UNIT_WALK_SPEED_PX = TD_CELL_PX * 2   // px/sec walking from building to path

/** Mana cost to place a building based on its unit stats. */
export function towerCost(template: UnitTemplate): number {
  return Math.max(5, Math.round(template.attack * 2 + template.maxHp / 20))
}

/** Mana cost to upgrade a building (spawns one more unit). */
export function upgradeCost(tower: TDTower): number {
  return Math.round(towerCost(tower.template) * (tower.upgrades + 1))
}

/** Number of units a building spawns at its current upgrade level. */
export function buildingUnitCount(tower: TDTower): number {
  return tower.upgrades + 1
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
function generateWave(waveIndex: number): WaveDefinition {
  const n   = waveIndex + 1
  const len = TD_WAVES.length  // 10

  if (waveIndex < len) {
    const base = TD_WAVES[waveIndex]
    return {
      wave: n,
      label: `Wave ${n} — ${base.label.replace(/^Wave \d+ — /, '')}`,
      spawns: base.spawns.map(s => ({ ...s })),
    }
  }

  // Merge spawn lists, keyed by enemyId+hpMult+intervalMs to preserve HP variety.
  const merged = new Map<string, WaveSpawn>()
  const add = (baseIdx: number) => {
    for (const s of TD_WAVES[baseIdx].spawns) {
      const key = `${s.enemyId}|${s.hpMult}|${s.intervalMs}`
      const ex  = merged.get(key)
      merged.set(key, ex ? { ...ex, count: ex.count + s.count } : { ...s })
    }
  }

  // Base: always include wave 10
  add(9)
  // Wave 11 adds W1, wave 12 adds W2, … cycling through W1–W10
  for (let i = 10; i <= waveIndex; i++) add((i - 10) % len)

  const cycle    = Math.floor((waveIndex - 10) / len) + 2
  const addedIdx = (waveIndex - 10) % len
  const baseLabel = TD_WAVES[addedIdx].label.replace(/^Wave \d+ — /, '')
  return {
    wave: n,
    label: `Wave ${n} — ${baseLabel} [Cycle ${cycle}]`,
    spawns: [...merged.values()],
  }
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

function unitCanHit(unit: TDUnit, enemy: TDEnemy): boolean {
  if (enemy.template.flying && !unit.template.bypassWall) return false
  return dist(unit.x, unit.y, enemy.x, enemy.y) <= unit.rangeInCells * TD_CELL_PX
}

function unitDamageDealt(unit: TDUnit, enemy: TDEnemy): number {
  let dmg = Math.round(unit.template.attack)
  if (unit.template.strengths?.some(tag => enemy.template.tags.includes(tag))) {
    dmg = Math.round(dmg * STRENGTH_MULT)
  }
  return dmg
}

/** Return the path cell closest to building cell (col, row). */
function nearestPathCell(col: number, row: number): GridPos {
  const cx = col * TD_CELL_PX + TD_CELL_PX / 2
  const cy = row * TD_CELL_PX + TD_CELL_PX / 2
  let best = TD_PATH[0]
  let bestDist = Infinity
  for (const p of TD_PATH) {
    const d = dist(cx, cy, p.col * TD_CELL_PX + TD_CELL_PX / 2, p.row * TD_CELL_PX + TD_CELL_PX / 2)
    if (d < bestDist) { bestDist = d; best = p }
  }
  return best
}

/** Create a fresh unit that walks from its building to the nearest path cell. */
function spawnUnitFromBuilding(tower: TDTower): TDUnit {
  const start  = cellToXY(tower.col, tower.row)
  const target = nearestPathCell(tower.col, tower.row)
  const txy    = cellToXY(target.col, target.row)
  return {
    id: nextId(),
    towerId: tower.id,
    template: tower.template,
    hp: tower.template.maxHp,
    maxHp: tower.template.maxHp,
    x: start.x,
    y: start.y,
    targetX: txy.x,
    targetY: txy.y,
    stationed: false,
    attackCooldownRemaining: 0,
    rangeInCells: Math.max(1.5, Math.round(tower.template.attackRange / TD_CELL_PX)),
  }
}

function buildSpawnQueue(waveDef: WaveDefinition, startTimeMs: number): SpawnEntry[] {
  const queue: SpawnEntry[] = []
  let t = startTimeMs
  for (const group of waveDef.spawns) {
    const tpl = ENEMY_TEMPLATES[group.enemyId]
    if (!tpl) continue
    for (let i = 0; i < group.count; i++) {
      queue.push({ template: tpl, hpMult: group.hpMult, spawnAt: t })
      t += group.intervalMs
    }
  }
  // sort ascending so we can pop from the end
  queue.sort((a, b) => b.spawnAt - a.spawnAt)
  return queue
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
    nextWaveAt: 0,
    log: ['Place your buildings, then press START WAVE.'],
    attackEvents: [],
    score: 0,
    availableTemplates,
    remainingPlacements: { ...placementsPerTemplate },
    mode,
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
    respawnTimers: [],
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
  const refund = Math.floor(towerCost(tower.template) * 0.5)
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
export function upgradeTower(state: TDGameState, towerId: number): TDGameState | null {
  const tower = state.towers.find(t => t.id === towerId)
  if (!tower) return null
  if (tower.upgrades >= TD_MAX_UPGRADES) return null
  const cost = upgradeCost(tower)
  if (state.mana < cost) return null
  const upgradedTower = { ...tower, upgrades: tower.upgrades + 1 }
  const newUnit = spawnUnitFromBuilding(upgradedTower)
  return {
    ...state,
    mana: state.mana - cost,
    towers: state.towers.map(t => t.id === towerId ? upgradedTower : t),
    units: [...state.units, newUnit],
    log: [...state.log.slice(-9), `${tower.buildingName} upgraded to ★${tower.upgrades + 1} — extra ${tower.template.name} dispatched! (-${cost} mana)`],
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
  const target = nearestPathCell(col, row)
  const txy = cellToXY(target.col, target.row)
  const startXY = cellToXY(col, row)
  return {
    ...state,
    towers: state.towers.map(t => t.id === towerId ? movedTower : t),
    units: state.units.map(u =>
      u.towerId !== towerId ? u
        : { ...u, x: startXY.x, y: startXY.y, targetX: txy.x, targetY: txy.y, stationed: false }
    ),
    log: [...state.log.slice(-9), `Moved ${tower.buildingName}.`],
  }
}

/** Begin the next wave from prep, between, or milestone phase. */
export function startWave(state: TDGameState): TDGameState {
  if (state.phase !== 'prep' && state.phase !== 'between' && state.phase !== 'milestone') return state
  const waveDef = generateWave(state.currentWaveIndex)
  const queue = buildSpawnQueue(waveDef, state.gameTimeMs)
  return {
    ...state,
    phase: 'wave',
    spawnQueue: queue,
    waveSpawnTotal: queue.length,
    log: [...state.log.slice(-9), waveDef.label + '!'],
  }
}

/** Advance simulation by dtMs milliseconds. Returns next state. */
export function tickTD(state: TDGameState, dtMs: number): TDGameState {
  if (state.phase === 'prep' || state.phase === 'victory' || state.phase === 'defeat') return state

  let s = { ...state, gameTimeMs: state.gameTimeMs + dtMs }
  s.towers = [...s.towers]
  s.units = [...s.units]
  s.enemies = [...s.enemies]
  s.spawnQueue = [...s.spawnQueue]
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
    }]
  }

  // ── Move enemies ──────────────────────────────────────────────────────────
  const dtSec = dtMs / 1000
  let livesLost = 0
  const survivingEnemies: TDEnemy[] = []
  for (const enemy of s.enemies) {
    const np = enemy.pathProgress + enemy.template.speed * dtSec
    if (np >= TD_PATH.length - 1) {
      livesLost += enemy.template.attack
    } else {
      const xy = pathIndexToXY(np)
      survivingEnemies.push({ ...enemy, pathProgress: np, x: xy.x, y: xy.y })
    }
  }
  s.enemies = survivingEnemies
  if (livesLost > 0) {
    s.lives = Math.max(0, s.lives - livesLost)
    s.log = [...s.log.slice(-9), `${livesLost} ${livesLost === 1 ? 'enemy' : 'enemies'} reached your base!`]
  }

  // ── Move units toward their target path cell ──────────────────────────────
  s.units = s.units.map(u => {
    if (u.stationed) return u
    const dx = u.targetX - u.x
    const dy = u.targetY - u.y
    const d  = Math.sqrt(dx * dx + dy * dy)
    const step = UNIT_WALK_SPEED_PX * dtSec
    if (d <= step) return { ...u, x: u.targetX, y: u.targetY, stationed: true }
    return { ...u, x: u.x + dx / d * step, y: u.y + dy / d * step }
  })

  // ── Units attack enemies ──────────────────────────────────────────────────
  const deadEnemyIds = new Set<number>()
  const newAttackEvents: TDAttackEvent[] = s.attackEvents.filter(e => e.expiresAt > s.gameTimeMs)

  s.units = s.units.map(unit => {
    if (!unit.stationed) return unit
    let cd = Math.max(0, unit.attackCooldownRemaining - dtMs)
    if (cd <= 0 && s.enemies.length > 0) {
      const targets = s.enemies
        .filter(e => !deadEnemyIds.has(e.id) && unitCanHit(unit, e))
        .sort((a, b) => b.pathProgress - a.pathProgress)
      if (targets.length > 0) {
        const target = targets[0]
        const dmg = unitDamageDealt(unit, target)
        const newHp = target.hp - dmg
        if (newHp <= 0) {
          deadEnemyIds.add(target.id)
          s.score += target.template.reward
          s.mana += target.template.reward
        } else {
          s.enemies = s.enemies.map(e => e.id === target.id ? { ...e, hp: newHp } : e)
        }
        newAttackEvents.push({
          id: nextId(),
          fromX: unit.x, fromY: unit.y,
          toX: target.x, toY: target.y,
          expiresAt: s.gameTimeMs + 400,
        })
        cd = unit.template.attackCooldownMs
      }
    }
    return { ...unit, attackCooldownRemaining: cd }
  })
  s.attackEvents = newAttackEvents
  s.enemies = s.enemies.filter(e => !deadEnemyIds.has(e.id))

  // ── Enemies retaliate against stationed units ─────────────────────────────
  const unitHpDeltas: Record<number, number> = {}
  const unitDeaths = new Set<number>()

  s.enemies = s.enemies.map(enemy => {
    let ucd = Math.max(0, enemy.unitAttackCd - dtMs)
    if (ucd <= 0) {
      const target = s.units
        .filter(u => u.stationed && !unitDeaths.has(u.id))
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
    for (let i = 0; i < addCount; i++) timers.push(RESPAWN_DELAY_MS)
    const toSpawn = timers.filter(t => t <= 0).length
    timers = timers.filter(t => t > 0)
    for (let i = 0; i < toSpawn; i++) newlySpawned.push(spawnUnitFromBuilding(tower))
    return { ...tower, respawnTimers: timers }
  })
  s.units = [...s.units, ...newlySpawned]

  // ── Check defeat ──────────────────────────────────────────────────────────
  if (s.lives <= 0) {
    s.log = [...s.log.slice(-9), 'Your base has fallen!']
    return { ...s, phase: 'defeat' }
  }

  // ── Check wave complete ───────────────────────────────────────────────────
  if (s.phase === 'wave' && s.spawnQueue.length === 0 && s.enemies.length === 0) {
    s.wavesCompleted += 1
    if (s.wavesCompleted >= TD_TOTAL_WAVES) {
      s.log = [...s.log.slice(-9), 'All 100 waves defeated! Legendary victory!']
      return { ...s, phase: 'victory' }
    }
    s.currentWaveIndex += 1
    if (s.wavesCompleted % TD_MILESTONE_EVERY === 0) {
      s.log = [...s.log.slice(-9), `🎉 ${s.wavesCompleted} waves cleared! Take a break — sell, move or upgrade!`]
      return { ...s, phase: 'milestone' }
    }
    s.nextWaveAt = s.gameTimeMs + BETWEEN_WAVE_MS
    const nextWave = generateWave(s.currentWaveIndex)
    s.log = [...s.log.slice(-9), `Wave ${s.wavesCompleted} cleared! Next in 5 s — ${nextWave.label}`]
    return { ...s, phase: 'between' }
  }

  if (s.phase === 'between' && s.gameTimeMs >= s.nextWaveAt) return startWave(s)

  return s
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
