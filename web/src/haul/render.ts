// ─── /haul: drawing ─────────────────────────────────────────────────────────
//
// Everything is drawn from code in 8-pixel tiles and scaled up with square
// pixels. The street is 152×168; a strip above it shows the score and the
// clock, and in portrait a panel below shows your bag and lives (main.ts
// moves those to side panels in landscape).

import { PAL, drawSprite, drawText, hash, textWidth } from '../arcade/gfx'
import { TILE, houseFor, isHouse, tileAt, type Maze } from './maze'
import { sprites } from './sprites'
import { BAG, bankRate, doorsLeft, type Ghoul, type Hero, type World } from './world'

export { PAL, drawText, textWidth }

export const MAZE_W = 19 * TILE
export const MAZE_H = 21 * TILE
export const HUD = 16

export function centreText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale = 1): void {
  drawText(ctx, text, x, y, color, scale, 'center')
}

interface Theme { pave: string; fence: string; house: string; roof: string; trim: string }

const THEMES: Theme[] = [
  { pave: '#0d0a1a', fence: '#3a2410', house: PAL[4], roof: '#5a2a14', trim: PAL[9] },
  { pave: '#08120e', fence: '#20302a', house: PAL[5], roof: '#2e2a28', trim: PAL[11] },
  { pave: '#0c0c14', fence: '#1d2438', house: PAL[1], roof: '#101a38', trim: PAL[13] },
  { pave: '#120616', fence: '#2a1030', house: PAL[2], roof: '#4a1238', trim: PAL[14] },
  { pave: '#100808', fence: '#301818', house: '#3a2e4a', roof: '#241a30', trim: PAL[8] },
]

export const themeFor = (street: number) => THEMES[(street - 1) % THEMES.length]

/** Screen shake, flashes and the numbers that float up when you score. */
export class Fx {
  shake = 0
  flash = 0
  pops: { x: number; y: number; text: string; t: number; colour: string }[] = []

  pop(x: number, y: number, text: string, colour = PAL[7]) {
    this.pops.push({ x, y, text, t: 1, colour })
  }

  update(dt: number) {
    this.shake = Math.max(0, this.shake - dt)
    this.flash = Math.max(0, this.flash - dt)
    for (const p of this.pops) p.t -= dt
    this.pops = this.pops.filter(p => p.t > 0)
  }
}

// ── The street ──────────────────────────────────────────────────────────────

function drawHouse(g: CanvasRenderingContext2D, m: Maze, x: number, y: number, px: number, py: number, th: Theme, t: number) {
  const roofEdge = !isHouse(m, x, y - 1)
  g.fillStyle = th.house
  g.fillRect(px, py, TILE, TILE)
  // Brick courses.
  g.fillStyle = 'rgba(0,0,0,0.25)'
  g.fillRect(px, py + 3, TILE, 1)
  g.fillRect(px + ((y & 1) ? 2 : 6), py, 1, 3)
  g.fillRect(px + ((y & 1) ? 5 : 1), py + 4, 1, 4)
  if (roofEdge) {
    g.fillStyle = th.roof
    g.fillRect(px, py, TILE, 3)
    g.fillStyle = 'rgba(255,255,255,0.12)'
    g.fillRect(px, py, TILE, 1)
  }
  // Outline against the pavement.
  g.fillStyle = 'rgba(0,0,0,0.55)'
  if (!isHouse(m, x - 1, y)) g.fillRect(px, py, 1, TILE)
  if (!isHouse(m, x + 1, y)) g.fillRect(px + TILE - 1, py, 1, TILE)
  if (!isHouse(m, x, y + 1)) g.fillRect(px, py + TILE - 1, TILE, 1)
  // An occasional window, some lit, flickering like a telly.
  const h = hash(x * 31 + y * 17)
  if (h > 0.62 && !roofEdge) {
    const on = h > 0.8 && Math.sin(t * (2 + h * 3) + h * 20) > -0.6
    g.fillStyle = on ? PAL[10] : '#0a0a18'
    g.fillRect(px + 2, py + 2, 4, 3)
    g.fillStyle = 'rgba(0,0,0,0.5)'
    g.fillRect(px + 4, py + 2, 1, 3)
  }
}

function drawFence(g: CanvasRenderingContext2D, px: number, py: number, th: Theme) {
  g.fillStyle = th.fence
  g.fillRect(px, py, TILE, TILE)
  g.fillStyle = 'rgba(0,0,0,0.45)'
  g.fillRect(px + 1, py, 1, TILE)
  g.fillRect(px + 5, py, 1, TILE)
  g.fillRect(px, py + 5, TILE, 1)
}

function drawGrave(g: CanvasRenderingContext2D, px: number, py: number, x: number) {
  g.fillStyle = '#1a1420'
  g.fillRect(px, py, TILE, TILE)
  g.fillStyle = PAL[5]
  g.fillRect(px + 2, py + 2, 4, 6)
  g.fillRect(px + 3, py + 1, 2, 1)
  g.fillStyle = PAL[6]
  g.fillRect(px + 3 + (x & 1 ? 0 : 1), py + 3, 1, 3)
}

/** The door on the house next to each doorstep: lit, dark or your own. */
function drawDoor(g: CanvasRenderingContext2D, m: Maze, step: { x: number; y: number }, style: 'lit' | 'dark' | 'home', ox: number, oy: number, t: number) {
  const hs = houseFor(m, step)
  if (!hs) return
  const px = ox + hs.x * TILE
  const py = oy + hs.y * TILE
  const dx = step.x - hs.x
  const dy = step.y - hs.y
  // A 4×5 door on the house face towards the step.
  const x = dx > 0 ? px + TILE - 3 : dx < 0 ? px : px + 2
  const y = dy > 0 ? py + TILE - 5 : dy < 0 ? py : py + 1
  const w = dx !== 0 ? 3 : 4
  const h = dy !== 0 ? 5 : 6
  const colour = style === 'home' ? PAL[11] : style === 'lit' ? PAL[9] : '#2a1a10'
  g.fillStyle = colour
  g.fillRect(x, y, w, h)
  if (style === 'lit') {
    // Warm light spilling onto the step.
    const a = 0.25 + 0.1 * Math.sin(t * 5 + step.x)
    g.fillStyle = `rgba(255,163,0,${a})`
    g.fillRect(ox + step.x * TILE + 1, oy + step.y * TILE + 1, TILE - 2, TILE - 2)
    g.fillStyle = PAL[10]
    g.fillRect(x + (w >> 1), y + (h >> 1), 1, 1)
  }
  if (style === 'home') {
    g.fillStyle = PAL[8]
    g.fillRect(x + (w >> 1), y + 1, 1, 1)
  }
}

export function drawStreet(g: CanvasRenderingContext2D, w: World, ox: number, oy: number, t: number): void {
  const m = w.maze
  const th = themeFor(w.street)
  g.fillStyle = w.midnight ? '#1a0610' : th.pave
  g.fillRect(ox, oy, MAZE_W, MAZE_H)
  for (let y = 0; y < m.rows; y++) {
    for (let x = 0; x < m.cols; x++) {
      const c = tileAt(m, x, y)
      const px = ox + x * TILE
      const py = oy + y * TILE
      if (c === 'H') drawHouse(g, m, x, y, px, py, th, t)
      else if (c === '#') drawFence(g, px, py, th)
      else if (c === 'G') drawGrave(g, px, py, x)
      else if (c === '-') {
        g.fillStyle = PAL[5]
        for (let i = 0; i < TILE; i += 2) g.fillRect(px + i, py + 2, 1, 5)
        g.fillRect(px, py + 2, TILE, 1)
      } else if ((x * 7 + y * 13) % 11 === 0) {
        // Leaves on the pavement.
        g.fillStyle = 'rgba(171,82,54,0.5)'
        g.fillRect(px + 3, py + 4, 2, 1)
      }
    }
  }
  m.doors.forEach((d, i) => drawDoor(g, m, d, w.lit[i] ? 'lit' : 'dark', ox, oy, t))
  drawDoor(g, m, m.home, 'home', ox, oy, t)
  // Your doorstep glows when there are sweets to bank.
  if (w.bag > 0) {
    const a = 0.3 + 0.3 * Math.sin(t * 8)
    g.fillStyle = `rgba(0,228,54,${a})`
    g.fillRect(ox + m.home.x * TILE, oy + m.home.y * TILE, TILE, TILE)
  }
  const art = sprites()
  m.lanterns.forEach((l, i) => {
    if (!w.lanterns[i]) return
    const bob = Math.sin(t * 4 + i) > 0 ? 0 : 1
    drawSprite(g, art.lantern, ox + l.x * TILE, oy + l.y * TILE + bob, false)
  })
}

// ── Walkers ─────────────────────────────────────────────────────────────────

const frameOf = (t: number, moving: boolean) => (moving ? Math.floor(t * 8) % 2 : 0)

export function drawHero(g: CanvasRenderingContext2D, hero: Hero, x: number, y: number, left: boolean, frame: number): void {
  drawSprite(g, sprites().heroes[hero][frame], x, y, left)
}

function drawGhoul(g: CanvasRenderingContext2D, w: World, gh: Ghoul, ox: number, oy: number, t: number) {
  const x = ox + gh.x * TILE - 1
  const y = oy + gh.y * TILE - 2
  if (gh.mode === 'eyes') {
    g.fillStyle = PAL[7]
    g.fillRect(x + 2, y + 3, 2, 3)
    g.fillRect(x + 6, y + 3, 2, 3)
    g.fillStyle = PAL[12]
    g.fillRect(x + 3, y + 4, 1, 1)
    g.fillRect(x + 7, y + 4, 1, 1)
    return
  }
  const art = sprites()
  const f = frameOf(t + gh.slot.x, true)
  let set = art.ghouls[gh.kind]
  if (gh.scared) set = w.lantern < 2 && Math.floor(t * 6) % 2 === 0 ? art.flash[gh.kind] : art.scared[gh.kind]
  const bob = gh.kind === 'ghost' || gh.kind === 'bat' ? Math.round(Math.sin(t * 5 + gh.slot.x) * 1.5) : 0
  if (gh.kind === 'ghost') g.globalAlpha = gh.mode === 'pen' ? 0.5 : 0.8
  drawSprite(g, set[f], x, y + bob, gh.dir === 'left')
  g.globalAlpha = 1
}

export function drawWalkers(g: CanvasRenderingContext2D, w: World, ox: number, oy: number, t: number): void {
  const p = w.player
  const caught = w.phase === 'caught'
  // Ghouls in the graveyard first, so the ones out hunting draw over houses.
  for (const gh of w.ghouls) if (gh.mode === 'pen') drawGhoul(g, w, gh, ox, oy, t)
  if (!(caught && w.phaseTime > 0.8 && Math.floor(t * 10) % 2 === 0)) {
    const px = ox + p.x * TILE - 1
    const py = oy + p.y * TILE - 2
    drawHero(g, w.hero, px, py, p.face === 'left', frameOf(t, !!p.dir && w.phase === 'play'))
    // Wrapping through an alley: draw the other half on the far side.
    if (p.x < 0.5) drawHero(g, w.hero, px + MAZE_W, py, p.face === 'left', 0)
    if (p.x > w.maze.cols - 1.5) drawHero(g, w.hero, px - MAZE_W, py, p.face === 'left', 0)
  }
  for (const gh of w.ghouls) if (gh.mode !== 'pen') drawGhoul(g, w, gh, ox, oy, t)
}

// ── Fog ─────────────────────────────────────────────────────────────────────
let fogCanvas: HTMLCanvasElement | null = null

/** Foggy streets: you only see a little way round you (and lit doors). */
export function drawFog(g: CanvasRenderingContext2D, w: World, ox: number, oy: number, t: number): void {
  if (!w.def.fog) return
  fogCanvas ??= document.createElement('canvas')
  fogCanvas.width = MAZE_W
  fogCanvas.height = MAZE_H
  const f = fogCanvas.getContext('2d')!
  f.globalCompositeOperation = 'source-over'
  f.fillStyle = 'rgba(8,8,16,0.93)'
  f.fillRect(0, 0, MAZE_W, MAZE_H)
  f.globalCompositeOperation = 'destination-out'
  const hole = (x: number, y: number, r: number) => {
    const grad = f.createRadialGradient(x, y, r * 0.4, x, y, r)
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    f.fillStyle = grad
    f.fillRect(x - r, y - r, r * 2, r * 2)
  }
  const r = 30 + Math.sin(t * 3) * 1.5
  hole(w.player.x * TILE + 4, w.player.y * TILE + 4, r)
  const m = w.maze
  m.doors.forEach((d, i) => { if (w.lit[i]) hole(d.x * TILE + 4, d.y * TILE + 4, 9) })
  m.lanterns.forEach((l, i) => { if (w.lanterns[i]) hole(l.x * TILE + 4, l.y * TILE + 4, 9) })
  hole(m.home.x * TILE + 4, m.home.y * TILE + 4, 10)
  g.drawImage(fogCanvas, ox, oy)
  // Eyes glint through the fog.
  for (const gh of w.ghouls) {
    if (gh.mode !== 'hunt') continue
    g.fillStyle = gh.scared ? PAL[12] : PAL[8]
    const x = ox + gh.x * TILE
    const y = oy + gh.y * TILE
    g.fillRect(x + 2, y + 1, 1, 1)
    g.fillRect(x + 5, y + 1, 1, 1)
  }
}

// ── Readouts ────────────────────────────────────────────────────────────────

/** The clock on the church tower: minutes to midnight, one per second. */
export function clockText(w: World): string {
  if (w.midnight) return '12:00'
  const mins = Math.ceil(w.clock)
  const h = 11 - Math.floor((mins - 1) / 60)
  const m = (60 - (mins % 60)) % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

export function drawHud(g: CanvasRenderingContext2D, w: World, hiscore: number, x: number, width: number, t: number): void {
  g.fillStyle = PAL[0]
  g.fillRect(x, 0, width, HUD)
  drawText(g, 'SCORE', x + 2, 1, PAL[9])
  drawText(g, String(w.score).padStart(6, '0'), x + 2, 8, PAL[7])
  const midnightBlink = w.midnight && Math.floor(t * 2) % 2 === 0
  centreText(g, clockText(w), x + width / 2, 2, w.midnight ? (midnightBlink ? PAL[8] : PAL[14]) : w.clock < 15 ? PAL[10] : PAL[7], 2)
  drawText(g, 'HI', x + width - 2, 1, PAL[13], 1, 'right')
  drawText(g, String(Math.max(hiscore, w.score)).padStart(6, '0'), x + width - 2, 8, PAL[6], 1, 'right')
}

/** Bag, lives and doors left: under the street in portrait, beside it in landscape. */
export function drawStatus(g: CanvasRenderingContext2D, w: World, x: number, y: number, width: number, t: number): void {
  const art = sprites()
  const full = w.bag >= BAG
  drawText(g, full ? 'BAG FULL! GO HOME' : 'BAG', x, y, full && Math.floor(t * 4) % 2 === 0 ? PAL[8] : PAL[9])
  for (let i = 0; i < BAG; i++) {
    const cx = x + i * 9
    const cy = y + 8
    if (i < w.bag) drawSprite(g, art.candy, cx, cy, false)
    else {
      g.fillStyle = PAL[5]
      g.fillRect(cx + 2, cy + 1, 3, 1)
    }
  }
  drawText(g, `DOORS ${doorsLeft(w)}`, x, y + 15, PAL[6])
  if (bankRate(w) > 1) drawText(g, 'OVERTIME X2', x + width, y + 15, Math.floor(t * 3) % 2 ? PAL[10] : PAL[9], 1, 'right')
  for (let i = 0; i < Math.min(w.lives - 1, 5); i++) drawHero(g, w.hero, x + i * 11, y + 23, false, 0)
}
