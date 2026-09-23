// ─── Retro platformer: controls ─────────────────────────────────────────────
//
// Maps keys, touch buttons and gamepad onto the platformer's actions, using
// the shared arcade input layer (../arcade/input.ts).

import type { Input } from './physics'
import { createInput } from '../arcade/input'

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

const input = createInput<Action>({
  keys: KEYS,
  gamepad: pad => {
    const b = (i: number) => pad.buttons[i]?.pressed
    const axis = pad.axes[0] ?? 0
    const on: Action[] = []
    if (b(14) || axis < -0.4) on.push('left')
    if (b(15) || axis > 0.4) on.push('right')
    if (b(0) || b(1) || b(12)) on.push('jump')
    if (b(9)) on.push('pause')
    return on
  },
})

export function initInput(onFirstInteraction: () => void): void {
  input.init(onFirstInteraction)
  // Tapping the game screen itself also counts as "start".
  document.getElementById('screen')?.addEventListener('pointerdown', () => {
    onFirstInteraction()
    input.press('start')
  })
}

export function poll(): Frame {
  const p = input.poll()
  return {
    input: {
      left: p.held('left'),
      right: p.held('right'),
      jump: p.held('jump'),
      jumpPressed: p.pressed('jump'),
    },
    confirm: p.pressed('start') || p.pressed('jump'),
    pause: p.pressed('pause'),
    mute: p.pressed('mute'),
    crt: p.pressed('crt'),
  }
}
