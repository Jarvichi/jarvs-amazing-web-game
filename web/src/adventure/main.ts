// ─── /adventure — EMBERFALL, a top-down adventure ───────────────────────────
//
// Served at jawg.uk/adventure (adventure.html). Like the other arcade pages
// it is a plain canvas, separate from the main game.
//
// This file owns the screens (title → story → play ⇄ pause → game over /
// ending), saving, music and the fixed-timestep loop. Rules are in world.ts,
// drawing in render.ts, sound in audio.ts.

import { MAPS } from './maps'
import { questOf, type World } from './state'
import { continueGame, createWorld, cycleItem, enterMap, give, step, type Controls } from './world'
import { SAVE_KEY, fromSave, parseSave, toSave } from './save'
import { paginate } from './text'
import { Fx, H, HUD, PAL, W, centreText, drawInventory, drawText, drawTitleScene, renderWorld } from './render'
import { initInput, poll, type Frame } from './input'
import { isMuted, music, resetMusic, sfx, toggleMute, unlock, type Music } from './audio'
import { arcadeLink, buildLabel, crtToggle, fitToWindow, preventZoom, readNumber, watchForUpdates, write } from '../arcade/page'

const DT = 1 / 60
const HISCORE_KEY = 'jawg-adventure-hiscore'

type Screen = 'title' | 'intro' | 'play' | 'paused' | 'over' | 'won'

const canvas = document.getElementById('screen') as HTMLCanvasElement
const frame = document.getElementById('frame') as HTMLDivElement
const ctx = canvas.getContext('2d')!
ctx.imageSmoothingEnabled = false
const toggleCrt = crtToggle(frame, 'jawg-adventure-crt')
const fx = new Fx()
const toArcade = arcadeLink()
preventZoom()

const INTRO = paginate([
  'LONG AGO, THREE HEARTH-FLAMES KEPT THE VALE OF EMBERFALL WARM AND SAFE.',
  'THEN THE ASHEN KING CAME DOWN FROM THE NORTH, AND ONE BY ONE HE SNUFFED THE FLAMES OUT.',
  "NOW THE DARK CREEPS SOUTH. THE VALE'S LAST HOPE IS JUST WAKING UP IN A LITTLE VILLAGE...",
  'YOU.',
])

const readSave = () => {
  try { return parseSave(localStorage.getItem(SAVE_KEY)) } catch { return null }
}

const game = {
  screen: 'title' as Screen,
  screenTime: 0,
  world: createWorld(Date.now() & 0xffff) as World,
  hiscore: readNumber(HISCORE_KEY),
  menu: 0,
  confirmErase: false,
  hasSave: readSave() !== null,
  /** The save has beaten the Ashen King, so the Frostreach is open. */
  chapter2: readSave()?.flags.includes('boss:keep') ?? false,
  intro: { page: 0, shown: 0 },
  lowBeep: 0,
  lastMap: '',
}

function go(screen: Screen) {
  toArcade.show(screen === 'title')
  game.screen = screen
  game.screenTime = 0
}

function save() {
  const w = game.world
  write(SAVE_KEY, JSON.stringify(toSave(w)))
  game.hasSave = true
  game.chapter2 = w.flags.has('boss:keep')
  if (w.score > game.hiscore) {
    game.hiscore = w.score
    write(HISCORE_KEY, String(w.score))
  }
}

function newGame() {
  game.world = createWorld(Date.now() & 0xffff)
  game.lastMap = game.world.map.id
  game.intro = { page: 0, shown: 0 }
  save()
  sfx('start')
  go('intro')
}

function continueSaved() {
  const d = readSave()
  if (!d) { newGame(); return }
  game.world = fromSave(d, Date.now() & 0xffff)
  game.lastMap = game.world.map.id
  sfx('start')
  go('play')
}

// ── Version ─────────────────────────────────────────────────────────────────
const BUILD = buildLabel(import.meta.env.VITE_GIT_SHA, __BUILD_DATE__)
let updateReady = false
watchForUpdates(() => { updateReady = true })

// ── Layout ──────────────────────────────────────────────────────────────────
canvas.width = W
canvas.height = H
fitToWindow(frame, W, H, () => {
  // Portrait phones keep a band below the screen for the thumbs.
  const touch = matchMedia?.('(pointer: coarse)').matches ?? false
  return touch && window.innerHeight > window.innerWidth ? { w: 0, h: 200 } : { w: 0, h: 0 }
})
const scaleOf = () => frame.getBoundingClientRect().width / W

// ── Update ──────────────────────────────────────────────────────────────────
const SAVE_ON = new Set(['room', 'stairs', 'item', 'flame', 'key', 'unlock', 'secret', 'burn', 'buy', 'potion'])

function handle(w: World) {
  let dirty = false
  for (const e of w.events) {
    sfx(e.kind)
    if (SAVE_ON.has(e.kind)) dirty = true
    switch (e.kind) {
      case 'kill': fx.burst(e.x!, e.y!, [PAL[7], PAL[6], PAL[10]], 8, 50); break
      case 'hurt': fx.flash = 0.25; fx.shake = 0.15; break
      case 'blast': fx.shake = 0.3; break
      case 'bossHit': fx.burst(e.x!, e.y!, [PAL[7], PAL[8]], 6, 70); break
      case 'bossDie':
        fx.shake = 1.4
        for (let i = 0; i < 4; i++) fx.burst(e.x! + (i - 1.5) * 8, e.y!, [PAL[7], PAL[9], PAL[10], PAL[8]], 12, 90)
        break
      case 'secret': fx.burst(e.x!, e.y!, [PAL[10], PAL[7]], 10, 40); break
      case 'burn': fx.burst(e.x!, e.y!, [PAL[8], PAL[9], PAL[10]], 10, 50); break
      case 'cut': fx.burst(e.x!, e.y!, [PAL[11], PAL[3]], 6, 40); break
      case 'thud': fx.shake = Math.max(fx.shake, 0.2); break
    }
  }
  if (w.map.id !== game.lastMap) {
    // Dungeons and caves announce themselves, and so does a new land.
    const newLand = MAPS[game.lastMap]?.quest !== w.map.quest
    if (w.map.kind !== 'overworld' || newLand) fx.banner = { text: w.map.name, t: 2.5 }
    game.lastMap = w.map.id
  }
  if (dirty) save()
}

function title(f: Frame, confirm: boolean) {
  const items = game.hasSave ? ['CONTINUE', 'NEW GAME'] : ['NEW GAME']
  if (game.confirmErase) {
    if (f.a || f.start) { game.confirmErase = false; newGame() }
    else if (f.b) { game.confirmErase = false; sfx('select') }
    return
  }
  if (f.pressed.up || f.pressed.down) {
    game.menu = (game.menu + 1) % items.length
    sfx('select')
  }
  // Taps pick a line directly.
  const s = scaleOf()
  for (const tap of f.taps) {
    const y = tap.y / s
    items.forEach((_, i) => { if (Math.abs(y - (128 + i * 14 + 5)) < 7) { game.menu = i; confirm = true } })
  }
  game.menu = Math.min(game.menu, items.length - 1)
  if (!confirm) return
  if (updateReady) { location.reload(); return } // picks up the newer deploy
  const choice = items[game.menu]
  if (choice === 'CONTINUE') continueSaved()
  else if (game.hasSave) { game.confirmErase = true; sfx('select') }
  else newGame()
}

function intro(f: Frame, dt: number) {
  const text = INTRO[game.intro.page]
  const skip = f.start
  if (game.intro.shown < text.length && !skip) {
    game.intro.shown = f.a || f.b ? text.length : Math.min(text.length, game.intro.shown + 30 * dt)
    return
  }
  if (!f.a && !f.b && !skip) return
  game.intro.page++
  game.intro.shown = 0
  if (skip || game.intro.page >= INTRO.length) go('play')
}

/** The same frame with its presses already spent (for later ticks of one frame). */
const idle = (f: Frame): Frame => ({
  ...f, a: false, b: false, start: false, swap: false, taps: [],
  pressed: { up: false, down: false, left: false, right: false },
})

function update(f: Frame, dt: number, first: boolean) {
  game.screenTime += dt
  fx.update(dt)
  const w = game.world
  const pressed = (x: boolean) => first && x

  switch (game.screen) {
    case 'title':
      if (first) title(f, f.a || f.start)
      break

    case 'intro':
      intro(first ? f : idle(f), dt)
      break

    case 'play': {
      if (pressed(f.start) && !w.dialog && !w.scroll && w.phase === 'play') {
        sfx('pause')
        go('paused')
        return
      }
      if (pressed(f.swap) && !w.dialog) { cycleItem(w); sfx('select') }
      const c: Controls = { dx: f.dx, dy: f.dy, a: pressed(f.a), b: pressed(f.b) }
      step(w, c, dt)
      handle(w)
      if (w.phase === 'play' && !w.dialog && w.player.hp <= 2) {
        game.lowBeep -= dt
        if (game.lowBeep <= 0) { sfx('low'); game.lowBeep = 0.8 }
      }
      if (w.phase === 'over') { save(); sfx('over'); go('over') }
      if (w.phase === 'won') { save(); go('won') }
      break
    }

    case 'paused':
      if (pressed(f.pressed.left || f.pressed.right || f.swap || f.b)) { cycleItem(w); sfx('select') }
      if (pressed(f.start || f.a)) { sfx('pause'); go('play') }
      break

    case 'over':
      if (game.screenTime < 1) break
      if (pressed(f.a || f.start)) {
        continueGame(w)
        game.lastMap = w.map.id
        save()
        go('play')
      } else if (pressed(f.b)) {
        game.world = createWorld(Date.now() & 0xffff)
        go('title')
      }
      break

    case 'won':
      if (game.screenTime > 3 && pressed(f.a || f.start)) {
        game.world = createWorld(Date.now() & 0xffff)
        go('title')
      }
      break
  }
}

// ── Music ───────────────────────────────────────────────────────────────────
function wantedMusic(): Music {
  const w = game.world
  switch (game.screen) {
    case 'title':
    case 'intro':
      return 'title'
    case 'over':
      return 'none'
    case 'won':
      return 'ending'
    default:
      if (w.phase !== 'play') return 'none'
      if (w.enemies.some(e => e.boss && e.hp > 0)) return 'boss'
      return w.map.music
  }
}

// ── Draw ────────────────────────────────────────────────────────────────────
const blink = (period = 0.5) => Math.floor(performance.now() / 1000 / period) % 2 === 0
const touchUi = () => matchMedia?.('(pointer: coarse)').matches ?? false

function dim(alpha: number) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`
  ctx.fillRect(0, 0, W, H)
}

function drawTitle(t: number) {
  drawTitleScene(ctx, t)
  centreText(ctx, 'EMBERFALL', W / 2, 34, PAL[9], 5)
  centreText(ctx, 'EMBERFALL', W / 2, 33, PAL[10], 5)
  centreText(ctx, 'RELIGHT THE THREE HEARTH-FLAMES', W / 2, 66, PAL[7])
  centreText(ctx, 'AND SAVE YOUR HOMELAND', W / 2, 76, PAL[7])
  if (game.chapter2 && !game.confirmErase) centreText(ctx, 'CHAPTER 2: THE FROSTREACH IS OPEN', W / 2, 96, blink(0.8) ? PAL[12] : PAL[7])
  if (game.confirmErase) {
    centreText(ctx, 'START OVER? YOUR SAVE', W / 2, 124, PAL[8])
    centreText(ctx, 'WILL BE ERASED.', W / 2, 134, PAL[8])
    centreText(ctx, touchUi() ? 'A: YES     B: NO' : 'Z: YES     X: NO', W / 2, 150, PAL[7])
  } else if (updateReady) {
    ctx.fillStyle = PAL[1]
    ctx.fillRect(24, 122, W - 48, 26)
    centreText(ctx, 'NEW VERSION AVAILABLE!', W / 2, 127, PAL[11])
    if (blink()) centreText(ctx, touchUi() ? 'TAP TO UPDATE' : 'PRESS ENTER TO UPDATE', W / 2, 138, PAL[7])
  } else {
    const items = game.hasSave ? ['CONTINUE', 'NEW GAME'] : ['NEW GAME']
    items.forEach((item, i) => {
      const chosen = i === game.menu
      centreText(ctx, item, W / 2, 128 + i * 14, chosen ? PAL[10] : PAL[6], chosen ? 2 : 1)
      if (chosen && blink(0.3)) drawText(ctx, '>', W / 2 - 50, 131 + i * 14, PAL[10])
    })
  }
  const help = touchUi() ? 'DRAG TO WALK   A: SWORD   B: ITEM' : 'ARROWS MOVE  Z SWORD  X ITEM  ENTER PAUSE'
  centreText(ctx, help, W / 2, 168, PAL[6])
  centreText(ctx, `HI-SCORE ${String(game.hiscore).padStart(6, '0')}`, W / 2, 180, PAL[9])
  centreText(ctx, BUILD, W / 2, H - 9, PAL[5])
}

function drawIntro(t: number) {
  drawTitleScene(ctx, t)
  dim(0.55)
  const text = INTRO[game.intro.page].slice(0, Math.floor(game.intro.shown))
  text.split('\n').forEach((line, i) => drawText(ctx, line, 16, 70 + i * 14, PAL[7], 2))
  if (game.intro.shown >= INTRO[game.intro.page].length && blink()) drawText(ctx, '>', W - 22, 120, PAL[10])
  centreText(ctx, touchUi() ? 'START: SKIP' : 'ENTER: SKIP', W / 2, H - 14, PAL[5])
}

function drawOver(t: number) {
  renderWorld(ctx, game.world, fx, t)
  ctx.fillStyle = 'rgba(0,0,0,0.75)'
  ctx.fillRect(0, HUD, W, H - HUD)
  centreText(ctx, 'YOU HAVE FALLEN', W / 2, HUD + 50, PAL[8], 2)
  centreText(ctx, 'THE EMBERS STILL GLOW. RISE AGAIN?', W / 2, HUD + 76, PAL[7])
  if (game.screenTime > 1) {
    centreText(ctx, touchUi() ? 'A: CONTINUE' : 'Z / ENTER: CONTINUE', W / 2, HUD + 100, blink() ? PAL[10] : PAL[9])
    centreText(ctx, touchUi() ? 'B: BACK TO TITLE' : 'X: BACK TO TITLE', W / 2, HUD + 114, PAL[6])
  }
}

function drawWon(t: number) {
  drawTitleScene(ctx, t)
  dim(0.35)
  const w = game.world
  const frost = questOf(w).id === 'frostreach'
  centreText(ctx, frost ? 'THE NORTH IS FREE!' : 'EMBERFALL IS SAVED!', W / 2, 26, PAL[10], 2)
  if (frost) {
    centreText(ctx, 'THE BEACONS BLAZE AND THE SNOW MELTS.', W / 2, 50, PAL[7])
    centreText(ctx, 'BOTH LANDS SING YOUR NAME.', W / 2, 60, PAL[7])
  } else {
    centreText(ctx, 'THE HEARTH-FLAMES BURN ONCE MORE...', W / 2, 50, PAL[7])
    centreText(ctx, 'BUT WHO SENT THE ASHEN KING?', W / 2, 60, PAL[7])
  }
  const mins = Math.floor(w.time / 60)
  centreText(ctx, `TIME ${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`, W / 2, 80, PAL[6])
  centreText(ctx, `FOES BEATEN ${w.kills}`, W / 2, 90, PAL[6])
  centreText(ctx, `SCORE ${w.score}`, W / 2, 104, PAL[10], 2)
  if (w.score >= game.hiscore) centreText(ctx, 'NEW HI-SCORE!', W / 2, 122, PAL[14])
  if (frost) centreText(ctx, 'THANK YOU FOR PLAYING', W / 2, 142, PAL[9])
  else {
    ctx.fillStyle = PAL[1]
    ctx.fillRect(16, 134, W - 32, 26)
    centreText(ctx, 'CHAPTER 2 UNLOCKED!', W / 2, 138, PAL[12])
    centreText(ctx, 'CONTINUE YOUR SAVE: A SHIP AWAITS AT THE DEAD SHORE', W / 2, 150, PAL[7])
  }
  if (game.screenTime > 3 && blink()) centreText(ctx, touchUi() ? 'PRESS A' : 'PRESS ENTER', W / 2, 184, PAL[6])
}

function draw() {
  const t = performance.now() / 1000
  ctx.fillStyle = PAL[0]
  ctx.fillRect(0, 0, W, H)
  switch (game.screen) {
    case 'title': drawTitle(t); break
    case 'intro': drawIntro(t); break
    case 'play': renderWorld(ctx, game.world, fx, t); break
    case 'paused':
      renderWorld(ctx, game.world, fx, t)
      drawInventory(ctx, game.world, t, touchUi() ? 'START: RESUME   B: SWAP ITEM' : 'ENTER: RESUME   ARROWS: SWAP ITEM')
      break
    case 'over': drawOver(t); break
    case 'won': drawWon(t); break
  }
  if (isMuted()) drawText(ctx, 'MUTE', W - 3, H - 8, PAL[5], 1, 'right')
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
  let first = true
  while (acc >= DT) {
    update(f, DT, first)
    first = false
    acc -= DT
  }
  music(wantedMusic())
  draw()
  requestAnimationFrame(loop)
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.screen === 'play') {
    save()
    if (game.world.phase === 'play' && !game.world.dialog) go('paused')
  }
})

initInput(canvas, () => { unlock(); resetMusic() })
toArcade.show(true)
requestAnimationFrame(loop)

// Dev-server only (stripped from production builds): lets a browser session
// jump to a place or screen when checking visuals.
if (import.meta.env.DEV) {
  Object.assign(window, { __adventure: { game, go, newGame, enterMap, give, MAPS, fx } })
}
