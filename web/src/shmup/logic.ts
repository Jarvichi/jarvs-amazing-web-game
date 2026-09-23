// ─── /shmup: pure game logic ────────────────────────────────────────────────
//
// Everything that decides what happens in the vertical shooter lives here,
// with no DOM, canvas or audio, so it can be unit-tested and run headlessly.
// `step` advances the world one fixed tick and returns events (with positions)
// for the renderer's explosions and the sound effects to react to.
//
// Units are pixels and seconds on a 180×320 playfield, y pointing down. All
// randomness comes from the world's seeded RNG so runs are reproducible.

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

// ── Types ───────────────────────────────────────────────────────────────────
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

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  drifter: { hp: 2, score: 100, credits: 5, w: 12, h: 12, capsule: 0 },
  swooper: { hp: 1, score: 150, credits: 5, w: 12, h: 10, capsule: 0 },
  spinner: { hp: 3, score: 200, credits: 10, w: 12, h: 12, capsule: 0.05 },
  darter: { hp: 5, score: 250, credits: 15, w: 14, h: 14, capsule: 0.2 },
  turret: { hp: 8, score: 300, credits: 20, w: 16, h: 16, capsule: 0.25 },
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

const hit = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
  Math.abs(ax - bx) * 2 < aw + bw && Math.abs(ay - by) * 2 < ah + bh

export function shipSpeed(l: Loadout): number {
  return BASE_SPEED + l.speed * SPEED_STEP
}

// ── Ship & weapons ──────────────────────────────────────────────────────────
function stepShip(w: World, input: Input, dt: number, ev: GameEvent[]) {
  const s = w.ship
  if (!s.alive) {
    s.respawn -= dt
    if (s.respawn <= 0) {
      s.alive = true
      s.x = W / 2
      s.y = H - 40
      s.shield = MAX_SHIELD
      s.invuln = INVULN_TIME
    }
    return
  }
  s.invuln = Math.max(0, s.invuln - dt)
  const len = Math.hypot(input.dx, input.dy) || 1
  const v = shipSpeed(w.loadout)
  s.x += (input.dx / len) * v * dt + input.dragX
  s.y += (input.dy / len) * v * dt + input.dragY
  s.x = Math.max(MARGIN + SHIP_W, Math.min(W - MARGIN - SHIP_W, s.x))
  s.y = Math.max(40, Math.min(H - 12, s.y))

  w.fireCd -= dt
  w.homingCd -= dt
  if (!input.fire) return
  const l = w.loadout
  if (w.fireCd <= 0) {
    w.fireCd = FIRE_COOLDOWN
    const up = (x: number, vx = 0) => w.shots.push({ x: s.x + x, y: s.y - 8, vx, vy: -260, dmg: 1 })
    if (l.cannon === 1) up(0)
    else if (l.cannon === 2) { up(-3); up(3) }
    else { up(0); up(-4, -60); up(4, 60) }
    w.sideToggle = !w.sideToggle
    if (l.side && w.sideToggle) {
      w.shots.push({ x: s.x - 6, y: s.y, vx: -220, vy: 0, dmg: 1 })
      w.shots.push({ x: s.x + 6, y: s.y, vx: 220, vy: 0, dmg: 1 })
    }
    if (l.rear && !w.sideToggle) w.shots.push({ x: s.x, y: s.y + 8, vx: 0, vy: 220, dmg: 1 })
    ev.push({ kind: 'shot', x: s.x, y: s.y })
  }
  if (l.homing > 0 && w.homingCd <= 0) {
    w.homingCd = HOMING_COOLDOWN
    for (let i = 0; i < l.homing; i++) {
      const side = i === 0 ? -1 : 1
      w.shots.push({ x: s.x + side * 6, y: s.y, vx: side * 60, vy: -80, dmg: 2, homing: true })
    }
  }
}

function nearestTarget(w: World, x: number, y: number): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null
  let bestD = Infinity
  const consider = (tx: number, ty: number) => {
    const d = (tx - x) ** 2 + (ty - y) ** 2
    if (ty > -10 && d < bestD) { bestD = d; best = { x: tx, y: ty } }
  }
  for (const e of w.enemies) consider(e.x, e.y)
  if (w.boss && !w.boss.dying) {
    for (const p of w.boss.pods) if (p.hp > 0) consider(w.boss.x + p.ox, w.boss.y + p.oy)
    if (w.boss.pods.every(p => p.hp <= 0)) consider(w.boss.x, w.boss.y)
  }
  return best
}

function stepShots(w: World, dt: number) {
  for (const b of w.shots) {
    if (b.homing) {
      const t = nearestTarget(w, b.x, b.y)
      const speed = 170
      if (t) {
        const a = Math.atan2(t.y - b.y, t.x - b.x)
        b.vx += (Math.cos(a) * speed - b.vx) * Math.min(1, 6 * dt)
        b.vy += (Math.sin(a) * speed - b.vy) * Math.min(1, 6 * dt)
      } else {
        b.vy += (-speed - b.vy) * Math.min(1, 4 * dt)
      }
    }
    b.x += b.vx * dt
    b.y += b.vy * dt
  }
  for (const b of w.enemyShots) {
    b.x += b.vx * dt
    b.y += b.vy * dt
  }
  const inside = (b: Shot) => b.x > -8 && b.x < W + 8 && b.y > -8 && b.y < H + 8
  w.shots = w.shots.filter(inside)
  w.enemyShots = w.enemyShots.filter(inside)
}

// ── Enemies ─────────────────────────────────────────────────────────────────
function aimAt(w: World, x: number, y: number, speed = ENEMY_SHOT_SPEED, spread = 0) {
  const a = Math.atan2(w.ship.y - y, w.ship.x - x) + spread
  w.enemyShots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg: BULLET_DAMAGE })
}

function moveEnemy(w: World, e: Enemy, dt: number) {
  const t = e.age
  switch (e.kind) {
    case 'drifter':
      e.y += 50 * dt
      e.x = e.sx + Math.sin(t * 2 + e.p) * 25
      break
    case 'swooper': {
      const dir = e.p || 1
      e.y = -10 + 130 * t - Math.max(0, t - 1) ** 2 * 60
      e.x = e.sx + dir * Math.max(0, t - 0.7) ** 2 * 90
      break
    }
    case 'spinner':
      e.y += 70 * dt
      if (e.y > 20 && (e.fire -= dt) <= 0) { e.fire = 2; aimAt(w, e.x, e.y) }
      break
    case 'turret':
      e.y += SCROLL_SPEED * dt
      if (e.y > 16 && (e.fire -= dt) <= 0) { e.fire = 1.6; aimAt(w, e.x, e.y) }
      break
    case 'darter': {
      const hover = 60 + (e.p || 0)
      if (t < 1.2) e.y += (hover - e.y) * Math.min(1, 4 * dt)
      else if (t < 2.6) {
        if ((e.fire -= dt) <= 0) {
          e.fire = 99
          for (const s of [-0.25, 0, 0.25]) aimAt(w, e.x, e.y, 100, s)
        }
      } else {
        e.y += 170 * dt
        e.x += Math.sign(w.ship.x - e.x) * 60 * dt
      }
      break
    }
  }
}

function killEnemy(w: World, e: Enemy, ev: GameEvent[]) {
  const def = ENEMIES[e.kind]
  w.score += def.score
  ev.push({ kind: e.kind === 'turret' || e.kind === 'darter' ? 'bigexplode' : 'explode', x: e.x, y: e.y })
  w.pickups.push({ x: e.x, y: e.y, kind: 'credit', value: def.credits })
  if (rand(w) < def.capsule) w.pickups.push({ x: e.x + 6, y: e.y, kind: 'capsule', value: 0 })
}

function stepEnemies(w: World, dt: number, ev: GameEvent[]) {
  while (w.nextSpawn < w.spawns.length && w.spawns[w.nextSpawn].at <= w.time) {
    const s = w.spawns[w.nextSpawn++]
    const def = ENEMIES[s.kind]
    w.enemies.push({
      id: w.nextId++, kind: s.kind, x: s.x, y: -def.h, sx: s.x, p: s.p,
      hp: def.hp, age: 0, fire: 0.6 + rand(w), flash: 0,
    })
  }
  for (const e of w.enemies) {
    e.age += dt
    e.flash = Math.max(0, e.flash - dt)
    moveEnemy(w, e, dt)
  }

  // Player shots vs enemies
  for (const b of w.shots) {
    for (const e of w.enemies) {
      if (e.hp <= 0) continue
      const def = ENEMIES[e.kind]
      if (!hit(b.x, b.y, 3, 6, e.x, e.y, def.w, def.h)) continue
      e.hp -= b.dmg
      e.flash = 0.06
      b.y = -100 // spent
      if (e.hp <= 0) killEnemy(w, e, ev)
      else ev.push({ kind: 'hit', x: b.x, y: e.y })
      break
    }
  }

  w.enemies = w.enemies.filter(e => e.hp > 0 && e.y < H + 24 && e.x > -40 && e.x < W + 40 && e.y > -60)
}

// ── Boss ────────────────────────────────────────────────────────────────────
function spawnBoss(w: World, ev: GameEvent[]) {
  const d = w.level.boss
  const part = (ox: number, oy: number, hp: number, pw: number, ph: number): BossPart =>
    ({ ox, oy, hp, max: hp, w: pw, h: ph, fire: 1 + rand(w), flash: 0 })
  w.boss = {
    def: d,
    x: W / 2,
    y: -50,
    t: 0,
    core: part(0, 0, d.coreHp, 36, 24),
    pods: d.pods.map(p => part(p.ox, p.oy, d.podHp, 14, 14)),
    dying: 0,
  }
  ev.push({ kind: 'boss', x: W / 2, y: 0 })
}

export function coreExposed(b: Boss): boolean {
  return b.pods.every(p => p.hp <= 0)
}

function stepBoss(w: World, dt: number, ev: GameEvent[]) {
  const b = w.boss
  if (!b) return
  b.t += dt
  if (b.dying > 0) {
    b.dying += dt
    if (Math.floor(b.dying * 8) !== Math.floor((b.dying - dt) * 8)) {
      ev.push({ kind: 'explode', x: b.x + (rand(w) - 0.5) * 60, y: b.y + (rand(w) - 0.5) * 36 })
    }
    if (b.dying > 2.5) w.status = 'won'
    return
  }

  // Enter, then sway across the top of the screen.
  if (b.y < 64) b.y += 30 * dt
  else b.x = W / 2 + Math.sin(b.t * b.def.sway) * 36

  const exposed = coreExposed(b)
  for (const p of b.pods) {
    p.flash = Math.max(0, p.flash - dt)
    if (p.hp > 0 && b.y >= 64 && (p.fire -= dt) <= 0) {
      p.fire = 1.3
      aimAt(w, b.x + p.ox, b.y + p.oy, 100)
    }
  }
  const c = b.core
  c.flash = Math.max(0, c.flash - dt)
  if (b.y >= 64 && (c.fire -= dt) <= 0) {
    c.fire = exposed ? 1.4 : 2.6
    const n = b.def.spread + (exposed ? 2 : 0)
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.22
      w.enemyShots.push({ x: b.x, y: b.y + 12, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, dmg: BULLET_DAMAGE })
    }
  }

  for (const s of w.shots) {
    for (const p of [...b.pods, c]) {
      if (p.hp <= 0) continue
      if (!hit(s.x, s.y, 3, 6, b.x + p.ox, b.y + p.oy, p.w, p.h)) continue
      const hy = s.y
      s.y = -100 // spent
      if (p === c && !exposed) { ev.push({ kind: 'hit', x: s.x, y: hy }); break } // armoured
      p.hp -= s.dmg
      p.flash = 0.06
      if (p.hp <= 0) {
        if (p === c) {
          b.dying = dt
          w.score += 5000
          // Paid out directly: a dropped pickup couldn't reach the ship before
          // the level ends.
          w.credits += BOSS_CREDITS
          ev.push({ kind: 'bossdie', x: b.x, y: b.y })
        } else {
          w.score += 1000
          ev.push({ kind: 'podkill', x: b.x + p.ox, y: b.y + p.oy })
        }
      }
      break
    }
  }
}

// ── Pickups & damage ────────────────────────────────────────────────────────
const CAPSULE_UPGRADES = ['cannon', 'side', 'rear', 'homing', 'speed', 'shield'] as const

/** Grant a random upgrade the ship doesn't already max out; shield otherwise. */
export function applyCapsule(w: World): string {
  const l = w.loadout
  const options = CAPSULE_UPGRADES.filter(u =>
    (u === 'cannon' && l.cannon < 3) || (u === 'side' && !l.side) || (u === 'rear' && !l.rear) ||
    (u === 'homing' && l.homing < 2) || (u === 'speed' && l.speed < 2))
  const pick = options.length ? options[Math.floor(rand(w) * options.length)] : 'shield'
  switch (pick) {
    case 'cannon': l.cannon = (l.cannon + 1) as Loadout['cannon']; break
    case 'side': l.side = true; break
    case 'rear': l.rear = true; break
    case 'homing': l.homing = (l.homing + 1) as Loadout['homing']; break
    case 'speed': l.speed = (l.speed + 1) as Loadout['speed']; break
    case 'shield': w.ship.shield = MAX_SHIELD; break
  }
  return pick
}

function damageShip(w: World, amount: number, ev: GameEvent[]) {
  const s = w.ship
  if (!s.alive || s.invuln > 0) return
  s.shield -= amount
  s.invuln = 0.4
  ev.push({ kind: 'hurt', x: s.x, y: s.y })
  if (s.shield > 0) return
  s.alive = false
  s.respawn = 2
  w.lives--
  // Losing a ship costs a cannon level.
  w.loadout.cannon = Math.max(1, w.loadout.cannon - 1) as Loadout['cannon']
  w.enemyShots = []
  ev.push({ kind: 'die', x: s.x, y: s.y })
  if (w.lives <= 0) w.status = 'gameover'
}

function stepCollisions(w: World, dt: number, ev: GameEvent[]) {
  const s = w.ship
  for (const p of w.pickups) {
    p.y += (p.kind === 'credit' ? 45 : 35) * dt
    // Credits drift toward a nearby ship so they're satisfying to hoover up.
    if (s.alive && Math.hypot(p.x - s.x, p.y - s.y) < 28) {
      p.x += (s.x - p.x) * Math.min(1, 6 * dt)
      p.y += (s.y - p.y) * Math.min(1, 6 * dt)
    }
  }
  if (s.alive) {
    w.pickups = w.pickups.filter(p => {
      if (!hit(p.x, p.y, 10, 10, s.x, s.y, SHIP_W + 6, SHIP_H + 6)) return true
      if (p.kind === 'credit') {
        w.credits += p.value
        ev.push({ kind: 'credit', x: p.x, y: p.y })
      } else {
        ev.push({ kind: 'capsule', x: p.x, y: p.y, detail: applyCapsule(w) })
      }
      return false
    })
  }
  w.pickups = w.pickups.filter(p => p.y < H + 10)

  if (!s.alive) return
  for (const b of w.enemyShots) {
    if (hit(b.x, b.y, 3, 3, s.x, s.y, SHIP_W, SHIP_H)) {
      b.y = H + 100
      damageShip(w, b.dmg, ev)
    }
  }
  for (const e of w.enemies) {
    const def = ENEMIES[e.kind]
    if (e.hp > 0 && hit(e.x, e.y, def.w, def.h, s.x, s.y, SHIP_W, SHIP_H)) {
      damageShip(w, RAM_DAMAGE, ev)
      e.hp -= 5
      if (e.hp <= 0) killEnemy(w, e, ev)
    }
  }
  const b = w.boss
  if (b && !b.dying && hit(b.x, b.y, 40, 28, s.x, s.y, SHIP_W, SHIP_H)) damageShip(w, RAM_DAMAGE, ev)
}

/** Advance the world by one tick. Returns what happened this tick. */
export function step(w: World, input: Input, dt: number): GameEvent[] {
  const ev: GameEvent[] = []
  if (w.status !== 'playing') return ev
  w.time += dt
  if (!w.boss) w.scroll += SCROLL_SPEED * dt

  stepShip(w, input, dt, ev)
  stepEnemies(w, dt, ev)
  if (!w.boss && w.time >= w.level.bossAt && w.nextSpawn >= w.spawns.length && w.enemies.length === 0) {
    spawnBoss(w, ev)
  }
  stepBoss(w, dt, ev)
  stepShots(w, dt)
  stepCollisions(w, dt, ev)
  return ev
}

// ── Shop ────────────────────────────────────────────────────────────────────
export type ShopId = 'cannon' | 'side' | 'rear' | 'homing' | 'speed' | 'life'

export interface ShopItem {
  id: ShopId
  name: string
  blurb: string
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'cannon', name: 'CANNON UP', blurb: 'WIDER FORWARD FIRE' },
  { id: 'side', name: 'SIDE SHOTS', blurb: 'FIRE LEFT AND RIGHT' },
  { id: 'rear', name: 'REAR GUN', blurb: 'COVER YOUR TAIL' },
  { id: 'homing', name: 'HOMING', blurb: 'SEEKER MISSILES' },
  { id: 'speed', name: 'SPEED UP', blurb: 'FASTER SHIP' },
  { id: 'life', name: 'EXTRA SHIP', blurb: '+1 LIFE' },
]

export const MAX_LIVES = 5

/** Price of the next level of an item, or null if it's maxed out. */
export function priceOf(id: ShopId, c: Carry): number | null {
  const l = c.loadout
  switch (id) {
    case 'cannon': return l.cannon < 3 ? 250 * l.cannon : null
    case 'side': return l.side ? null : 300
    case 'rear': return l.rear ? null : 200
    case 'homing': return l.homing < 2 ? 350 * (l.homing + 1) : null
    case 'speed': return l.speed < 2 ? 150 * (l.speed + 1) : null
    case 'life': return c.lives < MAX_LIVES ? 800 : null
  }
}

export type BuyResult = 'ok' | 'maxed' | 'poor'

export function buy(c: Carry, id: ShopId): BuyResult {
  const price = priceOf(id, c)
  if (price === null) return 'maxed'
  if (c.credits < price) return 'poor'
  c.credits -= price
  const l = c.loadout
  switch (id) {
    case 'cannon': l.cannon = (l.cannon + 1) as Loadout['cannon']; break
    case 'side': l.side = true; break
    case 'rear': l.rear = true; break
    case 'homing': l.homing = (l.homing + 1) as Loadout['homing']; break
    case 'speed': l.speed = (l.speed + 1) as Loadout['speed']; break
    case 'life': c.lives++; break
  }
  return 'ok'
}
