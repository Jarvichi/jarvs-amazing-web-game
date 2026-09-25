// ─── /haul: controls ────────────────────────────────────────────────────────
//
// Keyboard and gamepad come from the shared arcade input layer. On a phone
// you swipe anywhere: each flick of about a fingertip sets the way to go, and
// you can keep your thumb down and steer corner to corner without lifting.
// The walker turns at the next corner that fits, so a swipe can come early.
// Taps are reported separately, in canvas pixels, for the menus.

import { createInput } from '../arcade/input'
import type { Dir } from './maze'

type Action = 'left' | 'right' | 'up' | 'down' | 'start' | 'pause' | 'mute' | 'crt'

const KEYS: Record<string, Action> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Enter: 'start', Space: 'start', KeyZ: 'start',
  KeyP: 'pause', Escape: 'pause',
  KeyM: 'mute',
  KeyC: 'crt',
}

const input = createInput<Action>({
  keys: KEYS,
  gamepad: pad => {
    const b = (i: number) => pad.buttons[i]?.pressed
    const [ax = 0, ay = 0] = pad.axes
    const on: Action[] = []
    if (b(14) || ax < -0.5) on.push('left')
    if (b(15) || ax > 0.5) on.push('right')
    if (b(12) || ay < -0.5) on.push('up')
    if (b(13) || ay > 0.5) on.push('down')
    if (b(0) || b(1)) on.push('start')
    if (b(9)) on.push('pause')
    return on
  },
})

export interface Frame {
  /** A direction asked for this frame (a swipe, or a key going down). */
  dir: Dir | null
  /** Directions held on keys or pad, newest-first order not guaranteed. */
  held: Dir[]
  /** Taps since last poll, in CSS pixels relative to the canvas. */
  taps: { x: number; y: number }[]
  left: boolean
  right: boolean
  confirm: boolean
  pause: boolean
  mute: boolean
  crt: boolean
}

/** Finger travel, in CSS pixels, that counts as a swipe. */
const SWIPE = 14

let swiped: Dir | null = null
let taps: { x: number; y: number }[] = []
const pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; swiped: boolean }>()
/** The pointer that steers: the most recently pressed one still down. */
let steering: number | null = null

function releaseAll() {
  pointers.clear()
  steering = null
}

export function initInput(canvas: HTMLElement, onFirstInteraction: () => void): void {
  input.init(onFirstInteraction)
  window.addEventListener('pointerdown', e => {
    if ((e.target as HTMLElement).closest?.('button, a')) return
    onFirstInteraction()
    // A primary pointer means no other finger is down, so anything still
    // tracked is stale (iOS drops pointerups in multi-touch).
    if (e.isPrimary) pointers.clear()
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), swiped: false })
    steering = e.pointerId
  })
  window.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId)
    if (!p || e.pointerId !== steering) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return
    swiped = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'
    p.swiped = true
    // Measure the next swipe from here, so one long drag can turn twice.
    p.x = e.clientX
    p.y = e.clientY
  })
  const end = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId)
    if (!p) return
    pointers.delete(e.pointerId)
    if (steering === e.pointerId) steering = [...pointers.keys()].pop() ?? null
    const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy)
    if (!p.swiped && moved < 10 && performance.now() - p.t < 400) {
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

const DIR_ACTIONS: Dir[] = ['up', 'down', 'left', 'right']

export function poll(): Frame {
  const p = input.poll()
  const keyed = DIR_ACTIONS.find(d => p.pressed(d)) ?? null
  const frame: Frame = {
    dir: swiped ?? keyed,
    held: DIR_ACTIONS.filter(d => p.held(d)),
    taps,
    left: p.pressed('left') || swiped === 'left',
    right: p.pressed('right') || swiped === 'right',
    confirm: p.pressed('start'),
    pause: p.pressed('pause'),
    mute: p.pressed('mute'),
    crt: p.pressed('crt'),
  }
  swiped = null
  taps = []
  return frame
}
