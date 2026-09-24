// ─── /chase: controls ───────────────────────────────────────────────────────
//
// Keyboard and gamepad come from the shared arcade input layer; you hold a
// key to accelerate. On touch the car accelerates by itself: the left thumb
// steers on a pad (left or right of its middle), the right thumb has BRAKE
// and TURBO.
//
// Touch is tracked here per pointer rather than with per-button listeners,
// following /shmup: iOS drops pointerups in multi-touch, so a primary
// pointerdown (no other finger down) clears any stale pointers, the newest
// finger on the pad always steers, and lifting every finger releases all.

import { createInput, isTouchDevice } from '../arcade/input'

type Action = 'left' | 'right' | 'gas' | 'brake' | 'turbo' | 'start' | 'pause' | 'mute' | 'crt'

const KEYS: Record<string, Action> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'gas', KeyW: 'gas', KeyZ: 'gas',
  ArrowDown: 'brake', KeyS: 'brake', KeyX: 'brake',
  Space: 'turbo', ShiftLeft: 'turbo', ShiftRight: 'turbo',
  Enter: 'start',
  KeyP: 'pause', Escape: 'pause',
  KeyM: 'mute',
  KeyC: 'crt',
}

const input = createInput<Action>({
  keys: KEYS,
  gamepad: pad => {
    const b = (i: number) => pad.buttons[i]?.pressed
    const [ax = 0] = pad.axes
    const on: Action[] = []
    if (b(14) || ax < -0.3) on.push('left')
    if (b(15) || ax > 0.3) on.push('right')
    if (b(0) || b(7)) on.push('gas')
    if (b(1) || b(6)) on.push('brake')
    if (b(2) || b(3) || b(5)) on.push('turbo')
    if (b(9)) on.push('pause')
    return on
  },
})

export interface Frame {
  /** -1 … +1. */
  steer: number
  gas: boolean
  brake: boolean
  /** Turbo went down since the last poll. */
  turbo: boolean
  /** Start / select in menus (keyboard, pad or a tap). */
  confirm: boolean
  pause: boolean
  mute: boolean
  crt: boolean
  /** Taps since last poll, in CSS pixels relative to the canvas. */
  taps: { x: number; y: number }[]
  /** Is the player driving by touch (auto-accelerate)? */
  touch: boolean
}

type Zone = 'steer' | 'brake' | 'turbo' | null

interface Pointer { x: number; y: number; sx: number; sy: number; t: number; zone: Zone }

const pointers = new Map<number, Pointer>()
/** The pointer steering: the newest one that went down on the pad. */
let steering: number | null = null
let turboTapped = false
let taps: { x: number; y: number }[] = []
let touchMode = false
const zones: Record<Exclude<Zone, null>, HTMLElement | null> = { steer: null, brake: null, turbo: null }

function zoneAt(x: number, y: number): Zone {
  for (const [name, el] of Object.entries(zones) as [Exclude<Zone, null>, HTMLElement | null][]) {
    if (!el) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0) continue // hidden (no touch controls on this device)
    // A little slack around each pad: thumbs are not precise.
    if (x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12) return name
  }
  return null
}

function releaseAll() {
  pointers.clear()
  steering = null
}

export function initInput(canvas: HTMLElement, onFirstInteraction: () => void): void {
  input.init(onFirstInteraction)
  zones.steer = document.getElementById('pad-steer')
  zones.brake = document.getElementById('pad-brake')
  zones.turbo = document.getElementById('pad-turbo')
  if (isTouchDevice()) touchMode = true

  window.addEventListener('keydown', () => { touchMode = false })
  window.addEventListener('pointerdown', e => {
    if ((e.target as HTMLElement).closest?.('button')) return
    onFirstInteraction()
    if (e.pointerType === 'touch') touchMode = true
    if (e.isPrimary) releaseAll()
    const zone = zoneAt(e.clientX, e.clientY)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), zone })
    if (zone === 'steer') steering = e.pointerId
    if (zone === 'turbo') turboTapped = true
  })
  window.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId)
    if (!p) return
    p.x = e.clientX
    p.y = e.clientY
  })
  const end = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId)
    if (!p) return
    pointers.delete(e.pointerId)
    if (steering === e.pointerId) {
      steering = [...pointers.entries()].filter(([, q]) => q.zone === 'steer').map(([id]) => id).pop() ?? null
    }
    const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy)
    if (!p.zone && moved < 12 && performance.now() - p.t < 400) {
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
}

function touchSteer(): number {
  const p = steering === null ? undefined : pointers.get(steering)
  const pad = zones.steer
  if (!p || !pad) return 0
  const r = pad.getBoundingClientRect()
  const off = p.x - (r.left + r.width / 2)
  return Math.abs(off) < 8 ? 0 : Math.sign(off)
}

export function poll(): Frame {
  const p = input.poll()
  const touchBrake = [...pointers.values()].some(q => q.zone === 'brake')
  const steerTouch = touchSteer()
  const keySteer = (p.held('right') ? 1 : 0) - (p.held('left') ? 1 : 0)
  if (p.held('gas') || keySteer !== 0) touchMode = false
  const brake = p.held('brake') || touchBrake
  const frame: Frame = {
    steer: Math.max(-1, Math.min(1, keySteer + steerTouch)),
    gas: p.held('gas') || (touchMode && !brake),
    brake,
    turbo: p.pressed('turbo') || turboTapped,
    confirm: p.pressed('start') || p.pressed('turbo') || p.pressed('gas'),
    pause: p.pressed('pause'),
    mute: p.pressed('mute'),
    crt: p.pressed('crt'),
    taps,
    touch: touchMode,
  }
  zones.steer?.classList.toggle('left', steerTouch < 0)
  zones.steer?.classList.toggle('right', steerTouch > 0)
  zones.brake?.classList.toggle('down', touchBrake)
  zones.turbo?.classList.toggle('down', [...pointers.values()].some(q => q.zone === 'turbo'))
  turboTapped = false
  taps = []
  return frame
}
