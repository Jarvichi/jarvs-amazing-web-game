// ─── Retro platformer: keyboard, touch and gamepad input ────────────────────
//
// Held state is tracked per source and merged in `poll()`, which also reports
// buttons that went down since the previous poll (edge-triggered), so a tap
// shorter than one frame is never lost.

import type { Input } from './physics'

type Action = 'left' | 'right' | 'jump' | 'start' | 'pause' | 'mute' | 'crt'

const KEYS: Record<string, Action> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
  Enter: 'start',
  KeyP: 'pause', Escape: 'pause',
  KeyM: 'mute',
  KeyC: 'crt',
}

export interface Frame {
  input: Input
  /** Any "go" button: start, or jump — so touch players can begin with A. */
  confirm: boolean
  pause: boolean
  mute: boolean
  crt: boolean
}

const held = new Set<string>() // `${source}:${action}`
const pressed = new Set<Action>()
let padPrev = new Set<Action>()

function down(source: string, a: Action) {
  const key = `${source}:${a}`
  if (!held.has(key)) pressed.add(a)
  held.add(key)
}

function up(source: string, a: Action) {
  held.delete(`${source}:${a}`)
}

const isHeld = (a: Action) => [...held].some(k => k.endsWith(`:${a}`))

export function initInput(onFirstInteraction: () => void): void {
  window.addEventListener('keydown', e => {
    const a = KEYS[e.code]
    onFirstInteraction()
    if (!a) return
    e.preventDefault()
    if (!e.repeat) down('key', a)
  })
  window.addEventListener('keyup', e => {
    const a = KEYS[e.code]
    if (a) up('key', a)
  })
  window.addEventListener('blur', () => held.clear())

  const touch = document.getElementById('touch')
  const coarse = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window
  if (touch && coarse) touch.classList.add('on')
  document.querySelectorAll<HTMLButtonElement>('#touch button[data-key], #touch-pause button[data-key]').forEach(btn => {
    const a = btn.dataset.key as Action
    const id = `touch-${a}`
    const release = () => { up(id, a); btn.classList.remove('down') }
    btn.addEventListener('pointerdown', e => {
      e.preventDefault()
      onFirstInteraction()
      btn.setPointerCapture?.(e.pointerId)
      down(id, a)
      btn.classList.add('down')
    })
    btn.addEventListener('pointerup', release)
    btn.addEventListener('pointercancel', release)
    btn.addEventListener('lostpointercapture', release)
    btn.addEventListener('contextmenu', e => e.preventDefault())
  })

  // Tapping the game screen itself also counts as "start".
  document.getElementById('screen')?.addEventListener('pointerdown', () => {
    onFirstInteraction()
    pressed.add('start')
  })
}

function pollGamepad() {
  const pads = navigator.getGamepads?.() ?? []
  const now = new Set<Action>()
  for (const pad of pads) {
    if (!pad) continue
    const b = (i: number) => pad.buttons[i]?.pressed
    const axis = pad.axes[0] ?? 0
    if (b(14) || axis < -0.4) now.add('left')
    if (b(15) || axis > 0.4) now.add('right')
    if (b(0) || b(1) || b(12)) now.add('jump')
    if (b(9)) now.add('pause')
  }
  for (const a of ['left', 'right', 'jump', 'pause'] as Action[]) {
    if (now.has(a)) down('pad', a)
    else up('pad', a)
  }
  if (now.has('jump') && !padPrev.has('jump')) pressed.add('jump')
  padPrev = now
}

export function poll(): Frame {
  pollGamepad()
  const frame: Frame = {
    input: {
      left: isHeld('left'),
      right: isHeld('right'),
      jump: isHeld('jump'),
      jumpPressed: pressed.has('jump'),
    },
    confirm: pressed.has('start') || pressed.has('jump'),
    pause: pressed.has('pause'),
    mute: pressed.has('mute'),
    crt: pressed.has('crt'),
  }
  pressed.clear()
  return frame
}
