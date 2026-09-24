// ─── /shmup — Bioblast, a vertical-scrolling shooter ────────────────────────
//
// Served at jawg.uk/shmup (shmup.html). Like /retro it is deliberately
// separate from the main game: a plain canvas, no React/Firebase/PixiJS.
//
// This file owns the screen flow (title → level → clear → shop → … →
// victory / game over), the portrait/landscape layout and the fixed-timestep
// loop. Rules are in logic.ts, drawing in render.ts, sound in audio.ts.

import {
  CONTINUE_SECONDS, MAX_CONTINUES, SHOP_ITEMS, START_LOADOUT, buy, cloneLoadout, continueCarry, createWorld, maxShield, priceOf, step,
  type Carry, type World,
} from './logic'
import { LEVELS } from './levels'
import {
  Fx, PANEL_W, PAL, PF_H, PF_W, centreText, drawHudCompact, drawPanels, drawText, panelState, renderPlayfield,
} from './render'
import { initInput, poll, type Frame } from './input'
import {
  isMuted, playBossMusic, playShopMusic, playStageMusic, sfx, stopMusic, toggleMute, unlock,
} from './audio'
import { buildLabel, crtToggle, fitFrame, readNumber, watchForUpdates, write } from '../arcade/page'

const DT = 1 / 60
const START_LIVES = 3
const HISCORE_KEY = 'jawg-shmup-hiscore'
const CRT_KEY = 'jawg-shmup-crt'
const SHIELD_BONUS = 10 // points per shield unit left at the end of a level

type Screen = 'title' | 'play' | 'clear' | 'shop' | 'continue' | 'gameover' | 'victory'

const canvas = document.getElementById('screen') as HTMLCanvasElement
const frame = document.getElementById('frame') as HTMLDivElement
const ctx = canvas.getContext('2d')!
const toggleCrt = crtToggle(frame, CRT_KEY)
const fx = new Fx()

const freshCarry = (): Carry => ({ loadout: cloneLoadout(START_LOADOUT), score: 0, credits: 0, lives: START_LIVES })

const game = {
  screen: 'title' as Screen,
  screenTime: 0,
  paused: false,
  levelIdx: 0,
  carry: freshCarry(),
  /** The carry each level began with, for continues. */
  levelCarry: freshCarry(),
  continues: MAX_CONTINUES,
  world: createWorld(LEVELS[0], freshCarry()) as World,
  hiscore: readNumber(HISCORE_KEY),
  shieldBonus: 0,
  shopCursor: 0,
  shopMsg: { text: '', t: 0 },
  bossWarning: 0,
  /** A bomb press waiting for the next physics tick (see loop()). */
  bombLatched: false,
}

const isFinalLevel = () => game.levelIdx === LEVELS.length - 1

function go(screen: Screen) {
  game.screen = screen
  game.screenTime = 0
}

function startLevel(idx: number) {
  game.levelIdx = idx
  game.levelCarry = { ...game.carry, loadout: cloneLoadout(game.carry.loadout) }
  game.world = createWorld(LEVELS[idx], game.carry, (Date.now() & 0xffff) + 1)
  fx.clear()
  go('play')
  playStageMusic(LEVELS[idx].theme)
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
// Landscape screens get the playfield between two side panels; portrait gets
// the playfield alone with a compact HUD.
let wide = false
let scale = 1

function layout() {
  wide = window.innerWidth >= window.innerHeight
  canvas.width = wide ? PF_W + PANEL_W * 2 : PF_W
  canvas.height = PF_H
  ctx.imageSmoothingEnabled = false
  scale = fitFrame(frame, canvas.width, canvas.height)
}
window.addEventListener('resize', layout)
layout()

const ox = () => (wide ? PANEL_W : 0)
const midX = () => ox() + PF_W / 2

// ── Shop ────────────────────────────────────────────────────────────────────
const SHOP_TOP = 104
const SHOP_ROW = 14
const LAUNCH_ROW = SHOP_ITEMS.length

const QUIPS = {
  ok: ['PLEASURE DOING BUSINESS', 'FINE CHOICE, PILOT', 'NO REFUNDS!'],
  poor: ['COME BACK WITH MORE CREDITS', 'THIS IS NOT A CHARITY'],
  maxed: ['YOU CANNOT FIT ANY MORE OF THAT'],
  mounted: ['NEW POD MOUNTED! LOOKING MIGHTY', 'ANOTHER POD! YOUR SHIP GROWS'],
}

function shopAction(row: number) {
  if (row === LAUNCH_ROW) {
    startLevel(game.levelIdx + 1)
    return
  }
  const result = buy(game.carry, SHOP_ITEMS[row].id)
  const lines = QUIPS[result]
  game.shopMsg = { text: lines[Math.floor(Math.random() * lines.length)], t: 2 }
  sfx(result === 'mounted' ? 'mount' : result === 'ok' ? 'buy' : 'deny')
}

// ── Update ──────────────────────────────────────────────────────────────────
function update(dt: number, f: Frame, confirm: boolean, drag: { x: number; y: number }) {
  game.screenTime += dt
  fx.update(dt)
  const w = game.world

  switch (game.screen) {
    case 'title':
      w.scroll += 24 * dt
      if (confirm && updateReady) {
        location.reload() // picks up the newer deploy (the page isn't service-worker cached)
      } else if (confirm) {
        sfx('start')
        game.carry = freshCarry()
        game.continues = MAX_CONTINUES
        startLevel(0)
      }
      break

    case 'play': {
      const events = step(w, {
        dx: f.dx, dy: f.dy, dragX: drag.x, dragY: drag.y, fire: f.fire, bomb: game.bombLatched,
      }, dt)
      game.bombLatched = false
      fx.handle(events)
      for (const e of events) {
        sfx(e.kind)
        if (e.kind === 'boss') { game.bossWarning = 3; playBossMusic(isFinalLevel()) }
        if (e.kind === 'bossdie') stopMusic()
      }
      game.bossWarning = Math.max(0, game.bossWarning - dt)
      if (w.status === 'won') {
        game.shieldBonus = Math.max(0, Math.round(w.ship.shield)) * SHIELD_BONUS
        game.carry = {
          loadout: cloneLoadout(w.loadout), score: w.score + game.shieldBonus, credits: w.credits, lives: w.lives,
        }
        go('clear')
      } else if (w.status === 'gameover') {
        stopMusic()
        saveHiscore(w.score)
        go(game.continues > 0 ? 'continue' : 'gameover')
      }
      break
    }

    case 'clear':
      if (game.screenTime > 4 || (confirm && game.screenTime > 1)) {
        if (game.levelIdx + 1 < LEVELS.length) {
          game.shopCursor = 0
          game.shopMsg = { text: 'WELCOME, PILOT. BROWSE MY WARES', t: 3 }
          go('shop')
          playShopMusic()
        } else {
          saveHiscore(game.carry.score)
          sfx('bossdie')
          go('victory')
        }
      }
      break

    case 'shop':
      game.shopMsg.t -= dt
      break

    case 'continue': {
      const before = Math.floor(game.screenTime - dt)
      if (Math.floor(game.screenTime) !== before && game.screenTime < CONTINUE_SECONDS) sfx('tick')
      if (confirm && game.screenTime > 0.5) {
        game.continues--
        game.carry = continueCarry(game.levelCarry, START_LIVES)
        sfx('start')
        startLevel(game.levelIdx)
      } else if (game.screenTime >= CONTINUE_SECONDS) {
        go('gameover')
      }
      break
    }

    case 'gameover':
    case 'victory':
      w.scroll += 24 * dt
      if (confirm && game.screenTime > 1.5) go('title')
      break
  }
}

/** Menu input that should act once per frame, not once per physics tick. */
function frameInput(f: Frame) {
  if (game.screen !== 'shop') return
  const rows = LAUNCH_ROW + 1
  if (f.up) game.shopCursor = (game.shopCursor + rows - 1) % rows
  if (f.down) game.shopCursor = (game.shopCursor + 1) % rows
  if (f.confirm) shopAction(game.shopCursor)
  for (const tap of f.taps) {
    const y = tap.y / scale
    const row = Math.floor((y - SHOP_TOP + SHOP_ROW / 2) / SHOP_ROW)
    if (row >= 0 && row <= LAUNCH_ROW) {
      game.shopCursor = row
      shopAction(row)
    }
  }
}

// ── Draw ────────────────────────────────────────────────────────────────────
const blink = (period = 0.5) => Math.floor(performance.now() / 1000 / period) % 2 === 0

function drawPlayfield(t: number, withShip: boolean) {
  const w = game.world
  const alive = w.ship.alive
  if (!withShip) w.ship.alive = false
  const pf = renderPlayfield(w, fx, t)
  w.ship.alive = alive
  const s = fx.shake * 6
  ctx.drawImage(pf, ox() + Math.round((Math.random() - 0.5) * s), Math.round((Math.random() - 0.5) * s))
}

function dim(alpha = 0.55) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`
  ctx.fillRect(ox(), 0, PF_W, PF_H)
}

function drawSidePanelsForMenus() {
  if (!wide) return
  ctx.fillStyle = PAL[0]
  ctx.fillRect(0, 0, PANEL_W, PF_H)
  ctx.fillRect(PANEL_W + PF_W, 0, PANEL_W, PF_H)
  const help = [
    ['MOVE', 'ARROWS'], ['', 'WASD'], ['FIRE', 'SPACE'], ['', 'Z'], ['BOMB', 'B'], ['PAUSE', 'P'], ['MUTE', 'M'], ['CRT', 'C'],
  ]
  drawText(ctx, 'CONTROLS', 6, 10, PAL[13])
  help.forEach(([a, b], i) => {
    drawText(ctx, a, 6, 26 + i * 12, PAL[6])
    drawText(ctx, b, 30, 26 + i * 12, PAL[7])
  })
  drawText(ctx, 'DRAG TO', 6, 130, PAL[6])
  drawText(ctx, 'FLY WITH', 6, 138, PAL[6])
  drawText(ctx, 'A MOUSE', 6, 146, PAL[6])
  const rx = PANEL_W + PF_W + 6
  drawText(ctx, 'HI-SCORE', rx, 10, PAL[13])
  drawText(ctx, String(game.hiscore).padStart(7, '0'), rx, 18, PAL[9])
}

function drawTitle(t: number) {
  drawPlayfield(t, true)
  dim(0.45)
  const cx = midX()
  centreText(ctx, 'BIO', cx, 50, PAL[14], 5)
  centreText(ctx, 'BLAST', cx, 80, PAL[11], 5)
  centreText(ctx, 'A VOYAGE INTO THE BEAST', cx, 116, PAL[7])
  const touch = document.getElementById('touch')?.classList.contains('on')
  if (blink() && !updateReady) centreText(ctx, touch ? 'TAP TO START' : 'PRESS FIRE TO START', cx, 190, PAL[10])
  if (touch) {
    centreText(ctx, 'DRAG ANYWHERE TO FLY', cx, 214, PAL[6])
    centreText(ctx, 'AUTO-FIRE WHILE TOUCHING', cx, 224, PAL[6])
    centreText(ctx, 'B BUTTON FOR SMART BOMB', cx, 234, PAL[6])
  }
  centreText(ctx, `HI-SCORE ${String(game.hiscore).padStart(7, '0')}`, cx, 290, PAL[9])
  centreText(ctx, BUILD, cx, 306, PAL[5])
  if (updateReady) {
    ctx.fillStyle = PAL[1]
    ctx.fillRect(ox() + 8, 132, PF_W - 16, 26)
    centreText(ctx, 'NEW VERSION AVAILABLE!', cx, 137, PAL[11])
    if (blink()) centreText(ctx, touch ? 'TAP TO UPDATE' : 'PRESS FIRE TO UPDATE', cx, 148, PAL[7])
  }
  drawSidePanelsForMenus()
}

function drawTrader(cx: number, y: number, t: number) {
  // An original alien trader: three eyes, one of them always shifty.
  ctx.fillStyle = PAL[3]
  ctx.beginPath(); ctx.ellipse(cx, y + 18, 20, 22, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = PAL[11]
  ctx.beginPath(); ctx.ellipse(cx, y + 12, 16, 12, 0, 0, Math.PI * 2); ctx.fill()
  const look = Math.sin(t * 1.3) * 2
  for (const [ex, ey, r] of [[-8, 10, 4], [8, 10, 4], [0, 2, 3]] as const) {
    ctx.fillStyle = PAL[7]
    ctx.beginPath(); ctx.arc(cx + ex, y + ey, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = PAL[0]
    ctx.fillRect(Math.round(cx + ex + look) - 1, y + ey - 1, 2, 2)
  }
  ctx.fillStyle = PAL[0]
  const talk = game.shopMsg.t > 0 && Math.floor(t * 8) % 2
  ctx.fillRect(cx - 6, y + 26, 12, talk ? 4 : 2)
  ctx.fillStyle = PAL[13]
  ctx.fillRect(cx - 3, y - 12, 1, 8)
  ctx.fillRect(cx + 3, y - 12, 1, 8)
}

function drawShop(t: number) {
  const x0 = ox()
  ctx.fillStyle = '#12061e'
  ctx.fillRect(x0, 0, PF_W, PF_H)
  const cx = midX()
  centreText(ctx, 'GLIX THE TRADER', cx, 6, PAL[11], 1)
  drawTrader(cx, 24, t)
  if (game.shopMsg.t > 0) centreText(ctx, game.shopMsg.text, cx, 74, PAL[7])
  centreText(ctx, `CREDITS ${game.carry.credits}`, cx, 86, PAL[12])

  SHOP_ITEMS.forEach((item, i) => {
    const y = SHOP_TOP + i * SHOP_ROW
    const sel = game.shopCursor === i
    const price = priceOf(item.id, game.carry)
    if (sel) {
      ctx.fillStyle = PAL[1]
      ctx.fillRect(x0 + 6, y - 5, PF_W - 12, SHOP_ROW - 2)
    }
    const affordable = price !== null && price <= game.carry.credits
    drawText(ctx, (sel ? '> ' : '  ') + item.name, x0 + 8, y - 2, affordable ? PAL[7] : PAL[5])
    drawText(ctx, price === null ? 'MAX' : String(price), x0 + PF_W - 10, y - 2, price === null ? PAL[5] : PAL[10], 1, 'right')
    if (sel) centreText(ctx, item.blurb, cx, SHOP_TOP + (LAUNCH_ROW + 1) * SHOP_ROW + 4, PAL[6])
  })
  const ly = SHOP_TOP + LAUNCH_ROW * SHOP_ROW
  const sel = game.shopCursor === LAUNCH_ROW
  if (sel) {
    ctx.fillStyle = PAL[2]
    ctx.fillRect(x0 + 6, ly - 5, PF_W - 12, SHOP_ROW - 2)
  }
  centreText(ctx, (sel ? '> ' : '') + `LAUNCH TO LEVEL ${game.levelIdx + 2}`, cx, ly - 2, sel ? PAL[10] : PAL[7])

  const touch = document.getElementById('touch')?.classList.contains('on')
  centreText(ctx, touch ? 'TAP AN ITEM TO BUY IT' : 'UP/DOWN TO CHOOSE, FIRE TO BUY', cx, 306, PAL[5])

  if (wide) {
    // Show the current loadout in the usual panels.
    drawPanels(ctx, { ...game.carry, shield: maxShield(game.carry.loadout) }, { hiscore: game.hiscore, levelNum: game.levelIdx + 2 }, ox())
  }
}

function drawGame(t: number) {
  const w = game.world
  drawPlayfield(t, true)
  const cx = midX()
  if (w.time < 2.5 && game.screen === 'play') {
    centreText(ctx, `LEVEL ${game.levelIdx + 1}`, cx, 120, PAL[7], 2)
    centreText(ctx, w.level.name, cx, 140, PAL[10])
  }
  if (game.bossWarning > 0 && blink(0.25)) {
    ctx.fillStyle = 'rgba(255,0,77,0.25)'
    ctx.fillRect(ox(), 140, PF_W, 30)
    centreText(ctx, 'WARNING', cx, 146, PAL[8], 3)
  }
  if (game.screen === 'clear' && game.screenTime > 0.3) {
    dim(0.5)
    centreText(ctx, 'LEVEL CLEAR', cx, 110, PAL[11], 2)
    centreText(ctx, `SHIELD BONUS ${game.shieldBonus}`, cx, 140, PAL[7])
    centreText(ctx, `CREDITS ${w.credits}`, cx, 154, PAL[12])
  }
  if (wide) drawPanels(ctx, panelState(w), { hiscore: game.hiscore, levelNum: game.levelIdx + 1 }, ox())
  else drawHudCompact(ctx, w, { hiscore: game.hiscore, levelNum: game.levelIdx + 1 })
  if (game.paused) {
    dim(0.6)
    centreText(ctx, 'PAUSED', cx, 140, PAL[7], 2)
    if (blink()) centreText(ctx, 'PRESS P OR TAP TO RESUME', cx, 164, PAL[6])
  }
}

function drawContinue(t: number) {
  drawPlayfield(t, false)
  dim(0.65)
  const cx = midX()
  const left = Math.max(0, CONTINUE_SECONDS - 1 - Math.floor(game.screenTime))
  centreText(ctx, 'CONTINUE?', cx, 90, PAL[10], 3)
  centreText(ctx, String(left), cx, 130, left <= 3 ? PAL[8] : PAL[7], 8)
  centreText(ctx, `CONTINUES LEFT ${game.continues}`, cx, 190, PAL[6])
  centreText(ctx, 'RESTART THIS LEVEL, SCORE RESETS', cx, 202, PAL[5])
  if (blink(0.3)) centreText(ctx, 'PRESS FIRE OR TAP', cx, 230, PAL[7])
  drawSidePanelsForMenus()
}

function drawEnd(t: number, won: boolean) {
  drawPlayfield(t, false)
  dim(0.6)
  const cx = midX()
  const score = won ? game.carry.score : game.world.score
  if (won) {
    centreText(ctx, 'THE BEAST', cx, 90, PAL[11], 3)
    centreText(ctx, 'IS SLAIN!', cx, 112, PAL[11], 3)
    centreText(ctx, 'THANKS FOR PLAYING', cx, 150, PAL[14])
  } else {
    centreText(ctx, 'GAME OVER', cx, 110, PAL[8], 3)
  }
  centreText(ctx, `SCORE ${score}`, cx, 180, PAL[7])
  centreText(ctx, `HI-SCORE ${game.hiscore}`, cx, 194, PAL[9])
  if (game.screenTime > 1.5 && blink()) centreText(ctx, 'PRESS FIRE OR TAP', cx, 240, PAL[6])
  drawSidePanelsForMenus()
}

function draw() {
  const t = performance.now() / 1000
  ctx.fillStyle = PAL[0]
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  switch (game.screen) {
    case 'title': drawTitle(t); break
    case 'play':
    case 'clear': drawGame(t); break
    case 'shop': drawShop(t); break
    case 'continue': drawContinue(t); break
    case 'gameover': drawEnd(t, false); break
    case 'victory': drawEnd(t, true); break
  }
  if (isMuted()) drawText(ctx, 'MUTE', canvas.width - 3, PF_H - 16, PAL[5], 1, 'right')
}

// ── Loop ────────────────────────────────────────────────────────────────────
// Physics runs at a fixed 60Hz while input is polled per rendered frame, so a
// frame may run zero or several ticks. Drag distance is held until a tick
// consumes it, so fast displays never drop movement.
let last = performance.now()
let acc = 0
const pendingDrag = { x: 0, y: 0 }

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
    else if (game.world.boss) playBossMusic(isFinalLevel())
    else playStageMusic(game.world.level.theme)
  }
  if (!game.paused) {
    if (f.bomb && playing) game.bombLatched = true
    pendingDrag.x += f.dragX / scale
    pendingDrag.y += f.dragY / scale
    frameInput(f)
  }

  // Menus accept a tap as "go"; in play a tap is just part of flying.
  let confirm = f.confirm || (tapped && game.screen !== 'play' && game.screen !== 'shop')
  while (acc >= DT) {
    if (!game.paused) {
      update(DT, f, confirm, { ...pendingDrag })
      pendingDrag.x = 0
      pendingDrag.y = 0
    }
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
  }
})

initInput(canvas, unlock)
requestAnimationFrame(loop)

// Dev-server only (stripped from production builds): lets a browser session
// jump straight to a boss or the shop when checking visuals.
if (import.meta.env.DEV) {
  Object.assign(window, { __shmup: { game, go, startLevel, playShopMusic } })
}
