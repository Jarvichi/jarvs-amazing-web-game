// ─── /adventure: drawing ────────────────────────────────────────────────────
//
// A 256×208 screen: a 32-pixel status bar over one 256×176 room. Tiles are
// painted once into little canvases and reused; figures come from
// sprites.ts; bosses are drawn from shapes.

import { PAL, drawSprite, drawText, hash, makeSprite, textWidth, type Sprite } from '../arcade/gfx'
import type { Dir, GameMap, Look } from './maps'
import { MAPS } from './maps'
import { jumpHeight } from './enemies'
import { questFlames, tileAt, type Drop, type Enemy, type World } from './state'
import { ENEMY_ART, HERO, ITEM_ART, PERSON } from './sprites'
import { RH, RW, TILE, VIEW_H, VIEW_W } from './tiles'
import { goalInfo, SCROLL_TIME, SWING_TIME, SWORD_REACH, swordAngle, swordPivot } from './world'

export { PAL, drawText }

export const W = VIEW_W
export const HUD = 32
export const H = HUD + VIEW_H

type G = CanvasRenderingContext2D

export const centreText = (g: G, text: string, x: number, y: number, c: string, scale = 1) =>
  drawText(g, text, x, y, c, scale, 'center')

const rect = (g: G, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c
  g.fillRect(x, y, w, h)
}

/** A filled circle made of whole pixels. */
function disc(g: G, cx: number, cy: number, r: number, c: string) {
  g.fillStyle = c
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy))
    g.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1)
  }
}

// ── Effects ─────────────────────────────────────────────────────────────────
interface Particle { x: number; y: number; vx: number; vy: number; life: number; c: string }

export class Fx {
  parts: Particle[] = []
  shake = 0
  flash = 0
  banner: { text: string; t: number } | null = null

  update(dt: number) {
    this.shake = Math.max(0, this.shake - dt)
    this.flash = Math.max(0, this.flash - dt)
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null
    for (const p of this.parts) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 40 * dt
      p.life -= dt
    }
    this.parts = this.parts.filter(p => p.life > 0)
  }

  burst(x: number, y: number, colours: string[], n = 8, speed = 60) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5
      const s = speed * (0.5 + Math.random() * 0.7)
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + Math.random() * 0.4, c: colours[i % colours.length] })
    }
  }
}

// ── Tiles ───────────────────────────────────────────────────────────────────
type Theme = 'green' | 'marsh' | 'ash' | 'barrow' | 'mine' | 'shrine' | 'keep' | 'cave'

interface Colours { ground: string; tuft: string; dark: string; path: string; wall: string; brick: string }

const THEMES: Record<Theme, Colours> = {
  green: { ground: '#4c9a3c', tuft: '#6cc04a', dark: '#2f6e2a', path: '#d8b77a', wall: '#8b5a3c', brick: '#5e3a26' },
  marsh: { ground: '#3e7a5a', tuft: '#5a9a70', dark: '#2a5a40', path: '#a89870', wall: '#6b5a44', brick: '#4a3c2c' },
  ash: { ground: '#6f625a', tuft: '#8a7c70', dark: '#4e453e', path: '#9d8e7c', wall: '#5a4a44', brick: '#3a302c' },
  barrow: { ground: '#2e4a3a', tuft: '#3a5a46', dark: '#223a2c', path: '#2e4a3a', wall: '#5f7d5a', brick: '#3f5a3c' },
  mine: { ground: '#4a2e26', tuft: '#5a3a30', dark: '#3a221c', path: '#4a2e26', wall: '#8a4f36', brick: '#5e3222' },
  shrine: { ground: '#223a5c', tuft: '#2c4a70', dark: '#1a2c46', path: '#223a5c', wall: '#4a78a8', brick: '#2c4f7a' },
  keep: { ground: '#2a2236', tuft: '#352c44', dark: '#1e1828', path: '#2a2236', wall: '#5a4a6e', brick: '#3a2e4a' },
  cave: { ground: '#3a2c22', tuft: '#46362a', dark: '#2a2018', path: '#3a2c22', wall: '#6a5040', brick: '#4a3628' },
}


function themeAt(m: GameMap, tx: number, ty: number): Theme {
  if (m.kind === 'cave') return 'cave'
  if (m.kind === 'dungeon') return m.id as Theme
  const room = `${Math.floor(tx / RW)},${Math.floor(ty / RH)}`
  for (const [theme, rooms] of Object.entries(m.regions ?? {})) if (rooms.includes(room)) return theme as Theme
  return (m.theme ?? 'green') as Theme
}

/** Whether the ground under a tile is outdoor grass (for trees, rocks…). */
const outdoors = (th: Theme) => th === 'green' || th === 'marsh' || th === 'ash'

function paintGround(g: G, c: Colours, th: Theme) {
  rect(g, 0, 0, 16, 16, c.ground)
  if (outdoors(th)) {
    rect(g, 3, 4, 1, 2, c.tuft); rect(g, 4, 3, 1, 2, c.tuft)
    rect(g, 11, 10, 1, 2, c.tuft); rect(g, 12, 9, 1, 2, c.tuft)
  } else {
    rect(g, 0, 0, 16, 1, c.dark); rect(g, 0, 0, 1, 16, c.dark)
    rect(g, 7, 7, 2, 2, c.tuft)
  }
}

function paintBricks(g: G, c: Colours) {
  rect(g, 0, 0, 16, 16, c.wall)
  for (let y = 0; y < 16; y += 4) {
    rect(g, 0, y + 3, 16, 1, c.brick)
    const off = (y / 4) % 2 ? 4 : 12
    rect(g, off, y, 1, 3, c.brick)
  }
}

function paintTile(g: G, ch: string, th: Theme, frame: number) {
  const c = THEMES[th]
  switch (ch) {
    case '.': case 'A': case ':': case ';':
      paintGround(g, c, th)
      break
    case ',':
      rect(g, 0, 0, 16, 16, c.path)
      rect(g, 4, 5, 1, 1, c.dark); rect(g, 11, 12, 1, 1, c.dark); rect(g, 13, 3, 1, 1, c.dark)
      break
    case 'F':
      paintGround(g, c, th)
      for (const [x, y, col] of [[3, 3, 14], [10, 5, 10], [6, 11, 14], [12, 12, 7]]) {
        rect(g, x, y, 2, 2, PAL[col]); rect(g, x, y + 2, 1, 2, c.dark)
      }
      break
    case '=':
      rect(g, 0, 0, 16, 16, '#8b5a2b')
      for (let x = 0; x < 16; x += 4) rect(g, x, 0, 1, 16, '#5e3a1a')
      rect(g, 0, 0, 16, 1, '#3a2410'); rect(g, 0, 15, 16, 1, '#3a2410')
      break
    case 'T':
      paintGround(g, c, th)
      rect(g, 7, 11, 3, 5, '#5e3a1a')
      disc(g, 8, 7, 7, th === 'marsh' ? '#1f4a34' : '#1e5a2a')
      disc(g, 6, 5, 3, th === 'marsh' ? '#2f6a48' : '#2f7a36')
      break
    case 'a':
      paintGround(g, c, th)
      rect(g, 7, 4, 2, 12, '#3a2e28')
      rect(g, 3, 5, 4, 1, '#3a2e28'); rect(g, 3, 2, 1, 3, '#3a2e28')
      rect(g, 9, 7, 4, 1, '#3a2e28'); rect(g, 12, 3, 1, 4, '#3a2e28')
      break
    case 'R': case 'C':
      if (outdoors(th)) paintGround(g, c, th)
      else paintBricks(g, c)
      disc(g, 8, 8, 7, '#8a8580'); disc(g, 6, 6, 3, '#aaa59e'); rect(g, 3, 13, 11, 2, '#5a5550')
      if (ch === 'C') {
        g.fillStyle = '#2a2622'
        for (const [x, y] of [[8, 3], [7, 4], [7, 5], [8, 6], [9, 7], [9, 8], [8, 9], [7, 10], [5, 7], [6, 8], [11, 9], [10, 10]]) g.fillRect(x, y, 1, 1)
      }
      break
    case 'M':
      rect(g, 0, 0, 16, 16, c.wall)
      rect(g, 0, 5, 16, 1, c.brick); rect(g, 0, 11, 16, 1, c.brick)
      rect(g, 4, 0, 1, 5, c.brick); rect(g, 11, 6, 1, 5, c.brick); rect(g, 6, 12, 1, 4, c.brick)
      rect(g, 1, 1, 2, 1, '#b07a54'); rect(g, 8, 7, 2, 1, '#b07a54')
      break
    case 'g':
      paintGround(g, c, th)
      rect(g, 4, 4, 8, 11, '#8a8580'); rect(g, 5, 3, 6, 1, '#8a8580')
      rect(g, 7, 6, 2, 6, '#5a5550'); rect(g, 5, 8, 6, 2, '#5a5550')
      break
    case 'W': {
      rect(g, 0, 0, 16, 16, '#2a5bd7')
      const o = frame * 4
      rect(g, (2 + o) % 16, 4, 4, 1, '#6a9bff'); rect(g, (9 + o) % 16, 11, 4, 1, '#6a9bff')
      break
    }
    case 'w': {
      rect(g, 0, 0, 16, 16, '#4f8fe0')
      const o = frame * 3
      rect(g, (3 + o) % 16, 5, 3, 1, '#9ac4ff'); rect(g, (10 + o) % 16, 12, 3, 1, '#9ac4ff')
      rect(g, 12, 2, 1, 4, '#3b7a3b'); rect(g, 2, 9, 1, 4, '#3b7a3b')
      break
    }
    case '~':
      rect(g, 0, 0, 16, 16, frame ? '#d9401f' : '#e85a1f')
      rect(g, 2 + frame * 5, 3, 4, 2, '#ffa31f'); rect(g, 10 - frame * 4, 10, 4, 2, '#ffd24a')
      break
    case 'B':
      paintGround(g, c, th)
      disc(g, 8, 9, 6, '#2f9a3a'); disc(g, 6, 7, 2, '#4fc05a'); rect(g, 4, 14, 8, 1, '#1e5a2a')
      break
    case 'X':
      paintGround(g, c, th)
      g.fillStyle = '#5a2d52'
      for (let i = 0; i < 16; i++) {
        g.fillRect(i, 8 + Math.round(Math.sin(i * 1.3) * 4), 1, 3)
        g.fillRect(i, 3 + Math.round(Math.cos(i * 0.9) * 2), 1, 2)
      }
      g.fillStyle = '#c24a8a'
      for (const [x, y] of [[2, 5], [7, 2], [12, 6], [4, 12], [10, 11], [14, 13]]) g.fillRect(x, y, 1, 1)
      break
    case 'D':
      if (th === 'green' || th === 'marsh' || th === 'ash') {
        rect(g, 0, 0, 16, 16, '#5a5550')
        rect(g, 2, 2, 12, 14, PAL[0]); rect(g, 4, 1, 8, 1, PAL[0])
      } else {
        rect(g, 0, 0, 16, 16, PAL[0])
        for (let y = 2; y < 16; y += 4) rect(g, 1, y, 14, 2, c.dark)
      }
      break
    case 'h':
      rect(g, 0, 0, 16, 16, '#a33b2f')
      for (let y = 3; y < 16; y += 4) rect(g, 0, y, 16, 1, '#6e241c')
      break
    case 'H':
      rect(g, 0, 0, 16, 16, '#d8c8a0')
      rect(g, 0, 0, 2, 16, '#7a5a3a'); rect(g, 14, 0, 2, 16, '#7a5a3a'); rect(g, 0, 7, 16, 2, '#7a5a3a')
      break
    case 'Q':
      rect(g, 0, 0, 16, 16, '#3b3547')
      for (let y = 0; y < 16; y += 4) {
        rect(g, 0, y + 3, 16, 1, '#26212e')
        rect(g, (y / 4) % 2 ? 3 : 11, y, 1, 3, '#26212e')
      }
      break
    case 'K':
      rect(g, 0, 0, 16, 16, PAL[0])
      for (let x = 1; x < 16; x += 4) rect(g, x, 0, 2, 16, '#6a6a78')
      rect(g, 0, 4, 16, 2, '#6a6a78'); rect(g, 0, 11, 16, 2, '#6a6a78')
      break
    case '#':
      paintBricks(g, c)
      break
    case 's':
      paintGround(g, c, th)
      rect(g, 1, 1, 14, 14, c.brick); rect(g, 2, 2, 12, 12, c.wall); rect(g, 4, 4, 8, 8, c.brick)
      break
    case 'o':
      paintGround(g, c, th)
      rect(g, 4, 9, 8, 6, '#5a5550'); rect(g, 3, 8, 10, 2, '#8a8580')
      disc(g, 8, 6, 3, frame ? '#ff8a1f' : '#ffa31f'); rect(g, 7 + frame, 1, 2, 4, '#ffd24a')
      break
    case 'L':
      paintBricks(g, c)
      rect(g, 1, 1, 14, 14, '#8b5a2b'); rect(g, 1, 7, 14, 2, '#5e3a1a')
      rect(g, 7, 4, 2, 3, PAL[0]); rect(g, 6, 3, 4, 2, PAL[10])
      break
    case 'S':
      rect(g, 0, 0, 16, 16, c.dark)
      for (let x = 1; x < 16; x += 3) rect(g, x, 0, 2, 16, '#8a8a9a')
      break
    default:
      rect(g, 0, 0, 16, 16, PAL[0])
  }
}

const tileCache = new Map<string, HTMLCanvasElement>()

function tileImage(ch: string, th: Theme, frame: number): HTMLCanvasElement {
  const key = `${th}${ch}${frame}`
  let c = tileCache.get(key)
  if (!c) {
    c = document.createElement('canvas')
    c.width = c.height = TILE
    paintTile(c.getContext('2d')!, ch, th, frame)
    tileCache.set(key, c)
  }
  return c
}

const ANIMATED = new Set(['W', 'w', '~', 'o'])

function drawTiles(g: G, w: World, camX: number, camY: number, t: number) {
  const frame = Math.floor(t * 2) % 2
  const x0 = Math.floor(camX / TILE)
  const y0 = Math.floor(camY / TILE)
  for (let ty = y0; ty <= y0 + RH; ty++) {
    for (let tx = x0; tx <= x0 + RW; tx++) {
      const ch = tileAt(w, tx, ty)
      const img = tileImage(ch, themeAt(w.map, tx, ty), ANIMATED.has(ch) ? frame : 0)
      g.drawImage(img, Math.round(tx * TILE - camX), Math.round(ty * TILE - camY + HUD))
    }
  }
}

// ── Sprites ─────────────────────────────────────────────────────────────────
const cache = new Map<string, Sprite>()
function sprite(key: string, rows: () => string[]): Sprite {
  let s = cache.get(key)
  if (!s) { s = makeSprite(rows()); cache.set(key, s) }
  return s
}
const white = (rows: string[]) => rows.map(r => r.replace(/[^.]/g, '7'))

const LOOKS: Record<Look, [string, string, string]> = {
  // hair, clothes, trim
  smith: ['6', '4', '5'],
  elder: ['7', 'd', '2'],
  villager: ['4', 'b', '3'],
  kid: ['9', 'c', '1'],
  sage: ['1', '1', '0'],
  merchant: ['a', 'e', '2'],
}

function heroSprite(dir: Dir, frame: number): { s: Sprite; flip: boolean } {
  const set = dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'side'
  return { s: sprite(`hero${set}${frame}`, () => HERO[set][frame]), flip: dir === 'left' }
}

function itemSprite(item: string): Sprite | null {
  if (item === 'heart') return sprite('heartBig', () => ITEM_ART.heartSmall)
  if (item === 'bombPack') return sprite('bomb', () => ITEM_ART.bomb)
  const art = ITEM_ART[item]
  return art ? sprite(item, () => art) : null
}

/** An item icon centred in a 16×16 cell at (x, y). */
export function drawItem(g: G, item: string, x: number, y: number, t = 0) {
  if (item === 'flame') {
    const s = sprite('flame', () => ITEM_ART.flame)
    drawSprite(g, s, x + 4, y + 2, Math.floor(t * 8) % 2 === 0)
    return
  }
  const s = itemSprite(item)
  if (!s) return
  if (item === 'heart') {
    g.drawImage(s, Math.round(x + 1), Math.round(y + 2), s.width * 2, s.height * 2)
    return
  }
  drawSprite(g, s, x + Math.floor((16 - s.width) / 2), y + Math.floor((16 - s.height) / 2), false)
}

// ── The room ────────────────────────────────────────────────────────────────
function camera(w: World): [number, number] {
  const x = w.rx * VIEW_W
  const y = w.ry * VIEW_H
  if (!w.scroll) return [x, y]
  const k = Math.min(1, w.scroll.t / SCROLL_TIME)
  const e = k * k * (3 - 2 * k)
  return [x - w.scroll.dx * VIEW_W * (1 - e), y - w.scroll.dy * VIEW_H * (1 - e)]
}

function drawEnemy(g: G, e: Enemy, cx: number, cy: number, t: number) {
  const x = Math.round(e.x - cx)
  const y = Math.round(e.y - cy + HUD)
  if (e.spawn > 0 || e.dying > 0) {
    const k = e.spawn > 0 ? e.spawn : e.dying
    const r = e.boss ? 10 + (1.5 - k) * 12 : 3 + k * 10
    disc(g, x + e.w / 2, y + e.h / 2, Math.max(1, Math.round(r)), PAL[7])
    disc(g, x + e.w / 2, y + e.h / 2, Math.max(0, Math.round(r) - 2), PAL[6])
    if (!e.boss || e.spawn > 0) return
  }
  if (e.boss) { drawBoss(g, e, x, y, t); return }
  const flashing = e.flash > 0 && Math.floor(t * 20) % 2 === 0
  const kind = e.kind === 'bat' && Math.floor(t * 8) % 2 ? 'bat2' : e.kind
  const art = ENEMY_ART[kind]
  const s = sprite(`${kind}${flashing ? 'w' : ''}`, () => (flashing ? white(art) : art))
  const bob = e.left > 0 && Math.floor(t * 6) % 2 ? -1 : 0
  if (e.kind === 'beetle') {
    const angle = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[e.dir]
    g.save()
    g.translate(x + 8, y + 8)
    g.rotate(angle)
    g.drawImage(s, -8, -8)
    g.restore()
    return
  }
  drawSprite(g, s, x, y + bob, e.dir === 'left')
}

function drawBoss(g: G, e: Enemy, x: number, y: number, t: number) {
  const hit = e.flash > 0 && Math.floor(t * 20) % 2 === 0
  const col = (c: string) => (hit ? PAL[7] : c)
  switch (e.kind) {
    case 'mossback': {
      const z = Math.round(jumpHeight(e))
      rect(g, x + 4, y + 26, 24, 5, 'rgba(0,0,0,0.35)')
      const by = y - z
      disc(g, x + 16, by + 18, 14, col('#2f6e2a'))
      disc(g, x + 16, by + 14, 11, col('#4c9a3c'))
      for (const [sx, sy] of [[9, 9], [20, 7], [14, 15], [23, 14], [8, 17]]) disc(g, x + sx, by + sy, 2, col('#8bd06a'))
      rect(g, x + 8, by + 24, 16, 4, col('#1e3a1a'))
      disc(g, x + 10, by + 22, 3, col(PAL[10])); disc(g, x + 22, by + 22, 3, col(PAL[10]))
      rect(g, x + 10, by + 22, 1, 2, PAL[0]); rect(g, x + 22, by + 22, 1, 2, PAL[0])
      break
    }
    case 'drake': {
      const flap = Math.floor(t * 6) % 2 ? 0 : 3
      const face = e.dir === 'left' ? -1 : 1
      g.fillStyle = col('#a33b2f')
      g.beginPath(); g.moveTo(x + 16, y + 10); g.lineTo(x - 2, y + 2 + flap); g.lineTo(x + 8, y + 16); g.fill()
      g.beginPath(); g.moveTo(x + 16, y + 10); g.lineTo(x + 34, y + 2 + flap); g.lineTo(x + 24, y + 16); g.fill()
      disc(g, x + 16, y + 14, 9, col('#e8641f'))
      disc(g, x + 16, y + 16, 5, col('#ffd24a'))
      const hx = x + 16 + face * 9
      disc(g, hx, y + 7, 6, col('#e8641f'))
      rect(g, hx + face * 2, y + 5, 2, 2, PAL[0])
      rect(g, hx + face * 5 - 1, y + 9, 3, 2, col('#ffa31f'))
      break
    }
    case 'serpent': {
      const cxp = x + 16
      const cyp = y + 16
      if (e.state === 'under') {
        const r = 6 + Math.floor(t * 8) % 6
        g.strokeStyle = '#9ac4ff'
        g.strokeRect(cxp - r, cyp - r / 2, r * 2, r)
        break
      }
      const rise = e.state === 'rise' ? 1 - e.t / 0.4 : e.state === 'sink' ? e.t / 0.4 : 1
      g.save()
      g.beginPath(); g.rect(x - 4, y - 8, 40, 40); g.clip()
      const oy = Math.round((1 - rise) * 26)
      disc(g, cxp, cyp + oy, 12, col('#2a8a8a'))
      disc(g, cxp, cyp + oy - 2, 9, col('#3ab0a0'))
      rect(g, cxp - 14, cyp + oy - 4, 4, 10, col('#1f6a6a')); rect(g, cxp + 10, cyp + oy - 4, 4, 10, col('#1f6a6a'))
      disc(g, cxp - 5, cyp + oy - 3, 2, PAL[8]); disc(g, cxp + 5, cyp + oy - 3, 2, PAL[8])
      rect(g, cxp - 4, cyp + oy + 4, 8, 3, PAL[0])
      g.restore()
      rect(g, x, y + 26, 32, 2, '#9ac4ff')
      break
    }
    case 'king': {
      if ((e.state === 'out' || e.state === 'in') && Math.floor(t * 30) % 2) break
      const bare = e.bare > 0
      const robe = bare ? (Math.floor(t * 10) % 2 ? '#a33b2f' : '#e8641f') : '#6a6a78'
      g.fillStyle = col(robe)
      g.beginPath(); g.moveTo(x + 12, y + 6); g.lineTo(x - 1, y + 32); g.lineTo(x + 25, y + 32); g.fill()
      disc(g, x + 12, y + 8, 6, col(bare ? '#3a2e28' : '#8a8580'))
      rect(g, x + 6, y, 13, 3, col(PAL[10])); rect(g, x + 6, y - 3, 2, 3, col(PAL[10]))
      rect(g, x + 11, y - 3, 2, 3, col(PAL[10])); rect(g, x + 17, y - 3, 2, 3, col(PAL[10]))
      rect(g, x + 9, y + 7, 2, 2, PAL[8]); rect(g, x + 14, y + 7, 2, 2, PAL[8])
      if (!bare) {
        g.fillStyle = '#4a4a56'
        for (const [px, py] of [[8, 16], [14, 20], [10, 25], [16, 27], [6, 28]]) g.fillRect(x + px, y + py, 2, 1)
      }
      break
    }
  }
  // Boss health, under the status bar.
  if (e.hp > 0) {
    rect(g, 64, HUD + 2, 128, 4, PAL[0])
    rect(g, 65, HUD + 3, Math.round(126 * (e.hp / e.maxHp)), 2, PAL[8])
  }
}

function drawHero(g: G, w: World, cx: number, cy: number, t: number) {
  const p = w.player
  if (p.invuln > 0 && w.phase === 'play' && Math.floor(t * 15) % 2 === 0) return
  const x = Math.round(p.x - cx)
  const y = Math.round(p.y - cy + HUD)
  let dir = p.dir
  if (w.phase === 'dying') dir = (['down', 'left', 'up', 'right'] as Dir[])[Math.floor(w.phaseTime * 10) % 4]
  if (p.hold) {
    const { s } = heroSprite('down', 0)
    drawSprite(g, s, x, y, false)
    drawItem(g, p.hold, x, y - 16, t)
    return
  }
  const frame = p.swing > 0 ? 0 : Math.floor(p.step * 8) % 2
  const { s, flip } = heroSprite(dir, frame)
  if (p.swing > 0) {
    // A pale trail over the arc swept so far, then the blade itself.
    const { x: px, y: py } = swordPivot(w)
    const ox = px - cx
    const oy = py - cy + HUD
    const now = swordAngle(w)
    const from = now - (1 - p.swing / SWING_TIME) * Math.PI
    g.fillStyle = 'rgba(255,241,232,0.35)'
    for (let a = from; a < now; a += 0.12) {
      g.fillRect(Math.round(ox + Math.cos(a) * (SWORD_REACH - 3)), Math.round(oy + Math.sin(a) * (SWORD_REACH - 3)), 2, 2)
    }
    for (let r = 5; r <= SWORD_REACH; r++) {
      const c = r < 9 ? PAL[10] : r > SWORD_REACH - 2 ? PAL[6] : PAL[7]
      rect(g, Math.round(ox + Math.cos(now) * r) - 1, Math.round(oy + Math.sin(now) * r) - 1, 2, 2, c)
    }
  }
  drawSprite(g, s, x, y, flip)
}

function drawDrop(g: G, d: Drop, cx: number, cy: number, t: number) {
  if (d.life < 2 && Math.floor(t * 12) % 2) return
  const x = Math.round(d.x - cx)
  const y = Math.round(d.y - cy + HUD)
  const lift = d.life === Infinity && !d.price ? Math.round(Math.sin(t * 3) * 1.5) : 0
  drawItem(g, d.item, x, y + lift, t)
  if (d.price !== undefined) centreText(g, String(d.price), x + 8, y + 19, PAL[7])
}

function drawShots(g: G, w: World, cx: number, cy: number, t: number) {
  const blink = Math.floor(t * 20) % 2
  for (const s of w.shots) {
    const x = Math.round(s.x - cx)
    const y = Math.round(s.y - cy + HUD)
    switch (s.kind) {
      case 'beam':
        if (Math.abs(s.vx) > Math.abs(s.vy)) rect(g, x - 6, y - 1, 12, 3, blink ? PAL[7] : PAL[12])
        else rect(g, x - 1, y - 6, 3, 12, blink ? PAL[7] : PAL[12])
        break
      case 'fire': disc(g, x, y, 4, blink ? PAL[9] : PAL[8]); disc(g, x, y, 2, PAL[10]); break
      case 'seed': disc(g, x, y, 2, PAL[4]); break
      case 'flame': disc(g, x, y, 4, blink ? PAL[9] : PAL[10]); break
      case 'orb': disc(g, x, y, 3, blink ? PAL[12] : PAL[7]); break
      case 'ember': disc(g, x, y, 3, blink ? PAL[8] : PAL[9]); break
    }
  }
  for (const b of w.bombs) {
    const x = Math.round(b.x - cx)
    const y = Math.round(b.y - cy + HUD)
    const s = sprite('bomb', () => ITEM_ART.bomb)
    const flash = b.fuse < 0.4 && blink
    if (!flash) drawSprite(g, s, x - 4, y - 5, false)
  }
  for (const b of w.blasts) {
    const x = Math.round(b.x - cx)
    const y = Math.round(b.y - cy + HUD)
    const r = Math.round(10 + (0.4 - b.t) * 50)
    disc(g, x, y, r, blink ? PAL[10] : PAL[9])
    disc(g, x, y, Math.max(0, r - 6), PAL[7])
  }
}

/** The whole play screen: room, figures, status bar, and any dialog. */
export function renderWorld(g: G, w: World, fx: Fx, t: number) {
  const [camX, camY] = camera(w)
  const sx = fx.shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0
  const sy = fx.shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0
  const cx = camX + sx
  const cy = camY + sy
  g.save()
  g.beginPath()
  g.rect(0, HUD, W, VIEW_H)
  g.clip()
  drawTiles(g, w, cx, cy, t)
  for (const d of w.drops) drawDrop(g, d, cx, cy, t)
  for (const n of w.npcs) {
    const [hair, clothes, trim] = LOOKS[n.look]
    const s = sprite(`npc${n.look}`, () => PERSON.map(r => r.replace(/4/g, hair).replace(/9/g, clothes).replace(/8/g, trim)))
    drawSprite(g, s, n.px - cx, n.py - cy + HUD, false)
  }
  for (const e of w.enemies) if (!e.boss) drawEnemy(g, e, cx, cy, t)
  drawHero(g, w, cx, cy, t)
  for (const e of w.enemies) if (e.boss) drawEnemy(g, e, cx, cy, t)
  drawShots(g, w, cx, cy, t)
  for (const p of fx.parts) rect(g, Math.round(p.x - cx), Math.round(p.y - cy + HUD), 2, 2, p.c)
  if (w.fade > 0) rect(g, 0, HUD, W, VIEW_H, `rgba(0,0,0,${Math.min(1, w.fade / 0.35)})`)
  if (fx.flash > 0) rect(g, 0, HUD, W, VIEW_H, `rgba(255,0,77,${fx.flash})`)
  if (w.phase === 'dying') rect(g, 0, HUD, W, VIEW_H, `rgba(126,37,83,${Math.min(0.6, w.phaseTime / 2)})`)
  if (fx.banner) {
    const a = Math.min(1, fx.banner.t)
    g.globalAlpha = a
    rect(g, 0, HUD + 12, W, 16, 'rgba(0,0,0,0.6)')
    centreText(g, fx.banner.text, W / 2, HUD + 16, PAL[10], 1)
    g.globalAlpha = 1
  }
  g.restore()
  drawHud(g, w, t)
  if (w.dialog) drawDialog(g, w, t)
}

// ── Status bar ──────────────────────────────────────────────────────────────
function drawMinimap(g: G, w: World, t: number) {
  const m = w.map
  if (m.kind === 'cave') {
    drawText(g, m.name.slice(0, 12), 6, 12, PAL[6])
    return
  }
  const cw = m.kind === 'overworld' ? 8 : 12
  const ch = m.kind === 'overworld' ? 4 : 6
  const ox = 6
  const oy = 6
  rect(g, ox - 1, oy - 1, m.cols * cw + 2, m.rows * ch + 2, PAL[5])
  for (let ry = 0; ry < m.rows; ry++) {
    for (let rx = 0; rx < m.cols; rx++) {
      const here = rx === w.rx && ry === w.ry
      if (m.kind === 'dungeon' && !m.rooms[`${rx},${ry}`]) { rect(g, ox + rx * cw, oy + ry * ch, cw, ch, PAL[0]); continue }
      rect(g, ox + rx * cw, oy + ry * ch, cw - 1, ch - 1, here ? PAL[11] : m.kind === 'overworld' ? PAL[1] : PAL[13])
    }
  }
  // The next goal blinks on the overworld map.
  const goal = goalInfo(w).room
  if (m.kind === 'overworld' && goal && Math.floor(t * 3) % 2 === 0) {
    rect(g, ox + goal[0] * cw + cw / 2 - 2, oy + goal[1] * ch + 1, 3, 2, PAL[10])
  }
}

export function drawHeart(g: G, x: number, y: number, fill: number) {
  // fill: 0 empty, 1 half, 2 full
  const s = sprite('heartSmall', () => ITEM_ART.heartSmall)
  const e = sprite('heartEmpty', () => ITEM_ART.heartSmall.map(r => r.replace(/[^.]/g, '5')))
  g.drawImage(e, x, y)
  if (fill === 2) g.drawImage(s, x, y)
  else if (fill === 1) g.drawImage(s, 0, 0, 4, 6, x, y, 4, 6)
}

function drawHud(g: G, w: World, t: number) {
  rect(g, 0, 0, W, HUD, PAL[0])
  drawMinimap(g, w, t)
  const inv = w.inv
  const col = 62
  drawItem(g, 'coin', col - 6, -1)
  drawText(g, `X${inv.coins}`, col + 6, 4, PAL[7])
  drawItem(g, 'key', col - 6, 8)
  drawText(g, `X${w.map.kind === 'dungeon' ? inv.keys[w.map.id] ?? 0 : 0}`, col + 6, 13, PAL[7])
  drawItem(g, 'bomb', col - 6, 17)
  drawText(g, `X${inv.bombs}`, col + 6, 22, PAL[7])
  // Item boxes.
  for (const [label, x, item] of [['B', 100, inv.b], ['A', 124, inv.sword ? 'sword' : null]] as const) {
    g.strokeStyle = PAL[12]
    g.strokeRect(x + 0.5, 8.5, 18, 21)
    rect(g, x + 6, 5, 7, 6, PAL[0])
    centreText(g, label, x + 10, 5, PAL[7])
    if (item) drawItem(g, item === 'bombs' ? 'bomb' : item, x + 2, 11, t)
  }
  // Flames relit.
  for (let i = 0; i < 3; i++) {
    const lit = i < questFlames(w)
    const s = sprite(lit ? 'flame' : 'flameOut', () =>
      lit ? ITEM_ART.flame : ITEM_ART.flame.map(r => r.replace(/[^.]/g, '5')))
    g.drawImage(s, 148 + i * 9, 14)
  }
  centreText(g, '-LIFE-', 212, 3, PAL[8])
  const hearts = w.player.maxHp / 2
  for (let i = 0; i < hearts; i++) {
    const hp = w.player.hp - i * 2
    drawHeart(g, 178 + (i % 8) * 9, 13 + Math.floor(i / 8) * 8, hp >= 2 ? 2 : hp === 1 ? 1 : 0)
  }
  if (inv.potion) drawItem(g, 'potion', 232, 16)
}

// ── Dialog ──────────────────────────────────────────────────────────────────
function drawDialog(g: G, w: World, t: number) {
  const d = w.dialog!
  const top = w.player.y - w.ry * VIEW_H > VIEW_H / 2
  const y = top ? HUD + 6 : H - 54
  rect(g, 6, y, W - 12, 48, PAL[0])
  g.strokeStyle = PAL[7]
  g.strokeRect(8.5, y + 2.5, W - 17, 43)
  const text = d.pages[d.page].slice(0, Math.floor(d.shown))
  text.split('\n').forEach((line, i) => drawText(g, line, 16, y + 7 + i * 13, PAL[7], 2, 'left', false))
  if (d.shown >= d.pages[d.page].length && Math.floor(t * 3) % 2) {
    const tip = d.page < d.pages.length - 1 ? '>' : '.'
    drawText(g, tip, W - 20, y + 36, PAL[10])
  }
}

// ── Pause: the bag ──────────────────────────────────────────────────────────
export function drawInventory(g: G, w: World, t: number, hint: string) {
  rect(g, 0, HUD, W, VIEW_H, 'rgba(0,0,0,0.85)')
  const inv = w.inv
  centreText(g, 'PAUSED', W / 2, HUD + 8, PAL[7], 2)
  drawText(g, 'ITEMS', 20, HUD + 30, PAL[12])
  const items: [string, boolean, string][] = [
    ['sword', inv.sword, 'BLADE'],
    ['bomb', inv.hasBombs, `BOMBS ${inv.bombs}`],
    ['rod', inv.rod, 'EMBER ROD'],
    ['boots', inv.boots, 'HERON BOOTS'],
    ['potion', inv.potion, 'POTION'],
  ]
  items.forEach(([item, have, name], i) => {
    const x = 20 + (i % 3) * 76
    const y = HUD + 42 + Math.floor(i / 3) * 28
    const chosen = (item === 'bomb' && inv.b === 'bombs') || (item === 'rod' && inv.b === 'rod')
    if (chosen && Math.floor(t * 4) % 2 === 0) {
      g.strokeStyle = PAL[10]
      g.strokeRect(x - 2.5, y - 2.5, 21, 21)
    }
    if (have) drawItem(g, item, x, y, t)
    else rect(g, x + 6, y + 6, 4, 4, PAL[5])
    drawText(g, have ? name : '???', x + 20, y + 6, have ? PAL[7] : PAL[5])
  })
  drawText(g, 'HEARTH-FLAMES', 20, HUD + 104, PAL[9])
  for (let i = 0; i < 3; i++) {
    if (i < questFlames(w)) drawItem(g, 'flame', 20 + i * 20, HUD + 112, t)
    else g.drawImage(sprite('flameOut', () => ITEM_ART.flame.map(r => r.replace(/[^.]/g, '5'))), 24 + i * 20, HUD + 114)
  }
  const mins = Math.floor(w.time / 60)
  drawText(g, `TIME ${String(Math.floor(mins / 60))}:${String(mins % 60).padStart(2, '0')}`, 150, HUD + 108, PAL[6])
  drawText(g, `SCORE ${w.score}`, 150, HUD + 118, PAL[6])
  centreText(g, hint, W / 2, H - 14, PAL[6])
}

// ── Title art ───────────────────────────────────────────────────────────────
export function drawTitleScene(g: G, t: number) {
  const sky = g.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#05060f')
  sky.addColorStop(0.7, '#2a1030')
  sky.addColorStop(1, '#5a2020')
  g.fillStyle = sky
  g.fillRect(0, 0, W, H)
  for (let i = 0; i < 40; i++) {
    rect(g, Math.floor(hash(i) * W), Math.floor(hash(i + 99) * 90), 1, 1, i % 5 ? PAL[5] : PAL[6])
  }
  // Mountains and the keep.
  g.fillStyle = '#1a1020'
  g.beginPath()
  g.moveTo(0, 160)
  for (let x = 0; x <= W; x += 16) g.lineTo(x, 150 - Math.abs(Math.sin(x * 0.05)) * 30 - hash(x) * 10)
  g.lineTo(W, H); g.lineTo(0, H); g.fill()
  rect(g, 104, 104, 48, 50, '#120a16')
  for (const x of [100, 118, 136, 148]) rect(g, x, 94, 8, 14, '#120a16')
  rect(g, 124, 132, 8, 22, '#000')
  // Embers drifting up.
  for (let i = 0; i < 30; i++) {
    const speed = 12 + hash(i + 7) * 20
    const y = H - ((t * speed + hash(i) * H) % H)
    const x = hash(i + 3) * W + Math.sin(t + i) * 6
    rect(g, Math.round(x), Math.round(y), 1, 1, i % 3 ? PAL[9] : PAL[10])
  }
  rect(g, 0, H - 30, W, 30, '#0a0608')
}

export const textW = textWidth
export const mapName = (id: string) => MAPS[id]?.name ?? ''
