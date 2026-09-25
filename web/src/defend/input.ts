// ─── /defend: controls ──────────────────────────────────────────────────────
//
// Touch and mouse: every press fires at the point pressed — on pointerdown,
// not release, so it feels instant — and every finger counts, so two thumbs
// can fire at once. Keyboard and gamepad move a crosshair and fire from a
// chosen base (or the nearest).

import { createInput } from '../arcade/input'

type Action =
  | 'left' | 'right' | 'up' | 'down' | 'fire' | 'fireL' | 'fireC' | 'fireR'
  | 'start' | 'pause' | 'mute' | 'crt'

const KEYS: Record<string, Action> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  Space: 'fire', KeyA: 'fireL', KeyS: 'fireC', KeyD: 'fireR',
  Enter: 'start',
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
    if (b(14) || ax < -0.3) on.push('left')
    if (b(15) || ax > 0.3) on.push('right')
    if (b(12) || ay < -0.3) on.push('up')
    if (b(13) || ay > 0.3) on.push('down')
    if (b(0)) on.push('fire')
    if (b(2)) on.push('fireL')
    if (b(3)) on.push('fireC')
    if (b(1)) on.push('fireR')
    if (b(9)) on.push('pause')
    return on
  },
})

export interface Frame {
  /** Crosshair movement, -1…1 each way (keyboard / gamepad). */
  dx: number
  dy: number
  /** Presses since last poll, in CSS pixels relative to the canvas. */
  taps: { x: number; y: number }[]
  /** Crosshair shots: -1 = nearest base, 0/1/2 = that base. */
  shots: number[]
  confirm: boolean
  pause: boolean
  mute: boolean
  crt: boolean
}

let taps: { x: number; y: number }[] = []

export function initInput(canvas: HTMLElement, onFirstInteraction: () => void): void {
  input.init(onFirstInteraction)
  window.addEventListener('pointerdown', e => {
    if ((e.target as HTMLElement).closest?.('button, a')) return
    onFirstInteraction()
    const r = canvas.getBoundingClientRect()
    taps.push({ x: e.clientX - r.left, y: e.clientY - r.top })
  })
  // No long-press menus or double-tap zoom mid-wave.
  window.addEventListener('contextmenu', e => e.preventDefault())
}

export function poll(): Frame {
  const p = input.poll()
  const shots: number[] = []
  if (p.pressed('fire')) shots.push(-1)
  if (p.pressed('fireL')) shots.push(0)
  if (p.pressed('fireC')) shots.push(1)
  if (p.pressed('fireR')) shots.push(2)
  const frame: Frame = {
    dx: (p.held('right') ? 1 : 0) - (p.held('left') ? 1 : 0),
    dy: (p.held('down') ? 1 : 0) - (p.held('up') ? 1 : 0),
    taps,
    shots,
    confirm: p.pressed('start') || p.pressed('fire'),
    pause: p.pressed('pause'),
    mute: p.pressed('mute'),
    crt: p.pressed('crt'),
  }
  taps = []
  return frame
}
