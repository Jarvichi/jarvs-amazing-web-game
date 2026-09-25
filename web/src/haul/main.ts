// ─── /haul — MIDNIGHT HAUL, a trick-or-treat maze game ──────────────────────
//
// Served at jawg.uk/haul (haul.html). Like the other arcade pages it is a
// plain canvas, separate from the main game.
//
// This file owns the screens (title → choose → how to play → streets → game
// over), the portrait / landscape layout and the fixed-timestep loop. Rules
// are in world.ts, drawing in render.ts, sound in audio.ts.

import { BAG, CLEARED_TIME, HEROES, bankPoints, createWorld, startStreet, step, steer, type GameEvent, type Hero, type World } from './world'
import { TILE } from './maze'
import {
  Fx, HUD, MAZE_H, MAZE_W, PAL, centreText, drawFog, drawHero, drawHud, drawStatus, drawStreet, drawText, drawWalkers,
} from './render'
import { sprites } from './sprites'
import { initInput, poll } from './input'
import { isMuted, playLantern, playTitle, sfx, stopMusic, toggleMute, unlock } from './audio'
import { arcadeLink, buildLabel, crtToggle, fitFrame, preventZoom, readNumber, watchForUpdates, write } from '../arcade/page'

const DT = 1 / 60
const PANEL = 72
const STATUS = 46
const HISCORE_KEY = 'jawg-haul-hiscore'
const HERO_KEY = 'jawg-haul-hero'
const HOWTO_TIME = 8

type Screen = 'title' | 'select' | 'howto' | 'play' | 'gameover'

const canvas = document.getElementById('screen') as HTMLCanvasElement
const frame = document.getElementById('frame') as HTMLDivElement
const ctx = canvas.getContext('2d')!
const toggleCrt = crtToggle(frame, 'jawg-haul-crt')
const fx = new Fx()
const toArcade = arcadeLink()
preventZoom()

const savedHero = (() => {
  try { return localStorage.getItem(HERO_KEY) } catch { return null }
})()

const game = {
  screen: 'title' as Screen,
  screenTime: 0,
  paused: false,
  hero: (HEROES.includes(savedHero as Hero) ? savedHero : 'witch') as Hero,
  world: createWorld(1) as World,
  hiscore: readNumber(HISCORE_KEY),
}

function go(screen: Screen) {
  toArcade.show(screen === 'title')
  game.screen = screen
  game.screenTime = 0
}

function newGame(hero: Hero) {
  game.hero = hero
  write(HERO_KEY, hero)
  game.world = createWorld(Date.now() & 0xffff, hero)
  game.paused = false
  fx.pops = []
  stopMusic()
  sfx('start')
  go('howto')
}

function saveHiscore(score: number) {
  if (score > game.hiscore) {
    game.hiscore = score
    write(HISCORE_KEY, String(score))
  }
}

// ── Version ─────────────────────────────────────────────────────────────────
const BUILD = buildLabel(import.meta.env.VITE_GIT_SHA, __BUILD_DATE__)
let updateReady = false
watchForUpdates(() => { updateReady = true })

// ── Layout ──────────────────────────────────────────────────────────────────
// Portrait: the street with your bag underneath. Landscape: side panels.
let wide = false
let scale = 1
function layout() {
  wide = window.innerWidth > window.innerHeight
  canvas.width = wide ? MAZE_W + PANEL * 2 : MAZE_W
  canvas.height = wide ? HUD + MAZE_H : HUD + MAZE_H + STATUS
  ctx.imageSmoothingEnabled = false
  scale = fitFrame(frame, canvas.width, canvas.height)
}
window.addEventListener('resize', layout)
layout()
const ox = () => (wide ? PANEL : 0)
const oy = HUD

// ── Update ──────────────────────────────────────────────────────────────────

function handle(events: GameEvent[]) {
  const w = game.world
  for (const e of events) {
    sfx(e.kind)
    const px = e.x !== undefined ? e.x * TILE + 4 : 0
    const py = e.y !== undefined ? e.y * TILE - 2 : 0
    switch (e.kind) {
      case 'knock': fx.pop(px, py, `+${e.points}`, PAL[10]); break
      case 'full': fx.pop(px, py, 'FULL!', PAL[8]); break
      case 'bank': fx.pop(px, py, String(e.points), PAL[11]); fx.flash = 0.15; break
      case 'eat': fx.pop(px, py, String(e.points), PAL[12]); break
      case 'lantern': playLantern(); break
      case 'lanternEnd': case 'cleared': stopMusic(); break
      case 'caught': stopMusic(); fx.shake = 0.4; break
      case 'midnight': fx.flash = 0.5; fx.shake = 0.3; break
      case 'extra': fx.pop(w.player.x * TILE, w.player.y * TILE - 6, '1UP', PAL[14]); break
    }
  }
}

function update(dt: number, confirm: boolean) {
  game.screenTime += dt
  fx.update(dt)

  switch (game.screen) {
    case 'title':
      if (confirm && updateReady) location.reload() // picks up the newer deploy
      else if (confirm) { sfx('select'); go('select') }
      break

    case 'select':
      if (confirm && game.screenTime > 0.3) newGame(game.hero)
      break

    case 'howto':
      if ((confirm && game.screenTime > 0.4) || game.screenTime > HOWTO_TIME) {
        go('play')
        handle([{ kind: 'ready' }])
      }
      break

    case 'play': {
      const w = game.world
      handle(step(w, dt))
      if (w.phase === 'cleared' && w.phaseTime > CLEARED_TIME) handle(startStreet(w, w.street + 1))
      if (w.phase === 'over' && w.phaseTime > 2.5) {
        saveHiscore(w.score)
        go('gameover')
      }
      break
    }

    case 'gameover':
      if (confirm && game.screenTime > 1.5) {
        go('title')
        playTitle()
      }
      break
  }
}

/** Which hero card a tap on the choose screen landed on (or -1). */
function cardAt(tap: { x: number; y: number }): number {
  const x = tap.x / scale
  const y = tap.y / scale
  if (y < 40 || y > 170) return -1
  const cw = canvas.width / 3
  return Math.max(0, Math.min(2, Math.floor(x / cw)))
}

// ── Draw ────────────────────────────────────────────────────────────────────
const blink = (period = 0.5) => Math.floor(performance.now() / 1000 / period) % 2 === 0
const touchUi = () => matchMedia?.('(pointer: coarse)').matches ?? false

function dim(alpha: number) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

function drawBigSprite(img: CanvasImageSource, x: number, y: number, s: number, flip = false) {
  const w = 10 * s
  ctx.save()
  if (flip) {
    ctx.translate(x + w, y)
    ctx.scale(-1, 1)
    ctx.drawImage(img, 0, 0, w, w)
  } else ctx.drawImage(img, x, y, w, w)
  ctx.restore()
}

function drawNight(t: number) {
  const W = canvas.width
  const H = canvas.height
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#05030f')
  grad.addColorStop(1, '#2a0f3a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < 40; i++) {
    const sx = (i * 97) % W
    const sy = (i * 53) % (H * 0.6)
    ctx.fillStyle = (i + Math.floor(t * 2)) % 7 === 0 ? PAL[6] : PAL[5]
    ctx.fillRect(sx, sy, 1, 1)
  }
  // The moon.
  const mx = W - 34
  ctx.fillStyle = '#f4ecd0'
  ctx.beginPath()
  ctx.arc(mx, 30, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.fillRect(mx - 6, 24, 4, 3)
  ctx.fillRect(mx + 3, 33, 5, 3)
  // Rooftops and a church spire along the bottom.
  const base = H - 30
  ctx.fillStyle = '#0a0612'
  for (let x = 0; x < W; x += 24) {
    const h = 10 + ((x * 7) % 13)
    ctx.fillRect(x, base - h, 20, h + 30)
    ctx.beginPath()
    ctx.moveTo(x - 2, base - h)
    ctx.lineTo(x + 10, base - h - 8)
    ctx.lineTo(x + 22, base - h)
    ctx.fill()
    if ((x / 24) % 3 === 1) {
      ctx.fillStyle = Math.sin(t * 3 + x) > -0.7 ? PAL[9] : '#402000'
      ctx.fillRect(x + 7, base - h + 4, 3, 3)
      ctx.fillStyle = '#0a0612'
    }
  }
}

function drawTitle(t: number) {
  drawNight(t)
  const W = canvas.width
  const H = canvas.height
  const cx = W / 2
  centreText(ctx, 'MIDNIGHT', cx, 52, PAL[9], 4)
  centreText(ctx, 'HAUL', cx, 76, PAL[10], 5)
  centreText(ctx, 'KNOCK. GRAB. RUN HOME.', cx, 110, PAL[7])
  // A witch, a caped hero and a salaryman, chased across the rooftops.
  const art = sprites()
  const run = ((t * 34) % (W + 120)) - 60
  const f = Math.floor(t * 8) % 2
  HEROES.forEach((h, i) => drawHero(ctx, h, run - i * 14, H - 42, false, f))
  ctx.globalAlpha = 0.8
  ctx.drawImage(art.ghouls.ghost[f], run - 64, H - 44 + Math.round(Math.sin(t * 5) * 2))
  ctx.globalAlpha = 1
  ctx.drawImage(art.ghouls.bat[f], run - 84, H - 54 + Math.round(Math.sin(t * 7) * 3))
  if (blink() && !updateReady) centreText(ctx, touchUi() ? 'TAP TO START' : 'PRESS ENTER', cx, 132, PAL[11])
  centreText(ctx, `HI-SCORE ${String(game.hiscore).padStart(6, '0')}`, cx, 150, PAL[13])
  centreText(ctx, BUILD, cx, H - 8, PAL[5])
  if (updateReady) {
    ctx.fillStyle = PAL[1]
    ctx.fillRect(8, 124, W - 16, 24)
    centreText(ctx, 'NEW VERSION AVAILABLE!', cx, 128, PAL[11])
    if (blink()) centreText(ctx, touchUi() ? 'TAP TO UPDATE' : 'CLICK TO UPDATE', cx, 138, PAL[7])
  }
}

const HERO_INFO: Record<Hero, { name: string; perk: string[]; colour: number }> = {
  witch: { name: 'WITCH', perk: ['LANTERNS', 'BURN TWICE', 'AS LONG'], colour: 13 },
  hero: { name: 'HERO', perk: ['RUNS', 'FASTER'], colour: 10 },
  salaryman: { name: 'SALARYMAN', perk: ['DOUBLE PAY', 'AFTER', 'MIDNIGHT'], colour: 15 },
}

function drawSelect(t: number) {
  drawNight(t)
  const W = canvas.width
  const cx = W / 2
  centreText(ctx, 'WHO IS GOING', cx, 12, PAL[7], 2)
  centreText(ctx, 'TRICK-OR-TREATING?', cx, 26, PAL[9])
  const cw = W / 3
  const art = sprites()
  HEROES.forEach((h, i) => {
    const info = HERO_INFO[h]
    const x = i * cw
    const on = game.hero === h
    ctx.fillStyle = on ? 'rgba(255,163,0,0.22)' : 'rgba(0,0,0,0.35)'
    ctx.fillRect(x + 2, 42, cw - 4, 126)
    if (on) {
      ctx.strokeStyle = PAL[9]
      ctx.strokeRect(x + 2.5, 42.5, cw - 5, 125)
    }
    const s = 4
    const bob = on ? Math.round(Math.sin(t * 6) * 1.5) : 0
    drawBigSprite(art.heroes[h][on ? Math.floor(t * 6) % 2 : 0], x + cw / 2 - 5 * s, 52 + bob, s)
    centreText(ctx, info.name, x + cw / 2, 102, PAL[info.colour])
    info.perk.forEach((line, j) => centreText(ctx, line, x + cw / 2, 116 + j * 8, PAL[6]))
  })
  if (blink()) centreText(ctx, touchUi() ? 'TAP ONE TO PLAY' : 'ARROWS TO CHOOSE, ENTER TO PLAY', cx, 180, PAL[11])
}

function drawHowto(t: number) {
  drawNight(t)
  const cx = canvas.width / 2
  const art = sprites()
  centreText(ctx, 'HOW TO HAUL', cx, 16, PAL[9], 2)
  const rows: [() => void, string, string][] = [
    [() => { ctx.fillStyle = PAL[9]; ctx.fillRect(10, 44, 4, 6) }, 'KNOCK ON LIT DOORS', `FOR SWEETS. BAG HOLDS ${BAG}`],
    [() => { ctx.fillStyle = PAL[11]; ctx.fillRect(10, 68, 4, 6) }, 'BANK THEM AT YOUR', 'GREEN DOOR. FULLER = MORE'],
    [() => ctx.drawImage(art.ghouls.zombie[0], 7, 88), 'GHOULS SPILL YOUR BAG', 'AND COST A LIFE'],
    [() => ctx.drawImage(art.lantern, 8, 114), 'LANTERNS TURN THEM', 'SO YOU CAN SCARE THEM'],
  ]
  rows.forEach(([icon, a, b], i) => {
    icon()
    drawText(ctx, a, 24, 42 + i * 24, PAL[7])
    drawText(ctx, b, 24, 50 + i * 24, PAL[6])
  })
  centreText(ctx, `FULL BAG = ${bankPoints(BAG)} POINTS`, cx, 146, PAL[10])
  centreText(ctx, 'BEAT THE MIDNIGHT BELL', cx, 156, PAL[14])
  centreText(ctx, touchUi() ? 'SWIPE ANYWHERE TO WALK' : 'ARROW KEYS TO WALK', cx, 170, PAL[12])
  if (blink() && game.screenTime > 0.4) centreText(ctx, touchUi() ? 'TAP TO GO' : 'PRESS ENTER', cx, 186, PAL[11])
}

function drawPlay(t: number) {
  const w = game.world
  const shake = fx.shake > 0 ? Math.round(Math.sin(t * 90) * 2) : 0
  const x0 = ox() + shake
  ctx.save()
  ctx.beginPath()
  ctx.rect(ox(), oy, MAZE_W, MAZE_H)
  ctx.clip()
  drawStreet(ctx, w, x0, oy, t)
  drawWalkers(ctx, w, x0, oy, t)
  drawFog(ctx, w, x0, oy, t)
  for (const p of fx.pops) {
    centreText(ctx, p.text, x0 + p.x, oy + p.y - (1 - p.t) * 10, p.colour)
  }
  if (fx.flash > 0) {
    ctx.fillStyle = w.midnight ? `rgba(255,0,77,${fx.flash * 0.5})` : `rgba(255,255,255,${fx.flash})`
    ctx.fillRect(ox(), oy, MAZE_W, MAZE_H)
  }
  ctx.restore()
  drawHud(ctx, w, game.hiscore, ox(), MAZE_W, t)

  const cx = ox() + MAZE_W / 2
  const cy = oy + MAZE_H / 2
  const banner = (y: number, h: number) => {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.fillRect(ox(), y, MAZE_W, h)
  }
  if (w.phase === 'ready') {
    banner(cy - 22, 36)
    centreText(ctx, `STREET ${w.street}`, cx, cy - 18, PAL[6])
    centreText(ctx, w.def.name, cx, cy - 10, PAL[9], 1)
    if (blink(0.25)) centreText(ctx, 'READY!', cx, cy, PAL[10], 2)
  }
  if (w.midnight && w.phase === 'play' && w.clock === 0 && fx.flash > 0) {
    centreText(ctx, 'MIDNIGHT!', cx, cy - 6, PAL[8], 2)
  }
  if (w.phase === 'cleared') {
    banner(cy - 26, 50)
    centreText(ctx, 'STREET CLEARED!', cx, cy - 20, PAL[11], 1)
    centreText(ctx, w.tally.points > 0 ? `TIME BONUS ${w.tally.points}` : 'NO TIME BONUS', cx, cy - 6, PAL[10])
    centreText(ctx, 'ON TO', cx, cy + 6, PAL[6])
    centreText(ctx, (w.street < 99 ? `STREET ${w.street + 1}` : ''), cx, cy + 14, PAL[7])
  }
  if (w.phase === 'over') {
    banner(cy - 12, 26)
    centreText(ctx, 'LIGHTS OUT', cx, cy - 6, PAL[8], 2)
  }
  if (game.paused) {
    banner(cy - 16, 32)
    centreText(ctx, 'PAUSED', cx, cy - 10, PAL[7], 2)
    if (blink()) centreText(ctx, touchUi() ? 'TAP TO RESUME' : 'PRESS P TO RESUME', cx, cy + 6, PAL[6])
  }

  if (wide) drawPanels(t)
  else {
    ctx.fillStyle = PAL[0]
    ctx.fillRect(0, oy + MAZE_H, MAZE_W, STATUS)
    drawStatus(ctx, w, 4, oy + MAZE_H + 4, MAZE_W - 8, t)
  }
}

function drawPanels(t: number) {
  const w = game.world
  const H = canvas.height
  ctx.fillStyle = PAL[0]
  ctx.fillRect(0, 0, PANEL, H)
  ctx.fillRect(PANEL + MAZE_W, 0, PANEL, H)
  const L = 4
  drawText(ctx, `STREET ${w.street}`, L, 6, PAL[6])
  drawText(ctx, w.def.name, L, 14, PAL[9])
  drawStatus(ctx, w, L, 32, PANEL - 8, t)
  const R = PANEL + MAZE_W + 5
  drawText(ctx, 'CONTROLS', R, 6, PAL[13])
  const help = touchUi()
    ? ['SWIPE', 'ANYWHERE', 'TO WALK']
    : ['ARROWS WALK', 'P  PAUSE', 'M  MUTE', 'C  CRT']
  help.forEach((line, i) => drawText(ctx, line, R, 20 + i * 9, PAL[7]))
  drawText(ctx, 'GREEN DOOR', R, 70, PAL[11])
  drawText(ctx, 'IS HOME', R, 78, PAL[6])
}

function drawGameOver(t: number) {
  drawNight(t)
  const cx = canvas.width / 2
  const w = game.world
  centreText(ctx, 'THE NIGHT', cx, 40, PAL[9], 2)
  centreText(ctx, 'IS OVER', cx, 58, PAL[9], 2)
  drawBigSprite(sprites().heroes[w.hero][0], cx - 15, 78, 3)
  centreText(ctx, `${w.haul} SWEETS BANKED`, cx, 114, PAL[10])
  centreText(ctx, `REACHED STREET ${w.street}`, cx, 124, PAL[6])
  centreText(ctx, `SCORE ${w.score}`, cx, 138, PAL[7])
  centreText(ctx, `HI-SCORE ${game.hiscore}`, cx, 148, PAL[13])
  if (w.score >= game.hiscore && w.score > 0) centreText(ctx, 'NEW HI-SCORE!', cx, 160, blink(0.2) ? PAL[14] : PAL[10])
  if (game.screenTime > 1.5 && blink()) centreText(ctx, touchUi() ? 'TAP TO CONTINUE' : 'PRESS ENTER', cx, 176, PAL[11])
}

function draw() {
  const t = performance.now() / 1000
  ctx.fillStyle = PAL[0]
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  switch (game.screen) {
    case 'title': drawTitle(t); break
    case 'select': drawSelect(t); break
    case 'howto': drawHowto(t); break
    case 'play': drawPlay(t); break
    case 'gameover': drawGameOver(t); break
  }
  if (isMuted()) drawText(ctx, 'MUTE', canvas.width - 3, canvas.height - 8, PAL[5], 1, 'right')
}

// ── Loop ────────────────────────────────────────────────────────────────────
let last = performance.now()
let acc = 0
/** A press that arrived on a frame with no update step (120 Hz screens) waits for the next. */
let pendingConfirm = false

function loop(now: number) {
  acc += Math.min(0.25, (now - last) / 1000)
  last = now

  const f = poll()
  if (f.mute) toggleMute()
  if (f.crt) toggleCrt()
  const playing = game.screen === 'play'
  const tapped = f.taps.length > 0
  if (playing && (f.pause || (game.paused && (f.confirm || tapped)))) {
    game.paused = !game.paused
    sfx('pause')
    f.taps = []
  }
  // On the choose screen a tap picks that hero and starts.
  if (game.screen === 'select' && tapped && game.screenTime > 0.3) {
    const i = cardAt(f.taps[0])
    if (i >= 0) newGame(HEROES[i])
    f.taps = []
  }

  // Steering and menu moves act at once; the walker keeps the turn it was given.
  if (playing && !game.paused) steer(game.world, f.dir)
  if (game.screen === 'select' && (f.left || f.right)) {
    const i = HEROES.indexOf(game.hero)
    game.hero = HEROES[(i + (f.left ? -1 : 1) + HEROES.length) % HEROES.length]
    sfx('select')
  }

  pendingConfirm ||= f.confirm || (f.taps.length > 0 && !playing)
  while (acc >= DT) {
    if (!game.paused) update(DT, pendingConfirm)
    pendingConfirm = false
    acc -= DT
  }
  draw()
  requestAnimationFrame(loop)
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.screen === 'play' && !game.paused) game.paused = true
})

initInput(canvas, () => { unlock(); if (game.screen === 'title') playTitle() })
toArcade.show(true)
requestAnimationFrame(loop)

// Dev-server only (stripped from production builds): lets a browser session
// jump to a street or screen when checking visuals.
if (import.meta.env.DEV) {
  Object.assign(window, { __haul: { game, go, newGame, startStreet } })
}
