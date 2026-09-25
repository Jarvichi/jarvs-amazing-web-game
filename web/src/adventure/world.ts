// ─── /adventure: the rules ──────────────────────────────────────────────────
//
// `step(world, controls, dt)` advances the game by one tick and returns what
// happened (for sound and screen shake). No drawing, no DOM: tests drive it
// directly.

import { MAPS, START, type ItemKind, type RoomDef, type Warp } from './maps'
import {
  VEC, body, emit, enemyBox, facing, feet, openKey, overlap, rand, roomKey, roomLeft, roomTop,
  tileAt, type Action, type Box, type DropKind, type Enemy, type GameEvent, type World,
} from './state'
import { ENEMIES, harmless, knockEnemy, makeBoss, makeEnemy, updateEnemy, vulnerable } from './enemies'
import { RH, RW, TILE, VIEW_H, VIEW_W, enemyWalkable, stopsShots, walkable } from './tiles'
import { paginate } from './text'

export const SPEED = 80
export const SWING_TIME = 0.25
export const SCROLL_TIME = 0.6
export const INVULN = 1
export const TYPE_SPEED = 45
export const DROP_LIFE = 8
export const START_HP = 6

export interface Controls {
  dx: number
  dy: number
  /** Pressed this tick. */
  a: boolean
  b: boolean
}

export const NO_INPUT: Controls = { dx: 0, dy: 0, a: false, b: false }

export function createWorld(seed = 1): World {
  const w: World = {
    map: MAPS.overworld, rx: 0, ry: 0,
    player: {
      x: START.x, y: START.y, dir: START.dir, hp: START_HP, maxHp: START_HP, invuln: 0,
      knock: 0, kx: 0, ky: 0, swing: 0, cooldown: 0, step: 0, hold: null,
    },
    inv: {
      sword: false, hasBombs: false, rod: false, boots: false, bombs: 0, maxBombs: 0,
      coins: 0, potion: false, keys: {}, flames: 0, b: null,
    },
    flags: new Set(), opened: new Set(), cut: new Set(), cleared: new Set(),
    enemies: [], shots: [], bombs: [], blasts: [], drops: [], npcs: [],
    dialog: null, scroll: null, fade: 0, phase: 'play', phaseTime: 0, time: 0, score: 0, kills: 0,
    respawn: START, roomBusy: false, nextId: 1, swingId: 0, nope: 0, seed, events: [],
  }
  enterMap(w, START)
  return w
}

export const roomDef = (w: World): RoomDef => w.map.rooms[roomKey(w)] ?? {}

// ── Moving between maps and rooms ───────────────────────────────────────────
export function enterMap(w: World, to: Warp) {
  w.map = MAPS[to.map]
  const p = w.player
  p.x = to.x
  p.y = to.y
  p.dir = to.dir
  p.knock = 0
  p.swing = 0
  w.rx = Math.floor((p.x + 8) / VIEW_W)
  w.ry = Math.floor((p.y + 8) / VIEW_H)
  w.scroll = null
  w.fade = 0.35
  // Dungeon rooms fill up again once you have left.
  if (w.map.kind === 'overworld') w.cleared.clear()
  enterRoom(w)
}

function warp(w: World, to: Warp) {
  const from = w.map.kind
  enterMap(w, to)
  if (w.map.kind === 'dungeon' && from !== 'dungeon') w.respawn = to
  if (w.map.kind === 'overworld') w.respawn = START
  emit(w, 'stairs')
}

/** Local room pixel → map pixel. */
const at = (w: World, x: number, y: number) => ({ x: roomLeft(w) + x, y: roomTop(w) + y })

function place(w: World, item: DropKind, x: number, y: number, id?: string, price?: number) {
  if (id && w.flags.has(`got:${id}`)) return
  w.drops.push({ ...at(w, x, y), item, life: Infinity, id, price })
}

const CENTRE = [112, 80] as const
const SHOP_X = [56, 112, 168]

export function enterRoom(w: World) {
  const def = roomDef(w)
  const here = `${w.map.id}:${roomKey(w)}`
  w.enemies = []
  w.shots = []
  w.bombs = []
  w.blasts = []
  w.drops = []
  w.cut.clear()
  w.npcs = (def.npcs ?? []).map(n => ({ ...n, px: roomLeft(w) + n.x * TILE, py: roomTop(w) + n.y * TILE }))
  if (def.boss) {
    if (!w.flags.has(`boss:${w.map.id}`)) w.enemies.push(makeBoss(w, def.boss))
    else bossRewards(w)
  }
  if (def.enemies && !w.cleared.has(here)) spawnEnemies(w, def.enemies)
  w.roomBusy = w.enemies.length > 0
  if (def.key === 'floor' || (def.key === 'clear' && !w.roomBusy)) place(w, 'key', ...CENTRE, `key:${here}`)
  if (def.item && !w.roomBusy) place(w, def.item, ...CENTRE, `item:${here}`)
  def.shop?.forEach((s, i) => place(w, s.item, SHOP_X[i], CENTRE[1], s.item === 'heart' ? 'shopheart' : undefined, s.price))
  if (def.talk) openDialog(w, def.talk)
  emit(w, 'room')
}

function spawnEnemies(w: World, kinds: readonly (keyof typeof ENEMIES)[]) {
  const p = w.player
  const spots: [number, number][] = []
  for (let y = 2; y <= RH - 3; y++) {
    for (let x = 2; x <= RW - 3; x++) {
      const tx = w.rx * RW + x
      const ty = w.ry * RH + y
      const far = Math.hypot(tx * TILE - p.x, ty * TILE - p.y) > 3 * TILE
      if (far && enemyWalkable(tileAt(w, tx, ty))) spots.push([tx, ty])
    }
  }
  for (const kind of kinds) {
    if (!spots.length) break
    const i = Math.floor(rand(w) * spots.length)
    const [tx, ty] = spots.splice(i, 1)[0]
    w.enemies.push(makeEnemy(w, kind, tx * TILE, ty * TILE))
  }
}

/** Leaving the room over its edge starts a scroll to the next one. */
function crossEdge(w: World): boolean {
  const p = w.player
  const L = roomLeft(w)
  const T = roomTop(w)
  let dx = 0
  let dy = 0
  if (p.x + 3 < L) dx = -1
  else if (p.x + 13 > L + VIEW_W) dx = 1
  else if (p.y + 8 < T) dy = -1
  else if (p.y + 16 > T + VIEW_H) dy = 1
  if (!dx && !dy) return false
  const rx = w.rx + dx
  const ry = w.ry + dy
  if (rx < 0 || ry < 0 || rx >= w.map.cols || ry >= w.map.rows) return false
  w.rx = rx
  w.ry = ry
  if (dx > 0) p.x = roomLeft(w) - 3
  if (dx < 0) p.x = roomLeft(w) + VIEW_W - 13
  if (dy > 0) p.y = roomTop(w) - 8
  if (dy < 0) p.y = roomTop(w) + VIEW_H - 16
  p.knock = 0
  w.scroll = { dx, dy, t: 0 }
  w.enemies = []
  w.shots = []
  w.bombs = []
  w.blasts = []
  w.drops = []
  w.npcs = []
  return true
}

// ── Dialog ──────────────────────────────────────────────────────────────────
export function openDialog(w: World, pages: string[], then: Action = { kind: 'none' }) {
  if (!pages.length) return
  w.dialog = { pages: paginate(pages), page: 0, shown: 0, then }
}

function updateDialog(w: World, c: Controls, dt: number) {
  const d = w.dialog!
  const text = d.pages[d.page]
  if (d.shown < text.length) {
    d.shown = c.a || c.b ? text.length : Math.min(text.length, d.shown + TYPE_SPEED * dt)
    return
  }
  if (!c.a && !c.b) return
  d.page++
  d.shown = 0
  if (d.page < d.pages.length) return
  w.dialog = null
  w.player.hold = null
  run(w, d.then)
}

function run(w: World, a: Action) {
  if (a.kind === 'warp') warp(w, a.warp)
  if (a.kind === 'win') {
    w.phase = 'won'
    w.phaseTime = 0
    w.score += 5000 + Math.max(0, 7200 - Math.floor(w.time))
    emit(w, 'win')
  }
}

// ── The hero ────────────────────────────────────────────────────────────────
/** Solid things the hero's feet would touch at (x, y). */
function blockers(w: World, x: number, y: number, ignore: Set<string>): [number, number][] {
  const f = feet(x, y)
  const out: [number, number][] = []
  const abilities = { boots: w.inv.boots }
  for (let ty = Math.floor(f.y / TILE); ty <= Math.floor((f.y + f.h - 1) / TILE); ty++) {
    for (let tx = Math.floor(f.x / TILE); tx <= Math.floor((f.x + f.w - 1) / TILE); tx++) {
      if (!ignore.has(`${tx},${ty}`) && !walkable(tileAt(w, tx, ty), abilities)) out.push([tx, ty])
    }
  }
  for (const n of w.npcs) {
    if (overlap(f, { x: n.px + 2, y: n.py + 4, w: 12, h: 12 })) out.push([-1, -1])
  }
  return out
}

/** Closed shutters the hero is standing in: walking out of one is always allowed. */
function standingIn(w: World): Set<string> {
  const p = w.player
  const f = feet(p.x, p.y)
  const s = new Set<string>()
  for (let ty = Math.floor(f.y / TILE); ty <= Math.floor((f.y + f.h - 1) / TILE); ty++) {
    for (let tx = Math.floor(f.x / TILE); tx <= Math.floor((f.x + f.w - 1) / TILE); tx++) {
      if (tileAt(w, tx, ty) === 'S') s.add(`${tx},${ty}`)
    }
  }
  return s
}

/** Walk into a locked door with a key in hand and it opens. */
function bump(w: World, hit: [number, number][]) {
  for (const [tx, ty] of hit) {
    if (tileAt(w, tx, ty) === 'L' && (w.inv.keys[w.map.id] ?? 0) > 0) {
      w.inv.keys[w.map.id]--
      w.opened.add(openKey(w.map, tx, ty))
      emit(w, 'unlock', tx * TILE + 8, ty * TILE + 8)
      return
    }
  }
}

/**
 * Move the hero along one axis a pixel at a time. When blocked, slide round
 * the corner if a small sideways step would clear the way — so a doorway
 * doesn't need pixel-perfect lining up.
 */
function move(w: World, axis: 'x' | 'y', amount: number, slide: boolean) {
  const p = w.player
  const ignore = standingIn(w)
  const sign = Math.sign(amount)
  let remain = Math.abs(amount)
  while (remain > 1e-6) {
    const s = Math.min(1, remain)
    const nx = axis === 'x' ? p.x + sign * s : p.x
    const ny = axis === 'y' ? p.y + sign * s : p.y
    const hit = blockers(w, nx, ny, ignore)
    if (!hit.length) {
      p.x = nx
      p.y = ny
      remain -= s
      continue
    }
    if (!slide) return
    bump(w, hit)
    for (let off = 1; off <= 7; off++) {
      for (const side of [-1, 1]) {
        const ox = axis === 'y' ? side * off : 0
        const oy = axis === 'x' ? side * off : 0
        if (!blockers(w, p.x + ox, p.y + oy, ignore).length && !blockers(w, nx + ox, ny + oy, ignore).length) {
          if (axis === 'x') p.y += side * s
          else p.x += side * s
          return
        }
      }
    }
    return
  }
}

export function swordBox(w: World): Box {
  const p = w.player
  switch (p.dir) {
    case 'right': return { x: p.x + 12, y: p.y + 7, w: 13, h: 5 }
    case 'left': return { x: p.x - 9, y: p.y + 7, w: 13, h: 5 }
    case 'up': return { x: p.x + 6, y: p.y - 9, w: 5, h: 13 }
    case 'down': return { x: p.x + 5, y: p.y + 12, w: 5, h: 13 }
  }
}

function swing(w: World) {
  const p = w.player
  p.swing = SWING_TIME
  w.swingId++
  emit(w, 'swing')
  // At full health the blade throws its edge across the room.
  if (p.hp === p.maxHp && !w.shots.some(s => s.kind === 'beam')) {
    const [dx, dy] = VEC[p.dir]
    w.shots.push({ x: p.x + 8 + dx * 10, y: p.y + 9 + dy * 10, vx: dx * 200, vy: dy * 200, kind: 'beam', owner: 'player', dmg: 1, life: 1.2, swing: w.swingId })
    emit(w, 'beam')
  }
}

function swordHits(w: World) {
  const box = swordBox(w)
  for (const e of w.enemies) {
    if (e.hitBy !== w.swingId && e.hp > 0 && overlap(box, enemyBox(e))) {
      e.hitBy = w.swingId
      damage(w, e, 1, 'sword', w.player.dir)
    }
  }
  for (let ty = Math.floor(box.y / TILE); ty <= Math.floor((box.y + box.h - 1) / TILE); ty++) {
    for (let tx = Math.floor(box.x / TILE); tx <= Math.floor((box.x + box.w - 1) / TILE); tx++) {
      if (tileAt(w, tx, ty) === 'B') cutBush(w, tx, ty)
    }
  }
}

function cutBush(w: World, tx: number, ty: number) {
  w.cut.add(`${tx},${ty}`)
  emit(w, 'cut', tx * TILE + 8, ty * TILE + 8)
  if (rand(w) < 0.2) w.drops.push({ x: tx * TILE, y: ty * TILE, item: rand(w) < 0.5 ? 'coin' : 'heartSmall', life: DROP_LIFE })
}

function useItem(w: World) {
  const p = w.player
  const inv = w.inv
  if (p.cooldown > 0) return
  const [dx, dy] = VEC[p.dir]
  if (inv.b === 'bombs') {
    if (inv.bombs <= 0 || w.bombs.length >= 2) { emit(w, 'nope'); p.cooldown = 0.3; return }
    inv.bombs--
    w.bombs.push({ x: p.x + 8 + dx * 12, y: p.y + 10 + dy * 12, fuse: 1.1 })
    p.cooldown = 0.3
    emit(w, 'bomb')
  } else if (inv.b === 'rod') {
    w.shots.push({ x: p.x + 8 + dx * 8, y: p.y + 9 + dy * 8, vx: dx * 170, vy: dy * 170, kind: 'fire', owner: 'player', dmg: 2, life: 1.2 })
    p.cooldown = 0.4
    emit(w, 'fire')
  }
}

function talk(w: World): boolean {
  const p = w.player
  const [dx, dy] = VEC[p.dir]
  const x = p.x + 8 + dx * 12
  const y = p.y + 10 + dy * 12
  for (const n of w.npcs) {
    if (x >= n.px && x < n.px + TILE && y >= n.py && y < n.py + TILE) {
      openDialog(w, n.lines.length ? n.lines : roomDef(w).talk ?? [])
      emit(w, 'talk')
      return true
    }
  }
  return false
}

/** Returns true if the hero left the room (the rest of the tick is skipped). */
function updatePlayer(w: World, c: Controls, dt: number): boolean {
  const p = w.player
  p.invuln = Math.max(0, p.invuln - dt)
  p.cooldown = Math.max(0, p.cooldown - dt)
  if (p.knock > 0) {
    p.knock -= dt
    move(w, 'x', p.kx * dt, false)
    move(w, 'y', p.ky * dt, false)
    return crossEdge(w)
  }
  if (p.swing > 0) {
    p.swing -= dt
    swordHits(w)
    return false
  }
  if (c.a) {
    if (talk(w)) return false
    if (w.inv.sword) { swing(w); swordHits(w); return false }
  }
  if (c.b) useItem(w)

  let dx = c.dx
  let dy = c.dy
  // Four ways only: on a diagonal, keep going the way already faced.
  if (dx && dy) {
    if (p.dir === 'left' || p.dir === 'right') dy = 0
    else dx = 0
  }
  if (dx || dy) {
    p.dir = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down'
    p.step += dt
    if (dx) move(w, 'x', dx * SPEED * dt, true)
    else move(w, 'y', dy * SPEED * dt, true)
  }

  const tx = Math.floor((p.x + 8) / TILE)
  const ty = Math.floor((p.y + 12) / TILE)
  const to = w.map.warps[`${tx},${ty}`]
  if (to && tileAt(w, tx, ty) === 'D') {
    warp(w, to)
    return true
  }
  return crossEdge(w)
}

export function hurtPlayer(w: World, dmg: number, fromX: number, fromY: number) {
  const p = w.player
  if (p.invuln > 0 || w.phase !== 'play') return
  p.hp = Math.max(0, p.hp - dmg)
  p.invuln = INVULN
  const [kx, ky] = VEC[facing(fromX, fromY, p.x + 8, p.y + 8)]
  p.kx = kx * 200
  p.ky = ky * 200
  p.knock = 0.15
  p.swing = 0
  emit(w, 'hurt', p.x + 8, p.y + 8)
  if (p.hp > 0) return
  if (w.inv.potion) {
    w.inv.potion = false
    p.hp = p.maxHp
    p.invuln = 1.5
    emit(w, 'potion')
    return
  }
  w.phase = 'dying'
  w.phaseTime = 0
  emit(w, 'die')
}

// ── Fighting ────────────────────────────────────────────────────────────────
export type Weapon = 'sword' | 'beam' | 'fire' | 'bomb'

export function damage(w: World, e: Enemy, dmg: number, weapon: Weapon, dir: keyof typeof VEC): boolean {
  if (e.hp <= 0 || !vulnerable(e)) return false
  if (e.kind === 'king') {
    // Cold ash armour: only fire burns it away, and then only for a moment.
    if (weapon === 'fire') {
      const bare = e.bare > 0
      e.bare = 3
      if (!bare) { e.flash = 0.3; emit(w, 'burn', e.x + 12, e.y + 16); return true }
      dmg = 1
    } else if (e.bare <= 0) {
      emit(w, 'clang', e.x + 12, e.y + 16)
      return false
    }
  }
  e.hp -= dmg
  e.flash = 0.3
  if (e.boss) emit(w, 'bossHit', e.x + e.w / 2, e.y + e.h / 2)
  else {
    e.stun = 0.3
    knockEnemy(w, e, dir)
    emit(w, 'hit', e.x + 8, e.y + 8)
  }
  if (e.hp <= 0) {
    e.dying = e.boss ? 1.5 : 0.3
    w.kills++
    w.score += e.boss ? 500 : 10
    emit(w, e.boss ? 'bossDie' : 'kill', e.x + e.w / 2, e.y + e.h / 2)
    if (!e.boss) loot(w, e.x, e.y)
  }
  return true
}

function loot(w: World, x: number, y: number) {
  const r = rand(w)
  let item: DropKind | null = null
  if (r < 0.35) item = null
  else if (r < 0.62) item = 'coin'
  else if (r < 0.72) item = 'coin5'
  else if (r < 0.88) item = 'heartSmall'
  else item = w.inv.hasBombs ? 'bomb' : 'coin'
  if (item) w.drops.push({ x, y, item, life: DROP_LIFE })
}

const shotBox = (x: number, y: number): Box => ({ x: x - 3, y: y - 3, w: 6, h: 6 })

function updateShots(w: World, dt: number) {
  const p = w.player
  const L = roomLeft(w)
  const T = roomTop(w)
  for (const s of w.shots) {
    s.x += s.vx * dt
    s.y += s.vy * dt
    s.life -= dt
    if (s.x < L || s.y < T || s.x >= L + VIEW_W || s.y >= T + VIEW_H) { s.life = 0; continue }
    const tx = Math.floor(s.x / TILE)
    const ty = Math.floor(s.y / TILE)
    const ch = tileAt(w, tx, ty)
    if (s.owner === 'player' && s.kind === 'fire') {
      if (ch === 'X') {
        w.opened.add(openKey(w.map, tx, ty))
        emit(w, 'burn', tx * TILE + 8, ty * TILE + 8)
        s.life = 0
        continue
      }
      if (ch === 'B') { cutBush(w, tx, ty); s.life = 0; continue }
    }
    if (stopsShots(ch)) { s.life = 0; continue }
    const box = shotBox(s.x, s.y)
    if (s.owner === 'player') {
      const dir = Math.abs(s.vx) > Math.abs(s.vy) ? (s.vx < 0 ? 'left' : 'right') : (s.vy < 0 ? 'up' : 'down')
      const e = w.enemies.find(o => o.hp > 0 && o.hitBy !== s.swing && vulnerable(o) && overlap(box, enemyBox(o)))
      if (e) {
        damage(w, e, s.dmg, s.kind === 'fire' ? 'fire' : 'beam', dir)
        s.life = 0
      }
    } else if (overlap(box, body(p))) {
      // Small seeds glance off the hero's guard when walking into them.
      const [fx, fy] = VEC[p.dir]
      if (s.kind === 'seed' && p.swing <= 0 && fx * s.vx + fy * s.vy < 0) emit(w, 'clang', s.x, s.y)
      else hurtPlayer(w, s.dmg, s.x - s.vx, s.y - s.vy)
      s.life = 0
    }
  }
  w.shots = w.shots.filter(s => s.life > 0)
}

function updateBombs(w: World, dt: number) {
  for (const b of w.bombs) {
    b.fuse -= dt
    if (b.fuse > 0) continue
    w.blasts.push({ x: b.x, y: b.y, t: 0.4 })
    emit(w, 'blast', b.x, b.y)
    for (const e of w.enemies) {
      const ex = e.x + e.w / 2
      const ey = e.y + e.h / 2
      if (Math.hypot(ex - b.x, ey - b.y) < 26 + e.w / 4) damage(w, e, 3, 'bomb', facing(b.x, b.y, ex, ey))
    }
    const btx = Math.floor(b.x / TILE)
    const bty = Math.floor(b.y / TILE)
    for (let ty = bty - 2; ty <= bty + 2; ty++) {
      for (let tx = btx - 2; tx <= btx + 2; tx++) {
        if (Math.hypot(tx * TILE + 8 - b.x, ty * TILE + 8 - b.y) > 28) continue
        const ch = tileAt(w, tx, ty)
        if (ch === 'C') {
          w.opened.add(openKey(w.map, tx, ty))
          emit(w, 'secret', tx * TILE + 8, ty * TILE + 8)
        } else if (ch === 'B') cutBush(w, tx, ty)
      }
    }
  }
  w.bombs = w.bombs.filter(b => b.fuse > 0)
  for (const x of w.blasts) x.t -= dt
  w.blasts = w.blasts.filter(x => x.t > 0)
}

// ── Treasure ────────────────────────────────────────────────────────────────
const ORDINAL = ['FIRST', 'SECOND', 'THIRD']

function treasure(w: World, item: ItemKind, pages: string[], then?: Action) {
  w.player.hold = item
  w.player.swing = 0
  emit(w, item === 'flame' ? 'flame' : 'item')
  openDialog(w, pages, then)
}

/** The way out of the current dungeon. */
const exitOf = (w: World): Warp => Object.values(w.map.warps)[0]

export function give(w: World, item: DropKind) {
  const inv = w.inv
  const p = w.player
  switch (item) {
    case 'coin': inv.coins = Math.min(999, inv.coins + 1); w.score += 1; emit(w, 'coin'); break
    case 'coin5': inv.coins = Math.min(999, inv.coins + 5); w.score += 5; emit(w, 'coin'); break
    case 'heartSmall': p.hp = Math.min(p.maxHp, p.hp + 2); emit(w, 'heal'); break
    case 'bomb': inv.bombs = Math.min(inv.maxBombs, inv.bombs + 1); emit(w, 'coin'); break
    case 'bombPack': inv.bombs = Math.min(inv.maxBombs, inv.bombs + 4); emit(w, 'coin'); break
    case 'key':
      inv.keys[w.map.id] = (inv.keys[w.map.id] ?? 0) + 1
      emit(w, 'key')
      break
    case 'coins':
      inv.coins = Math.min(999, inv.coins + 50)
      treasure(w, item, ['FIFTY SILVER COINS!'])
      break
    case 'sword':
      inv.sword = true
      treasure(w, item, ["YOU GOT THE SMITH'S BLADE! PRESS A TO SWING IT."])
      break
    case 'bombs':
      inv.hasBombs = true
      inv.maxBombs = 8
      inv.bombs = 8
      inv.b ??= 'bombs'
      treasure(w, item, ['YOU FOUND A BAG OF BOMBS! PRESS B TO SET ONE DOWN.', 'CRACKED ROCK WILL NOT STAND UP TO THEM.'])
      break
    case 'rod':
      inv.rod = true
      inv.b = 'rod'
      treasure(w, item, ['YOU FOUND THE EMBER ROD! PRESS B TO CAST FIRE. THORNS BURN AWAY BEFORE IT.', 'PAUSE TO CHOOSE BETWEEN THE ROD AND YOUR BOMBS.'])
      break
    case 'boots':
      inv.boots = true
      treasure(w, item, ['YOU FOUND THE HERON BOOTS! NOW YOU CAN WADE THROUGH SHALLOW WATER.'])
      break
    case 'heart':
      p.maxHp += 2
      p.hp = p.maxHp
      w.score += 100
      treasure(w, item, ['A HEART VESSEL! YOUR LIFE GROWS BY ONE HEART.'])
      break
    case 'potion':
      inv.potion = true
      treasure(w, item, ['A RED POTION! IF YOU FALL, IT WILL LIFT YOU BACK UP.'])
      break
    case 'flame': {
      inv.flames++
      p.hp = p.maxHp
      w.score += 1000
      const left = 3 - inv.flames
      treasure(w, item, [
        `THE ${ORDINAL[inv.flames - 1]} HEARTH-FLAME BURNS AGAIN!`,
        left ? `${left === 1 ? 'ONE MORE FLAME SLEEPS' : 'TWO MORE FLAMES SLEEP'} SOMEWHERE IN EMBERFALL.`
          : 'ALL THREE BURN! THE ASHEN GATE IN THE FAR NORTH WILL OPEN FOR YOU NOW.',
      ], { kind: 'warp', warp: exitOf(w) })
      break
    }
  }
}

const canBuy = (w: World, item: DropKind) =>
  item === 'potion' ? !w.inv.potion : item === 'bombPack' ? w.inv.hasBombs && w.inv.bombs < w.inv.maxBombs : true

function pickups(w: World, dt: number) {
  const p = w.player
  const me = body(p)
  w.nope = Math.max(0, w.nope - dt)
  for (const d of w.drops) {
    d.life -= dt
    const touching = overlap(me, { x: d.x + 2, y: d.y + 2, w: 12, h: 12 })
    if (d.price !== undefined) {
      if (!touching) { d.armed = true; continue }
      if (d.armed === false) continue
      d.armed = false
      if (w.inv.coins < d.price || !canBuy(w, d.item)) { emit(w, 'nope'); continue }
      w.inv.coins -= d.price
      emit(w, 'buy')
      if (d.id) { w.flags.add(`got:${d.id}`); d.life = 0 }
      give(w, d.item)
      continue
    }
    if (!touching) continue
    d.life = 0
    if (d.id) w.flags.add(`got:${d.id}`)
    give(w, d.item)
    if (w.dialog) break // one treasure at a time
  }
  w.drops = w.drops.filter(d => d.life > 0)
}

function bossRewards(w: World) {
  const id = w.map.id
  if (id === 'keep') return
  place(w, 'heart', 112, 112, `heart:${id}`)
  place(w, 'flame', ...CENTRE, `flame:${id}`)
}

function bossDefeated(w: World, e: Enemy) {
  w.flags.add(`boss:${w.map.id}`)
  emit(w, 'door')
  if (e.kind === 'king') {
    openDialog(w, [
      'THE ASHEN KING CRUMBLES INTO COLD GREY DUST, AND THE WIND CARRIES HIM AWAY.',
      'FAR TO THE SOUTH, THE THREE HEARTH-FLAMES LEAP UP BRIGHTER THAN EVER BEFORE.',
      'EMBERFALL IS SAVED!',
    ], { kind: 'win' })
    return
  }
  bossRewards(w)
}

function roomCleared(w: World) {
  const def = roomDef(w)
  const here = `${w.map.id}:${roomKey(w)}`
  if (w.map.kind === 'dungeon') w.cleared.add(here)
  if (def.key === 'clear') place(w, 'key', ...CENTRE, `key:${here}`)
  if (def.item) place(w, def.item, ...CENTRE, `item:${here}`)
  const hasShutters = w.map.tiles.slice(w.ry * RH, (w.ry + 1) * RH)
    .some(row => row.slice(w.rx * RW, (w.rx + 1) * RW).includes('S'))
  if (hasShutters || def.key === 'clear' || def.item) emit(w, 'door')
}

// ── The tick ────────────────────────────────────────────────────────────────
export function step(w: World, c: Controls, dt: number): GameEvent[] {
  w.events = []
  if (w.phase === 'over' || w.phase === 'won') { w.phaseTime += dt; return w.events }
  w.fade = Math.max(0, w.fade - dt)
  if (w.dialog) { updateDialog(w, c, dt); return w.events }
  if (w.scroll) {
    w.scroll.t += dt
    if (w.scroll.t >= SCROLL_TIME) { w.scroll = null; enterRoom(w) }
    return w.events
  }
  if (w.phase === 'dying') {
    w.phaseTime += dt
    if (w.phaseTime > 2) { w.phase = 'over'; w.phaseTime = 0 }
    return w.events
  }
  w.time += dt
  if (updatePlayer(w, c, dt) || w.dialog) return w.events

  const p = w.player
  for (const e of w.enemies) updateEnemy(w, e, dt)
  updateShots(w, dt)
  updateBombs(w, dt)
  const me = body(p)
  for (const e of w.enemies) {
    if (e.hp > 0 && !harmless(e) && overlap(enemyBox(e), me)) hurtPlayer(w, e.dmg, e.x + e.w / 2, e.y + e.h / 2)
  }
  for (const e of w.enemies.filter(o => o.hp <= 0 && o.dying <= 0)) {
    if (e.boss) bossDefeated(w, e)
  }
  w.enemies = w.enemies.filter(e => e.hp > 0 || e.dying > 0)
  const busy = w.enemies.some(e => e.hp > 0)
  if (w.roomBusy && !busy) roomCleared(w)
  w.roomBusy = busy
  if (!w.dialog) pickups(w, dt)
  return w.events
}

/** After a game over: wake at the last safe place with three hearts. */
export function continueGame(w: World) {
  w.phase = 'play'
  w.phaseTime = 0
  w.dialog = null
  w.player.hp = Math.min(w.player.maxHp, START_HP)
  w.player.invuln = 0
  w.player.hold = null
  enterMap(w, w.respawn)
}

/** Put the B button on the next item carried. */
export function cycleItem(w: World) {
  const owned = (['bombs', 'rod'] as const).filter(i => (i === 'bombs' ? w.inv.hasBombs : w.inv.rod))
  if (!owned.length) return
  const i = w.inv.b ? owned.indexOf(w.inv.b) : -1
  w.inv.b = owned[(i + 1) % owned.length]
}

