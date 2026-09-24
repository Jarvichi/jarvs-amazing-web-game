// ─── /shmup: renderer and effects ───────────────────────────────────────────
//
// The playfield is drawn to its own 180×320 canvas, then placed on screen
// either alone (portrait, with a compact HUD over the top) or between two
// 60px side panels (landscape), arcade-cabinet style. Explosions, sparks and
// floating text are purely visual, so they live here as an `Fx` system fed by
// the events `step` returns — the logic never knows about them.

import { PAL, drawSprite, drawText, hash, makeSprite, textWidth, type Sprite } from '../arcade/gfx'
import { partPos } from './boss'
import {
  ENEMIES, H, MARGIN, REAR_WARNING, W, coreExposed, dronePos, maxShield, rearWarnings,
  type Boss, type BossLook, type BossPart, type Enemy, type GameEvent, type Loadout, type Theme, type World,
} from './logic'

export { PAL, drawText }

export const PANEL_W = 60
export const PF_W = W
export const PF_H = H

// ── Sprites ─────────────────────────────────────────────────────────────────
const SHIP = [
  '.......7.......',
  '......767......',
  '......666......',
  '.....66c66.....',
  '.....6ccc6.....',
  '....66c1c66....',
  '....6611166....',
  '...666111666...',
  '..66d66166d66..',
  '.6d6d66666d6d6.',
  '6dd6d66866d6dd6',
  '6d66d68886d66d6',
  '66..6d888d6..66',
  '6...66...66...6',
]

const DRIFTER = [
  '....eeee....',
  '..eeeeeeee..',
  '.ee8eeee8ee.',
  '.e878ee878e.',
  'eee8eeee8eee',
  'eeeeeeeeeeee',
  'eeee2222eeee',
  'eee222222eee',
  '.eee2222eee.',
  '.e.eeeeee.e.',
  'e..e.ee.e..e',
  '...e....e...',
]

const SWOOPER = [
  'b..........b',
  'bb........bb',
  'bbb..33..bbb',
  '.bbb3bb3bbb.',
  '..bbbbbbbb..',
  '...bb77bb...',
  '...b7007b...',
  '....b77b....',
  '.....bb.....',
  '.....b......',
]

// Drawn nose-down: darters dive at the player.
const DARTER = [
  '..2...22...2..',
  '..22.2222.22..',
  'd.2222882222.d',
  'dd2222882222dd',
  'ddd22222222ddd',
  'dddd222222dddd',
  '.ddddd88ddddd.',
  '..dddd88dddd..',
  '...ddd77ddd...',
  '....dd77dd....',
  '.....dddd.....',
  '......dd......',
]

interface Sprites { ship: Sprite; drifter: Sprite; swooper: Sprite; darter: Sprite }
let sprites: Sprites | null = null
function getSprites(): Sprites {
  sprites ??= { ship: makeSprite(SHIP), drifter: makeSprite(DRIFTER), swooper: makeSprite(SWOOPER), darter: makeSprite(DARTER) }
  return sprites
}

// ── Effects ─────────────────────────────────────────────────────────────────
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; colour: number; size: number }
interface Ring { x: number; y: number; r: number; max: number; life: number }
interface Floater { x: number; y: number; text: string; colour: number; life: number }

export class Fx {
  particles: Particle[] = []
  rings: Ring[] = []
  floaters: Floater[] = []
  shake = 0
  flash = 0
  private seed = 1

  private rnd() {
    this.seed = (this.seed * 16807) % 2147483647
    return this.seed / 2147483647
  }

  burst(x: number, y: number, n: number, speed: number, colours: number[], life = 0.6) {
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2
      const v = speed * (0.3 + this.rnd() * 0.7)
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.5 + this.rnd() * 0.5), max: life,
        colour: colours[Math.floor(this.rnd() * colours.length)], size: this.rnd() < 0.3 ? 2 : 1,
      })
    }
  }

  float(x: number, y: number, text: string, colour: number) {
    this.floaters.push({ x, y, text, colour, life: 0.9 })
  }

  handle(events: GameEvent[]) {
    for (const e of events) {
      switch (e.kind) {
        case 'hit':
          this.burst(e.x, e.y, 3, 40, [7, 10], 0.2)
          break
        case 'explode':
          this.burst(e.x, e.y, 14, 70, [7, 10, 9, 8])
          this.rings.push({ x: e.x, y: e.y, r: 0, max: 12, life: 0.25 })
          break
        case 'bigexplode':
        case 'podkill':
          this.burst(e.x, e.y, 28, 100, [7, 10, 9, 8, 2], 0.8)
          this.rings.push({ x: e.x, y: e.y, r: 0, max: 22, life: 0.35 })
          this.shake = Math.max(this.shake, 0.2)
          break
        case 'bossdie':
          this.burst(e.x, e.y, 80, 160, [7, 10, 9, 8, 14], 1.4)
          this.rings.push({ x: e.x, y: e.y, r: 0, max: 60, life: 0.6 })
          this.shake = 1.2
          this.flash = 0.3
          break
        case 'die':
          this.burst(e.x, e.y, 40, 120, [7, 12, 6, 10], 1)
          this.rings.push({ x: e.x, y: e.y, r: 0, max: 30, life: 0.4 })
          this.shake = 0.5
          break
        case 'bomb':
          this.flash = 0.35
          this.shake = 0.6
          this.rings.push({ x: e.x, y: e.y, r: 0, max: 200, life: 0.5 })
          this.rings.push({ x: e.x, y: e.y, r: 0, max: 120, life: 0.4 })
          this.float(e.x, e.y - 16, 'SMART BOMB', 7)
          break
        case 'phase':
          this.flash = 0.15
          this.shake = Math.max(this.shake, 0.4)
          this.burst(e.x, e.y, 30, 90, [8, 14, 7], 0.6)
          break
        case 'hurt':
          this.burst(e.x, e.y, 6, 50, [12, 7], 0.3)
          this.shake = Math.max(this.shake, 0.12)
          break
        case 'credit':
          this.burst(e.x, e.y, 4, 30, [12, 7], 0.3)
          break
        case 'capsule':
          this.float(e.x, e.y, CAPSULE_LABEL[e.detail ?? ''] ?? 'POWER UP', 10)
          this.burst(e.x, e.y, 12, 60, [10, 11, 7], 0.5)
          break
      }
    }
  }

  update(dt: number) {
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 1 - 2 * dt
      p.vy *= 1 - 2 * dt
      p.life -= dt
    }
    this.particles = this.particles.filter(p => p.life > 0)
    for (const r of this.rings) { r.life -= dt; r.r += (r.max / 0.3) * dt }
    this.rings = this.rings.filter(r => r.life > 0)
    for (const f of this.floaters) { f.y -= 20 * dt; f.life -= dt }
    this.floaters = this.floaters.filter(f => f.life > 0)
    this.shake = Math.max(0, this.shake - dt)
    this.flash = Math.max(0, this.flash - dt)
  }

  clear() {
    this.particles = []
    this.rings = []
    this.floaters = []
    this.shake = 0
    this.flash = 0
  }
}

const CAPSULE_LABEL: Record<string, string> = {
  cannon: 'CANNON UP', side: 'SIDE SHOTS', rear: 'REAR GUN', homing: 'HOMING', speed: 'SPEED UP', shield: 'SHIELD',
}

// ── Background ──────────────────────────────────────────────────────────────
function wallWidth(worldY: number, side: number): number {
  return 7 + Math.sin(worldY * 0.03 + side * 2) * 3 + Math.sin(worldY * 0.11 + side) * 2
}

const THEME_BG: Record<Theme, { bg: string; wall: [number, number] }> = {
  flesh: { bg: '#2a0612', wall: [14, 8] },
  machine: { bg: PAL[1], wall: [5, 6] },
  spore: { bg: '#0b2410', wall: [3, 11] },
  crystal: { bg: '#061a2c', wall: [1, 12] },
  core: { bg: '#1c0204', wall: [2, 8] },
}

function drawBackground(ctx: CanvasRenderingContext2D, w: World, t: number) {
  const theme = w.level.theme
  const flesh = theme === 'flesh'
  const scroll = w.scroll + (w.boss ? t * 6 : 0) // keep a little life when the scroll stops
  ctx.fillStyle = THEME_BG[theme].bg
  ctx.fillRect(0, 0, W, H)

  if (theme === 'spore') drawSporeDecor(ctx, scroll, t)
  else if (theme === 'crystal') drawCrystalDecor(ctx, scroll, t)
  else if (theme === 'core') drawCoreDecor(ctx, scroll, t)
  else if (flesh) {
    // Pulsing veins, then cells drifting past at half speed.
    for (let v = 0; v < 5; v++) {
      ctx.fillStyle = v % 2 ? '#4a0c20' : PAL[2]
      const base = 20 + v * 34
      for (let y = 0; y < H; y += 2) {
        const wy = y - scroll * 0.6
        const x = base + Math.sin(wy * 0.02 + v * 1.7) * 12
        ctx.fillRect(Math.round(x), y, v % 2 ? 1 : 2, 2)
      }
    }
    for (let i = 0; i < 14; i++) {
      const y = ((hash(i) * 400 + scroll * 0.5) % 400) - 40
      const x = 20 + hash(i + 50) * (W - 40)
      const r = 3 + hash(i + 9) * 5
      ctx.fillStyle = PAL[2]
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#b8406a'
      ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 2, 2)
    }
  } else {
    // Riveted plates scrolling under a faint grid.
    const off = scroll % 32
    for (let y = -32; y < H + 32; y += 32) {
      for (let x = MARGIN; x < W - MARGIN; x += 32) {
        const py = Math.round(y + off)
        ctx.fillStyle = (Math.floor((y - scroll) / 32) + x / 32) % 2 === 0 ? '#16244a' : PAL[1]
        ctx.fillRect(x, py, 32, 32)
        ctx.fillStyle = PAL[5]
        ctx.fillRect(x + 2, py + 2, 1, 1)
        ctx.fillRect(x + 29, py + 2, 1, 1)
        ctx.fillRect(x + 2, py + 29, 1, 1)
        ctx.fillRect(x + 29, py + 29, 1, 1)
      }
    }
    for (let i = 0; i < 6; i++) {
      const y = ((hash(i + 3) * 400 + scroll * 1.4) % 400) - 40
      ctx.fillStyle = PAL[13]
      ctx.fillRect(MARGIN + 6 + Math.floor(hash(i) * 120), Math.round(y), 24, 1)
    }
  }

  // Tunnel walls
  for (let y = 0; y < H; y += 2) {
    const wy = y - scroll
    for (const side of [0, 1]) {
      const ww = Math.round(wallWidth(wy, side))
      const x = side ? W - ww : 0
      const [body, edge] = THEME_BG[theme].wall
      ctx.fillStyle = PAL[body]
      ctx.fillRect(x, y, ww, 2)
      ctx.fillStyle = PAL[edge]
      ctx.fillRect(side ? x : x + ww - 1, y, 1, 2)
    }
  }
}

/** Wrap a scrolling coordinate into [-margin, H + margin). */
const wrapY = (y: number, margin = 40) => ((y % (H + margin * 2)) + H + margin * 2) % (H + margin * 2) - margin

function drawSporeDecor(ctx: CanvasRenderingContext2D, scroll: number, t: number) {
  // Mushroom caps drifting past below, spores rising against the scroll.
  for (let i = 0; i < 8; i++) {
    const y = wrapY(hash(i) * 400 + scroll * 0.5)
    const x = 24 + hash(i + 20) * (W - 48)
    const r = 6 + hash(i + 5) * 6
    ctx.fillStyle = '#1a4a1e'
    ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, Math.round(r))
    ctx.fillStyle = PAL[3]
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, Math.PI, Math.PI * 2); ctx.fill()
    ctx.fillStyle = PAL[11]
    ctx.fillRect(Math.round(x - r / 3), Math.round(y - r * 0.35), 2, 2)
  }
  for (let i = 0; i < 30; i++) {
    const y = wrapY(hash(i + 70) * 400 + scroll * 0.3 - t * 14, 10)
    const x = 16 + hash(i + 90) * (W - 32) + Math.sin(t + i) * 4
    ctx.fillStyle = PAL[i % 3 ? 11 : 10]
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
  }
}

function drawCrystalDecor(ctx: CanvasRenderingContext2D, scroll: number, t: number) {
  for (let i = 0; i < 16; i++) {
    const layer = i % 2 ? 0.4 : 0.9
    const y = wrapY(hash(i) * 400 + scroll * layer)
    const x = 18 + hash(i + 31) * (W - 36)
    const s = (i % 2 ? 3 : 5) + hash(i + 3) * 3
    // Kept dark: anything bright on a shooter's background reads as a threat.
    ctx.fillStyle = i % 2 ? '#0c2a44' : '#15406a'
    ctx.beginPath()
    ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.6); ctx.lineTo(x - s, y)
    ctx.fill()
    if (i % 2 === 0 && Math.floor(t * 3 + i) % 5 === 0) {
      ctx.fillStyle = '#5a8ab0'
      ctx.fillRect(Math.round(x) - 1, Math.round(y - s), 1, 2)
    }
  }
}

function drawCoreDecor(ctx: CanvasRenderingContext2D, scroll: number, t: number) {
  // The whole chamber throbs; veins of heat and embers climbing upward.
  const beat = Math.max(0, Math.sin(t * 5)) ** 4
  ctx.fillStyle = `rgba(255,0,77,${0.08 + beat * 0.12})`
  ctx.fillRect(0, 0, W, H)
  for (let v = 0; v < 6; v++) {
    ctx.fillStyle = v % 2 ? PAL[2] : PAL[8]
    const base = 18 + v * 28
    for (let y = 0; y < H; y += 3) {
      const x = base + Math.sin((y - scroll * 0.8) * 0.04 + v) * 10
      ctx.fillRect(Math.round(x), y, 1, 3)
    }
  }
  for (let i = 0; i < 24; i++) {
    const y = wrapY(hash(i + 40) * 400 - t * (20 + hash(i) * 30), 10)
    ctx.fillStyle = PAL[i % 2 ? 9 : 10]
    ctx.fillRect(Math.round(16 + hash(i + 60) * (W - 32)), Math.round(y), 1, 2)
  }
}

// ── Entities ────────────────────────────────────────────────────────────────
function drawShip(ctx: CanvasRenderingContext2D, w: World, t: number) {
  const s = w.ship
  if (!s.alive) return
  if (s.invuln > 0 && Math.floor(t * 20) % 2) return
  const { ship } = getSprites()
  const x = Math.round(s.x - 7)
  const y = Math.round(s.y - 7)
  // Engine flicker
  ctx.fillStyle = PAL[Math.floor(t * 30) % 2 ? 10 : 9]
  ctx.fillRect(x + 5, y + 14, 1, 2 + (Math.floor(t * 30) % 2))
  ctx.fillRect(x + 9, y + 14, 1, 2 + (Math.floor(t * 30) % 2))
  drawSprite(ctx, ship, x, y, false)
  for (let i = 0; i < w.loadout.drones; i++) {
    const d = dronePos(w, i)
    ctx.fillStyle = PAL[12]
    ctx.fillRect(Math.round(d.x) - 2, Math.round(d.y) - 2, 5, 5)
    ctx.fillStyle = PAL[Math.floor(t * 10 + i) % 2 ? 7 : 1]
    ctx.fillRect(Math.round(d.x) - 1, Math.round(d.y) - 1, 3, 3)
  }
}

function drawSpinner(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  ctx.fillStyle = PAL[9]
  ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = PAL[10]
  for (let i = 0; i < 4; i++) {
    const a = t * 5 + i * Math.PI / 2
    for (let r = 4; r < 7; r++) ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1)
  }
  ctx.fillStyle = PAL[8]
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2)
}

function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: { x: number; y: number }, shell: string, iris: string) {
  ctx.fillStyle = shell
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = PAL[7]
  ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.fill()
  const a = Math.atan2(look.y - y, look.x - x)
  ctx.fillStyle = iris
  ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25, r * 0.35, 0, Math.PI * 2); ctx.fill()
}

const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string) => {
  ctx.fillStyle = colour
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
}

function drawSplitter(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const r = 8 + Math.sin(t * 4) * 0.8
  circle(ctx, x, y, r, PAL[3])
  circle(ctx, x, y, r - 2, PAL[11])
  // Two nuclei drifting apart: it's about to divide.
  const d = 2 + Math.sin(t * 2) * 1.5
  circle(ctx, x - d, y, 2, PAL[3])
  circle(ctx, x + d, y, 2, PAL[3])
}

function drawMine(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, shipDist: number) {
  ctx.fillStyle = PAL[5]
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    ctx.fillRect(Math.round(x + Math.cos(a) * 6), Math.round(y + Math.sin(a) * 6), 2, 2)
  }
  circle(ctx, x, y, 5, PAL[6])
  // Blinks faster the closer the ship gets.
  const rate = shipDist < 50 ? 16 : 4
  circle(ctx, x, y, 2, PAL[Math.floor(t * rate) % 2 ? 8 : 2])
}

function drawSnake(ctx: CanvasRenderingContext2D, e: Enemy, w: World) {
  const head = e.member === 0
  circle(ctx, e.x, e.y, 5, PAL[head ? 8 : 9])
  circle(ctx, e.x, e.y, 3, PAL[head ? 14 : 10])
  if (head) {
    const a = Math.atan2(w.ship.y - e.y, w.ship.x - e.x)
    ctx.fillStyle = PAL[0]
    ctx.fillRect(Math.round(e.x + Math.cos(a) * 2 - 2), Math.round(e.y + Math.sin(a) * 2), 1, 1)
    ctx.fillRect(Math.round(e.x + Math.cos(a) * 2 + 2), Math.round(e.y + Math.sin(a) * 2), 1, 1)
  }
}

function drawSniper(ctx: CanvasRenderingContext2D, e: Enemy, w: World, t: number) {
  // Lock-on warning: a dotted line to where the shot will go.
  if (e.aim && Math.floor(t * 20) % 2) {
    ctx.fillStyle = PAL[8]
    const d = Math.hypot(e.aim.x - e.x, e.aim.y - e.y)
    for (let i = 0; i < d; i += 4) {
      ctx.fillRect(Math.round(e.x + (e.aim.x - e.x) * i / d), Math.round(e.y + (e.aim.y - e.y) * i / d), 1, 1)
    }
  }
  const target = e.aim ?? w.ship
  const a = Math.atan2(target.y - e.y, target.x - e.x)
  ctx.fillStyle = PAL[6]
  for (let r = 4; r < 11; r++) ctx.fillRect(Math.round(e.x + Math.cos(a) * r), Math.round(e.y + Math.sin(a) * r), 1, 1)
  ctx.fillStyle = PAL[13]
  ctx.beginPath()
  ctx.moveTo(e.x, e.y - 7); ctx.lineTo(e.x + 7, e.y); ctx.lineTo(e.x, e.y + 7); ctx.lineTo(e.x - 7, e.y)
  ctx.fill()
  circle(ctx, e.x, e.y, 2, PAL[e.aim ? 8 : 12])
}

function drawCarrier(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const l = Math.round(x - 12)
  const top = Math.round(y - 9)
  ctx.fillStyle = PAL[5]
  ctx.fillRect(l, top + 2, 24, 14)
  ctx.fillRect(l + 4, top, 16, 18)
  ctx.fillStyle = PAL[6]
  ctx.fillRect(l + 1, top + 3, 22, 2)
  // Hangar mouth, glowing when a launch is near.
  ctx.fillStyle = PAL[0]
  ctx.fillRect(l + 8, top + 12, 8, 5)
  ctx.fillStyle = PAL[Math.floor(t * 6) % 2 ? 9 : 10]
  ctx.fillRect(l + 2, top + 8, 2, 2)
  ctx.fillRect(l + 20, top + 8, 2, 2)
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, w: World, t: number) {
  // Rear attackers are drawn upside down, facing the way they fly.
  if (e.below) {
    ctx.save()
    ctx.translate(0, Math.round(e.y) * 2)
    ctx.scale(1, -1)
    drawEnemyBody(ctx, e, w, t)
    ctx.restore()
  } else {
    drawEnemyBody(ctx, e, w, t)
  }
}

function drawEnemyBody(ctx: CanvasRenderingContext2D, e: Enemy, w: World, t: number) {
  const s = getSprites()
  const def = ENEMIES[e.kind]
  const x = Math.round(e.x - def.w / 2)
  const y = Math.round(e.y - def.h / 2)
  switch (e.kind) {
    case 'drifter': drawSprite(ctx, s.drifter, x, y + (Math.floor(t * 4 + e.id) % 2), false); break
    case 'swooper': drawSprite(ctx, s.swooper, x, y, e.x < e.sx); break
    case 'darter': drawSprite(ctx, s.darter, x, y, false); break
    case 'spinner': drawSpinner(ctx, e.x, e.y, t + e.id); break
    case 'turret': drawEye(ctx, e.x, e.y, 8, w.ship, w.level.theme === 'flesh' ? PAL[14] : PAL[6], PAL[8]); break
    case 'splitter': drawSplitter(ctx, e.x, e.y, t + e.id); break
    case 'mine': drawMine(ctx, e.x, e.y, t, Math.hypot(w.ship.x - e.x, w.ship.y - e.y)); break
    case 'snake': drawSnake(ctx, e, w); break
    case 'sniper': drawSniper(ctx, e, w, t); break
    case 'carrier': drawCarrier(ctx, e.x, e.y, t); break
  }
  if (e.flash > 0) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillRect(x, y, def.w, def.h)
    ctx.globalCompositeOperation = 'source-over'
  }
}

/** Body shell, body highlight, pod shell and pod iris colours for each boss. */
const BOSS_COLOURS: Record<BossLook, [number, number, number, number]> = {
  maw: [2, 14, 8, 2],
  heart: [5, 6, 13, 12],
  spore: [3, 11, 10, 3],
  hydra: [1, 12, 6, 12],
  core: [2, 8, 9, 8],
}

function drawBoss(ctx: CanvasRenderingContext2D, b: Boss, w: World, t: number) {
  if (b.dying && Math.floor(b.dying * 12) % 2) return
  const look = b.def.look
  const flesh = look === 'maw'
  const [shell, highlight, podShell, podIris] = BOSS_COLOURS[look]
  const exposed = coreExposed(b)
  const bx = Math.round(b.x)
  const by = Math.round(b.y)

  // Hydra heads hang from necks drawn behind the body.
  if (look === 'hydra') {
    ctx.strokeStyle = PAL[13]
    ctx.lineWidth = 4
    for (const p of b.pods) {
      if (p.hp <= 0) continue
      const pos = partPos(b, p)
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + p.ox * 0.4, by + 24, pos.x, pos.y); ctx.stroke()
    }
    ctx.lineWidth = 1
  }

  // Body: a wide carapace spanning the pods.
  ctx.fillStyle = PAL[shell]
  if (look === 'spore') {
    // A mushroom cap with gills underneath.
    ctx.beginPath(); ctx.ellipse(bx, by + 2, 56, 28, 0, Math.PI, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1a4a1e'
    ctx.fillRect(bx - 50, by + 2, 100, 8)
    ctx.fillStyle = PAL[highlight]
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.arc(bx - 40 + i * 16, by - 12 - (i % 2) * 6, 3, 0, Math.PI * 2); ctx.fill()
    }
  } else if (look === 'hydra') {
    ctx.beginPath()
    ctx.moveTo(bx, by - 26); ctx.lineTo(bx + 34, by); ctx.lineTo(bx, by + 18); ctx.lineTo(bx - 34, by)
    ctx.fill()
    ctx.fillStyle = PAL[highlight]
    ctx.beginPath(); ctx.moveTo(bx, by - 26); ctx.lineTo(bx + 12, by - 6); ctx.lineTo(bx, by - 2); ctx.fill()
  } else if (look === 'core') {
    // Armoured plates that rotate around the heart.
    for (let i = 0; i < 8; i++) {
      const a = t * 0.8 + (i / 8) * Math.PI * 2
      ctx.fillStyle = PAL[i % 2 ? shell : 5]
      ctx.beginPath(); ctx.arc(bx + Math.cos(a) * 30, by + Math.sin(a) * 16, 9, 0, Math.PI * 2); ctx.fill()
    }
  } else {
    ctx.beginPath(); ctx.ellipse(bx, by + 4, 52, 22, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = PAL[highlight]
    ctx.beginPath(); ctx.ellipse(bx, by, 46, 16, 0, Math.PI, Math.PI * 2); ctx.fill()
  }

  // Core: armoured shell until the pods fall, then a pulsing heart / maw.
  const c = b.core
  if (!exposed) {
    ctx.fillStyle = PAL[5]
    ctx.fillRect(bx - 18, by - 12, 36, 24)
    ctx.fillStyle = PAL[6]
    for (let i = 0; i < 4; i++) ctx.fillRect(bx - 16 + i * 9, by - 10, 6, 20)
  } else {
    const pulse = 0.5 + Math.sin(t * 10) * 0.5
    ctx.fillStyle = pulse > 0.5 ? PAL[8] : PAL[2]
    ctx.beginPath(); ctx.ellipse(bx, by, 18, 12, 0, 0, Math.PI * 2); ctx.fill()
    if (flesh) {
      ctx.fillStyle = PAL[7]
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(bx + i * 5 - 1, by - 8, 2, 4)
        ctx.fillRect(bx + i * 5 - 1, by + 4, 2, 4)
      }
    } else if (look === 'core') {
      drawEye(ctx, bx, by, 11, w.ship, PAL[8], PAL[0])
    } else if (look === 'spore') {
      ctx.fillStyle = PAL[10]
      for (let i = -2; i <= 2; i++) ctx.fillRect(bx + i * 6 - 1, by - 6, 2, 12)
    } else {
      ctx.fillStyle = PAL[look === 'hydra' ? 7 : 10]
      ctx.fillRect(bx - 3, by - 3, 6, 6)
    }
  }
  flashPart(ctx, b, c)

  for (const p of b.pods) {
    const pos = partPos(b, p)
    if (p.hp <= 0) {
      ctx.fillStyle = PAL[0]
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2); ctx.fill()
      continue
    }
    drawEye(ctx, pos.x, pos.y, 7, w.ship, PAL[podShell], PAL[podIris])
    flashPart(ctx, b, p)
  }

  // Health bar across the top of the playfield.
  const total = b.pods.reduce((s, p) => s + Math.max(0, p.hp), 0) + Math.max(0, c.hp)
  const max = b.pods.reduce((s, p) => s + p.max, 0) + c.max
  ctx.fillStyle = PAL[0]
  ctx.fillRect(MARGIN + 4, 22, W - 2 * MARGIN - 8, 4)
  ctx.fillStyle = PAL[8]
  ctx.fillRect(MARGIN + 5, 23, Math.round((W - 2 * MARGIN - 10) * total / max), 2)
  drawText(ctx, b.def.name, W / 2, 14, PAL[7], 1, 'center')
}

function flashPart(ctx: CanvasRenderingContext2D, b: Boss, p: BossPart) {
  if (p.flash <= 0) return
  const pos = partPos(b, p)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillRect(Math.round(pos.x - p.w / 2), Math.round(pos.y - p.h / 2), p.w, p.h)
}

function drawLasers(ctx: CanvasRenderingContext2D, b: Boss, t: number) {
  for (const l of b.lasers) {
    const x = Math.round(l.x)
    const y = Math.round(l.y)
    if (l.t < l.warn) {
      // Telegraph: a thin flickering guide line, faster as it's about to fire.
      if (Math.floor(t * (8 + 16 * l.t / l.warn)) % 2) {
        ctx.fillStyle = PAL[8]
        ctx.fillRect(x, y, 1, H - y)
      }
      continue
    }
    const half = Math.floor(l.width / 2)
    const wobble = Math.floor(t * 30) % 2
    ctx.fillStyle = PAL[8]
    ctx.fillRect(x - half - wobble, y, l.width + wobble * 2, H - y)
    ctx.fillStyle = PAL[14]
    ctx.fillRect(x - Math.floor(half / 2), y, half + 1, H - y)
    ctx.fillStyle = PAL[7]
    ctx.fillRect(x - 1, y, 2, H - y)
  }
}

function drawShots(ctx: CanvasRenderingContext2D, w: World, t: number) {
  for (const s of w.shots) {
    if (s.pierce) {
      ctx.fillStyle = PAL[12]
      ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 6, 3, 12)
      ctx.fillStyle = PAL[7]
      ctx.fillRect(Math.round(s.x), Math.round(s.y) - 6, 1, 12)
    } else if (s.homing) {
      ctx.fillStyle = PAL[9]
      ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 3, 3)
      ctx.fillStyle = PAL[5]
      ctx.fillRect(Math.round(s.x - s.vx * 0.03), Math.round(s.y - s.vy * 0.03), 1, 1)
    } else if (s.vy === 0) {
      ctx.fillStyle = PAL[11]
      ctx.fillRect(Math.round(s.x) - 2, Math.round(s.y), 5, 1)
    } else {
      ctx.fillStyle = PAL[10]
      ctx.fillRect(Math.round(s.x), Math.round(s.y) - 2, 1, 5)
      ctx.fillStyle = PAL[7]
      ctx.fillRect(Math.round(s.x), Math.round(s.y) - 2, 1, 2)
    }
  }
  const blink = Math.floor(t * 12) % 2
  for (const s of w.enemyShots) {
    ctx.fillStyle = PAL[blink ? 14 : 8]
    ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 3, 3)
    ctx.fillStyle = PAL[7]
    ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1)
  }
}

function drawPickups(ctx: CanvasRenderingContext2D, w: World, t: number) {
  for (const p of w.pickups) {
    const x = Math.round(p.x)
    const y = Math.round(p.y)
    if (p.kind === 'credit') {
      // A bubble: ring with a glint.
      ctx.strokeStyle = PAL[12]
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, p.value >= 15 ? 4 : 3, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = PAL[7]
      ctx.fillRect(x - 1, y - 2, 1, 1)
    } else {
      ctx.fillStyle = PAL[Math.floor(t * 8) % 2 ? 11 : 3]
      ctx.fillRect(x - 4, y - 5, 9, 10)
      drawText(ctx, 'P', x - 1, y - 2, PAL[7], 1, 'left', false)
    }
  }
}

function drawFx(ctx: CanvasRenderingContext2D, fx: Fx) {
  for (const r of fx.rings) {
    ctx.strokeStyle = PAL[r.life > 0.15 ? 7 : 9]
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke()
  }
  for (const p of fx.particles) {
    ctx.fillStyle = PAL[p.life < p.max * 0.3 ? 5 : p.colour]
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
  }
  for (const f of fx.floaters) drawText(ctx, f.text, Math.round(f.x), Math.round(f.y), PAL[f.colour], 1, 'center')
}

/** Flashing up-arrows along the bottom edge where a rear wave is about to come in. */
function drawRearWarnings(ctx: CanvasRenderingContext2D, w: World, t: number) {
  for (const warn of rearWarnings(w)) {
    // Blink faster as it gets closer.
    if (Math.floor(t * (6 + 12 * (1 - warn.t / REAR_WARNING))) % 2) continue
    const x = Math.round(Math.max(MARGIN + 6, Math.min(W - MARGIN - 6, warn.x)))
    const y = H - 30
    ctx.fillStyle = PAL[8]
    for (let r = 0; r < 6; r++) ctx.fillRect(x - r, y + r, r * 2 + 1, 1)
    ctx.fillRect(x - 1, y + 6, 3, 5)
    drawText(ctx, '!', x - 1, y + 13, PAL[10])
  }
}

// ── Playfield ───────────────────────────────────────────────────────────────
let pf: HTMLCanvasElement | null = null

/** Draw the whole playfield to its own canvas and return it. */
export function renderPlayfield(w: World, fx: Fx, t: number): HTMLCanvasElement {
  if (!pf) {
    pf = document.createElement('canvas')
    pf.width = PF_W
    pf.height = PF_H
  }
  const ctx = pf.getContext('2d')!
  drawBackground(ctx, w, t)
  for (const e of w.enemies) if (e.kind === 'turret') drawEnemy(ctx, e, w, t) // ground-level first
  drawPickups(ctx, w, t)
  if (w.boss) {
    drawLasers(ctx, w.boss, t)
    drawBoss(ctx, w.boss, w, t)
  }
  for (const e of w.enemies) if (e.kind !== 'turret') drawEnemy(ctx, e, w, t)
  drawShip(ctx, w, t)
  drawRearWarnings(ctx, w, t)
  drawShots(ctx, w, t)
  drawFx(ctx, fx)
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${fx.flash * 2})`
    ctx.fillRect(0, 0, W, H)
  }
  return pf
}

// ── HUD ─────────────────────────────────────────────────────────────────────
export interface HudInfo {
  hiscore: number
  levelNum: number
}

function shieldBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, shield: number, max: number) {
  ctx.fillStyle = PAL[0]
  ctx.fillRect(x, y, width, 4)
  const frac = Math.max(0, shield) / max
  ctx.fillStyle = PAL[frac > 0.5 ? 11 : frac > 0.25 ? 10 : 8]
  ctx.fillRect(x + 1, y + 1, Math.round((width - 2) * frac), 2)
}

function lifeIcons(ctx: CanvasRenderingContext2D, x: number, y: number, lives: number, align: 'left' | 'right') {
  for (let i = 0; i < lives; i++) {
    const ix = align === 'left' ? x + i * 7 : x - (i + 1) * 7
    ctx.fillStyle = PAL[6]
    ctx.fillRect(ix + 2, y, 1, 2)
    ctx.fillRect(ix + 1, y + 2, 3, 2)
    ctx.fillRect(ix, y + 4, 5, 1)
  }
}

const pad = (n: number, len: number) => String(n).padStart(len, '0')

/** Compact HUD over the top of the playfield, for portrait screens. */
export function drawHudCompact(ctx: CanvasRenderingContext2D, w: World, _info: HudInfo) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(0, 0, W, 10)
  drawText(ctx, pad(w.score, 7), 3, 3, PAL[7])
  // Centred: the top-right corner is under the touch pause button.
  drawText(ctx, `CR ${w.credits}`, W / 2 + 10, 3, PAL[12], 1, 'center')
  shieldBar(ctx, 3, H - 8, 50, w.ship.shield, maxShield(w.loadout))
  drawText(ctx, `B${w.loadout.bombs}`, 58, H - 9, PAL[w.loadout.bombs ? 10 : 5])
  lifeIcons(ctx, W - 3, H - 9, w.lives, 'right')
}

/** What the side panels show — a World, or the carried state between levels. */
export interface PanelState {
  score: number
  credits: number
  lives: number
  shield: number
  loadout: Loadout
}

export const panelState = (w: World): PanelState =>
  ({ score: w.score, credits: w.credits, lives: w.lives, shield: w.ship.shield, loadout: w.loadout })

/** Arcade-style side panels, for landscape screens. `ox` is where the playfield starts. */
export function drawPanels(ctx: CanvasRenderingContext2D, w: PanelState, info: HudInfo, ox: number) {
  const left = 0
  const right = ox + PF_W
  for (const px of [left, right]) {
    ctx.fillStyle = PAL[0]
    ctx.fillRect(px, 0, PANEL_W, PF_H)
    ctx.fillStyle = PAL[1]
    ctx.fillRect(px + 2, 2, PANEL_W - 4, PF_H - 4)
  }
  const label = (text: string, x: number, y: number) => drawText(ctx, text, x, y, PAL[13])
  const value = (text: string, x: number, y: number, c = PAL[7]) => drawText(ctx, text, x, y, c)

  let y = 10
  label('SCORE', 6, y); value(pad(w.score, 7), 6, y + 8); y += 26
  label('HI', 6, y); value(pad(Math.max(info.hiscore, w.score), 7), 6, y + 8, PAL[9]); y += 26
  label('LEVEL', 6, y); value(String(info.levelNum), 6, y + 8); y += 26
  label('SHIPS', 6, y); lifeIcons(ctx, 6, y + 8, w.lives, 'left'); y += 26
  label('SHIELD', 6, y); shieldBar(ctx, 6, y + 8, PANEL_W - 12, w.shield, maxShield(w.loadout)); y += 26
  label('BOMBS', 6, y); value(String(w.loadout.bombs), 6, y + 8, PAL[w.loadout.bombs ? 10 : 5])

  const rx = right + 6
  y = 10
  label('CREDITS', rx, y); value(String(w.credits), rx, y + 8, PAL[12]); y += 24
  label('WEAPONS', rx, y); y += 10
  const l = w.loadout
  const pips = (name: string, n: number, max: number) => {
    value(name, rx, y, n ? PAL[7] : PAL[5])
    for (let i = 0; i < max; i++) {
      ctx.fillStyle = PAL[i < n ? 11 : 5]
      ctx.fillRect(rx + 1 + i * 5, y + 7, 4, 2)
    }
    y += 13
  }
  pips('CANNON', l.cannon, 3)
  pips('SIDE', l.side ? 1 : 0, 1)
  pips('REAR', l.rear ? 1 : 0, 1)
  pips('HOMING', l.homing, 2)
  pips('SPEED', l.speed, 2)
  pips('RAPID', l.rapid, 2)
  pips('LASER', l.laser ? 1 : 0, 1)
  pips('DRONES', l.drones, 2)
  pips('ARMOUR', l.armour ? 1 : 0, 1)
}

export function centreText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, colour: string, scale = 1) {
  drawText(ctx, text, Math.round(cx), y, colour, scale, 'center')
}

export { textWidth }
