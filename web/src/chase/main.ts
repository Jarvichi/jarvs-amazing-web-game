// ─── /chase — Pursuit 84, a pseudo-3D police chase ──────────────────────────
//
// Served at jawg.uk/chase (chase.html). Like the other arcade pages it is a
// plain canvas, separate from the main game: no React/Firebase/PixiJS.
//
// This file owns the screen flow (title → briefing → case → … → victory /
// game over), window fitting and the fixed-timestep loop. Rules live in the
// pure modules (world.ts and friends), drawing in render.ts, sound in audio.ts.

import { MAX_SPEED } from './car'
import { CASES } from './tracks'
import { stepTraffic } from './traffic'
import { CHECKPOINT_BONUS, createWorld, step, type World } from './world'
import { Fx, H, PAL, W, centreText, drawHud, drawText, renderWorld } from './render'
import { sprites } from './sprites'
import { initInput, poll, type Frame } from './input'
import {
  isMuted, playArrest, playBrief, playPursuit, sfx, stopMusic, toggleMute, unlock, updateEngine,
} from './audio'
import { arcadeLink, buildLabel, crtToggle, fitFrame, preventZoom, readNumber, watchForUpdates, write } from '../arcade/page'

const DT = 1 / 60
const HISCORE_KEY = 'jawg-chase-hiscore'
const CRT_KEY = 'jawg-chase-crt'
const MAX_CONTINUES = 3
const CONTINUE_SECONDS = 10

type Screen = 'title' | 'brief' | 'play' | 'continue' | 'gameover' | 'victory'

const canvas = document.getElementById('screen') as HTMLCanvasElement
const frame = document.getElementById('frame') as HTMLDivElement
const ctx = canvas.getContext('2d')!
const toggleCrt = crtToggle(frame, CRT_KEY)
const fx = new Fx()

const game = {
  screen: 'title' as Screen,
  screenTime: 0,
  paused: false,
  caseIdx: 0,
  /** Score when the current case began, restored on a continue. */
  caseScore: 0,
  continues: MAX_CONTINUES,
  world: createWorld(0) as World,
  hiscore: readNumber(HISCORE_KEY),
  steer: 0,
  /** A turbo press waiting for the next physics tick. */
  turboLatched: false,
}

const toArcade = arcadeLink()
preventZoom()

function go(screen: Screen) {
  toArcade.show(screen === 'title')
  game.screen = screen
  game.screenTime = 0
}

function brief(idx: number, score: number) {
  game.caseIdx = idx
  game.caseScore = score
  game.world = createWorld(idx, score, (Date.now() & 0xffff) + 1)
  fx.clear()
  go('brief')
  playBrief()
}

function startCase() {
  const w = game.world
  game.world = createWorld(w.caseIdx, game.caseScore, (Date.now() & 0xffff) + 1)
  fx.clear()
  stopMusic()
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
canvas.width = W
canvas.height = H
ctx.imageSmoothingEnabled = false
function layout() {
  fitFrame(frame, W, H)
}
window.addEventListener('resize', layout)
layout()

// ── Update ──────────────────────────────────────────────────────────────────
/** Title-screen attract mode: cruise down the first case's road. */
function demo(dt: number) {
  const w = game.world
  w.player.speed = MAX_SPEED * 0.6
  w.player.z += w.player.speed * dt
  w.player.x *= 0.98
  stepTraffic(w.traffic, w.track, w.player.z, dt, w.rnd)
}

function update(dt: number, f: Frame, confirm: boolean) {
  game.screenTime += dt
  const w = game.world
  fx.update(dt, w)

  switch (game.screen) {
    case 'title':
      demo(dt)
      if (confirm && updateReady) {
        location.reload() // picks up the newer deploy (the page isn't service-worker cached)
      } else if (confirm) {
        sfx('start')
        game.continues = MAX_CONTINUES
        brief(0, 0)
      }
      break

    case 'brief':
      if (confirm && game.screenTime > 0.5) {
        sfx('start')
        startCase()
      }
      break

    case 'play': {
      const events = step(w, {
        steer: f.steer, gas: f.gas, brake: f.brake, turbo: game.turboLatched,
      }, dt)
      game.turboLatched = false
      fx.handle(events)
      for (const e of events) {
        sfx(e.kind)
        if (e.kind === 'go') playPursuit()
        if (e.kind === 'arrest') playArrest()
        if (e.kind === 'caught' || e.kind === 'escaped') stopMusic()
      }
      if (w.phase === 'caught' && w.phaseTime > 4.5) {
        saveHiscore(w.score)
        if (w.caseIdx + 1 < CASES.length) brief(w.caseIdx + 1, w.score)
        else { go('victory'); sfx('caught') }
      } else if (w.phase === 'escaped' && w.phaseTime > 3) {
        saveHiscore(w.score)
        go(game.continues > 0 ? 'continue' : 'gameover')
      }
      break
    }

    case 'continue': {
      const before = Math.floor(game.screenTime - dt)
      if (Math.floor(game.screenTime) !== before && game.screenTime < CONTINUE_SECONDS) sfx('tick')
      if (confirm && game.screenTime > 0.5) {
        game.continues--
        sfx('start')
        startCase()
      } else if (game.screenTime >= CONTINUE_SECONDS) {
        go('gameover')
      }
      break
    }

    case 'gameover':
    case 'victory':
      demo(dt)
      if (confirm && game.screenTime > 1.5) {
        game.world = createWorld(0)
        go('title')
        playBrief()
      }
      break
  }
}

// ── Draw ────────────────────────────────────────────────────────────────────
const blink = (period = 0.5) => Math.floor(performance.now() / 1000 / period) % 2 === 0

function dim(alpha = 0.55) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`
  ctx.fillRect(0, 0, W, H)
}

const touchUi = () => document.getElementById('touch')?.classList.contains('on') ?? false

function drawTitle(t: number) {
  renderWorld(ctx, game.world, fx, t, 0, false)
  dim(0.35)
  centreText(ctx, 'PURSUIT', W / 2, 20, PAL[8], 5)
  centreText(ctx, '84', W / 2, 50, PAL[12], 5)
  centreText(ctx, 'INTERCEPT UNIT - FIVE CASES, ONE CAR', W / 2, 80, PAL[7])
  if (blink() && !updateReady) centreText(ctx, touchUi() ? 'TAP TO START' : 'PRESS ENTER TO START', W / 2, 100, PAL[10])
  if (touchUi()) {
    centreText(ctx, 'IT ACCELERATES BY ITSELF', W / 2, 116, PAL[6])
    centreText(ctx, 'LEFT PAD STEERS - BRAKE AND TURBO ON THE RIGHT', W / 2, 124, PAL[6])
  } else {
    centreText(ctx, 'ARROWS STEER   UP/Z GAS   DOWN/X BRAKE', W / 2, 116, PAL[6])
    centreText(ctx, 'SPACE TURBO   P PAUSE   M MUTE   C CRT', W / 2, 124, PAL[6])
  }
  centreText(ctx, `HI-SCORE ${String(game.hiscore).padStart(7, '0')}`, W / 2, 144, PAL[9])
  centreText(ctx, BUILD, W / 2, 170, PAL[5])
  if (updateReady) {
    ctx.fillStyle = PAL[1]
    ctx.fillRect(40, 96, W - 80, 26)
    centreText(ctx, 'NEW VERSION AVAILABLE!', W / 2, 100, PAL[11])
    if (blink()) centreText(ctx, touchUi() ? 'TAP TO UPDATE' : 'PRESS ENTER TO UPDATE', W / 2, 111, PAL[7])
  }
}

/** Sarge, the dispatch officer: an original character. */
function drawSarge(x: number, y: number, t: number) {
  const r = (dx: number, dy: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h) }
  r(0, 0, 40, 48, PAL[1])
  r(6, 36, 28, 12, '#29436a') // shoulders
  r(16, 36, 8, 12, PAL[7]) // collar
  r(18, 38, 4, 10, PAL[1]) // tie
  r(10, 12, 20, 24, PAL[15]) // face
  r(8, 6, 24, 8, '#1d2b53') // cap
  r(6, 12, 28, 3, '#0b1020') // peak
  r(18, 7, 4, 4, PAL[10]) // badge
  const look = Math.floor(t * 0.7) % 3 === 0 ? 1 : 0
  r(14 + look, 19, 3, 2, PAL[0])
  r(23 + look, 19, 3, 2, PAL[0])
  r(12, 26, 16, 4, PAL[6]) // moustache
  const talk = game.screenTime < 3 && Math.floor(t * 8) % 2
  r(17, 31, 6, talk ? 3 : 1, '#7e2553')
}

function drawBrief(t: number) {
  const w = game.world
  ctx.fillStyle = '#0b1020'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = PAL[1]
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1)
  centreText(ctx, 'DISPATCH', W / 2, 6, PAL[12], 2)
  drawSarge(12, 26, t)
  drawText(ctx, 'SARGE', 14, 78, PAL[10])
  drawText(ctx, w.def.title, 62, 28, PAL[10])
  // Type the briefing out a character at a time.
  let budget = Math.floor(game.screenTime * 40)
  w.def.brief.forEach((line, i) => {
    const shown = line.slice(0, Math.max(0, budget))
    budget -= line.length
    drawText(ctx, shown, 62, 42 + i * 10, PAL[7])
  })
  const car = sprites().targets[w.def.target].frames[1][0]
  const cw = 96
  ctx.drawImage(car, W / 2 - cw / 2 + 60, 96, cw, (cw * car.height) / car.width)
  drawText(ctx, 'TARGET', 62, 104, PAL[8])
  drawText(ctx, `${w.def.pursuitTime} SECONDS ON THE CLOCK`, 62, 114, PAL[6])
  drawText(ctx, `CHECKPOINTS ADD ${CHECKPOINT_BONUS} MORE`, 62, 122, PAL[6])
  drawText(ctx, `THEN ${w.def.arrestTime} TO STOP THEM`, 62, 130, PAL[6])
  drawText(ctx, `SCORE ${w.score}`, 14, 92, PAL[6])
  if (game.screenTime > 0.5 && blink()) centreText(ctx, touchUi() ? 'TAP TO ROLL OUT' : 'PRESS ENTER TO ROLL OUT', W / 2, 162, PAL[11])
}

function drawPlay(t: number) {
  const w = game.world
  renderWorld(ctx, w, fx, t, w.phase === 'pursuit' || w.phase === 'arrest' ? game.steer : 0)
  drawHud(ctx, w, fx, game.hiscore, t)
  if (w.phase === 'caught' && w.phaseTime > 1.5) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(60, 96, W - 120, 40)
    centreText(ctx, 'CASE CLOSED', W / 2, 100, PAL[11], 2)
    centreText(ctx, `TIME BONUS ${w.timeLeft} X 1000`, W / 2, 116, PAL[7])
    centreText(ctx, `SCORE ${w.score}`, W / 2, 126, PAL[10])
  }
  if (game.paused) {
    dim(0.6)
    centreText(ctx, 'PAUSED', W / 2, 70, PAL[7], 3)
    if (blink()) centreText(ctx, 'PRESS P OR TAP TO RESUME', W / 2, 100, PAL[6])
  }
}

function drawContinue(t: number) {
  renderWorld(ctx, game.world, fx, t, 0)
  dim(0.65)
  const left = Math.max(0, CONTINUE_SECONDS - 1 - Math.floor(game.screenTime))
  centreText(ctx, 'CONTINUE?', W / 2, 26, PAL[10], 3)
  centreText(ctx, String(left), W / 2, 56, left <= 3 ? PAL[8] : PAL[7], 8)
  centreText(ctx, `CONTINUES LEFT ${game.continues}`, W / 2, 110, PAL[6])
  centreText(ctx, 'RETRY THIS CASE FROM ITS START', W / 2, 120, PAL[5])
  if (blink(0.3)) centreText(ctx, touchUi() ? 'TAP TO CONTINUE' : 'PRESS ENTER', W / 2, 150, PAL[7])
}

function drawEnd(t: number, won: boolean) {
  renderWorld(ctx, game.world, fx, t, 0, false)
  dim(0.6)
  const score = game.world.score
  if (won) {
    centreText(ctx, 'ALL CASES', W / 2, 30, PAL[11], 3)
    centreText(ctx, 'CLOSED!', W / 2, 54, PAL[11], 3)
    centreText(ctx, 'THE CITY SLEEPS SAFE TONIGHT', W / 2, 86, PAL[14])
  } else {
    centreText(ctx, 'GAME OVER', W / 2, 50, PAL[8], 3)
  }
  centreText(ctx, `SCORE ${score}`, W / 2, 110, PAL[7])
  centreText(ctx, `HI-SCORE ${game.hiscore}`, W / 2, 122, PAL[9])
  if (game.screenTime > 1.5 && blink()) centreText(ctx, touchUi() ? 'TAP' : 'PRESS ENTER', W / 2, 150, PAL[6])
}

function draw() {
  const t = performance.now() / 1000
  ctx.fillStyle = PAL[0]
  ctx.fillRect(0, 0, W, H)
  switch (game.screen) {
    case 'title': drawTitle(t); break
    case 'brief': drawBrief(t); break
    case 'play': drawPlay(t); break
    case 'continue': drawContinue(t); break
    case 'gameover': drawEnd(t, false); break
    case 'victory': drawEnd(t, true); break
  }
  if (isMuted()) drawText(ctx, 'MUTE', W - 3, H - 22, PAL[5], 1, 'right')
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
    if (game.paused) stopMusic()
    else if (game.world.phase === 'arrest') playArrest()
    else if (game.world.phase === 'pursuit') playPursuit()
  }
  if (!game.paused && f.turbo && playing) game.turboLatched = true
  game.steer = f.steer

  const w = game.world
  const live = playing && !game.paused && (w.phase === 'pursuit' || w.phase === 'arrest' || w.phase === 'caught')
  updateEngine(live ? w.player.speed / MAX_SPEED : null, w.player.turbo > 0, live && w.phase !== 'caught', now / 1000)

  // Menus accept a tap as "go"; in play a tap is just driving.
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
  if (document.hidden && game.screen === 'play' && !game.paused) {
    game.paused = true
    stopMusic()
    updateEngine(null, false, false, 0)
  }
})

initInput(canvas, unlock)
requestAnimationFrame(loop)

// Dev-server only (stripped from production builds): lets a browser session
// jump straight to a case or phase when checking visuals.
if (import.meta.env.DEV) {
  Object.assign(window, { __chase: { game, go, brief, startCase } })
}
