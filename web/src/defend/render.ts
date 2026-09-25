// ─── /defend: drawing ───────────────────────────────────────────────────────
//
// Everything is drawn from code at 180×320 (the playfield) and scaled up with
// square pixels. Colours change every two waves, like the arcade classic.

import { PAL, drawText, hash } from '../arcade/gfx'
import { BASES_X, GROUND, H, MIN_AIM_Y, W, blastRadius, multiplier, type World } from './world'

export { PAL, drawText }
export { W, H }

export function centreText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale = 1): void {
  drawText(ctx, text, x, y, color, scale, 'center')
}

interface Scheme { sky: [string, string]; ground: string; city: string; enemy: string; mine: string }

const SCHEMES: Scheme[] = [
  { sky: ['#05060f', '#1d2b53'], ground: '#ab5236', city: PAL[12], enemy: PAL[8], mine: PAL[11] },
  { sky: ['#12001e', '#4a1a5a'], ground: '#5f574f', city: PAL[10], enemy: PAL[9], mine: PAL[12] },
  { sky: ['#001a12', '#0b4a3a'], ground: '#1d2b53', city: PAL[14], enemy: PAL[10], mine: PAL[7] },
  { sky: ['#1a0505', '#5a1d1d'], ground: '#3a2e4a', city: PAL[11], enemy: PAL[12], mine: PAL[10] },
]

export const schemeFor = (wave: number) => SCHEMES[Math.floor((Math.max(1, wave) - 1) / 2) % SCHEMES.length]

/** Flash of the screen when a city is hit, and a shake. */
export class Fx {
  flash = 0
  shake = 0
  /** Where the player last tapped, shown briefly so you can see your aim. */
  mark: { x: number; y: number; t: number } | null = null

  update(dt: number) {
    this.flash = Math.max(0, this.flash - dt)
    this.shake = Math.max(0, this.shake - dt)
    if (this.mark) {
      this.mark.t -= dt
      if (this.mark.t <= 0) this.mark = null
    }
  }
}

function drawCity(g: CanvasRenderingContext2D, x: number, alive: boolean, col: string) {
  if (!alive) {
    g.fillStyle = '#3a2e2e'
    g.fillRect(x - 6, GROUND - 2, 12, 2)
    g.fillRect(x - 3, GROUND - 3, 3, 1)
    return
  }
  g.fillStyle = col
  g.fillRect(x - 6, GROUND - 5, 3, 5)
  g.fillRect(x - 3, GROUND - 9, 4, 9)
  g.fillRect(x + 1, GROUND - 7, 3, 7)
  g.fillRect(x + 4, GROUND - 4, 2, 4)
  g.fillStyle = PAL[0]
  g.fillRect(x - 2, GROUND - 7, 1, 1)
  g.fillRect(x, GROUND - 5, 1, 1)
  g.fillRect(x + 2, GROUND - 5, 1, 1)
}

function drawBase(g: CanvasRenderingContext2D, x: number, ammo: number, alive: boolean, ground: string) {
  // A mound, with the missiles still in stock stacked on it.
  g.fillStyle = ground
  g.beginPath()
  g.moveTo(x - 12, GROUND)
  g.lineTo(x - 6, GROUND - 8)
  g.lineTo(x + 6, GROUND - 8)
  g.lineTo(x + 12, GROUND)
  g.fill()
  if (!alive) return
  const rows = [4, 3, 2, 1]
  let left = ammo
  rows.forEach((n, r) => {
    for (let i = 0; i < n && left > 0; i++, left--) {
      const mx = x - (n - 1) * 2 + i * 4
      const my = GROUND - 9 - r * 3
      g.fillStyle = PAL[7]
      g.fillRect(mx, my, 1, 2)
      g.fillStyle = PAL[12]
      g.fillRect(mx, my + 2, 1, 1)
    }
  })
}

/** Draw the playfield at (ox, 0). */
export function renderWorld(g: CanvasRenderingContext2D, w: World, fx: Fx, t: number, ox = 0): void {
  const s = schemeFor(w.wave)
  g.save()
  g.translate(ox, 0)
  if (fx.shake > 0) g.translate(Math.round((Math.random() - 0.5) * fx.shake * 6), Math.round((Math.random() - 0.5) * fx.shake * 4))
  g.beginPath()
  g.rect(0, 0, W, H)
  g.clip()

  const sky = g.createLinearGradient(0, 0, 0, GROUND)
  sky.addColorStop(0, s.sky[0])
  sky.addColorStop(1, s.sky[1])
  g.fillStyle = sky
  g.fillRect(0, 0, W, H)
  for (let i = 0; i < 40; i++) {
    const tw = Math.sin(t * 2 + i) > 0.7
    g.fillStyle = i % 5 ? PAL[5] : tw ? PAL[7] : PAL[6]
    g.fillRect(Math.floor(hash(i) * W), Math.floor(hash(i + 99) * 200), 1, 1)
  }

  // Ground.
  g.fillStyle = s.ground
  g.fillRect(0, GROUND, W, H - GROUND)
  for (let x = 0; x < W; x += 3) {
    const h = Math.floor(hash(x * 3) * 3)
    g.fillRect(x, GROUND - h, 3, h)
  }
  w.cities.forEach(c => drawCity(g, c.x, c.alive, s.city))
  w.bases.forEach(b => drawBase(g, b.x, b.ammo, b.alive, s.ground))

  // Enemy trails and heads.
  for (const e of w.enemies) {
    if (e.kind === 'warhead') {
      g.strokeStyle = s.enemy
      g.globalAlpha = 0.8
      g.beginPath()
      g.moveTo(e.sx, e.sy)
      g.lineTo(e.x, e.y)
      g.stroke()
      g.globalAlpha = 1
      g.fillStyle = Math.floor(t * 10) % 2 ? PAL[7] : s.enemy
      g.fillRect(Math.round(e.x) - 1, Math.round(e.y) - 1, 2, 2)
    } else if (e.kind === 'bomber') {
      const dir = Math.sign(e.vx) || 1
      const x = Math.round(e.x)
      const y = Math.round(e.y)
      g.fillStyle = PAL[6]
      g.fillRect(x - 6, y - 1, 12, 3)
      g.fillRect(x - 1 - dir * 2, y - 4, 3, 8)
      g.fillRect(x - dir * 6 - 1, y - 3, 2, 3)
      g.fillStyle = Math.floor(t * 4) % 2 ? PAL[8] : PAL[5]
      g.fillRect(x + dir * 5, y, 1, 1)
    } else {
      // Drones: a diamond with a blinking eye.
      const x = Math.round(e.x)
      const y = Math.round(e.y)
      g.fillStyle = PAL[14]
      g.fillRect(x - 1, y - 3, 3, 7)
      g.fillRect(x - 3, y - 1, 7, 3)
      g.fillStyle = Math.floor(t * 8) % 2 ? PAL[7] : PAL[2]
      g.fillRect(x, y, 1, 1)
    }
  }

  // Your interceptors, each with an X where it will burst.
  for (const m of w.interceptors) {
    g.strokeStyle = s.mine
    g.beginPath()
    g.moveTo(m.sx, m.sy)
    g.lineTo(m.x, m.y)
    g.stroke()
    g.fillStyle = PAL[7]
    g.fillRect(Math.round(m.x), Math.round(m.y), 1, 1)
    g.fillStyle = s.mine
    for (let i = -2; i <= 2; i++) {
      g.fillRect(Math.round(m.tx) + i, Math.round(m.ty) + i, 1, 1)
      g.fillRect(Math.round(m.tx) + i, Math.round(m.ty) - i, 1, 1)
    }
  }

  // Fireballs.
  for (const b of w.blasts) {
    const r = blastRadius(b.t)
    if (r <= 0) continue
    const cols = b.enemy ? [PAL[8], PAL[9], PAL[2]] : [PAL[7], PAL[10], PAL[9], PAL[14], PAL[12]]
    g.fillStyle = cols[Math.floor(t * 20 + b.x) % cols.length]
    g.beginPath()
    g.arc(b.x, b.y, r, 0, Math.PI * 2)
    g.fill()
  }

  // Your last tap, so you can see where you aimed under your finger.
  if (fx.mark) {
    const { x, y } = fx.mark
    g.globalAlpha = Math.min(1, fx.mark.t * 3)
    g.fillStyle = PAL[7]
    g.fillRect(Math.round(x) - 4, Math.round(y), 3, 1)
    g.fillRect(Math.round(x) + 2, Math.round(y), 3, 1)
    g.fillRect(Math.round(x), Math.round(y) - 4, 1, 3)
    g.fillRect(Math.round(x), Math.round(y) + 2, 1, 3)
    g.globalAlpha = 1
  }

  g.restore()
  if (fx.flash > 0) {
    g.fillStyle = `rgba(255,0,77,${Math.min(0.4, fx.flash)})`
    g.fillRect(ox, 0, W, H)
  }
}

/** Keyboard / gamepad crosshair. */
export function drawCrosshair(g: CanvasRenderingContext2D, x: number, y: number, ox: number, t: number) {
  const c = Math.floor(t * 6) % 2 ? PAL[7] : PAL[10]
  g.fillStyle = c
  const X = Math.round(x) + ox
  const Y = Math.round(Math.min(y, MIN_AIM_Y))
  g.fillRect(X - 5, Y, 4, 1)
  g.fillRect(X + 2, Y, 4, 1)
  g.fillRect(X, Y - 5, 1, 4)
  g.fillRect(X, Y + 2, 1, 4)
}

/** Score line across the top of the playfield. */
export function drawHud(g: CanvasRenderingContext2D, w: World, hiscore: number, ox: number) {
  drawText(g, String(w.score).padStart(6, '0'), ox + 3, 3, PAL[7])
  drawText(g, `HI ${String(hiscore).padStart(6, '0')}`, ox + W / 2, 3, PAL[9], 1, 'center')
  const m = multiplier(w.wave)
  drawText(g, `X${m}`, ox + W - 3, 3, m > 1 ? PAL[10] : PAL[5], 1, 'right')
  // Out-of-ammo warning under an empty base.
  w.bases.forEach((b, i) => {
    if (b.alive && b.ammo === 0 && w.phase === 'wave') drawText(g, 'OUT', ox + BASES_X[i], GROUND + 6, PAL[8], 1, 'center')
    else if (b.alive && b.ammo <= 3 && b.ammo > 0 && w.phase === 'wave') drawText(g, 'LOW', ox + BASES_X[i], GROUND + 6, PAL[9], 1, 'center')
  })
}

