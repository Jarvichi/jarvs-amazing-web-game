// ─── /arcade — the JAWG arcade index ────────────────────────────────────────
//
// Served at jawg.uk/arcade (arcade.html): one cabinet card per game in
// games.ts. The cards are ordinary links (so tapping, the back button and
// "open in new tab" all behave); their artwork is small animated canvases
// drawn with the shared palette and pixel font. Arrow keys or a gamepad move
// between cards, Enter / A launches.

import { PAL, drawText, hash } from './gfx'
import { crtToggle, readNumber } from './page'
import { GAMES, step, type ArcadeGame } from './games'

const W = 160
const H = 100
const SCENE_H = 58

const frame = document.getElementById('frame') as HTMLElement
const toggleCrt = crtToggle(frame, 'jawg-arcade-crt')
const list = document.getElementById('cabinets') as HTMLElement

// ── Header ──────────────────────────────────────────────────────────────────
const header = document.getElementById('logo') as HTMLCanvasElement
const hctx = header.getContext('2d')!
function drawHeader(t: number) {
  hctx.fillStyle = PAL[0]
  hctx.fillRect(0, 0, header.width, header.height)
  const x = header.width / 2
  drawText(hctx, 'JAWG', x, 4, PAL[14], 4, 'center')
  drawText(hctx, 'ARCADE', x, 28, Math.floor(t * 2) % 8 === 0 ? PAL[7] : PAL[12], 4, 'center')
  drawText(hctx, 'INSERT COIN', x, 54, Math.floor(t * 2) % 2 ? PAL[10] : PAL[5], 1, 'center')
}

// ── Card artwork ────────────────────────────────────────────────────────────
function platform(g: CanvasRenderingContext2D, t: number) {
  const sky = g.createLinearGradient(0, 0, 0, SCENE_H)
  sky.addColorStop(0, '#29adff')
  sky.addColorStop(1, '#c2e8ff')
  g.fillStyle = sky
  g.fillRect(0, 0, W, SCENE_H)
  const scroll = Math.floor(t * 24)
  // Clouds, floating blocks, ground.
  g.fillStyle = PAL[7]
  for (let i = 0; i < 3; i++) g.fillRect((i * 70 - scroll / 3 + 400) % 200 - 20, 8 + i * 6, 18, 5)
  for (let i = 0; i < 3; i++) {
    const x = (i * 64 - scroll + 640) % 192 - 16
    g.fillStyle = PAL[4]
    g.fillRect(x, 24 + (i % 2) * 6, 24, 6)
    g.fillStyle = PAL[9]
    g.fillRect(x + 1, 25 + (i % 2) * 6, 22, 1)
  }
  for (let x = -(scroll % 8); x < W; x += 8) {
    g.fillStyle = PAL[3]
    g.fillRect(x, SCENE_H - 10, 8, 3)
    g.fillStyle = (x + scroll) % 16 < 8 ? PAL[4] : '#8a4a2a'
    g.fillRect(x, SCENE_H - 7, 8, 7)
  }
  // Pete, hopping.
  const hop = Math.abs(Math.sin(t * 4)) * 14
  const px = 60
  const py = SCENE_H - 10 - 12 - Math.round(hop)
  g.fillStyle = PAL[8]; g.fillRect(px, py, 8, 3)
  g.fillStyle = PAL[15]; g.fillRect(px + 1, py + 3, 6, 3)
  g.fillStyle = PAL[12]; g.fillRect(px, py + 6, 8, 4)
  g.fillStyle = PAL[1]; g.fillRect(px + 1, py + 10, 2, 2); g.fillRect(px + 5, py + 10, 2, 2)
}

function shooter(g: CanvasRenderingContext2D, t: number) {
  g.fillStyle = '#12061e'
  g.fillRect(0, 0, W, SCENE_H)
  for (let i = 0; i < 40; i++) {
    const y = Math.floor((hash(i) * SCENE_H + t * (10 + (i % 3) * 14)) % SCENE_H)
    g.fillStyle = i % 3 ? PAL[5] : PAL[7]
    g.fillRect(Math.floor(hash(i + 99) * W), y, 1, i % 3 ? 1 : 2)
  }
  // Pulsing blobs drifting down.
  for (let i = 0; i < 3; i++) {
    const x = 30 + i * 50 + Math.sin(t * 2 + i) * 8
    const y = ((t * 12 + i * 20) % (SCENE_H + 10)) - 10
    const r = 5 + Math.sin(t * 6 + i) * 1.5
    g.fillStyle = PAL[14]
    g.beginPath(); g.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2); g.fill()
    g.fillStyle = PAL[2]
    g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2)
  }
  // The ship and its shots.
  const sx = Math.round(W / 2 + Math.sin(t * 1.5) * 30)
  const sy = SCENE_H - 12
  g.fillStyle = PAL[11]
  for (let i = 0; i < 4; i++) g.fillRect(sx - 1, sy - ((t * 120 + i * 14) % 50), 2, 4)
  g.fillStyle = PAL[6]
  g.fillRect(sx - 1, sy - 4, 2, 4)
  g.fillRect(sx - 4, sy, 8, 3)
  g.fillRect(sx - 6, sy + 2, 12, 2)
  g.fillStyle = PAL[9]
  if (Math.floor(t * 12) % 2) g.fillRect(sx - 1, sy + 4, 2, 2)
}

function racer(g: CanvasRenderingContext2D, t: number) {
  const hz = 26
  const sky = g.createLinearGradient(0, 0, 0, hz)
  sky.addColorStop(0, '#2a1b4a')
  sky.addColorStop(1, '#ff7a4a')
  g.fillStyle = sky
  g.fillRect(0, 0, W, hz)
  // Striped sun and skyline.
  for (let y = -10; y < 10; y++) {
    if (y > 2 && y % 3 === 0) continue
    const half = Math.sqrt(100 - y * y)
    g.fillStyle = y < -2 ? PAL[10] : y < 5 ? PAL[9] : PAL[8]
    g.fillRect(Math.round(110 - half), hz - 12 + y, Math.round(half * 2), 1)
  }
  g.fillStyle = '#2a1b3a'
  for (let x = 0; x < W; x += 9) g.fillRect(x, hz - 4 - Math.floor(hash(x) * 10), 7, 14)
  g.fillStyle = '#3c5a32'
  g.fillRect(0, hz, W, SCENE_H - hz)
  // The road, with stripes rushing towards you.
  for (let y = hz; y < SCENE_H; y++) {
    const p = (y - hz) / (SCENE_H - hz)
    const half = 6 + p * 70
    const band = Math.floor(1 / (p + 0.05) * 3 - t * 10) % 2
    g.fillStyle = band ? PAL[8] : PAL[7]
    g.fillRect(Math.round(W / 2 - half * 1.12), y, Math.round(half * 2.24), 1)
    g.fillStyle = band ? '#5f574f' : '#58514a'
    g.fillRect(Math.round(W / 2 - half), y, Math.round(half * 2), 1)
    if (band) {
      g.fillStyle = PAL[7]
      g.fillRect(Math.round(W / 2 - half / 3), y, 1, 1)
      g.fillRect(Math.round(W / 2 + half / 3), y, 1, 1)
    }
  }
  // Police car with flashing lights.
  const cx = W / 2 + Math.round(Math.sin(t) * 10)
  g.fillStyle = '#1a1a22'
  g.fillRect(cx - 12, SCENE_H - 10, 24, 8)
  g.fillRect(cx - 8, SCENE_H - 14, 16, 4)
  g.fillStyle = PAL[7]
  g.fillRect(cx - 12, SCENE_H - 6, 24, 1)
  g.fillStyle = PAL[8]
  g.fillRect(cx - 11, SCENE_H - 9, 4, 2); g.fillRect(cx + 7, SCENE_H - 9, 4, 2)
  const flash = Math.floor(t * 6) % 2
  g.fillStyle = flash ? PAL[8] : PAL[2]; g.fillRect(cx - 4, SCENE_H - 16, 4, 2)
  g.fillStyle = flash ? PAL[1] : PAL[12]; g.fillRect(cx, SCENE_H - 16, 4, 2)
}

function missile(g: CanvasRenderingContext2D, t: number) {
  const sky = g.createLinearGradient(0, 0, 0, SCENE_H)
  sky.addColorStop(0, '#05060f')
  sky.addColorStop(1, '#1d2b53')
  g.fillStyle = sky
  g.fillRect(0, 0, W, SCENE_H)
  for (let i = 0; i < 25; i++) {
    g.fillStyle = i % 4 ? PAL[5] : PAL[6]
    g.fillRect(Math.floor(hash(i) * W), Math.floor(hash(i + 50) * 30), 1, 1)
  }
  // Warheads streak down; interceptors rise to meet them in fireballs.
  const cycle = 3
  for (let i = 0; i < 3; i++) {
    const p = ((t + i * 1.1) % cycle) / cycle
    const sx = 20 + i * 55
    const x = sx + p * (i % 2 ? -18 : 18)
    const y = p * (SCENE_H - 12)
    g.strokeStyle = PAL[8]
    g.beginPath(); g.moveTo(sx, 0); g.lineTo(x, y); g.stroke()
    g.fillStyle = PAL[7]
    g.fillRect(Math.round(x), Math.round(y), 1, 1)
    if (p > 0.55 && p < 0.8) {
      const r = Math.sin(((p - 0.55) / 0.25) * Math.PI) * 9
      g.fillStyle = Math.floor(t * 12) % 2 ? PAL[10] : PAL[7]
      g.beginPath(); g.arc(sx + 0.55 * (i % 2 ? -18 : 18), 0.55 * (SCENE_H - 12), r, 0, Math.PI * 2); g.fill()
    }
  }
  // Ground, cities and the centre base.
  g.fillStyle = '#ab5236'
  g.fillRect(0, SCENE_H - 5, W, 5)
  for (const x of [22, 40, 58, 102, 120, 138]) {
    g.fillStyle = PAL[12]
    g.fillRect(x, SCENE_H - 9, 3, 4); g.fillRect(x + 3, SCENE_H - 11, 3, 6); g.fillRect(x + 6, SCENE_H - 8, 3, 3)
  }
  g.fillStyle = PAL[9]
  g.fillRect(W / 2 - 6, SCENE_H - 9, 12, 4)
}

function quest(g: CanvasRenderingContext2D, t: number) {
  // A hero walks a forest path towards a cave, sword ready; a blob waits.
  g.fillStyle = '#4c9a3c'
  g.fillRect(0, 0, W, SCENE_H)
  g.fillStyle = '#d8b77a'
  g.fillRect(0, 30, W, 12)
  for (let i = 0; i < 9; i++) {
    const x = i * 18 + 4
    g.fillStyle = '#5e3a1a'
    g.fillRect(x + 5, 16, 3, 5)
    g.fillStyle = i % 2 ? '#1e5a2a' : '#2f7a36'
    g.fillRect(x, 4, 13, 12)
    g.fillRect(x + 2, 2, 9, 16)
  }
  g.fillStyle = '#8b5a3c'
  g.fillRect(126, 44, 34, 14)
  g.fillStyle = PAL[0]
  g.fillRect(138, 48, 10, 10)
  // The hero, marching left to right.
  const x = Math.floor((t * 22) % 140) - 10
  const step = Math.floor(t * 8) % 2
  g.fillStyle = '#ab5236'
  g.fillRect(x + 2, 28, 6, 3)
  g.fillStyle = '#ffccaa'
  g.fillRect(x + 3, 31, 5, 3)
  g.fillStyle = PAL[9]
  g.fillRect(x + 2, 34, 6, 5)
  g.fillStyle = PAL[5]
  g.fillRect(x + 2 + step, 39, 2, 2)
  g.fillRect(x + 6 - step, 39, 2, 2)
  g.fillStyle = PAL[7]
  g.fillRect(x + 9, 35, 6, 1)
  // A blob bobbing on the path ahead.
  const bx = 96
  const by = 36 + (Math.floor(t * 3) % 2)
  g.fillStyle = PAL[11]
  g.fillRect(bx, by, 8, 5)
  g.fillRect(bx + 1, by - 1, 6, 1)
  g.fillStyle = PAL[7]
  g.fillRect(bx + 2, by + 1, 1, 1)
  g.fillRect(bx + 5, by + 1, 1, 1)
  // Three hearth-flames in the corner.
  for (let i = 0; i < 3; i++) {
    g.fillStyle = Math.floor(t * 6 + i) % 2 ? PAL[9] : PAL[10]
    g.fillRect(6 + i * 7, 46, 3, 4)
    g.fillRect(7 + i * 7, 44, 1, 2)
  }
}

const SCENES = { platform, shooter, racer, missile, quest }

function drawCard(g: CanvasRenderingContext2D, game: ArcadeGame, best: number, t: number) {
  SCENES[game.scene](g, t)
  g.fillStyle = PAL[0]
  g.fillRect(0, SCENE_H, W, H - SCENE_H)
  g.fillStyle = PAL[game.colour]
  g.fillRect(0, SCENE_H, W, 1)
  drawText(g, game.title, W / 2, SCENE_H + 6, PAL[game.colour], 2, 'center')
  drawText(g, game.blurb, W / 2, SCENE_H + 20, PAL[6], 1, 'center')
  drawText(g, best > 0 ? `YOUR BEST ${String(best).padStart(7, '0')}` : 'NOT PLAYED YET', W / 2, SCENE_H + 31, best > 0 ? PAL[9] : PAL[5], 1, 'center')
}

// ── Cabinets ────────────────────────────────────────────────────────────────
const cards = GAMES.map(game => {
  const a = document.createElement('a')
  a.className = 'cabinet'
  a.href = game.path
  const best = readNumber(game.hiscoreKey)
  a.setAttribute('aria-label', `${game.title}: ${game.blurb.toLowerCase()}${best ? `, your best ${best}` : ''}`)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  a.appendChild(c)
  list.appendChild(a)
  return { a, g: c.getContext('2d')!, game, best }
})

// ── Keyboard and gamepad ────────────────────────────────────────────────────
const focused = () => cards.findIndex(c => c.a === document.activeElement)
function move(by: number) {
  const i = focused()
  cards[i < 0 ? 0 : step(i, by)].a.focus()
}

window.addEventListener('keydown', e => {
  if (e.code === 'ArrowRight' || e.code === 'ArrowDown') { move(1); e.preventDefault() }
  else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') { move(-1); e.preventDefault() }
  else if (e.code === 'KeyC') toggleCrt()
})

let padWas = { left: false, right: false, go: false }
function pollPad() {
  for (const pad of navigator.getGamepads?.() ?? []) {
    if (!pad) continue
    const b = (i: number) => pad.buttons[i]?.pressed ?? false
    const [ax = 0, ay = 0] = pad.axes
    const now = {
      left: b(14) || b(12) || ax < -0.5 || ay < -0.5,
      right: b(15) || b(13) || ax > 0.5 || ay > 0.5,
      go: b(0) || b(9),
    }
    if (now.left && !padWas.left) move(-1)
    if (now.right && !padWas.right) move(1)
    if (now.go && !padWas.go) cards[Math.max(0, focused())].a.click()
    padWas = now
    return
  }
}

// ── Loop ────────────────────────────────────────────────────────────────────
function loop(now: number) {
  const t = now / 1000
  drawHeader(t)
  for (const c of cards) drawCard(c.g, c.game, c.best, t)
  pollPad()
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
