// ─── /adventure: enemies and bosses ─────────────────────────────────────────
//
// Walkers move tile to tile, choosing a new way at each tile, so they never
// clip a wall. Bats and wisps fly free inside the room. Each boss is a small
// state machine of its own.

import type { BossKind, Dir, EnemyKind } from './maps'
import {
  DIRS, REVERSE, VEC, emit, facing, pick, rand, roomLeft, roomTop, tileAt,
  type Enemy, type ShotKind, type World,
} from './state'
import { RH, RW, TILE, VIEW_H, VIEW_W, enemyWalkable } from './tiles'

export const ENEMIES: Record<EnemyKind, { hp: number; dmg: number; speed: number; fly?: boolean }> = {
  blob: { hp: 1, dmg: 1, speed: 22 },
  beetle: { hp: 2, dmg: 1, speed: 45 },
  thornling: { hp: 2, dmg: 1, speed: 28 },
  boar: { hp: 3, dmg: 2, speed: 30 },
  bat: { hp: 1, dmg: 1, speed: 60, fly: true },
  wisp: { hp: 3, dmg: 2, speed: 26, fly: true },
  knight: { hp: 5, dmg: 2, speed: 38 },
  // The Frostreach.
  iceblob: { hp: 2, dmg: 1, speed: 26 },
  yeti: { hp: 6, dmg: 2, speed: 32 },
  wolf: { hp: 3, dmg: 2, speed: 55 },
}

export const BOSSES: Record<BossKind, { hp: number; dmg: number; w: number; h: number }> = {
  mossback: { hp: 8, dmg: 2, w: 32, h: 32 },
  drake: { hp: 10, dmg: 2, w: 32, h: 24 },
  serpent: { hp: 10, dmg: 2, w: 32, h: 32 },
  king: { hp: 8, dmg: 3, w: 24, h: 32 },
  rimefang: { hp: 12, dmg: 2, w: 32, h: 24 },
  stormcrow: { hp: 10, dmg: 2, w: 32, h: 24 },
  glasseye: { hp: 6, dmg: 2, w: 32, h: 32 },
  warden: { hp: 10, dmg: 3, w: 24, h: 32 },
}

const CHARGE_SPEED = 130
const KNOCK_SPEED = 220
const JUMP_TIME = 0.7

export const isBoss = (k: EnemyKind | BossKind): k is BossKind => k in BOSSES

function base(w: World, kind: EnemyKind | BossKind, x: number, y: number): Enemy {
  const boss = isBoss(kind)
  const hp = boss ? BOSSES[kind].hp : ENEMIES[kind].hp
  return {
    id: w.nextId++, kind, boss, x, y,
    w: boss ? BOSSES[kind].w : TILE, h: boss ? BOSSES[kind].h : TILE,
    dir: pick(w, DIRS), hp, maxHp: hp, dmg: boss ? BOSSES[kind].dmg : ENEMIES[kind].dmg,
    t: 0.5 + rand(w), left: 0, state: 'walk', vx: 0, vy: 0, flash: 0, stun: 0, knock: 0,
    spawn: 0.4 + rand(w) * 0.3, hitBy: -1, dying: 0, sub: 0, bare: 0,
  }
}

// Chapter one's enemies are tougher in the Frostreach.
const NATIVE_TO_FROST = new Set<EnemyKind>(['iceblob', 'yeti', 'wolf'])

export function makeEnemy(w: World, kind: EnemyKind, x: number, y: number): Enemy {
  const e = base(w, kind, x, y)
  if (w.map.quest === 'frostreach' && !NATIVE_TO_FROST.has(kind)) e.hp = e.maxHp = e.hp + 1
  return e
}

// The Drowned Shrine's boss rises from one of four pools (see the 'pools' layout).
const POOLS: [number, number][] = [[72, 64], [184, 64], [72, 112], [184, 112]]
// Where the Ashen King may appear, clear of the lava.
const THRONE_SPOTS: [number, number][] = [[116, 64], [40, 72], [192, 72], [60, 112], [172, 112]]

export function makeBoss(w: World, kind: BossKind): Enemy {
  const L = roomLeft(w)
  const T = roomTop(w)
  const e = base(w, kind, L + VIEW_W / 2 - BOSSES[kind].w / 2, T + 40)
  e.spawn = 0.8
  e.t = 1.5
  e.state = 'idle'
  if (kind === 'drake') { e.y = T + 24; e.vx = 45 }
  if (kind === 'serpent') { e.state = 'under'; e.t = 1; placeInPool(w, e, 0) }
  if (kind === 'king' || kind === 'warden') { e.state = 'stand'; e.t = 2.2; e.x = L + 116; e.y = T + 40 }
  if (kind === 'rimefang') { e.state = 'prowl'; e.t = 1.5 }
  if (kind === 'stormcrow') { e.state = 'circle'; e.t = 3 }
  if (kind === 'glasseye') { e.y = T + 32; e.vx = 24; e.t = 1.5 }
  return e
}

function placeInPool(w: World, e: Enemy, i: number) {
  e.x = roomLeft(w) + POOLS[i][0] - 16
  e.y = roomTop(w) + POOLS[i][1] - 16
}

// ── Shared helpers ─────────────────────────────────────────────────────────
const centre = (e: Enemy) => ({ x: e.x + e.w / 2, y: e.y + e.h / 2 })
const heroCentre = (w: World) => ({ x: w.player.x + 8, y: w.player.y + 8 })

function shoot(w: World, x: number, y: number, vx: number, vy: number, kind: ShotKind, dmg: number) {
  w.shots.push({ x, y, vx, vy, kind, owner: 'enemy', dmg, life: 4 })
}

/** Fire at the hero, fanned out by `spread` radians per extra shot. */
function aimed(w: World, e: Enemy, kind: ShotKind, speed: number, count: number, spread: number, dmg: number) {
  const c = centre(e)
  const h = heroCentre(w)
  const a = Math.atan2(h.y - c.y, h.x - c.x)
  for (let i = 0; i < count; i++) {
    const ang = a + (i - (count - 1) / 2) * spread
    shoot(w, c.x, c.y, Math.cos(ang) * speed, Math.sin(ang) * speed, kind, dmg)
  }
  emit(w, 'shoot', c.x, c.y)
}

/** A tile a walker may step onto: open ground inside this room's border. */
function tileFree(w: World, tx: number, ty: number): boolean {
  const lx = tx - w.rx * RW
  const ly = ty - w.ry * RH
  if (lx < 1 || ly < 1 || lx > RW - 2 || ly > RH - 2) return false
  return enemyWalkable(tileAt(w, tx, ty))
}

const canGo = (w: World, e: Enemy, d: Dir) =>
  tileFree(w, Math.round(e.x / TILE) + VEC[d][0], Math.round(e.y / TILE) + VEC[d][1])

/** Move a walker; at each tile `choose` picks the next way (or null to stand). */
function walk(w: World, e: Enemy, dt: number, speed: number, choose: (free: Dir[]) => Dir | null) {
  if (e.left <= 0) {
    const free = DIRS.filter(d => canGo(w, e, d))
    const d = free.length ? choose(free) : null
    if (!d) return false
    e.dir = d
    e.left = TILE
  }
  const s = Math.min(e.left, speed * dt)
  const [dx, dy] = VEC[e.dir]
  e.x += dx * s
  e.y += dy * s
  e.left -= s
  if (e.left <= 1e-6) {
    e.left = 0
    e.x = Math.round(e.x)
    e.y = Math.round(e.y)
  }
  return true
}

/** The way towards the hero, if it is open; else null. */
function towards(w: World, e: Enemy, free: Dir[]): Dir | null {
  const h = heroCentre(w)
  const c = centre(e)
  const main = facing(c.x, c.y, h.x, h.y)
  if (free.includes(main)) return main
  const dx = h.x - c.x
  const dy = h.y - c.y
  const other: Dir = Math.abs(dx) > Math.abs(dy) ? (dy < 0 ? 'up' : 'down') : (dx < 0 ? 'left' : 'right')
  return free.includes(other) ? other : null
}

/** Knock a hit enemy back along the way the blow came, where the grid allows. */
export function knockEnemy(w: World, e: Enemy, d: Dir) {
  if (e.boss) return
  if (ENEMIES[e.kind as EnemyKind].fly) {
    e.vx = VEC[d][0] * 160
    e.vy = VEC[d][1] * 160
    e.knock = 0.15
    return
  }
  if (e.left === 0) {
    if (!canGo(w, e, d)) return
    e.dir = d
    e.left = TILE
  } else if (d === REVERSE[e.dir]) {
    e.dir = d
    e.left = TILE - e.left
  } else if (d !== e.dir) return
  e.knock = 1
}

/** No contact damage right now (appearing, dying, underwater, high in a leap). */
export function harmless(e: Enemy): boolean {
  if (e.spawn > 0 || e.dying > 0) return true
  if (e.kind === 'serpent') return e.state !== 'up' && e.state !== 'rise'
  if (e.kind === 'mossback' && e.state === 'jump') return Math.sin((1 - e.t / JUMP_TIME) * Math.PI) > 0.5
  if (e.kind === 'king' || e.kind === 'warden') return e.state === 'out'
  if (e.kind === 'stormcrow') return e.state === 'circle'
  return false
}

/** Can be hurt right now. The Ashen King also needs his armour burnt (see world.ts). */
export function vulnerable(e: Enemy): boolean {
  if (e.spawn > 0 || e.dying > 0) return false
  if (e.kind === 'serpent') return e.state === 'up'
  if (e.kind === 'king' || e.kind === 'warden') return e.state !== 'out'
  if (e.kind === 'stormcrow') return e.state !== 'circle'
  return true
}

/** How high a leaping enemy is off the ground, for drawing. */
export const jumpHeight = (e: Enemy) =>
  e.kind === 'mossback' && e.state === 'jump' ? Math.sin((1 - e.t / JUMP_TIME) * Math.PI) * 24 : 0

function clampToRoom(w: World, e: Enemy, margin: number): boolean {
  const L = roomLeft(w) + margin
  const T = roomTop(w) + margin
  const R = roomLeft(w) + VIEW_W - margin - e.w
  const B = roomTop(w) + VIEW_H - margin - e.h
  let bounced = false
  if (e.x < L) { e.x = L; e.vx = Math.abs(e.vx); bounced = true }
  if (e.x > R) { e.x = R; e.vx = -Math.abs(e.vx); bounced = true }
  if (e.y < T) { e.y = T; e.vy = Math.abs(e.vy); bounced = true }
  if (e.y > B) { e.y = B; e.vy = -Math.abs(e.vy); bounced = true }
  return bounced
}

const aliveCount = (w: World, kind: EnemyKind) => w.enemies.filter(o => o.kind === kind && o.dying <= 0).length

/** Put a minion on the nearest free tile to (x, y). */
function summon(w: World, kind: EnemyKind, x: number, y: number) {
  const tx = Math.round(x / TILE)
  const ty = Math.round(y / TILE)
  for (let r = 0; r < 3; r++) {
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        if (kind === 'bat' || tileFree(w, tx + ox, ty + oy)) {
          const m = makeEnemy(w, kind, (tx + ox) * TILE, (ty + oy) * TILE)
          m.spawn = 0.3
          w.enemies.push(m)
          return
        }
      }
    }
  }
}

// ── Update ──────────────────────────────────────────────────────────────────
export function updateEnemy(w: World, e: Enemy, dt: number) {
  if (e.spawn > 0) { e.spawn -= dt; return }
  if (e.dying > 0) { e.dying -= dt; return }
  e.flash = Math.max(0, e.flash - dt)
  e.bare = Math.max(0, e.bare - dt)
  if (e.knock > 0 && !e.boss) {
    if (ENEMIES[e.kind as EnemyKind].fly) {
      e.x += e.vx * dt
      e.y += e.vy * dt
      e.knock -= dt
      clampToRoom(w, e, w.map.kind === 'overworld' ? 4 : TILE)
    } else if (!walk(w, e, dt, KNOCK_SPEED, () => null) || e.left === 0) e.knock = 0
    return
  }
  if (e.stun > 0) { e.stun -= dt; return }
  e.t -= dt
  if (e.boss) { updateBoss(w, e, dt); return }

  const speed = ENEMIES[e.kind as EnemyKind].speed
  const resting = e.left === 0 && e.t > 0 && e.state === 'rest'
  switch (e.kind as EnemyKind) {
    case 'blob':
      if (resting) return
      e.state = 'walk'
      walk(w, e, dt, speed, free => {
        if (rand(w) < 0.3) { e.state = 'rest'; e.t = 0.4 + rand(w) * 0.6; return null }
        return pick(w, free)
      })
      break

    case 'beetle':
      walk(w, e, dt, speed, free => (free.includes(e.dir) && rand(w) < 0.75 ? e.dir : pick(w, free)))
      break

    case 'knight':
      walk(w, e, dt, speed, free => (rand(w) < 0.6 ? towards(w, e, free) : null) ?? pick(w, free))
      break

    case 'thornling':
      if (e.left === 0 && e.t <= 0) {
        const h = heroCentre(w)
        e.dir = facing(e.x + 8, e.y + 8, h.x, h.y)
        const [dx, dy] = VEC[e.dir]
        shoot(w, e.x + 8 + dx * 8, e.y + 8 + dy * 8, dx * 90, dy * 90, 'seed', 1)
        emit(w, 'shoot', e.x + 8, e.y + 8)
        e.t = 1.8 + rand(w) * 1.2
        e.stun = 0.5
        return
      }
      walk(w, e, dt, speed, free => pick(w, free))
      break

    case 'boar':
      if (e.state === 'charge') {
        if (!walk(w, e, dt, CHARGE_SPEED, free => (free.includes(e.dir) ? e.dir : null))) {
          e.state = 'walk'
          e.stun = 0.6
          emit(w, 'thud', e.x + 8, e.y + 8)
        }
        return
      }
      if (e.left === 0) {
        const h = heroCentre(w)
        const aligned = Math.abs(h.y - (e.y + 8)) < 8 || Math.abs(h.x - (e.x + 8)) < 8
        const near = Math.abs(h.x - e.x - 8) + Math.abs(h.y - e.y - 8) < 7 * TILE
        const d = facing(e.x + 8, e.y + 8, h.x, h.y)
        if (aligned && near && canGo(w, e, d)) {
          e.state = 'charge'
          e.dir = d
          return
        }
      }
      walk(w, e, dt, speed, free => (free.includes(e.dir) && rand(w) < 0.6 ? e.dir : pick(w, free)))
      break

    case 'bat': {
      if (e.state === 'rest') {
        if (e.t <= 0) { e.state = 'walk'; e.t = 2 + rand(w) * 2 }
        return
      }
      if (e.t <= 0) { e.state = 'rest'; e.t = 0.6 + rand(w) * 0.6; return }
      if (e.vx === 0 && e.vy === 0 || rand(w) < dt * 3) {
        const a = rand(w) * Math.PI * 2
        e.vx = Math.cos(a) * speed
        e.vy = Math.sin(a) * speed
      }
      e.x += e.vx * dt
      e.y += e.vy * dt
      clampToRoom(w, e, w.map.kind === 'overworld' ? 4 : TILE)
      break
    }

    case 'iceblob':
      if (resting) return
      e.state = 'walk'
      walk(w, e, dt, speed, free => {
        if (rand(w) < 0.25) { e.state = 'rest'; e.t = 0.3 + rand(w) * 0.5; return null }
        return pick(w, free)
      })
      break

    case 'yeti':
      if (e.left === 0 && e.t <= 0) {
        aimed(w, e, 'snow', 80, 1, 0, 2)
        e.dir = facing(e.x + 8, e.y + 8, w.player.x + 8, w.player.y + 8)
        e.t = 2.2 + rand(w)
        e.stun = 0.5
        return
      }
      walk(w, e, dt, speed, free => (rand(w) < 0.6 ? towards(w, e, free) : null) ?? pick(w, free))
      break

    case 'wolf':
      if (e.state === 'charge') {
        if (!walk(w, e, dt, 170, free => (free.includes(e.dir) ? e.dir : null))) {
          e.state = 'walk'
          e.stun = 0.5
        }
        return
      }
      if (e.left === 0) {
        const h = heroCentre(w)
        const aligned = Math.abs(h.y - (e.y + 8)) < 8 || Math.abs(h.x - (e.x + 8)) < 8
        const d = facing(e.x + 8, e.y + 8, h.x, h.y)
        if (aligned && canGo(w, e, d)) { e.state = 'charge'; e.dir = d; return }
      }
      walk(w, e, dt, speed, free => (rand(w) < 0.5 ? towards(w, e, free) : null) ?? pick(w, free))
      break

    case 'wisp': {
      const h = heroCentre(w)
      const a = Math.atan2(h.y - e.y - 8, h.x - e.x - 8) + Math.sin(e.t * 3) * 0.8
      e.x += Math.cos(a) * speed * dt
      e.y += Math.sin(a) * speed * dt
      clampToRoom(w, e, 4)
      break
    }
  }
}

function updateBoss(w: World, e: Enemy, dt: number) {
  const half = e.hp <= e.maxHp / 2
  const L = roomLeft(w)
  const T = roomTop(w)
  switch (e.kind as BossKind) {
    case 'mossback':
      if (e.state === 'jump') {
        e.x += e.vx * dt
        e.y += e.vy * dt
        clampToRoom(w, e, TILE)
        if (e.t <= 0) {
          e.state = 'idle'
          e.t = half ? 0.7 : 1.1
          emit(w, 'thud', e.x + 16, e.y + 28)
          if (half && aliveCount(w, 'blob') < 3 && rand(w) < 0.5) summon(w, 'blob', e.x + 8, e.y + 32)
        }
      } else if (e.t <= 0) {
        const h = heroCentre(w)
        e.state = 'jump'
        e.t = JUMP_TIME
        e.vx = (h.x - (e.x + 16)) / JUMP_TIME
        e.vy = (h.y - (e.y + 16)) / JUMP_TIME
      }
      break

    case 'drake':
      e.x += e.vx * dt
      if (e.x < L + 24) e.vx = Math.abs(e.vx)
      if (e.x > L + VIEW_W - 24 - e.w) e.vx = -Math.abs(e.vx)
      e.dir = e.vx < 0 ? 'left' : 'right'
      if (e.t <= 0) {
        aimed(w, e, 'flame', 85, half ? 5 : 3, 0.3, 2)
        e.t = half ? 1.4 : 2.1
      }
      break

    case 'serpent':
      if (e.t > 0) break
      switch (e.state) {
        case 'under': e.state = 'rise'; e.t = 0.4; break
        case 'rise':
          e.state = 'up'
          e.t = 2.2
          e.sub = half ? 1.1 : 99
          ring(w, e, half ? 10 : 8)
          break
        case 'up': e.state = 'sink'; e.t = 0.4; break
        case 'sink': {
          const here = POOLS.findIndex(([px, py]) => px - 16 === e.x - L && py - 16 === e.y - T)
          const next = pick(w, [0, 1, 2, 3].filter(i => i !== here))
          placeInPool(w, e, next)
          e.state = 'under'
          e.t = 0.8 + rand(w) * 0.6
          break
        }
      }
      break

    case 'king':
    case 'warden':
      switch (e.state) {
        case 'stand':
          if (e.t <= 1.2 && e.sub === 0) {
            // The Warden's cold light can be thrown back with the mirror shield.
            if (e.kind === 'warden') aimed(w, e, 'orb', 70, half ? 5 : 3, 0.3, 2)
            else aimed(w, e, 'ember', 75, 3, 0.35, 2)
            e.sub = 1
          }
          if (e.t <= 0) { e.state = 'out'; e.t = 0.35 }
          break
        case 'out':
          if (e.t <= 0) {
            const h = heroCentre(w)
            const spots = THRONE_SPOTS.filter(([x, y]) => Math.hypot(L + x + 12 - h.x, T + y + 16 - h.y) > 56)
            const [x, y] = pick(w, spots.length ? spots : THRONE_SPOTS)
            e.x = L + x
            e.y = T + y
            e.state = 'in'
            e.t = 0.35
            const minion = e.kind === 'warden' ? 'iceblob' : 'bat'
            if (half && aliveCount(w, minion) < 2) summon(w, minion, e.x, e.y)
          }
          break
        case 'in':
          if (e.t <= 0) { e.state = 'stand'; e.t = 2.2; e.sub = 0 }
          break
      }
      break

    case 'rimefang': {
      // Prowls closer, crouches, then dashes straight at where the hero was.
      const h = heroCentre(w)
      const c = centre(e)
      if (e.state === 'prowl') {
        const a = Math.atan2(h.y - c.y, h.x - c.x)
        e.x += Math.cos(a) * 40 * dt
        e.y += Math.sin(a) * 40 * dt
        e.dir = h.x < c.x ? 'left' : 'right'
        clampToRoom(w, e, TILE)
        if (e.t <= 0) { e.state = 'aim'; e.t = 0.5 }
      } else if (e.state === 'aim') {
        if (e.t <= 0) {
          const a = Math.atan2(h.y - c.y, h.x - c.x)
          e.vx = Math.cos(a) * 190
          e.vy = Math.sin(a) * 190
          e.state = 'dash'
          e.t = 2
        }
      } else if (e.state === 'dash') {
        e.x += e.vx * dt
        e.y += e.vy * dt
        if (clampToRoom(w, e, TILE) || e.t <= 0) {
          e.state = 'dazed'
          e.t = 1
          emit(w, 'thud', c.x, c.y)
          if (half && aliveCount(w, 'wolf') < 2) summon(w, 'wolf', e.x + 8, e.y + 8)
        }
      } else if (e.t <= 0) { e.state = 'prowl'; e.t = half ? 0.8 : 1.3 }
      break
    }

    case 'stormcrow': {
      // Circles high (out of reach) dropping feathers, then swoops and rests.
      const h = heroCentre(w)
      const c = centre(e)
      if (e.state === 'circle') {
        e.sub += dt
        e.x = L + VIEW_W / 2 - 16 + Math.cos(e.sub * 1.4) * 80
        e.y = T + VIEW_H / 2 - 20 + Math.sin(e.sub * 1.4) * 40
        e.dir = Math.sin(e.sub * 1.4) > 0 ? 'left' : 'right'
        if (Math.floor(e.t / 0.7) !== Math.floor((e.t + dt) / 0.7)) aimed(w, e, 'feather', 90, half ? 3 : 1, 0.3, 1)
        if (e.t <= 0) {
          const a = Math.atan2(h.y - c.y, h.x - c.x)
          e.vx = Math.cos(a) * 150
          e.vy = Math.sin(a) * 150
          e.state = 'swoop'
          e.t = Math.min(1.2, Math.hypot(h.x - c.x, h.y - c.y) / 150)
        }
      } else if (e.state === 'swoop') {
        e.x += e.vx * dt
        e.y += e.vy * dt
        clampToRoom(w, e, TILE)
        if (e.t <= 0) { e.state = 'land'; e.t = 1.4 }
      } else if (e.t <= 0) { e.state = 'circle'; e.t = half ? 2 : 3 }
      break
    }

    case 'glasseye':
      // Drifts along the top of the room firing cold light.
      e.x += e.vx * dt
      if (e.x < L + 32) e.vx = Math.abs(e.vx)
      if (e.x > L + VIEW_W - 32 - e.w) e.vx = -Math.abs(e.vx)
      if (e.t <= 0) {
        e.sub++
        if (e.sub % 3 === 0) ring(w, e, half ? 10 : 8)
        else aimed(w, e, 'orb', 70, half ? 3 : 1, 0.3, 1)
        e.t = half ? 1.3 : 1.8
      }
      break
  }
  // The serpent's second volley, halfway through surfacing.
  if (e.kind === 'serpent' && e.state === 'up' && e.t <= e.sub) {
    e.sub = -1
    ring(w, e, 10)
  }
}

function ring(w: World, e: Enemy, n: number) {
  const c = centre(e)
  const turn = rand(w)
  for (let i = 0; i < n; i++) {
    const a = ((i + turn) / n) * Math.PI * 2
    shoot(w, c.x, c.y, Math.cos(a) * 70, Math.sin(a) * 70, 'orb', 1)
  }
  emit(w, 'shoot', c.x, c.y)
}

/** Room origin in tiles, for spawning. */
export const roomTile = (w: World) => ({ tx: w.rx * RW, ty: w.ry * RH })

/** An ice slime shatters into two little slimes. */
export function shatter(w: World, e: Enemy) {
  for (const dx of [-8, 8]) summon(w, 'blob', e.x + dx, e.y)
}
