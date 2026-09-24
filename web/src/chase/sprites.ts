// ─── /chase: sprites, drawn from code ───────────────────────────────────────
//
// Every car is seen from behind, so one parametric drawing covers them all:
// a body, a cabin (which leans a few pixels into turns), tail lights, a plate
// and wheels, plus per-model extras (light bar, spoiler, stripes, open bed).
// Scenery is drawn the same way. Nothing here copies any real game's art.

import { PROP_SIZE, type PropKind } from './road'
import type { TargetKind } from './tracks'

export type Sprite = HTMLCanvasElement

function canvas(w: number, h: number): [Sprite, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

type Shape = 'police' | 'sedan' | 'van' | 'truck' | 'pickup' | 'super' | 'muscle' | 'coupe'

interface CarStyle {
  shape: Shape
  body: string
  shade: string
  light: string
  glass: string
  stripe?: string
}

export { PROP_SIZE }

export const CAR_PX_W = 48

function drawCar(s: CarStyle, turn: number, flash: boolean): Sprite {
  const tall = s.shape === 'truck' || s.shape === 'van'
  const h = s.shape === 'truck' ? 40 : tall ? 32 : 28
  const [c, g] = canvas(CAR_PX_W, h)
  const r = (x: number, y: number, w: number, hh: number, col: string) => {
    g.fillStyle = col
    g.fillRect(x, y, w, hh)
  }
  const b = h - 28 // everything below the cabin shifts down on tall vehicles

  // Shadow and wheels.
  r(1, h - 3, 46, 3, 'rgba(0,0,0,0.45)')
  r(2, b + 19, 8, 8, '#111')
  r(38, b + 19, 8, 8, '#111')
  for (let y = b + 20; y < b + 27; y += 2) { r(3, y, 6, 1, '#2b2c33'); r(39, y, 6, 1, '#2b2c33') }

  // Cabin (or box).
  const lean = Math.round(turn * 2)
  if (s.shape === 'truck') {
    r(1, 0, 46, 30, s.body)
    for (let x = 4; x < 44; x += 5) r(x, 2, 1, 26, s.shade)
    r(1, 0, 46, 2, s.light)
  } else if (s.shape === 'van') {
    r(2, 1 + b - 4, 44, 16, s.body)
    r(2, 1 + b - 4, 44, 2, s.light)
    r(6, 5 + b - 4, 15, 6, s.glass)
    r(27, 5 + b - 4, 15, 6, s.glass)
    r(23, 3 + b - 4, 2, 14, s.shade)
  } else {
    const top = s.shape === 'super' ? 6 : s.shape === 'coupe' ? 4 : 2
    const bottom = 11
    for (let y = top; y < bottom; y++) {
      const w = 26 + (y - top) * 1.4
      const x = Math.round(24 - w / 2 + lean * (bottom - y) / (bottom - top))
      r(x, y, Math.round(w), 1, s.body)
      if (y > top && y < bottom - 1) r(x + 2, y, Math.round(w) - 4, 1, s.glass)
    }
    // A glint on the rear window.
    r(24 + lean + 3, top + 2, 2, 1, '#c2c3c7')
    r(24 + lean + 5, top + 3, 2, 1, '#c2c3c7')
    if (s.shape === 'police') {
      const x = 16 + lean * 2
      r(x, top - 2, 8, 2, flash ? '#ff004d' : '#7e2553')
      r(x + 8, top - 2, 8, 2, flash ? '#1d2b53' : '#29adff')
      if (flash) r(x - 1, top - 3, 5, 1, '#ffccaa')
      else r(x + 12, top - 3, 5, 1, '#c2e8ff')
    }
  }

  // Body.
  if (s.shape !== 'truck') {
    r(1, b + 11, 46, 10, s.body)
    r(2, b + 10, 44, 2, s.light)
    if (s.shape === 'pickup') {
      r(4, b + 10, 40, 3, '#1a1a1a')
      r(4, b + 10, 40, 1, s.shade)
    }
    if (s.stripe) {
      r(18, s.shape === 'muscle' ? 2 : b + 10, 4, s.shape === 'muscle' ? 9 : 2, s.stripe)
      r(26, s.shape === 'muscle' ? 2 : b + 10, 4, s.shape === 'muscle' ? 9 : 2, s.stripe)
      r(18, b + 10, 4, 11, s.stripe)
      r(26, b + 10, 4, 11, s.stripe)
    }
    if (s.shape === 'police') {
      r(1, b + 15, 46, 2, '#fff1e8')
      r(1, b + 16, 46, 1, '#c2c3c7')
    }
  }
  r(2, b + 20, 44, 3, s.shade)

  // Tail lights and plate.
  if (s.shape === 'super') {
    for (const x of [3, 9, 35, 41]) { r(x, b + 13, 4, 3, '#ff004d'); r(x + 1, b + 13, 2, 1, '#ffccaa') }
    r(0, b + 7, 48, 2, s.shade)
    r(6, b + 9, 2, 2, s.shade)
    r(40, b + 9, 2, 2, s.shade)
  } else {
    r(3, b + 13, 8, 3, '#ff004d')
    r(37, b + 13, 8, 3, '#ff004d')
    r(4, b + 13, 3, 1, '#ffccaa')
    r(38, b + 13, 3, 1, '#ffccaa')
  }
  r(19, b + 16, 10, 4, '#fff1e8')
  r(20, b + 17, 8, 1, '#5f574f')
  r(21, b + 19, 6, 1, '#5f574f')
  if (s.shape === 'muscle' || s.shape === 'super') {
    r(12, b + 22, 3, 2, '#5f574f')
    r(33, b + 22, 3, 2, '#5f574f')
  }
  return c
}

const POLICE: CarStyle = { shape: 'police', body: '#1a1a22', shade: '#0b0b10', light: '#3a3a48', glass: '#29436a' }

const TARGETS: Record<TargetKind, CarStyle> = {
  van: { shape: 'van', body: '#c2c3c7', shade: '#5f574f', light: '#fff1e8', glass: '#1d2b53' },
  coupe: { shape: 'coupe', body: '#ff004d', shade: '#7e2553', light: '#ff77a8', glass: '#1d2b53' },
  muscle: { shape: 'muscle', body: '#ffa300', shade: '#ab5236', light: '#ffec27', glass: '#1d2b53', stripe: '#1a1a22' },
  pickup: { shape: 'pickup', body: '#008751', shade: '#1d3a2a', light: '#00e436', glass: '#1d2b53' },
  super: { shape: 'super', body: '#fff1e8', shade: '#83769c', light: '#ffffff', glass: '#12001e', stripe: '#ff77a8' },
}

const TRAFFIC: CarStyle[] = [
  { shape: 'sedan', body: '#29adff', shade: '#1d2b53', light: '#83c8ff', glass: '#1d2b53' },
  { shape: 'sedan', body: '#ffec27', shade: '#ab5236', light: '#fff1a0', glass: '#1d2b53' },
  { shape: 'truck', body: '#c2c3c7', shade: '#83769c', light: '#fff1e8', glass: '#1d2b53' },
  { shape: 'sedan', body: '#83769c', shade: '#3a2e4a', light: '#b8a8d0', glass: '#1d2b53' },
  { shape: 'van', body: '#ab5236', shade: '#5a2a1a', light: '#d07a50', glass: '#1d2b53' },
]

/** Sprites indexed [turn -1/0/+1 → 0/1/2][flash 0/1]. */
export interface CarSprites { frames: Sprite[][] }

function carSprites(s: CarStyle): CarSprites {
  return { frames: [-1, 0, 1].map(turn => [drawCar(s, turn, false), drawCar(s, turn, true)]) }
}

// ── Scenery ─────────────────────────────────────────────────────────────────
function drawProp(kind: PropKind, night: boolean): Sprite {
  const px = (w: number, h: number) => canvas(w, h)
  let c: Sprite
  let g: CanvasRenderingContext2D
  const r = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h) }
  switch (kind) {
    case 'palm': {
      ;[c, g] = px(32, 72)
      for (let y = 14; y < 72; y++) {
        const x = 15 + Math.round(Math.sin(y / 18) * 3)
        r(x, y, 3, 1, y % 4 === 0 ? '#5a3a1a' : '#8a5a2a')
      }
      const frond = (dx: number, dy: number, col: string) => {
        for (let i = 0; i < 14; i++) r(16 + Math.round(dx * i), 14 + Math.round(dy * i + (i * i) / 14), 3, 2, col)
      }
      frond(-1, -0.4, '#008751'); frond(1, -0.4, '#008751'); frond(-0.8, 0.2, '#00a060')
      frond(0.8, 0.2, '#00a060'); frond(-0.3, -0.8, '#00e436'); frond(0.3, -0.8, '#00e436')
      r(15, 12, 5, 4, '#5a3a1a')
      break
    }
    case 'lamp': {
      ;[c, g] = px(20, 72)
      r(3, 8, 2, 64, '#5f574f')
      r(3, 6, 12, 2, '#5f574f')
      r(12, 7, 6, 3, '#c2c3c7')
      r(13, 10, 4, 1, night ? '#ffec27' : '#fff1e8')
      r(1, 68, 6, 4, '#3a3a3a')
      break
    }
    case 'sign': {
      ;[c, g] = px(40, 34)
      r(6, 14, 2, 20, '#5f574f'); r(32, 14, 2, 20, '#5f574f')
      r(0, 0, 40, 16, '#008751')
      r(1, 1, 38, 14, '#00a060')
      r(3, 4, 24, 2, '#fff1e8'); r(3, 9, 16, 2, '#fff1e8'); r(30, 4, 6, 7, '#fff1e8')
      break
    }
    case 'tower':
    case 'block': {
      const tall = kind === 'tower'
      ;[c, g] = px(48, tall ? 120 : 56)
      const h = tall ? 120 : 56
      r(0, 0, 48, h, night ? '#141c36' : '#5f574f')
      r(0, 0, 48, 3, night ? '#1d2b53' : '#83769c')
      for (let y = 6; y < h - 6; y += 7) {
        for (let x = 4; x < 44; x += 8) {
          const lit = ((x * 7 + y * 13) % 5) < (night ? 2 : 1)
          r(x, y, 4, 4, lit ? (night ? '#ffec27' : '#fff1e8') : night ? '#0b1020' : '#1d2b53')
        }
      }
      break
    }
    case 'cactus': {
      ;[c, g] = px(20, 40)
      r(8, 2, 5, 38, '#008751'); r(9, 2, 2, 38, '#00a060')
      r(2, 12, 4, 12, '#008751'); r(2, 22, 8, 3, '#008751')
      r(15, 8, 4, 12, '#008751'); r(12, 18, 7, 3, '#008751')
      break
    }
    case 'rock': {
      ;[c, g] = px(32, 20)
      r(4, 6, 24, 14, '#ab5236'); r(8, 2, 16, 6, '#c0704a'); r(6, 8, 10, 4, '#d08a5a'); r(0, 14, 32, 6, '#8a4a2a')
      break
    }
    case 'pine': {
      ;[c, g] = px(32, 64)
      r(14, 50, 4, 14, '#5a3a1a')
      for (let y = 0; y < 52; y++) {
        const w = 4 + ((y % 16) + y / 2) * 0.9
        r(Math.round(16 - w / 2), y, Math.round(w), 1, y % 16 < 3 ? '#1e7a42' : '#145a30')
      }
      break
    }
    case 'bush': {
      ;[c, g] = px(32, 16)
      r(2, 6, 28, 10, '#1e5a32'); r(6, 2, 10, 8, '#227040'); r(16, 3, 12, 8, '#1e6a38'); r(4, 8, 6, 3, '#2a8a4a')
      break
    }
    case 'billboard': {
      ;[c, g] = px(64, 40)
      r(10, 24, 3, 16, '#5f574f'); r(51, 24, 3, 16, '#5f574f')
      r(0, 0, 64, 26, '#1d2b53'); r(1, 1, 62, 24, night ? '#ff77a8' : '#ffec27')
      // "JAWG" in chunky blocks.
      const col = night ? '#12001e' : '#ff004d'
      r(6, 6, 8, 3, col); r(10, 6, 3, 13, col); r(5, 16, 6, 3, col)
      r(18, 6, 3, 13, col); r(25, 6, 3, 13, col); r(18, 6, 10, 3, col); r(18, 12, 10, 3, col)
      r(32, 6, 3, 13, col); r(40, 6, 3, 13, col); r(36, 12, 3, 7, col); r(32, 16, 11, 3, col)
      r(47, 6, 11, 3, col); r(47, 6, 3, 13, col); r(47, 16, 11, 3, col); r(55, 11, 3, 8, col); r(52, 11, 6, 3, col)
      break
    }
    case 'chevron': {
      ;[c, g] = px(32, 16)
      r(0, 0, 32, 12, '#ffec27')
      for (let x = -8; x < 32; x += 8) {
        for (let i = 0; i < 6; i++) { r(x + i, i, 3, 1, '#1a1a22'); r(x + i, 11 - i, 3, 1, '#1a1a22') }
      }
      r(3, 12, 2, 4, '#5f574f'); r(27, 12, 2, 4, '#5f574f')
      break
    }
    case 'neon': {
      ;[c, g] = px(24, 72)
      r(10, 20, 3, 52, '#2a1a3a')
      r(0, 0, 24, 22, '#12001e')
      r(1, 1, 22, 2, '#ff77a8'); r(1, 19, 22, 2, '#ff77a8'); r(1, 1, 2, 20, '#ff77a8'); r(21, 1, 2, 20, '#ff77a8')
      r(6, 6, 12, 2, '#29adff'); r(6, 10, 8, 2, '#29adff'); r(6, 14, 12, 2, '#29adff')
      break
    }
  }
  return c!
}

function flipped(s: Sprite): Sprite {
  const [c, g] = canvas(s.width, s.height)
  g.translate(s.width, 0)
  g.scale(-1, 1)
  g.drawImage(s, 0, 0)
  return c
}

export interface SpriteSet {
  police: CarSprites
  targets: Record<TargetKind, CarSprites>
  traffic: CarSprites[]
  /** [normal, mirrored] per theme darkness. */
  props: (kind: PropKind, night: boolean, mirror: boolean) => Sprite
}

let cache: SpriteSet | null = null

export function sprites(): SpriteSet {
  if (cache) return cache
  const propCache = new Map<string, Sprite>()
  cache = {
    police: carSprites(POLICE),
    targets: Object.fromEntries(Object.entries(TARGETS).map(([k, s]) => [k, carSprites(s)])) as Record<TargetKind, CarSprites>,
    traffic: TRAFFIC.map(carSprites),
    props: (kind, night, mirror) => {
      const key = `${kind}${night ? 'n' : 'd'}${mirror ? 'm' : ''}`
      let s = propCache.get(key)
      if (!s) {
        s = mirror ? flipped(drawProp(kind, night)) : drawProp(kind, night)
        propCache.set(key, s)
      }
      return s
    },
  }
  return cache
}
