// ─── /adventure: controls ───────────────────────────────────────────────────
//
// Keyboard and gamepad come from the shared arcade input layer. On touch
// screens a thumbstick appears wherever a finger lands (outside the A, B and
// START buttons) and steers four ways. As in /shmup, the newest finger steers
// and a primary press clears any stale pointers, because iOS drops pointerups
// in multi-touch. Short taps are also reported, for the menus.

import { createInput } from '../arcade/input'

type Action = 'left' | 'right' | 'up' | 'down' | 'a' | 'b' | 'start' | 'swap' | 'mute' | 'crt'

const KEYS: Record<string, Action> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  KeyZ: 'a', KeyJ: 'a', Space: 'a',
  KeyX: 'b', KeyK: 'b',
  Enter: 'start', KeyP: 'start',
  KeyQ: 'swap', ShiftLeft: 'swap', ShiftRight: 'swap', Tab: 'swap',
  KeyM: 'mute',
  KeyC: 'crt',
}

const input = createInput<Action>({
  keys: KEYS,
  gamepad: pad => {
    const b = (i: number) => pad.buttons[i]?.pressed
    const [ax = 0, ay = 0] = pad.axes
    const on: Action[] = []
    if (b(14) || ax < -0.4) on.push('left')
    if (b(15) || ax > 0.4) on.push('right')
    if (b(12) || ay < -0.4) on.push('up')
    if (b(13) || ay > 0.4) on.push('down')
    if (b(0)) on.push('a')
    if (b(1) || b(2)) on.push('b')
    if (b(3) || b(8)) on.push('swap')
    if (b(9)) on.push('start')
    return on
  },
})

type Way = 'left' | 'right' | 'up' | 'down'

export interface Frame {
  /** Direction held, -1…1 on each axis. */
  dx: number
  dy: number
  /** Directions pressed since the last poll, for menus. */
  pressed: Record<Way, boolean>
  a: boolean
  b: boolean
  start: boolean
  swap: boolean
  mute: boolean
  crt: boolean
  /** Short taps since the last poll, in CSS pixels relative to the canvas. */
  taps: { x: number; y: number }[]
}

const DEAD = 10
const REACH = 36

interface Finger { x: number; y: number; ox: number; oy: number; sx: number; sy: number; t: number }
const fingers = new Map<number, Finger>()
let steering: number | null = null
let lastWay: Way | null = null
let taps: { x: number; y: number }[] = []
let stickEl: HTMLElement | null = null
let knobEl: HTMLElement | null = null

function releaseAll() {
  fingers.clear()
  steering = null
  showStick()
}

function stickWay(): Way | null {
  const f = steering === null ? undefined : fingers.get(steering)
  if (!f) return null
  const dx = f.x - f.ox
  const dy = f.y - f.oy
  if (Math.max(Math.abs(dx), Math.abs(dy)) < DEAD) return null
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'up' : 'down'
}

function showStick() {
  if (!stickEl || !knobEl) return
  const f = steering === null ? undefined : fingers.get(steering)
  stickEl.style.display = f ? 'block' : 'none'
  if (!f) return
  stickEl.style.transform = `translate(${f.ox - 40}px, ${f.oy - 40}px)`
  const dx = Math.max(-REACH, Math.min(REACH, f.x - f.ox))
  const dy = Math.max(-REACH, Math.min(REACH, f.y - f.oy))
  knobEl.style.transform = `translate(${dx}px, ${dy}px)`
}

export function initInput(canvas: HTMLElement, onFirstInteraction: () => void): void {
  input.init(onFirstInteraction)
  stickEl = document.getElementById('stick')
  knobEl = document.getElementById('knob')
  window.addEventListener('pointerdown', e => {
    if ((e.target as HTMLElement).closest?.('button, a')) return
    onFirstInteraction()
    if (e.isPrimary) fingers.clear()
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() })
    steering = e.pointerId
    showStick()
  })
  window.addEventListener('pointermove', e => {
    const f = fingers.get(e.pointerId)
    if (!f) return
    f.x = e.clientX
    f.y = e.clientY
    // A floating stick: drag past its reach and the centre follows the thumb.
    const dx = f.x - f.ox
    const dy = f.y - f.oy
    const d = Math.hypot(dx, dy)
    if (d > REACH) {
      f.ox = f.x - (dx / d) * REACH
      f.oy = f.y - (dy / d) * REACH
    }
    if (e.pointerId === steering) showStick()
  })
  const end = (e: PointerEvent) => {
    const f = fingers.get(e.pointerId)
    if (!f) return
    fingers.delete(e.pointerId)
    if (steering === e.pointerId) steering = [...fingers.keys()].pop() ?? null
    showStick()
    if (Math.hypot(e.clientX - f.sx, e.clientY - f.sy) < 10 && performance.now() - f.t < 400) {
      const r = canvas.getBoundingClientRect()
      taps.push({ x: e.clientX - r.left, y: e.clientY - r.top })
    }
  }
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
  const allUp = (e: TouchEvent) => { if (e.touches.length === 0) releaseAll() }
  window.addEventListener('touchend', allUp)
  window.addEventListener('touchcancel', allUp)
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll() })
  window.addEventListener('blur', releaseAll)
  window.addEventListener('contextmenu', e => e.preventDefault())
}

export function poll(): Frame {
  const p = input.poll()
  const way = stickWay()
  const stickPressed = way !== null && way !== lastWay ? way : null
  lastWay = way
  const held = (w: Way) => p.held(w) || way === w
  const frame: Frame = {
    dx: (held('right') ? 1 : 0) - (held('left') ? 1 : 0),
    dy: (held('down') ? 1 : 0) - (held('up') ? 1 : 0),
    pressed: {
      left: p.pressed('left') || stickPressed === 'left',
      right: p.pressed('right') || stickPressed === 'right',
      up: p.pressed('up') || stickPressed === 'up',
      down: p.pressed('down') || stickPressed === 'down',
    },
    a: p.pressed('a'),
    b: p.pressed('b'),
    start: p.pressed('start'),
    swap: p.pressed('swap'),
    mute: p.pressed('mute'),
    crt: p.pressed('crt'),
    taps,
  }
  taps = []
  return frame
}
