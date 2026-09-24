// ─── /shmup: world state and shared helpers ─────────────────────────────────
//
// Constants, types, world creation and the seeded RNG that every other
// logic module (weapons, enemies, boss, collisions, shop) builds on. Pure: no
// DOM, canvas or audio.

import { mountPods, type PodKind } from './pods'

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
export const ARMOUR_SHIELD = 50
export const LASER_COOLDOWN = 0.3
export const DRONE_COOLDOWN = 0.3
export const DRONE_RADIUS = 18
export const MAX_BOMBS = 3
export const BOMB_DAMAGE = 10
export const BULLET_DAMAGE = 25
export const RAM_DAMAGE = 40
export const INVULN_TIME = 2.5
export const ENEMY_SHOT_SPEED = 90
export const BOSS_CREDITS = 200
export const MINI_CREDITS = 100
/** Smallest formation that can earn a flawless-wave capsule. */
export const BONUS_WAVE_MIN = 3

export type EnemyKind =
  | 'drifter' | 'swooper' | 'turret' | 'darter' | 'spinner'
  | 'splitter' | 'mine' | 'snake' | 'sniper' | 'carrier'

export interface EnemyDef {
  hp: number
  score: number
  credits: number
  w: number
  h: number
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
  /**
   * Per-kind movement parameter: swoop direction (±1) for swoopers, extra
   * hover depth for darters and snipers, phase for drifters, sway direction
   * for snakes.
   */
  p?: number
  /**
   * 'below' sends the wave up from behind the ship on a mirrored path, with a
   * warning arrow first (see REAR_WARNING). Only kinds in REAR_KINDS make
   * sense this way round.
   */
  from?: 'below'
}

/** Enemies whose flight works mirrored; the rest attack downward by design. */
export const REAR_KINDS: EnemyKind[] = ['drifter', 'swooper', 'spinner', 'snake']
/** Seconds of warning before a rear wave arrives. */
export const REAR_WARNING = 1.5

/**
 * One boss attack, fired every `every` seconds from the core or from each
 * living pod. Speeds are px/s; angles are radians (π/2 is straight down).
 */
export type Attack =
  /** A downward fan of `n` shots, `spread` radians between neighbours. */
  | { kind: 'fan'; every: number; n: number; spread: number; speed: number }
  /** `n` shots at the ship, each a little faster, so they arrive as a stream. */
  | { kind: 'aimed'; every: number; n: number; speed: number }
  /** A full ring of `n` shots. */
  | { kind: 'ring'; every: number; n: number; speed: number }
  /** `arms` shots per volley, rotating `spin` radians each volley. */
  | { kind: 'spiral'; every: number; arms: number; spin: number; speed: number }
  /** Release `n` enemies, unless `max` enemies are already on screen. */
  | { kind: 'summon'; every: number; enemy: EnemyKind; n: number; max: number }
  /** A vertical beam: flashes a warning line for `warn` s, then burns for `dur` s. */
  | { kind: 'laser'; every: number; warn: number; dur: number; width: number; track?: boolean }

export interface BossPhase {
  /**
   * When this phase takes over: 'exposed' once every pod is dead, or a number
   * once the boss's total remaining health fraction is at or below it. The
   * last phase whose condition holds wins; omit it for the opening phase.
   */
  when?: 'exposed' | number
  core: Attack[]
  pods: Attack[]
  /** Side-to-side sway speed (rad/s) and half-width (px). */
  sway: number
  swayWidth?: number
}

/** Which body art the renderer draws. */
export type BossLook = 'maw' | 'heart' | 'spore' | 'hydra' | 'core'

export interface BossDef {
  name: string
  look: BossLook
  /** Drawn and hit at this scale (1 = full boss; minibosses are smaller). */
  size?: number
  coreHp: number
  podHp: number
  /** Pod positions relative to the core; `ax`/`ay`/`freq` make them bob independently. */
  pods: { ox: number; oy: number; ax?: number; ay?: number; freq?: number }[]
  phases: BossPhase[]
}

export type Theme = 'flesh' | 'machine' | 'spore' | 'crystal' | 'core'

export interface LevelDef {
  name: string
  theme: Theme
  /** Difficulty tier (1 = first level); scales enemy health, fire rate and shot speed. */
  tier: number
  bossAt: number
  waves: Wave[]
  boss: BossDef
  /**
   * A halfway fight: once the timeline reaches `at` and the screen is clear,
   * it appears; the timeline (and scrolling) holds until it dies.
   */
  miniboss?: { at: number; boss: BossDef }
}

export interface Loadout {
  cannon: 1 | 2 | 3
  side: boolean
  rear: boolean
  homing: 0 | 1 | 2
  speed: 0 | 1 | 2
  /** Piercing bolts alongside the cannon. */
  laser: boolean
  /** Orbiting drones that fire and soak up enemy shots. */
  drones: 0 | 1 | 2
  /** +ARMOUR_SHIELD max shield. */
  armour: boolean
  /** Each level cuts the cannon's cooldown by a fifth. */
  rapid: 0 | 1 | 2
  /** Smart bombs in stock (consumable). */
  bombs: number
  /** Weapon pods mounted around the ship, in the order they were earned (see pods.ts). */
  pods: PodKind[]
}

/** Mount any weapon that arrives already maxed (e.g. a hand-built test loadout). */
function withPods(l: Loadout): Loadout {
  mountPods(l)
  return l
}

/** A deep copy: `pods` must never be shared between a live world and a saved carry. */
export function cloneLoadout(l: Loadout): Loadout {
  return { ...l, pods: [...l.pods] }
}

export interface Enemy {
  id: number
  kind: EnemyKind
  x: number // centre
  y: number
  sx: number // spawn x
  p: number
  /** Position within its wave (0 = first in); a snake's head is member 0. */
  member: number
  hp: number
  age: number
  fire: number
  flash: number
  /** Index of the level wave it belongs to; unset for enemies released by carriers, splitters and bosses. */
  wave?: number
  /** Came from behind: its scripted path runs mirrored, bottom to top. */
  below?: boolean
  /** Sniper lock-on: where it will fire, and seconds of warning left. */
  aim?: { x: number; y: number; t: number }
}

export interface Shot {
  x: number
  y: number
  vx: number
  vy: number
  dmg: number
  homing?: boolean
  /** Passes through what it hits (the laser upgrade). */
  pierce?: boolean
  /** Ids a piercing shot has already damaged (boss parts use -1 for the core, -2-i for pods). */
  hitIds?: number[]
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
  /** Index into the def's pods (-1 for the core), for per-pod bobbing. */
  index: number
  hp: number
  max: number
  w: number
  h: number
  /** Seconds until each of the current phase's attacks fires again. */
  timers: number[]
  /** Current spiral angle. */
  spin: number
  flash: number
}

export interface Laser {
  /** The part it's fired from; its x is followed when `track` is set. */
  part: BossPart
  x: number
  y: number
  t: number
  warn: number
  dur: number
  width: number
  track: boolean
}

export interface Boss {
  def: BossDef
  x: number
  y: number
  t: number
  core: BossPart
  pods: BossPart[]
  phase: number
  lasers: Laser[]
  /** A halfway miniboss: its death resumes the level instead of ending it. */
  mini: boolean
  dying: number // seconds since death; 0 while alive
}

export type Status = 'playing' | 'won' | 'gameover'

export interface World {
  level: LevelDef
  time: number
  scroll: number
  spawns: { at: number; kind: EnemyKind; x: number; p: number; i: number; below: boolean; wave: number }[]
  nextSpawn: number
  /** 'waiting' holds the timeline until the screen clears for the miniboss; 'active' holds it during the fight. */
  miniState: 'pending' | 'waiting' | 'active' | 'done'
  /** Per wave (index into level.waves): how its members fared, for the flawless-wave bonus. */
  waveStats: { n: number; killed: number; escaped: number }[]
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
  laserCd: number
  droneCd: number
  droneAngle: number
  /** Seconds until each pod fires again, by pod index. */
  podCd: number[]
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
  /** True on the tick the smart-bomb button went down. */
  bomb: boolean
}

export type EventKind =
  | 'shot' | 'hit' | 'explode' | 'bigexplode' | 'credit' | 'capsule'
  | 'hurt' | 'die' | 'boss' | 'bossdie' | 'podkill' | 'phase' | 'laser' | 'bomb' | 'rearwarn' | 'mount' | 'podlost' | 'wavebonus'

export interface GameEvent {
  kind: EventKind
  x: number
  y: number
  /** For 'capsule': which upgrade was granted. */
  detail?: string
}

// ── Setup ───────────────────────────────────────────────────────────────────
/**
 * Frozen, pods included: copy it with cloneLoadout(). A `{ ...START_LOADOUT }`
 * would share its pods array, and mounting a pod would then leak into every
 * later game — freezing makes that mistake throw instead.
 */
export const START_LOADOUT: Loadout = Object.freeze({
  cannon: 1, side: false, rear: false, homing: 0, speed: 0,
  laser: false, drones: 0, armour: false, rapid: 0, bombs: 1, pods: Object.freeze([]) as unknown as PodKind[],
} as const satisfies Loadout) as Loadout

export interface Carry {
  loadout: Loadout
  score: number
  credits: number
  lives: number
}

export function createWorld(level: LevelDef, carry: Carry, seed = 1): World {
  const spawns: World['spawns'] = []
  level.waves.forEach((w, waveIdx) => {
    for (let i = 0; i < w.n; i++) {
      spawns.push({ at: w.at + i * (w.gap ?? 0.35), kind: w.kind, x: w.x + i * (w.dx ?? 0), p: w.p ?? 0, i, below: w.from === 'below', wave: waveIdx })
    }
  })
  spawns.sort((a, b) => a.at - b.at)
  return {
    level,
    time: 0,
    scroll: 0,
    spawns,
    nextSpawn: 0,
    miniState: level.miniboss ? 'pending' : 'done',
    waveStats: level.waves.map(v => ({ n: v.n, killed: 0, escaped: 0 })),
    ship: { x: W / 2, y: H - 40, shield: maxShield(carry.loadout), invuln: 1.5, alive: true, respawn: 0 },
    loadout: withPods(cloneLoadout(carry.loadout)),
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
    laserCd: 0,
    droneCd: 0,
    droneAngle: 0,
    podCd: [],
    sideToggle: false,
    nextId: 1,
    rngState: seed >>> 0 || 1,
  }
}

export const MAX_CONTINUES = 3
export const CONTINUE_SECONDS = 10

/**
 * What a continue restarts the level with: the loadout and credits the
 * player had when the level began (so dying doesn't also cost upgrades),
 * fresh ships, and — arcade rules — the score back to zero.
 */
export function continueCarry(levelStart: Carry, lives: number): Carry {
  return { loadout: cloneLoadout(levelStart.loadout), credits: levelStart.credits, score: 0, lives }
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

/**
 * How much harder each tier is than tier 1. Tuned so a player who has been
 * buying upgrades still feels pressure: level 1 at tier 1 played right, and
 * level 2 at the same numbers was too easy once upgraded.
 */
export function tierScale(tier: number): { hp: number; fire: number; speed: number } {
  const t = Math.max(0, tier - 1)
  return { hp: 1 + 0.4 * t, fire: 1 + 0.18 * t, speed: 1 + 0.08 * t }
}

export function maxShield(l: Loadout): number {
  return MAX_SHIELD + (l.armour ? ARMOUR_SHIELD : 0)
}

/** Where drone `i` is orbiting right now. */
export function dronePos(w: World, i: number): { x: number; y: number } {
  const a = w.droneAngle + i * Math.PI
  return { x: w.ship.x + Math.cos(a) * DRONE_RADIUS, y: w.ship.y + Math.sin(a) * DRONE_RADIUS * 0.6 }
}

export function shipSpeed(l: Loadout): number {
  return BASE_SPEED + l.speed * SPEED_STEP
}

