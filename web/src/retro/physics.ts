// ─── Retro platformer: pure world logic ─────────────────────────────────────
//
// Everything that decides what happens in the /retro game lives here, with no
// DOM, canvas or audio — so it can be unit-tested and stepped headlessly.
// `step` advances the world by one fixed tick and returns the events that
// happened (for sound effects and screen transitions to react to).
//
// Units are pixels and seconds. The tile grid is 16px; levels are ASCII maps
// (see levels.ts for the legend).

export const TILE = 16

export const GRAVITY = 900
export const MAX_FALL = 360
export const RUN_MAX = 110
export const RUN_ACCEL = 900
export const AIR_ACCEL = 600
export const FRICTION = 1000
export const JUMP_V = 300
/** Upward speed a jump is cut to when the button is released early. */
export const JUMP_CUT_V = 110
export const STOMP_BOUNCE = 230
export const COYOTE_TIME = 0.08
export const JUMP_BUFFER_TIME = 0.1
export const ENEMY_SPEED = 30

export const COIN_SCORE = 10
export const STOMP_SCORE = 50
export const FLAG_SCORE = 500

export type Theme = 'hills' | 'cave' | 'sky'

export interface LevelDef {
  name: string
  theme: Theme
  map: string[]
}

export interface Level {
  name: string
  theme: Theme
  w: number
  h: number
  /** Static terrain, one char per cell: '#', 'B', '=', '^' or '.'. */
  tiles: string[]
  start: { x: number; y: number }
  flagX: number
  flagY: number
}

export interface Body {
  x: number
  y: number
  w: number
  h: number
  vx: number
  vy: number
  onGround: boolean
}

export interface Player extends Body {
  facing: 1 | -1
  coyote: number
  jumpBuffer: number
}

export interface Enemy extends Body {
  alive: boolean
  dir: 1 | -1
  /** Seconds left to show the squashed sprite after a stomp. */
  squash: number
}

export interface Input {
  left: boolean
  right: boolean
  jump: boolean
  /** True only on the tick the jump button went down. */
  jumpPressed: boolean
}

export type Status = 'playing' | 'dead' | 'won'

export interface World {
  level: Level
  player: Player
  enemies: Enemy[]
  /** Cell indices (y * w + x) of coins not yet collected. */
  coins: Set<number>
  score: number
  coinCount: number
  time: number
  status: Status
}

export type GameEvent = 'jump' | 'coin' | 'stomp' | 'die' | 'win' | 'land'

export const PLAYER_W = 10
export const PLAYER_H = 14
export const ENEMY_W = 14
export const ENEMY_H = 12

export function parseLevel(def: LevelDef): {
  level: Level
  coins: Set<number>
  enemies: { x: number; y: number }[]
} {
  const h = def.map.length
  const w = def.map[0].length
  const tiles: string[] = []
  const coins = new Set<number>()
  const enemies: { x: number; y: number }[] = []
  let start: { x: number; y: number } | null = null
  let flagX = -1
  let flagY = -1

  def.map.forEach((row, y) => {
    if (row.length !== w) throw new Error(`${def.name}: row ${y} is ${row.length} wide, expected ${w}`)
    let out = ''
    for (let x = 0; x < w; x++) {
      const c = row[x]
      switch (c) {
        case '#': case 'B': case '=': case '^': case '.':
          out += c
          break
        case 'o':
          coins.add(y * w + x)
          out += '.'
          break
        case 'e':
          enemies.push({ x: x * TILE + (TILE - ENEMY_W) / 2, y: (y + 1) * TILE - ENEMY_H })
          out += '.'
          break
        case 'P':
          start = { x: x * TILE + (TILE - PLAYER_W) / 2, y: (y + 1) * TILE - PLAYER_H }
          out += '.'
          break
        case 'F':
          flagX = x * TILE
          flagY = y * TILE
          out += '.'
          break
        default:
          throw new Error(`${def.name}: unknown tile '${c}' at ${x},${y}`)
      }
    }
    tiles.push(out)
  })

  if (!start) throw new Error(`${def.name}: no player start 'P'`)
  if (flagX < 0) throw new Error(`${def.name}: no flag 'F'`)
  return { level: { name: def.name, theme: def.theme, w, h, tiles, start, flagX, flagY }, coins, enemies }
}

export function createWorld(def: LevelDef, score = 0): World {
  const { level, coins, enemies } = parseLevel(def)
  return {
    level,
    player: {
      x: level.start.x, y: level.start.y, w: PLAYER_W, h: PLAYER_H,
      vx: 0, vy: 0, onGround: false, facing: 1, coyote: 0, jumpBuffer: 0,
    },
    enemies: enemies.map(e => ({
      x: e.x, y: e.y, w: ENEMY_W, h: ENEMY_H, vx: -ENEMY_SPEED, vy: 0,
      onGround: false, alive: true, dir: -1 as const, squash: 0,
    })),
    coins,
    score,
    coinCount: 0,
    time: 0,
    status: 'playing',
  }
}

export function tileAt(level: Level, tx: number, ty: number): string {
  if (tx < 0 || tx >= level.w) return '#' // side walls
  if (ty < 0 || ty >= level.h) return '.' // open sky above, pit below
  return level.tiles[ty][tx]
}

const isSolid = (t: string) => t === '#' || t === 'B'

/** Move a body by its velocity, resolving collisions against the tile grid. */
export function moveBody(level: Level, b: Body, dt: number): void {
  // Horizontal
  b.x += b.vx * dt
  const top = Math.floor(b.y / TILE)
  const bottom = Math.floor((b.y + b.h - 0.01) / TILE)
  if (b.vx > 0) {
    const tx = Math.floor((b.x + b.w) / TILE)
    for (let ty = top; ty <= bottom; ty++) {
      if (isSolid(tileAt(level, tx, ty))) { b.x = tx * TILE - b.w; b.vx = 0; break }
    }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x / TILE)
    for (let ty = top; ty <= bottom; ty++) {
      if (isSolid(tileAt(level, tx, ty))) { b.x = (tx + 1) * TILE; b.vx = 0; break }
    }
  }

  // Vertical
  const prevBottom = b.y + b.h
  b.y += b.vy * dt
  b.onGround = false
  const left = Math.floor(b.x / TILE)
  const right = Math.floor((b.x + b.w - 0.01) / TILE)
  if (b.vy > 0) {
    const ty = Math.floor((b.y + b.h) / TILE)
    for (let tx = left; tx <= right; tx++) {
      const t = tileAt(level, tx, ty)
      // One-way platforms only catch a body that was above them last tick.
      if (isSolid(t) || (t === '=' && prevBottom <= ty * TILE + 0.01)) {
        b.y = ty * TILE - b.h; b.vy = 0; b.onGround = true; break
      }
    }
  } else if (b.vy < 0) {
    const ty = Math.floor(b.y / TILE)
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(tileAt(level, tx, ty))) { b.y = (ty + 1) * TILE; b.vy = 0; break }
    }
  }
}

const overlaps = (a: Body, b: Body) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

function approach(v: number, target: number, amount: number): number {
  return v < target ? Math.min(v + amount, target) : Math.max(v - amount, target)
}

function touchesSpike(level: Level, p: Body): boolean {
  const x0 = Math.floor(p.x / TILE)
  const x1 = Math.floor((p.x + p.w - 0.01) / TILE)
  const y0 = Math.floor(p.y / TILE)
  const y1 = Math.floor((p.y + p.h - 0.01) / TILE)
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tileAt(level, tx, ty) !== '^') continue
      // Spikes only hurt in the lower half of their cell, inset at the sides.
      const spike = { x: tx * TILE + 3, y: ty * TILE + 8, w: TILE - 6, h: 8 }
      if (overlaps(p, spike as Body)) return true
    }
  }
  return false
}

function stepPlayer(w: World, input: Input, dt: number, events: GameEvent[]): void {
  const p = w.player
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  if (dir !== 0) {
    p.facing = dir as 1 | -1
    p.vx = approach(p.vx, dir * RUN_MAX, (p.onGround ? RUN_ACCEL : AIR_ACCEL) * dt)
  } else if (p.onGround) {
    p.vx = approach(p.vx, 0, FRICTION * dt)
  }

  p.coyote = p.onGround ? COYOTE_TIME : Math.max(0, p.coyote - dt)
  p.jumpBuffer = input.jumpPressed ? JUMP_BUFFER_TIME : Math.max(0, p.jumpBuffer - dt)

  if (p.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = -JUMP_V
    p.jumpBuffer = 0
    p.coyote = 0
    events.push('jump')
  }
  if (!input.jump && p.vy < -JUMP_CUT_V) p.vy = -JUMP_CUT_V

  p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL)
  const wasGrounded = p.onGround
  moveBody(w.level, p, dt)
  if (p.onGround && !wasGrounded) events.push('land')
}

function stepEnemy(level: Level, e: Enemy, dt: number): void {
  if (!e.alive) { e.squash = Math.max(0, e.squash - dt); return }
  e.vx = e.dir * ENEMY_SPEED
  e.vy = Math.min(e.vy + GRAVITY * dt, MAX_FALL)
  moveBody(level, e, dt)
  if (e.vx === 0) { e.dir = -e.dir as 1 | -1; return } // hit a wall
  if (!e.onGround) return
  // Turn around at ledges and before walking into spikes.
  const aheadX = e.dir > 0 ? e.x + e.w + 1 : e.x - 1
  const tx = Math.floor(aheadX / TILE)
  const footY = Math.floor((e.y + e.h + 1) / TILE)
  const bodyY = Math.floor((e.y + e.h - 1) / TILE)
  const below = tileAt(level, tx, footY)
  if (!(isSolid(below) || below === '=') || tileAt(level, tx, bodyY) === '^') {
    e.dir = -e.dir as 1 | -1
  }
}

/** Advance the world by one tick. Returns what happened this tick. */
export function step(w: World, input: Input, dt: number): GameEvent[] {
  const events: GameEvent[] = []
  if (w.status !== 'playing') return events
  w.time += dt
  const p = w.player
  const prevBottom = p.y + p.h

  stepPlayer(w, input, dt, events)
  for (const e of w.enemies) stepEnemy(w.level, e, dt)

  // Coins
  const { level } = w
  const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + p.w - 0.01) / TILE)
  const y0 = Math.floor(p.y / TILE), y1 = Math.floor((p.y + p.h - 0.01) / TILE)
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const idx = ty * level.w + tx
      if (tx >= 0 && tx < level.w && w.coins.delete(idx)) {
        w.coinCount++
        w.score += COIN_SCORE
        events.push('coin')
      }
    }
  }

  // Enemies: landing on top stomps them, any other touch is fatal.
  for (const e of w.enemies) {
    if (!e.alive || !overlaps(p, e)) continue
    if (p.vy > 0 && prevBottom <= e.y + 6) {
      e.alive = false
      e.squash = 0.5
      p.vy = -STOMP_BOUNCE
      w.score += STOMP_SCORE
      events.push('stomp')
    } else {
      w.status = 'dead'
      events.push('die')
      return events
    }
  }

  if (touchesSpike(level, p) || p.y > level.h * TILE) {
    w.status = 'dead'
    events.push('die')
    return events
  }

  if (p.x + p.w >= level.flagX + TILE / 2) {
    w.status = 'won'
    w.score += FLAG_SCORE
    events.push('win')
  }
  return events
}
