// ─── /chase: drawing ────────────────────────────────────────────────────────
//
// The road is drawn front to back (so nearer hills hide what is behind them),
// then scenery and cars back to front, each clipped by the hill in front of
// it. Everything renders at 320×180 and is scaled up with square pixels.

import { PAL, drawText } from '../arcade/gfx'
import { CAR_W, MAX_SPEED, TURBOS, kmh } from './car'
import {
  CAM_DEPTH, RUMBLE, CAM_HEIGHT, DRAW_DIST, PLAYER_Z, ROAD_W, SEG_LEN, branchCentre, branchHalfWidth, heightAt, project,
  segmentAt, type Projected, type Segment,
} from './road'
import { PROP_SIZE, sprites, type Sprite } from './sprites'
import type { Theme } from './tracks'
import { CHECKPOINT_BONUS, gap, type World, type WorldEvent } from './world'

export { PAL, drawText }
export const W = 320
export const H = 180

const CAR_WORLD_W = CAR_W * ROAD_W
/** Screen width of the player's car. */
const PLAYER_PX = Math.round(CAR_WORLD_W * (CAM_DEPTH / PLAYER_Z) * (W / 2))
/** World units → metres, consistent with the speedometer. */
const METRES_PER_UNIT = (250 / 3.6) / MAX_SPEED

export function centreText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale = 1): void {
  drawText(ctx, text, x, y, color, scale, 'center')
}

// ── Effects ─────────────────────────────────────────────────────────────────
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }

export class Fx {
  shake = 0
  flash = 0
  skyX = 0
  particles: Particle[] = []
  banner = { text: '', t: 0, color: PAL[10] }
  hint = { side: 'left' as 'left' | 'right', t: 0 }
  /** Where the target was last drawn, for spark effects. */
  targetAt: { x: number; y: number; w: number } | null = null
  targetLastX = 0

  clear() {
    this.shake = 0
    this.flash = 0
    this.particles = []
    this.banner.t = 0
    this.hint.t = 0
  }

  sparks(x: number, y: number, n: number, colors: string[]) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x, y, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 110,
        life: 0.3 + Math.random() * 0.4, color: colors[i % colors.length],
      })
    }
  }

  handle(events: WorldEvent[]) {
    for (const e of events) {
      switch (e.kind) {
        case 'ram': {
          this.shake = Math.max(this.shake, 0.35)
          this.flash = 0.08
          const t = this.targetAt
          if (t) this.sparks(t.x, t.y - 4, 16, [PAL[10], PAL[9], PAL[7]])
          break
        }
        case 'bump':
          this.shake = Math.max(this.shake, 0.25)
          this.sparks(W / 2, H - 30, 8, [PAL[10], PAL[6]])
          break
        case 'crash':
          this.shake = Math.max(this.shake, 0.6)
          this.sparks(W / 2, H - 24, 20, [PAL[9], PAL[8], PAL[5]])
          break
        case 'turbo': this.banner = { text: 'TURBO!', t: 1.2, color: PAL[9] }; break
        case 'go': this.banner = { text: 'GO!', t: 1, color: PAL[11] }; break
        case 'arrest': this.banner = { text: 'PULL THEM OVER!', t: 2.5, color: PAL[8] }; break
        case 'caught': this.banner = { text: 'CAUGHT!', t: 99, color: PAL[11] }; break
        case 'escaped': this.banner = { text: 'THEY GOT AWAY...', t: 99, color: PAL[8] }; break
        case 'checkpoint': this.banner = { text: `CHECKPOINT +${CHECKPOINT_BONUS}`, t: 1.5, color: PAL[10] }; break
        case 'forkhint': this.hint = { side: e.detail === 'right' ? 'right' : 'left', t: 4 }; break
      }
    }
  }

  update(dt: number, w: World) {
    this.shake = Math.max(0, this.shake - dt)
    this.flash = Math.max(0, this.flash - dt)
    this.banner.t = Math.max(0, this.banner.t - dt)
    this.hint.t = Math.max(0, this.hint.t - dt)
    const seg = segmentAt(w.track, w.player.z)
    this.skyX += seg.curve * (w.player.speed / MAX_SPEED) * dt * 6
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 300 * dt
      p.life -= dt
    }
    this.particles = this.particles.filter(p => p.life > 0)
  }
}

// ── Background ──────────────────────────────────────────────────────────────
const HORIZON = 100
const skylines = new Map<string, HTMLCanvasElement[]>()

function skyline(theme: Theme): HTMLCanvasElement[] {
  const key = `${theme.skyline}${theme.hills.join()}`
  let layers = skylines.get(key)
  if (layers) return layers
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  layers = theme.hills.map((col, li) => {
    const c = document.createElement('canvas')
    c.width = 640
    c.height = 80
    const g = c.getContext('2d')!
    g.fillStyle = col
    const base = 80
    switch (theme.skyline) {
      case 'city':
      case 'neon': {
        for (let x = 0; x < 640;) {
          const w = 10 + Math.floor(rnd() * 26)
          const h = (li ? 14 : 26) + Math.floor(rnd() * (li ? 30 : 46))
          g.fillStyle = col
          g.fillRect(x, base - h, Math.min(w, 640 - x), h)
          if (theme.night) {
            for (let y = base - h + 3; y < base - 2; y += 4) {
              for (let wx = x + 2; wx < x + w - 2; wx += 3) {
                if (rnd() < 0.18) {
                  g.fillStyle = theme.skyline === 'neon' ? (rnd() < 0.5 ? '#ff77a8' : '#29adff') : '#ffec27'
                  g.fillRect(wx, y, 1, 1)
                }
              }
            }
          }
          x += w + (li ? 0 : Math.floor(rnd() * 6))
        }
        break
      }
      case 'hills':
      case 'mesa':
      case 'forest': {
        for (let x = 0; x < 640; x++) {
          const a = (x / 640) * Math.PI * 2
          let h = (li ? 16 : 30) + Math.sin(a * 2 + li) * 10 + Math.sin(a * 5 + li * 2) * 6
          if (theme.skyline === 'mesa') h = Math.round(h / 12) * 12
          if (theme.skyline === 'forest') h += (x % 8 < 4 ? x % 8 : 8 - (x % 8)) * 2
          g.fillRect(x, base - h, 1, h)
        }
        break
      }
    }
    return c
  })
  skylines.set(key, layers)
  return layers
}

function drawSky(ctx: CanvasRenderingContext2D, theme: Theme, fx: Fx, lift: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, HORIZON)
  grad.addColorStop(0, theme.sky[0])
  grad.addColorStop(1, theme.sky[1])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  if (theme.night) {
    for (let i = 0; i < 40; i++) {
      const x = ((i * 97 + Math.floor(fx.skyX * 2)) % W + W) % W
      ctx.fillStyle = i % 5 ? PAL[6] : PAL[7]
      ctx.fillRect(x, (i * 53) % 60, 1, 1)
    }
  }
  // A striped setting sun on the dusk and neon roads.
  if (theme.skyline === 'city' && !theme.night || theme.skyline === 'neon') {
    const sx = ((W * 0.7 - fx.skyX * 10) % (W * 2) + W * 2) % (W * 2) - W / 2
    const sy = HORIZON - 50 + lift
    for (let y = -24; y < 24; y++) {
      if (y > 4 && y % 5 < 2) continue
      const half = Math.sqrt(24 * 24 - y * y)
      ctx.fillStyle = y < -8 ? '#ffec27' : y < 6 ? '#ffa300' : '#ff004d'
      ctx.fillRect(Math.round(sx - half), sy + y, Math.round(half * 2), 1)
    }
  }
  const [far, near] = skyline(theme)
  for (const [layer, speed, dy] of [[far, 12, 0], [near, 24, 6]] as const) {
    const off = ((Math.round(fx.skyX * speed) % 640) + 640) % 640
    const y = HORIZON - 80 + dy + lift
    ctx.drawImage(layer, -off, y)
    ctx.drawImage(layer, 640 - off, y)
  }
  ctx.fillStyle = theme.fog
  ctx.fillRect(0, HORIZON + 6 + lift, W, H)
}

// ── Road ────────────────────────────────────────────────────────────────────
interface Drawn {
  seg: Segment
  /** Absolute segment number (not wrapped), to match cars to segments. */
  n: number
  p0: Projected
  p1: Projected
  /** Lowest screen row a sprite on this segment may cover. */
  clip: number
  visible: boolean
}

function quad(ctx: CanvasRenderingContext2D, x1: number, y1: number, w1: number, x2: number, y2: number, w2: number, col: string) {
  ctx.fillStyle = col
  ctx.beginPath()
  ctx.moveTo(x1 - w1, y1)
  ctx.lineTo(x1 + w1, y1)
  ctx.lineTo(x2 + w2, y2)
  ctx.lineTo(x2 - w2, y2)
  ctx.closePath()
  ctx.fill()
}

function drawRoadStrip(
  ctx: CanvasRenderingContext2D, theme: Theme, alt: number,
  x0: number, y0: number, w0: number, x1: number, y1: number, w1: number, lanes: number,
) {
  quad(ctx, x0, y0, w0 * RUMBLE, x1, y1, w1 * RUMBLE, theme.rumble[alt])
  quad(ctx, x0, y0, w0, x1, y1, w1, theme.road[alt])
  if (alt) return
  const lw0 = Math.max(0.5, w0 / 48)
  const lw1 = Math.max(0.5, w1 / 48)
  for (let i = 1; i < lanes; i++) {
    const f = -1 + (2 * i) / lanes
    quad(ctx, x0 + f * w0, y0, lw0, x1 + f * w1, y1, lw1, theme.lane)
  }
}

function drawSegment(ctx: CanvasRenderingContext2D, d: Drawn, nearFork: number, theme: Theme, fog: number) {
  const { seg, p0, p1 } = d
  const alt = Math.floor(seg.index / 3) % 2
  ctx.fillStyle = theme.grass[alt]
  ctx.fillRect(0, p1.y, W, p0.y - p1.y)
  const f0 = nearFork
  const f1 = seg.fork
  if (f0 <= 0 && f1 <= 0) {
    drawRoadStrip(ctx, theme, alt, p0.x, p0.y, p0.w, p1.x, p1.y, p1.w, 3)
  } else {
    for (const side of ['left', 'right'] as const) {
      drawRoadStrip(
        ctx, theme, alt,
        p0.x + branchCentre(f0, side) * p0.w, p0.y, branchHalfWidth(f0) * p0.w,
        p1.x + branchCentre(f1, side) * p1.w, p1.y, branchHalfWidth(f1) * p1.w,
        2,
      )
    }
  }
  if (fog > 0.01) {
    ctx.globalAlpha = fog
    ctx.fillStyle = theme.fog
    ctx.fillRect(0, p1.y, W, p0.y - p1.y)
    ctx.globalAlpha = 1
  }
}

/** Draw a sprite standing at (x, y) (bottom centre), `w` wide, cut off below `clip`. */
function drawClipped(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, w: number, clip: number) {
  const h = (w * s.height) / s.width
  const top = y - h
  if (w < 1 || top >= clip || x + w / 2 < 0 || x - w / 2 > W) return
  const visible = Math.min(h, clip - top)
  const srcH = (s.height * visible) / h
  if (srcH < 0.5) return
  ctx.drawImage(s, 0, 0, s.width, srcH, Math.round(x - w / 2), Math.round(top), Math.round(w), Math.round(visible))
}

/** How much of the fog colour covers the road `i` segments ahead. */
const fogAt = (i: number) => 1 - 1 / Math.exp(((i / DRAW_DIST) ** 2) * 4)

const turnFrame = (steer: number) => (steer < -0.2 ? 0 : steer > 0.2 ? 2 : 1)

export function renderWorld(
  ctx: CanvasRenderingContext2D, w: World, fx: Fx, t: number, steer: number, showPlayer = true,
): void {
  const { player: p, track } = w
  const theme = w.def.theme
  const set = sprites()
  const camZ = p.z - PLAYER_Z
  const camY = heightAt(track, p.z) + CAM_HEIGHT
  const camX = p.x * ROAD_W
  const base = Math.floor(camZ / SEG_LEN)
  const basePct = (camZ - base * SEG_LEN) / SEG_LEN

  ctx.save()
  if (fx.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * fx.shake * 8), Math.round((Math.random() - 0.5) * fx.shake * 6))

  // Climbing a hill lowers the skyline a little; cresting one raises it.
  const ahead = heightAt(track, p.z + SEG_LEN * 40) - heightAt(track, p.z)
  drawSky(ctx, theme, fx, Math.max(-20, Math.min(20, Math.round(ahead / 300))))

  // Road, front to back.
  const drawn: Drawn[] = []
  let x = 0
  let dx = -segmentAt(track, camZ).curve * basePct
  let maxy = H
  for (let i = 0; i < DRAW_DIST; i++) {
    const n = base + i
    const z0 = n * SEG_LEN
    const seg = segmentAt(track, z0)
    const p0 = project(0, seg.y0, z0, camX - x, camY, camZ, W, H)
    const p1 = project(0, seg.y1, z0 + SEG_LEN, camX - x - dx, camY, camZ, W, H)
    x += dx
    dx += seg.curve
    const d: Drawn = { seg, n, p0, p1, clip: maxy, visible: false }
    drawn.push(d)
    if (z0 - camZ <= CAM_DEPTH || p1.y >= p0.y || p1.y >= maxy) continue
    d.visible = true
    drawSegment(ctx, d, segmentAt(track, z0 - SEG_LEN).fork, theme, fogAt(i))
    maxy = p1.y
  }

  // Night: headlight glow on the road ahead.
  if (theme.night) {
    ctx.globalCompositeOperation = 'lighter'
    for (const [spread, alpha] of [[1, 0.1], [0.6, 0.1]]) {
      ctx.fillStyle = `rgba(90,80,30,${alpha})`
      ctx.beginPath()
      ctx.moveTo(W / 2 - 60 * spread, H - 30)
      ctx.lineTo(W / 2 + 60 * spread, H - 30)
      ctx.lineTo(W / 2 + 14 * spread, H - 95)
      ctx.lineTo(W / 2 - 14 * spread, H - 95)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  // Cars, bucketed by segment.
  type Car = { z: number; x: number; sprite: Sprite; target: boolean }
  const bySeg = new Map<number, Car[]>()
  const add = (c: Car) => {
    const k = Math.floor(c.z / SEG_LEN)
    const list = bySeg.get(k)
    if (list) list.push(c)
    else bySeg.set(k, [c])
  }
  for (const c of w.traffic) add({ z: c.z, x: c.x, sprite: set.traffic[c.kind].frames[1][0], target: false })
  const tg = w.target
  const tgTurn = tg.stopping ? 2 : turnFrame((tg.x - fx.targetLastX) * 60)
  fx.targetLastX = tg.x
  add({ z: tg.z, x: tg.x, sprite: set.targets[w.def.target].frames[tgTurn][0], target: true })
  fx.targetAt = null
  const gantry = w.phase === 'pursuit' || w.phase === 'countdown' ? Math.floor(w.checkpoint / SEG_LEN) : null

  for (let i = drawn.length - 1; i > 0; i--) {
    const d = drawn[i]
    const { seg, p0, p1, clip } = d
    if (p0.y <= 0 && !d.visible) continue
    // Distant scenery fades into the haze like the road does, so a tall
    // building peeking over a crest reads as far away, not as on the road.
    ctx.globalAlpha = 1 - fogAt(i) * 0.85
    for (const prop of seg.props) {
      const s = set.props(prop.kind, theme.night, prop.kind === 'lamp' && prop.x > 0)
      drawClipped(ctx, s, p0.x + p0.scale * prop.x * ROAD_W, p0.y, PROP_SIZE[prop.kind] * p0.scale, clip)
    }
    ctx.globalAlpha = 1
    if (gantry === d.n) drawGantry(ctx, p0, clip, t)
    const cars = bySeg.get(d.n)
    if (!cars) continue
    cars.sort((a, b) => b.z - a.z)
    for (const c of cars) {
      const pct = (c.z - d.n * SEG_LEN) / SEG_LEN
      const scale = p0.scale + (p1.scale - p0.scale) * pct
      const sx = p0.x + (p1.x - p0.x) * pct + scale * c.x * ROAD_W
      const sy = p0.y + (p1.y - p0.y) * pct
      const cw = CAR_WORLD_W * scale
      drawClipped(ctx, c.sprite, sx, sy, cw, clip)
      if (c.target && sy - cw * 0.6 < clip) {
        fx.targetAt = { x: sx, y: sy, w: cw }
        drawTargetMarks(ctx, w, sx, sy, cw, t)
      }
    }
  }

  if (showPlayer) drawPlayer(ctx, w, t, steer)
  for (const q of fx.particles) {
    ctx.fillStyle = q.color
    ctx.fillRect(Math.round(q.x), Math.round(q.y), 2, 2)
  }
  ctx.restore()
  if (fx.flash > 0) {
    ctx.fillStyle = 'rgba(255,241,232,0.35)'
    ctx.fillRect(0, 0, W, H)
  }
}

/** Fill a rect given in screen space, cut off below `clip`. */
function clipRect(ctx: CanvasRenderingContext2D, x: number, top: number, w: number, bottom: number, clip: number, col: string) {
  const b = Math.min(bottom, clip)
  if (b <= top || w < 0.5) return
  ctx.fillStyle = col
  ctx.fillRect(Math.round(x), Math.round(top), Math.max(1, Math.round(w)), Math.round(b - top))
}

/** A checkpoint gantry spanning the road at a segment's near edge. */
function drawGantry(ctx: CanvasRenderingContext2D, p: Projected, clip: number, t: number) {
  const s = p.scale
  const edge = RUMBLE + 0.08
  const post = 160 * s
  const left = p.x - edge * ROAD_W * s
  const right = p.x + edge * ROAD_W * s
  const y = (h: number) => p.y - h * s
  clipRect(ctx, left - post, y(2700), post, p.y, clip, PAL[5])
  clipRect(ctx, right, y(2700), post, p.y, clip, PAL[5])
  const top = y(2700)
  const bottom = y(2050)
  clipRect(ctx, left - post, top, right - left + post * 2, bottom, clip, PAL[10])
  const inset = Math.max(1, 40 * s)
  clipRect(ctx, left - post + inset, top + inset, right - left + post * 2 - inset * 2, bottom - inset, clip, PAL[1])
  const size = Math.min(Math.floor((bottom - top) / 7), Math.floor((right - left) / 42))
  if (size >= 1 && bottom < clip) {
    centreText(ctx, 'CHECKPOINT', Math.round(p.x), Math.round(top + (bottom - top - size * 5) / 2), Math.floor(t * 4) % 2 ? PAL[10] : PAL[7], size)
  }
}

function drawTargetMarks(ctx: CanvasRenderingContext2D, w: World, x: number, y: number, cw: number, t: number) {
  const tg = w.target
  // Smoke pours out as the damage builds up.
  const puffs = Math.floor(tg.damage * 8)
  for (let i = 0; i < puffs; i++) {
    const a = t * 3 + i * 1.7
    const r = Math.max(1, cw * (0.08 + ((a * 0.37) % 1) * 0.12))
    ctx.fillStyle = i % 2 ? 'rgba(95,87,79,0.7)' : 'rgba(194,195,199,0.6)'
    ctx.fillRect(Math.round(x + Math.sin(a) * cw * 0.3 - r), Math.round(y - cw * 0.5 - ((a * 13) % (cw * 0.6)) - r), Math.round(r * 2), Math.round(r * 2))
  }
  if (tg.stopping) return
  // A bobbing arrow so you never lose sight of it.
  if (Math.floor(t * 4) % 2 === 0) {
    const ay = Math.round(y - cw * 0.75 - 10 - Math.sin(t * 8) * 2)
    ctx.fillStyle = PAL[8]
    for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(x) - 5 + i, ay + i, 11 - i * 2, 1)
    if (cw < 24) centreText(ctx, 'TARGET', Math.round(x), ay - 8, PAL[8])
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, w: World, t: number, steer: number) {
  const p = w.player
  const set = sprites()
  const sp = p.speed / MAX_SPEED
  const turn = turnFrame(steer)
  const siren = (w.phase === 'pursuit' || w.phase === 'arrest') && Math.floor(t * 6) % 2 === 0 ? 1 : 0
  const s = set.police.frames[turn][siren]
  const h = Math.round((PLAYER_PX * s.height) / s.width)
  const offRoad = Math.abs(p.x) > 1 && segmentAt(w.track, p.z).fork === 0
  const bounce = sp > 0.05 ? Math.round(Math.random() * (offRoad ? 3 : sp * 1.2)) : 0
  const x = Math.round(W / 2 - PLAYER_PX / 2)
  const y = H - h - 2 - bounce
  if (p.turbo > 0 && Math.floor(t * 20) % 2) {
    // Exhaust flames.
    ctx.fillStyle = PAL[9]
    ctx.fillRect(x + 22, y + h - 6, 6, 5)
    ctx.fillRect(x + PLAYER_PX - 28, y + h - 6, 6, 5)
    ctx.fillStyle = PAL[10]
    ctx.fillRect(x + 23, y + h - 4, 4, 5)
    ctx.fillRect(x + PLAYER_PX - 27, y + h - 4, 4, 5)
  }
  ctx.drawImage(s, x, y, PLAYER_PX, h)
  if (p.turbo > 0) {
    // Speed lines at the edges.
    ctx.fillStyle = 'rgba(255,241,232,0.5)'
    for (let i = 0; i < 6; i++) {
      const ly = ((i * 37 + Math.floor(t * 400)) % 120) + 50
      ctx.fillRect(i % 2 ? 4 : W - 24, ly, 20, 1)
    }
  }
}

// ── HUD ─────────────────────────────────────────────────────────────────────
const blink = (t: number, period = 0.5) => Math.floor(t / period) % 2 === 0

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, f: number, col: string) {
  ctx.fillStyle = PAL[0]
  ctx.fillRect(x - 1, y - 1, w + 2, 6)
  ctx.fillStyle = PAL[1]
  ctx.fillRect(x, y, w, 4)
  ctx.fillStyle = col
  ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, f))), 4)
}

export function drawHud(ctx: CanvasRenderingContext2D, w: World, fx: Fx, hiscore: number, t: number): void {
  const p = w.player
  drawText(ctx, 'SCORE', 4, 3, PAL[12])
  drawText(ctx, String(w.score).padStart(7, '0'), 4, 10, PAL[7])
  drawText(ctx, `HI ${String(hiscore).padStart(7, '0')}`, 4, 18, PAL[5])

  const secs = Math.ceil(w.timer)
  centreText(ctx, 'TIME', W / 2, 2, PAL[10])
  const low = secs <= 10 && (w.phase === 'pursuit' || w.phase === 'arrest')
  if (!low || blink(t, 0.25)) centreText(ctx, String(secs), W / 2, 9, low ? PAL[8] : PAL[7], 3)

  drawText(ctx, 'TURBO', W - 4, 3, PAL[9], 1, 'right')
  for (let i = 0; i < TURBOS; i++) {
    const on = i < p.turbos
    const x = W - 4 - (TURBOS - i) * 9 + 1
    ctx.fillStyle = on ? PAL[9] : PAL[1]
    ctx.fillRect(x, 10, 7, 6)
    if (on) { ctx.fillStyle = PAL[10]; ctx.fillRect(x + 1, 11, 5, 2) }
  }
  if (p.turbo > 0) {
    ctx.fillStyle = PAL[10]
    ctx.fillRect(W - 4 - TURBOS * 9 + 1, 18, Math.round((p.turbo / 3) * (TURBOS * 9 - 2)), 2)
  }

  // Distance to the target, then its damage.
  const mx = W / 2 - 50
  if (w.phase === 'arrest' || w.phase === 'caught') {
    drawText(ctx, 'DAMAGE', mx - 3, 28, PAL[8], 1, 'right')
    bar(ctx, mx, 28, 100, w.target.damage, blink(t, 0.15) && w.target.damage > 0.75 ? PAL[10] : PAL[8])
  } else {
    const g = Math.max(0, gap(w))
    drawText(ctx, 'GAP', mx - 3, 28, PAL[12], 1, 'right')
    bar(ctx, mx, 28, 100, 1 - g / w.def.startGap, PAL[12])
    drawText(ctx, `${Math.round(g * METRES_PER_UNIT)}M`, mx + 103, 28, PAL[7])
  }

  const speed = kmh(p.speed)
  drawText(ctx, String(speed).padStart(3, ' '), W - 30, H - 14, p.turbo > 0 ? PAL[9] : PAL[7], 2, 'right')
  drawText(ctx, 'KM/H', W - 4, H - 8, PAL[6], 1, 'right')
  drawText(ctx, `CASE ${w.caseIdx + 1}`, 4, H - 8, PAL[6])

  if (w.phase === 'countdown') {
    const n = Math.ceil(3 - w.phaseTime)
    centreText(ctx, String(n), W / 2, 60, PAL[10], 6)
  }
  if (fx.hint.t > 0 && blink(t, 0.3)) {
    const left = fx.hint.side === 'left'
    centreText(ctx, left ? '<<< LEFT' : 'RIGHT >>>', W / 2, 44, PAL[10], 2)
    centreText(ctx, `TARGET WENT ${left ? 'LEFT' : 'RIGHT'}!`, W / 2, 58, PAL[7])
  }
  if (fx.banner.t > 0) centreText(ctx, fx.banner.text, W / 2, 72, fx.banner.color, 2)
  if (w.message.t > 0) centreText(ctx, w.message.text, W / 2, 90, PAL[7])
}
