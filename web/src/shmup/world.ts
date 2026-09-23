// ─── /shmup: world state and shared helpers ─────────────────────────────────
//
// Constants, types, world creation and the seeded RNG that every other
// logic module (weapons, enemies, boss, collisions, shop) builds on. Pure: no
// DOM, canvas or audio.

export const W = 180
export const H = 320
/** Side walls of the tunnel — the ship is kept between them. */
export const MARGIN = 12
export const SCROLL_SPEED = 24

export const SHIP_W = 8 // hitbox, smaller than the 16px sprite on purpose
export const SHIP_H = 10
export const BASE_SPEED = 95
export const SPEED_STEP = 25
export const FIRE_COOLDOWN = 0.12
export const HOMING_COOLDOWN = 0.7
export const MAX_SHIELD = 100
export const BULLET_DAMAGE = 25
export const RAM_DAMAGE = 40
export const INVULN_TIME = 2.5
export const ENEMY_SHOT_SPEED = 90
export const BOSS_CREDITS = 200

export type EnemyKind = 'drifter' | 'swooper' | 'turret' | 'darter' | 'spinner'

export interface EnemyDef {
  hp: number
  score: number
  credits: number
  w: number
  h: number
  /** Chance (0–1) of also dropping a weapon capsule. */
  capsule: number
}

/** A group of enemies entering together. Members spawn `gap` seconds apart. */
export interface Wave {
  at: number
  kind: EnemyKind
  n: number
  x: number
  gap?: number
  /** x offset added per member. */
  dx?: number
  /** Movement parameter: swoop direction (±1), darter hover depth, etc. */
  p?: number
}

export interface BossDef {
  name: string
  coreHp: number
  pods: { ox: number; oy: number }[]
  podHp: number
  /** Shots in the core's fan attack. */
  spread: number
  sway: number
}

export interface LevelDef {
  name: string
  theme: 'flesh' | 'machine'
  bossAt: number
  waves: Wave[]
  boss: BossDef
}

export interface Loadout {
  cannon: 1 | 2 | 3
  side: boolean
  rear: boolean
  homing: 0 | 1 | 2
  speed: 0 | 1 | 2
}

export interface Enemy {
  id: number
  kind: EnemyKind
  x: number // centre
  y: number
  sx: number // spawn x
  p: number
  hp: number
  age: number
  fire: number
  flash: number
}

export interface Shot {
  x: number
  y: number
  vx: number
  vy: number
  dmg: number
  homing?: boolean
}

export interface Pickup {
  x: number
  y: number
  kind: 'credit' | 'capsule'
  value: number
}

export interface BossPart {
  ox: number
  oy: number
  hp: number
  max: number
  w: number
  h: number
  fire: number
  flash: number
}

export interface Boss {
  def: BossDef
  x: number
  y: number
  t: number
  core: BossPart
  pods: BossPart[]
  dying: number // seconds since death; 0 while alive
}

export type Status = 'playing' | 'won' | 'gameover'

export interface World {
  level: LevelDef
  time: number
  scroll: number
  spawns: { at: number; kind: EnemyKind; x: number; p: number }[]
  nextSpawn: number
  ship: { x: number; y: number; shield: number; invuln: number; alive: boolean; respawn: number }
  loadout: Loadout
  enemies: Enemy[]
  shots: Shot[]
  enemyShots: Shot[]
  pickups: Pickup[]
  boss: Boss | null
  score: number
  credits: number
  lives: number
  status: Status
  fireCd: number
  homingCd: number
  sideToggle: boolean
  nextId: number
  rngState: number
}

export interface Input {
  /** Digital direction, each −1, 0 or 1. */
  dx: number
  dy: number
  /** Pointer drag since the last tick, in playfield pixels. */
  dragX: number
  dragY: number
  fire: boolean
}

export type EventKind =
  | 'shot' | 'hit' | 'explode' | 'bigexplode' | 'credit' | 'capsule'
  | 'hurt' | 'die' | 'boss' | 'bossdie' | 'podkill'

export interface GameEvent {
  kind: EventKind
  x: number
  y: number
  /** For 'capsule': which upgrade was granted. */
  detail?: string
}

// ── Setup ───────────────────────────────────────────────────────────────────
export const START_LOADOUT: Loadout = { cannon: 1, side: false, rear: false, homing: 0, speed: 0 }

export interface Carry {
  loadout: Loadout
  score: number
  credits: number
  lives: number
}

export function createWorld(level: LevelDef, carry: Carry, seed = 1): World {
  const spawns: World['spawns'] = []
  for (const w of level.waves) {
    for (let i = 0; i < w.n; i++) {
      spawns.push({ at: w.at + i * (w.gap ?? 0.35), kind: w.kind, x: w.x + i * (w.dx ?? 0), p: w.p ?? 0 })
    }
  }
  spawns.sort((a, b) => a.at - b.at)
  return {
    level,
    time: 0,
    scroll: 0,
    spawns,
    nextSpawn: 0,
    ship: { x: W / 2, y: H - 40, shield: MAX_SHIELD, invuln: 1.5, alive: true, respawn: 0 },
    loadout: { ...carry.loadout },
    enemies: [],
    shots: [],
    enemyShots: [],
    pickups: [],
    boss: null,
    score: carry.score,
    credits: carry.credits,
    lives: carry.lives,
    status: 'playing',
    fireCd: 0,
    homingCd: 0,
    sideToggle: false,
    nextId: 1,
    rngState: seed >>> 0 || 1,
  }
}

/** mulberry32 — small, fast, seedable. */
export function rand(w: World): number {
  w.rngState = (w.rngState + 0x6d2b79f5) >>> 0
  let t = w.rngState
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const hit = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
  Math.abs(ax - bx) * 2 < aw + bw && Math.abs(ay - by) * 2 < ah + bh

export function shipSpeed(l: Loadout): number {
  return BASE_SPEED + l.speed * SPEED_STEP
}

