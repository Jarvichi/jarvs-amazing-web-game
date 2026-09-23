// ─── /shmup: controls ───────────────────────────────────────────────────────
//
// Keyboard and gamepad come from the shared arcade input layer. Touch works
// differently from /retro: there are no d-pad buttons — you drag anywhere and
// the ship moves by the same distance (relative, so your thumb never hides
// it), with auto-fire while a finger is down. Taps are reported separately
// in canvas pixels for the menus and the shop.

import { createInput } from '../arcade/input'

type Action = 'left' | 'right' | 'up' | 'down' | 'fire' | 'bomb' | 'start' | 'pause' | 'mute' | 'crt'

const KEYS: Record<string, Action> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'fire', KeyZ: 'fire', KeyJ: 'fire', KeyK: 'fire',
  KeyB: 'bomb', KeyX: 'bomb', KeyL: 'bomb',
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
    if (b(14) || ax < -0.4) on.push('left')
    if (b(15) || ax > 0.4) on.push('right')
    if (b(12) || ay < -0.4) on.push('up')
    if (b(13) || ay > 0.4) on.push('down')
    if (b(0) || b(1) || b(2)) on.push('fire')
    if (b(3)) on.push('bomb')
    if (b(9)) on.push('pause')
    return on
  },
})

export interface Frame {
  dx: number
  dy: number
  /** Drag since last poll, in CSS pixels. */
  dragX: number
  dragY: number
  fire: boolean
  touching: boolean
  /** Taps since last poll, in CSS pixels relative to the canvas. */
  taps: { x: number; y: number }[]
  up: boolean
  down: boolean
  confirm: boolean
  firePressed: boolean
  bomb: boolean
  pause: boolean
  mute: boolean
  crt: boolean
}

let dragX = 0
let dragY = 0
let taps: { x: number; y: number }[] = []
const pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>()

export function initInput(canvas: HTMLElement, onFirstInteraction: () => void): void {
  input.init(onFirstInteraction)
  // Listen on the whole window so a drag can start in the black margins too.
  window.addEventListener('pointerdown', e => {
    if ((e.target as HTMLElement).closest?.('button')) return
    onFirstInteraction()
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() })
  })
  window.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId)
    if (!p) return
    // Only the first finger steers; a second one is ignored.
    if (pointers.keys().next().value === e.pointerId) {
      dragX += e.clientX - p.x
      dragY += e.clientY - p.y
    }
    p.x = e.clientX
    p.y = e.clientY
  })
  const end = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId)
    if (!p) return
    pointers.delete(e.pointerId)
    const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy)
    if (moved < 10 && performance.now() - p.t < 400) {
      const r = canvas.getBoundingClientRect()
      taps.push({ x: e.clientX - r.left, y: e.clientY - r.top })
    }
  }
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
  window.addEventListener('blur', () => pointers.clear())
}

export function poll(): Frame {
  const p = input.poll()
  const frame: Frame = {
    dx: (p.held('right') ? 1 : 0) - (p.held('left') ? 1 : 0),
    dy: (p.held('down') ? 1 : 0) - (p.held('up') ? 1 : 0),
    dragX,
    dragY,
    fire: p.held('fire') || pointers.size > 0,
    touching: pointers.size > 0,
    taps,
    up: p.pressed('up'),
    down: p.pressed('down'),
    confirm: p.pressed('start') || p.pressed('fire'),
    firePressed: p.pressed('fire'),
    bomb: p.pressed('bomb'),
    pause: p.pressed('pause'),
    mute: p.pressed('mute'),
    crt: p.pressed('crt'),
  }
  dragX = 0
  dragY = 0
  taps = []
  return frame
}
