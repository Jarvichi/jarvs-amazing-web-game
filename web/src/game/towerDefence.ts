// ─── Tower Defence — pure game logic ──────────────────────────────────────────
// No React imports. All state is plain objects; tick() returns a new state.

import { UnitTemplate, UnitTag } from './types'

// ── Grid ──────────────────────────────────────────────────────────────────────

export const TD_COLS = 13
export const TD_ROWS = 7

export type GridPos = { col: number; row: number }

// Path as ordered grid positions (enemies walk this route left → right).
// Shape: enters top-left, winds down, exits bottom-right.
export const TD_PATH: GridPos[] = [
  { col: 0, row: 0 },
  { col: 1, row: 0 },
  { col: 2, row: 0 },
  { col: 3, row: 0 },
  { col: 3, row: 1 },
  { col: 3, row: 2 },
  { col: 2, row: 2 },
  { col: 1, row: 2 },
  { col: 0, row: 2 },
  { col: 0, row: 3 },
  { col: 0, row: 4 },
  { col: 1, row: 4 },
  { col: 2, row: 4 },
  { col: 3, row: 4 },
  { col: 4, row: 4 },
  { col: 5, row: 4 },
  { col: 5, row: 3 },
  { col: 5, row: 2 },
  { col: 6, row: 2 },
  { col: 7, row: 2 },
  { col: 8, row: 2 },
  { col: 8, row: 1 },
  { col: 8, row: 0 },
  { col: 9, row: 0 },
  { col: 10, row: 0 },
  { col: 10, row: 1 },
  { col: 10, row: 2 },
  { col: 10, row: 3 },
  { col: 10, row: 4 },
  { col: 10, row: 5 },
  { col: 10, row: 6 },
  { col: 11, row: 6 },
  { col: 12, row: 6 },
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

export interface TDTower {
  id: number
  col: number
  row: number
  template: UnitTemplate
  hp: number
  maxHp: number
  attackCooldownRemaining: number   // ms until next attack
  rangeInCells: number
  upgrades: number                  // 0–TD_MAX_UPGRADES
}

export interface TDEnemy {
  id: number
  template: TDEnemyTemplate
  hp: number
  maxHp: number
  // Position along the path: integer = at node, fractional = between nodes
  pathProgress: number   // 0 = start, TD_PATH.length-1 = end
  // Pixel position (derived from pathProgress) — used only for UI
  x: number
  y: number
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

export type TDPhase = 'prep' | 'wave' | 'between' | 'victory' | 'defeat'

export interface TDGameState {
  phase: TDPhase
  lives: number
  mana: number                  // spendable currency (earn from kills, spend to place towers)
  wavesCompleted: number
  currentWaveIndex: number
  gameTimeMs: number
  towers: TDTower[]
  enemies: TDEnemy[]
  spawnQueue: SpawnEntry[]
  waveSpawnTotal: number        // total spawns queued when current wave started (for progress bar)
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
export const TD_TOTAL_WAVES = TD_WAVES.length
export const TD_CELL_PX = 48
export const TD_STARTING_MANA = 120
export const TD_MAX_UPGRADES = 2
const BETWEEN_WAVE_MS = 5000
// Strength bonus multiplier
const STRENGTH_MULT = 1.5

/** Mana cost to place a tower based on its stats. */
export function towerCost(template: UnitTemplate): number {
  return Math.max(5, Math.round(template.attack * 2 + template.maxHp / 20))
}

/** Mana cost to upgrade a tower to the next tier. */
export function upgradeCost(tower: TDTower): number {
  return Math.round(towerCost(tower.template) * (tower.upgrades + 1))
}

/** ATK multiplier for a tower at its current upgrade tier. */
export function upgradeAttackMult(upgrades: number): number {
  return 1 + upgrades * 0.5
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

function towerCanHit(tower: TDTower, enemy: TDEnemy): boolean {
  // Non-bypassing towers can't hit flying enemies
  if (enemy.template.flying && !tower.template.bypassWall) return false
  const tx = tower.col * TD_CELL_PX + TD_CELL_PX / 2
  const ty = tower.row * TD_CELL_PX + TD_CELL_PX / 2
  return dist(tx, ty, enemy.x, enemy.y) <= tower.rangeInCells * TD_CELL_PX
}

function damageDealt(tower: TDTower, enemy: TDEnemy): number {
  let dmg = Math.round(tower.template.attack * upgradeAttackMult(tower.upgrades))
  if (tower.template.strengths?.some(tag => enemy.template.tags.includes(tag))) {
    dmg = Math.round(dmg * STRENGTH_MULT)
  }
  return dmg
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
    enemies: [],
    spawnQueue: [],
    waveSpawnTotal: 0,
    nextWaveAt: 0,
    log: ['Place your towers, then press START WAVE.'],
    attackEvents: [],
    score: 0,
    availableTemplates,
    remainingPlacements: { ...placementsPerTemplate },
    mode,
  }
}

/** Place a tower on the grid. Returns updated state or null if invalid. */
export function placeTower(
  state: TDGameState,
  template: UnitTemplate,
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

  const rangeInCells = Math.max(1, Math.round(template.attackRange / TD_CELL_PX))
  const tower: TDTower = {
    id: nextId(),
    col, row,
    template,
    hp: template.maxHp,
    maxHp: template.maxHp,
    attackCooldownRemaining: 0,
    rangeInCells,
    upgrades: 0,
  }
  return {
    ...state,
    mana: state.mana - cost,
    towers: [...state.towers, tower],
    remainingPlacements: {
      ...state.remainingPlacements,
      [template.name]: remaining - 1,
    },
    log: [...state.log.slice(-9), `Placed ${template.name} (-${cost} mana).`],
  }
}

/** Remove a tower and refund its placement slot. */
export function removeTower(state: TDGameState, towerId: number): TDGameState {
  const tower = state.towers.find(t => t.id === towerId)
  if (!tower) return state
  const refund = Math.floor(towerCost(tower.template) * 0.5)
  return {
    ...state,
    mana: state.mana + refund,
    towers: state.towers.filter(t => t.id !== towerId),
    remainingPlacements: {
      ...state.remainingPlacements,
      [tower.template.name]: (state.remainingPlacements[tower.template.name] ?? 0) + 1,
    },
    log: [...state.log.slice(-9), `Removed ${tower.template.name} (+${refund} mana).`],
  }
}

/** Upgrade a tower's attack power. Returns null if not affordable or at max tier. */
export function upgradeTower(state: TDGameState, towerId: number): TDGameState | null {
  const tower = state.towers.find(t => t.id === towerId)
  if (!tower) return null
  if (tower.upgrades >= TD_MAX_UPGRADES) return null
  const cost = upgradeCost(tower)
  if (state.mana < cost) return null
  return {
    ...state,
    mana: state.mana - cost,
    towers: state.towers.map(t =>
      t.id === towerId ? { ...t, upgrades: t.upgrades + 1 } : t,
    ),
    log: [...state.log.slice(-9), `${tower.template.name} upgraded to tier ${tower.upgrades + 1}! (-${cost} mana)`],
  }
}

/** Move a placed tower to a new cell at no mana cost. */
export function moveTower(state: TDGameState, towerId: number, col: number, row: number): TDGameState | null {
  if (isPathCell(col, row)) return null
  if (col < 0 || col >= TD_COLS || row < 0 || row >= TD_ROWS) return null
  const tower = state.towers.find(t => t.id === towerId)
  if (!tower) return null
  if (state.towers.some(t => t.id !== towerId && t.col === col && t.row === row)) return null
  return {
    ...state,
    towers: state.towers.map(t => t.id === towerId ? { ...t, col, row } : t),
    log: [...state.log.slice(-9), `Moved ${tower.template.name}.`],
  }
}

/** Begin the next wave from prep or between phase. */
export function startWave(state: TDGameState): TDGameState {
  if (state.phase !== 'prep' && state.phase !== 'between') return state
  const waveDef = TD_WAVES[state.currentWaveIndex]
  if (!waveDef) return state
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
  if (state.phase === 'prep' || state.phase === 'victory' || state.phase === 'defeat') {
    return state
  }

  let s = { ...state, gameTimeMs: state.gameTimeMs + dtMs }
  s.towers = [...s.towers]
  s.enemies = [...s.enemies]
  s.spawnQueue = [...s.spawnQueue]
  s.log = [...s.log]

  // ── Spawn enemies from queue ───────────────────────────────────────────────
  while (s.spawnQueue.length > 0) {
    const next = s.spawnQueue[s.spawnQueue.length - 1]
    if (next.spawnAt > s.gameTimeMs) break
    s.spawnQueue = s.spawnQueue.slice(0, -1)
    const hp = Math.round(next.template.hp * next.hpMult)
    const startXY = pathIndexToXY(0)
    s.enemies = [...s.enemies, {
      id: nextId(),
      template: next.template,
      hp,
      maxHp: hp,
      pathProgress: 0,
      x: startXY.x,
      y: startXY.y,
    }]
  }

  // ── Move enemies ───────────────────────────────────────────────────────────
  const dtSec = dtMs / 1000
  let livesLost = 0
  const survivingEnemies: TDEnemy[] = []

  for (const enemy of s.enemies) {
    const newProgress = enemy.pathProgress + enemy.template.speed * dtSec
    if (newProgress >= TD_PATH.length - 1) {
      // Reached the end
      livesLost += enemy.template.attack
    } else {
      const xy = pathIndexToXY(newProgress)
      survivingEnemies.push({ ...enemy, pathProgress: newProgress, x: xy.x, y: xy.y })
    }
  }
  s.enemies = survivingEnemies

  if (livesLost > 0) {
    s.lives = Math.max(0, s.lives - livesLost)
    s.log = [...s.log.slice(-9), `${livesLost} ${livesLost === 1 ? 'enemy' : 'enemies'} reached your base!`]
  }

  // ── Tower attacks ──────────────────────────────────────────────────────────
  const deadEnemyIds = new Set<number>()
  const updatedTowers: TDTower[] = []
  // Prune expired attack events, then collect new ones this tick
  const newAttackEvents: TDAttackEvent[] = s.attackEvents.filter(e => e.expiresAt > s.gameTimeMs)

  for (const tower of s.towers) {
    let cd = Math.max(0, tower.attackCooldownRemaining - dtMs)
    if (cd <= 0 && s.enemies.length > 0) {
      // Pick the enemy furthest along the path that is in range
      const targets = s.enemies
        .filter(e => !deadEnemyIds.has(e.id) && towerCanHit(tower, e))
        .sort((a, b) => b.pathProgress - a.pathProgress)
      if (targets.length > 0) {
        const target = targets[0]
        const dmg = damageDealt(tower, target)
        const idx = s.enemies.findIndex(e => e.id === target.id)
        if (idx !== -1) {
          const newHp = s.enemies[idx].hp - dmg
          if (newHp <= 0) {
            deadEnemyIds.add(target.id)
            s.score += target.template.reward
            s.mana += target.template.reward
          } else {
            s.enemies = s.enemies.map(e => e.id === target.id ? { ...e, hp: newHp } : e)
          }
        }
        // Emit visual attack event
        const txy = cellToXY(tower.col, tower.row)
        newAttackEvents.push({
          id: nextId(),
          fromX: txy.x, fromY: txy.y,
          toX: target.x, toY: target.y,
          expiresAt: s.gameTimeMs + 500,
        })
        cd = tower.template.attackCooldownMs
      }
    }
    updatedTowers.push({ ...tower, attackCooldownRemaining: cd })
  }
  s.attackEvents = newAttackEvents

  s.towers = updatedTowers
  s.enemies = s.enemies.filter(e => !deadEnemyIds.has(e.id))

  // ── Check defeat ───────────────────────────────────────────────────────────
  if (s.lives <= 0) {
    s.log = [...s.log.slice(-9), 'Your base has fallen!']
    return { ...s, phase: 'defeat' }
  }

  // ── Check wave complete ────────────────────────────────────────────────────
  if (s.phase === 'wave' && s.spawnQueue.length === 0 && s.enemies.length === 0) {
    s.wavesCompleted += 1
    if (s.wavesCompleted >= TD_TOTAL_WAVES) {
      s.log = [...s.log.slice(-9), 'All waves defeated! Victory!']
      return { ...s, phase: 'victory' }
    }
    s.currentWaveIndex += 1
    s.nextWaveAt = s.gameTimeMs + BETWEEN_WAVE_MS
    const nextWave = TD_WAVES[s.currentWaveIndex]
    s.log = [...s.log.slice(-9), `Wave ${s.wavesCompleted} cleared! Next wave in 5 s — ${nextWave?.label ?? ''}`]
    return { ...s, phase: 'between' }
  }

  // ── Auto-advance between phase ─────────────────────────────────────────────
  if (s.phase === 'between' && s.gameTimeMs >= s.nextWaveAt) {
    return startWave(s)
  }

  return s
}

/** Compute ticket reward for arcade mode based on waves cleared. */
export function calcTicketReward(wavesCompleted: number): number {
  return wavesCompleted * 5
}

/** Compute city gold reward for city mode based on waves cleared. */
export function calcGoldReward(wavesCompleted: number): number {
  return wavesCompleted * 5
}

export { ENEMY_TEMPLATES }
