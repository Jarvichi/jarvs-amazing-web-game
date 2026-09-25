// ─── /defend — LAST LINE, a missile defence game ────────────────────────────
//
// Served at jawg.uk/defend (defend.html). Like the other arcade pages it is a
// plain canvas, separate from the main game.
//
// This file owns the screens (title → waves → game over), the portrait /
// landscape layout and the fixed-timestep loop. Rules are in world.ts,
// drawing in render.ts, sound in audio.ts.

import {
  CITY_BONUS, AMMO_BONUS, GROUND, MIN_AIM_Y, createWorld, fire, multiplier, startWave, step, type World,
} from './world'
import { Fx, H, PAL, W, centreText, drawCrosshair, drawHud, drawText, renderWorld } from './render'
import { initInput, poll, type Frame } from './input'
import { isMuted, playTitle, sfx, stopMusic, toggleMute, unlock } from './audio'
import { arcadeLink, buildLabel, preventZoom, crtToggle, fitFrame, readNumber, watchForUpdates, write } from '../arcade/page'

const DT = 1 / 60
const PANEL = 70
const HISCORE_KEY = 'jawg-defend-hiscore'
const TALLY_TIME = 3.2
const CROSSHAIR_SPEED = 150

type Screen = 'title' | 'play' | 'gameover'

const canvas = document.getElementById('screen') as HTMLCanvasElement
const frame = document.getElementById('frame') as HTMLDivElement
const ctx = canvas.getContext('2d')!
const toggleCrt = crtToggle(frame, 'jawg-defend-crt')
const fx = new Fx()
const toArcade = arcadeLink()

const game = {
  screen: 'title' as Screen,
  screenTime: 0,
  paused: false,
  world: createWorld(Date.now() & 0xffff) as World,
  hiscore: readNumber(HISCORE_KEY),
  cross: { x: W / 2, y: 180 },
  demoTimer: 0,
}

function go(screen: Screen) {
  toArcade.show(screen === 'title')
  game.screen = screen
  game.screenTime = 0
}

function newGame() {
  game.world = createWorld((Date.now() & 0xffff) + 1)
  game.paused = false
  stopMusic()
  sfx('wave')
  go('play')
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
// Portrait: the playfield alone. Landscape: side panels for score and help.
let wide = false
let scale = 1
function layout() {
  wide = window.innerWidth > window.innerHeight
  canvas.width = wide ? W + PANEL * 2 : W
  canvas.height = H
  ctx.imageSmoothingEnabled = false
  scale = fitFrame(frame, canvas.width, canvas.height)
}
window.addEventListener('resize', layout)
layout()
const ox = () => (wide ? PANEL : 0)

// ── Update ──────────────────────────────────────────────────────────────────
/** Title-screen attract mode: the defences look after themselves. */
function demo(dt: number) {
  const w = game.world
  game.demoTimer -= dt
  if (game.demoTimer <= 0 && w.phase === 'wave') {
    game.demoTimer = 0.7
    const e = [...w.enemies].sort((a, b) => b.y - a.y)[0]
    if (e && e.y > 30) fire(w, e.x + e.vx * 0.7, Math.min(MIN_AIM_Y, e.y + e.vy * 0.7))
  }
  step(w, dt)
  if (w.phase === 'tally' && w.phaseTime > 1) startWave(w, (w.wave % 3) + 1)
  if (w.phase === 'over') game.world = createWorld(Date.now() & 0xffff)
}

function handle(events: ReturnType<typeof step>) {
  for (const e of events) {
    sfx(e.kind)
    if (e.kind === 'cityLost') { fx.flash = 0.35; fx.shake = 0.35 }
    if (e.kind === 'impact') fx.shake = Math.max(fx.shake, 0.15)
  }
}

function update(dt: number, f: Frame, confirm: boolean) {
  game.screenTime += dt
  fx.update(dt)
  const w = game.world

  switch (game.screen) {
    case 'title':
      demo(dt)
      if (confirm && updateReady) location.reload() // picks up the newer deploy
      else if (confirm) newGame()
      break

    case 'play': {
      game.cross.x = Math.max(0, Math.min(W, game.cross.x + f.dx * CROSSHAIR_SPEED * dt))
      game.cross.y = Math.max(20, Math.min(MIN_AIM_Y, game.cross.y + f.dy * CROSSHAIR_SPEED * dt))
      handle(step(w, dt))
      if (w.phase === 'tally' && w.phaseTime > TALLY_TIME) handle(startWave(w, w.wave + 1))
      if (w.phase === 'over' && w.phaseTime > 2.5) {
        saveHiscore(w.score)
        go('gameover')
      }
      break
    }

    case 'gameover':
      if (confirm && game.screenTime > 1.5) {
        game.world = createWorld(Date.now() & 0xffff)
        go('title')
        playTitle()
      }
      break
  }
}

/** Shots happen once per frame, as soon as the press arrives. */
function shoot(f: Frame) {
  if (game.screen !== 'play' || game.paused) return
  const w = game.world
  for (const tap of f.taps) {
    const x = tap.x / scale - ox()
    const y = tap.y / scale
    if (x < 0 || x > W) continue // taps on the side panels
    fx.mark = { x, y: Math.min(y, MIN_AIM_Y), t: 0.6 }
    sfx(fire(w, x, y).kind)
  }
  for (const base of f.shots) {
    sfx(fire(w, game.cross.x, game.cross.y, base < 0 ? undefined : base).kind)
  }
}

// ── Draw ────────────────────────────────────────────────────────────────────
const blink = (period = 0.5) => Math.floor(performance.now() / 1000 / period) % 2 === 0
const touchUi = () => matchMedia?.('(pointer: coarse)').matches ?? false

function dim(alpha: number) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`
  ctx.fillRect(ox(), 0, W, H)
}

function drawPanels() {
  if (!wide) return
  const w = game.world
  ctx.fillStyle = PAL[0]
  ctx.fillRect(0, 0, PANEL, H)
  ctx.fillRect(PANEL + W, 0, PANEL, H)
  const L = 6
  drawText(ctx, 'SCORE', L, 10, PAL[12])
  drawText(ctx, String(w.score).padStart(6, '0'), L, 18, PAL[7])
  drawText(ctx, 'HI-SCORE', L, 34, PAL[12])
  drawText(ctx, String(game.hiscore).padStart(6, '0'), L, 42, PAL[9])
  if (game.screen === 'play') {
    drawText(ctx, `WAVE ${w.wave}`, L, 60, PAL[7])
    drawText(ctx, `POINTS X${multiplier(w.wave)}`, L, 70, PAL[10])
    drawText(ctx, `CITIES ${w.cities.filter(c => c.alive).length}`, L, 80, PAL[12])
  }
  const R = PANEL + W + 6
  drawText(ctx, 'CONTROLS', R, 10, PAL[13])
  const help = touchUi()
    ? [['TAP THE', ''], ['SKY TO', ''], ['FIRE', '']]
    : [['CLICK', 'FIRE'], ['ARROWS', 'AIM'], ['SPACE', 'FIRE'], ['A S D', 'BASE'], ['P', 'PAUSE'], ['M', 'MUTE'], ['C', 'CRT']]
  help.forEach(([a, b], i) => {
    drawText(ctx, a, R, 26 + i * 11, PAL[7])
    if (b) drawText(ctx, b, R + 36, 26 + i * 11, PAL[6])
  })
}

function drawTitle(t: number) {
  renderWorld(ctx, game.world, fx, t, ox())
  dim(0.45)
  const cx = ox() + W / 2
  centreText(ctx, 'LAST', cx, 40, PAL[8], 5)
  centreText(ctx, 'LINE', cx, 70, PAL[12], 5)
  centreText(ctx, 'HOLD THE SKY. SAVE THE CITIES.', cx, 104, PAL[7])
  if (blink() && !updateReady) centreText(ctx, touchUi() ? 'TAP TO START' : 'CLICK OR PRESS ENTER', cx, 140, PAL[10])
  centreText(ctx, touchUi() ? 'TAP THE SKY TO FIRE' : 'CLICK THE SKY TO FIRE', cx, 162, PAL[6])
  centreText(ctx, 'EACH MISSILE BURSTS', cx, 172, PAL[6])
  centreText(ctx, 'WHERE YOU AIMED', cx, 182, PAL[6])
  centreText(ctx, `HI-SCORE ${String(game.hiscore).padStart(6, '0')}`, cx, 214, PAL[9])
  centreText(ctx, BUILD, cx, H - 10, PAL[5])
  if (updateReady) {
    ctx.fillStyle = PAL[1]
    ctx.fillRect(ox() + 8, 132, W - 16, 26)
    centreText(ctx, 'NEW VERSION AVAILABLE!', cx, 137, PAL[11])
    if (blink()) centreText(ctx, touchUi() ? 'TAP TO UPDATE' : 'CLICK TO UPDATE', cx, 148, PAL[7])
  }
}

function drawPlay(t: number) {
  const w = game.world
  renderWorld(ctx, w, fx, t, ox())
  drawHud(ctx, w, game.hiscore, ox())
  if (!touchUi()) drawCrosshair(ctx, game.cross.x, game.cross.y, ox(), t)
  const cx = ox() + W / 2
  if (w.phase === 'wave' && w.phaseTime < 2) {
    centreText(ctx, `WAVE ${w.wave}`, cx, 110, PAL[7], 2)
    centreText(ctx, `${multiplier(w.wave)} X POINTS`, cx, 128, PAL[10])
    if (w.wave === 1) centreText(ctx, 'DEFEND THE CITIES', cx, 140, PAL[6])
  }
  if (w.phase === 'tally') {
    const m = multiplier(w.wave)
    const shown = Math.min(1, w.phaseTime / 1.5)
    dim(0.35)
    centreText(ctx, 'WAVE CLEARED', cx, 90, PAL[11], 2)
    centreText(ctx, `CITIES   ${Math.round(w.tally.cities * shown)} X ${CITY_BONUS * m}`, cx, 116, PAL[12])
    centreText(ctx, `MISSILES ${Math.round(w.tally.ammo * shown)} X ${AMMO_BONUS * m}`, cx, 128, PAL[7])
    centreText(ctx, `BONUS ${Math.round(w.tally.points * shown)}`, cx, 144, PAL[10])
    if (w.spareCities > 0 && w.cities.some(c => !c.alive)) centreText(ctx, 'BONUS CITY!', cx, 160, PAL[14])
  }
  if (w.phase === 'over') {
    centreText(ctx, 'THE END', cx, 120, PAL[8], 3)
  }
  if (game.paused) {
    dim(0.6)
    centreText(ctx, 'PAUSED', cx, 130, PAL[7], 2)
    if (blink()) centreText(ctx, 'PRESS P OR TAP TO RESUME', cx, 150, PAL[6])
  }
}

function drawGameOver(t: number) {
  renderWorld(ctx, game.world, fx, t, ox())
  dim(0.65)
  const cx = ox() + W / 2
  const w = game.world
  centreText(ctx, 'THE CITIES', cx, 80, PAL[8], 2)
  centreText(ctx, 'HAVE FALLEN', cx, 98, PAL[8], 2)
  centreText(ctx, `YOU HELD OUT ${w.wave} WAVES`, cx, 130, PAL[7])
  centreText(ctx, `SCORE ${w.score}`, cx, 146, PAL[10])
  centreText(ctx, `HI-SCORE ${game.hiscore}`, cx, 158, PAL[9])
  if (w.score >= game.hiscore && w.score > 0) centreText(ctx, 'NEW HI-SCORE!', cx, 174, PAL[14])
  if (game.screenTime > 1.5 && blink()) centreText(ctx, touchUi() ? 'TAP TO CONTINUE' : 'PRESS ENTER', cx, 210, PAL[6])
}

function draw() {
  const t = performance.now() / 1000
  ctx.fillStyle = PAL[0]
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  switch (game.screen) {
    case 'title': drawTitle(t); break
    case 'play': drawPlay(t); break
    case 'gameover': drawGameOver(t); break
  }
  drawPanels()
  if (isMuted()) drawText(ctx, 'MUTE', canvas.width - 3, H - 8, PAL[5], 1, 'right')
}

// ── Loop ────────────────────────────────────────────────────────────────────
let last = performance.now()
let acc = 0

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
    f.taps = [] // the tap that resumes doesn't also fire
  }
  shoot(f)

  // Menus accept a tap as "go"; in play a tap is a shot.
  let confirm = f.confirm || (tapped && !playing)
  while (acc >= DT) {
    if (!game.paused) update(DT, f, confirm)
    confirm = false
    acc -= DT
  }
  draw()
  requestAnimationFrame(loop)
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.screen === 'play' && !game.paused) game.paused = true
})

// iOS ignores user-scalable=no: without this a double-tap zooms in for good.
preventZoom()
initInput(canvas, () => { unlock(); if (game.screen === 'title') playTitle() })
toArcade.show(true)
requestAnimationFrame(loop)

// Dev-server only (stripped from production builds): lets a browser session
// jump to a wave or screen when checking visuals.
if (import.meta.env.DEV) {
  Object.assign(window, { __defend: { game, go, newGame, startWave, GROUND } })
}
