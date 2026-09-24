// ─── /retro — Pixel Pete, an 80s-style platformer ───────────────────────────
//
// A standalone game served at jawg.uk/retro (retro.html), deliberately separate
// from the main card game: no React, Firebase or PixiJS, just a 2D canvas.
//
// This file owns the screen flow (title → level intro → play → clear / game
// over) and the fixed-timestep loop. World rules are in physics.ts, drawing in
// render.ts, sound in audio.ts, controls in input.ts.

import { createWorld, step, type World } from './physics'
import { LEVELS } from './levels'
import {
  PAL, VIEW_H, VIEW_W, drawHeart, drawHud, drawText, drawTitleHero, drawWorld, updateCamera,
  type Camera,
} from './render'
import { initInput, poll, type Frame } from './input'
import { arcadeLink, buildLabel, crtToggle, fitToWindow, readNumber, watchForUpdates, write } from '../arcade/page'
import { isMuted, sfx, startMusic, stopMusic, toggleMute, unlock } from './audio'

const DT = 1 / 60
const START_LIVES = 3
const HISCORE_KEY = 'jawg-retro-hiscore'
const CRT_KEY = 'jawg-retro-crt'
const PAR_TIME = 200 // seconds; each second under par is worth TIME_BONUS
const TIME_BONUS = 5

type Screen = 'title' | 'intro' | 'play' | 'dying' | 'clear' | 'gameover' | 'victory'

interface Game {
  screen: Screen
  screenTime: number
  paused: boolean
  levelIdx: number
  lives: number
  /** Score when the current level began — restored after losing a life. */
  levelStartScore: number
  world: World
  cam: Camera
  hiscore: number
  bonus: number
  /** A jump press waiting for the next physics tick (see loop()). */
  jumpLatched: boolean
}

const canvas = document.getElementById('screen') as HTMLCanvasElement
const frame = document.getElementById('frame') as HTMLDivElement
const ctx = canvas.getContext('2d')!
ctx.imageSmoothingEnabled = false

const BUILD = buildLabel(import.meta.env.VITE_GIT_SHA, __BUILD_DATE__)
let updateReady = false
watchForUpdates(() => { updateReady = true })

const game: Game = {
  screen: 'title',
  screenTime: 0,
  paused: false,
  levelIdx: 0,
  lives: START_LIVES,
  levelStartScore: 0,
  world: createWorld(LEVELS[0]),
  cam: { x: 0, y: 0 },
  hiscore: readNumber(HISCORE_KEY),
  bonus: 0,
  jumpLatched: false,
}

const toggleCrt = crtToggle(frame, CRT_KEY)

const toArcade = arcadeLink()

function go(screen: Screen) {
  toArcade.show(screen === 'title')
  game.screen = screen
  game.screenTime = 0
}

function startLevel(idx: number, score: number) {
  game.levelIdx = idx
  game.levelStartScore = score
  game.world = createWorld(LEVELS[idx], score)
  game.cam = { x: 0, y: 0 }
  updateCamera(game.cam, game.world)
  game.cam.x = Math.max(0, game.cam.x)
  go('intro')
}

function saveHiscore() {
  if (game.world.score > game.hiscore) {
    game.hiscore = game.world.score
    write(HISCORE_KEY, String(game.hiscore))
  }
}

// ── Update ──────────────────────────────────────────────────────────────────
function update(dt: number, confirm: boolean) {
  game.screenTime += dt
  const w = game.world

  switch (game.screen) {
    case 'title':
      if (confirm && updateReady) {
        location.reload() // picks up the newer deploy (the page isn't service-worker cached)
      } else if (confirm) {
        sfx('start')
        game.lives = START_LIVES
        startLevel(0, 0)
      }
      break

    case 'intro':
      if (game.screenTime > 2 || (confirm && game.screenTime > 0.3)) {
        go('play')
        startMusic()
      }
      break

    case 'play': {
      const input = held.input
      const events = step(w, { ...input, jumpPressed: game.jumpLatched }, dt)
      game.jumpLatched = false
      for (const e of events) {
        if (e === 'jump' || e === 'coin' || e === 'stomp') sfx(e)
      }
      if (w.status === 'dead') {
        stopMusic()
        sfx('die')
        w.player.vy = -260
        go('dying')
      } else if (w.status === 'won') {
        stopMusic()
        sfx('win')
        game.bonus = Math.max(0, Math.floor(PAR_TIME - w.time)) * TIME_BONUS
        w.score += game.bonus
        go('clear')
      }
      updateCamera(game.cam, w)
      break
    }

    case 'dying': {
      // Classic death hop: freeze the world, pop the hero up and off-screen.
      const p = w.player
      if (game.screenTime > 0.4) {
        p.vy += 700 * dt
        p.y += p.vy * dt
      }
      if (game.screenTime > 2.2) {
        game.lives--
        if (game.lives <= 0) {
          saveHiscore()
          go('gameover')
        } else {
          const lives = game.lives
          startLevel(game.levelIdx, game.levelStartScore)
          game.lives = lives
        }
      }
      break
    }

    case 'clear':
      if (game.screenTime > 3.5 || (confirm && game.screenTime > 1)) {
        if (game.levelIdx + 1 < LEVELS.length) startLevel(game.levelIdx + 1, w.score)
        else {
          saveHiscore()
          sfx('win')
          go('victory')
        }
      }
      break

    case 'gameover':
    case 'victory':
      if (confirm && game.screenTime > 1) go('title')
      break
  }
}

// ── Draw ────────────────────────────────────────────────────────────────────
function blink(period = 0.5) {
  return Math.floor(performance.now() / 1000 / period) % 2 === 0
}

function drawTitle(t: number) {
  // Scroll the first level behind the logo as an attract mode.
  const w = game.world
  const cam = { x: (t * 30) % (w.level.w * 16 - VIEW_W), y: 12 }
  drawWorld(ctx, w, cam, t, false)
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  drawText(ctx, 'PIXEL', VIEW_W / 2 + 2, 18, PAL[10], 5, 'center')
  drawText(ctx, 'PETE', VIEW_W / 2 + 2, 46, PAL[8], 5, 'center')
  drawTitleHero(ctx, VIEW_W / 2 - 60, 76, t)
  const touch = document.getElementById('touch')?.classList.contains('on')
  if (blink()) drawText(ctx, touch ? 'TAP TO START' : 'PRESS ENTER TO START', VIEW_W / 2, 136, PAL[7], 1, 'center')
  drawText(ctx, touch
    ? 'ARROWS MOVE   A JUMP   II PAUSE'
    : 'ARROWS/WASD MOVE   SPACE/Z JUMP   P PAUSE   M MUTE   C CRT', VIEW_W / 2, 152, PAL[6], 1, 'center')
  drawText(ctx, `HI-SCORE ${String(game.hiscore).padStart(6, '0')}`, VIEW_W / 2, 166, PAL[9], 1, 'center')
  drawText(ctx, BUILD, 3, VIEW_H - 8, PAL[5])
  if (updateReady) {
    ctx.fillStyle = PAL[1]
    ctx.fillRect(0, 124, VIEW_W, 20)
    drawText(ctx, 'NEW VERSION AVAILABLE!', VIEW_W / 2, 127, PAL[11], 1, 'center')
    if (blink()) drawText(ctx, touch ? 'TAP TO UPDATE' : 'PRESS ENTER TO UPDATE', VIEW_W / 2, 135, PAL[7], 1, 'center')
  }
}

function drawCentered(lines: [string, string, number][], y: number) {
  lines.forEach(([text, colour, scale], i) => drawText(ctx, text, VIEW_W / 2, y + i * 16, colour, scale, 'center'))
}

function draw() {
  const t = performance.now() / 1000
  const w = game.world
  ctx.fillStyle = PAL[0]
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  switch (game.screen) {
    case 'title':
      drawTitle(t)
      break

    case 'intro':
      drawText(ctx, `WORLD 1-${game.levelIdx + 1}`, VIEW_W / 2, 60, PAL[7], 2, 'center')
      drawText(ctx, w.level.name, VIEW_W / 2, 80, PAL[10], 1, 'center')
      drawHeart(ctx, VIEW_W / 2 - 14, 104)
      drawText(ctx, `x ${game.lives}`, VIEW_W / 2 - 4, 105, PAL[7])
      break

    case 'play':
    case 'dying':
    case 'clear':
      drawWorld(ctx, w, game.cam, t)
      drawHud(ctx, w, game.lives, game.levelIdx + 1)
      if (game.screen === 'clear' && game.screenTime > 0.5) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillRect(0, 58, VIEW_W, 58)
        drawCentered([
          ['COURSE CLEAR!', PAL[10], 2],
          [`TIME BONUS ${game.bonus}`, PAL[7], 1],
        ], 66)
        drawText(ctx, `COINS ${w.coinCount}`, VIEW_W / 2, 100, PAL[9], 1, 'center')
      }
      if (game.paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(0, 0, VIEW_W, VIEW_H)
        drawText(ctx, 'PAUSED', VIEW_W / 2, 76, PAL[7], 2, 'center')
        if (blink()) drawText(ctx, 'PRESS P OR TAP TO RESUME', VIEW_W / 2, 100, PAL[6], 1, 'center')
      }
      break

    case 'gameover':
      drawCentered([
        ['GAME OVER', PAL[8], 3],
        ['', PAL[7], 1],
        [`SCORE ${w.score}`, PAL[7], 1],
        [`HI-SCORE ${game.hiscore}`, PAL[9], 1],
      ], 50)
      if (game.screenTime > 1 && blink()) drawText(ctx, 'PRESS ENTER OR TAP', VIEW_W / 2, 140, PAL[6], 1, 'center')
      break

    case 'victory':
      drawTitleHero(ctx, VIEW_W / 2 - 60, 20, t)
      drawCentered([
        ['YOU WIN!', PAL[10], 3],
        ['', PAL[7], 1],
        [`FINAL SCORE ${w.score}`, PAL[7], 1],
        [`HI-SCORE ${game.hiscore}`, PAL[9], 1],
      ], 80)
      if (game.screenTime > 1 && blink()) drawText(ctx, 'THANKS FOR PLAYING!', VIEW_W / 2, 160, PAL[14], 1, 'center')
      break
  }

  if (isMuted()) drawText(ctx, 'MUTE', VIEW_W - 3, VIEW_H - 8, PAL[5], 1, 'right')
}

// ── Loop ────────────────────────────────────────────────────────────────────
// Input is polled once per rendered frame but physics runs at a fixed 60Hz, so
// a frame can run zero or several ticks. A jump press is latched until the
// next tick consumes it — otherwise a tap on a 120Hz display could land on a
// frame with no tick and vanish.
let last = performance.now()
let acc = 0
/** This frame's poll() result; update() reads the held buttons from it. */
let held: Frame = poll()

function loop(now: number) {
  acc += Math.min(0.25, (now - last) / 1000)
  last = now

  const f = poll()
  held = f
  if (f.mute) toggleMute()
  if (f.crt) toggleCrt()
  const inGame = game.screen === 'play'
  if (inGame && (f.pause || (game.paused && f.confirm))) {
    game.paused = !game.paused
    sfx('pause')
    if (game.paused) stopMusic()
    else startMusic()
  }
  if (f.input.jumpPressed && !game.paused) game.jumpLatched = true

  let confirm = f.confirm
  while (acc >= DT) {
    if (!game.paused) update(DT, confirm)
    confirm = false
    acc -= DT
  }
  draw()
  requestAnimationFrame(loop)
}

// ── Layout ──────────────────────────────────────────────────────────────────
fitToWindow(frame, VIEW_W, VIEW_H)

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.screen === 'play' && !game.paused) {
    game.paused = true
    stopMusic()
  }
})

initInput(unlock)
requestAnimationFrame(loop)
