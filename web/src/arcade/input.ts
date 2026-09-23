// ─── Arcade: shared keyboard, touch-button and gamepad input ────────────────
//
// Held state is tracked per source (keyboard, each touch button, gamepad) and
// merged, so releasing one source never cancels another still holding the
// same action. `poll()` also reports actions that went down since the previous
// poll (edge-triggered), so a tap shorter than one frame is never lost.
//
// Touch buttons are any `<button data-key="action">` on the page; they are
// shown (by adding `on` to `#touch`) only on coarse-pointer devices.

export interface InputConfig<A extends string> {
  /** KeyboardEvent.code → action. */
  keys: Record<string, A>
  /** Actions a connected gamepad is holding right now. */
  gamepad?: (pad: Gamepad) => A[]
}

export interface Polled<A extends string> {
  held: (a: A) => boolean
  pressed: (a: A) => boolean
}

export interface Input<A extends string> {
  init: (onFirstInteraction: () => void) => void
  /** Mark an action as pressed this frame (e.g. from a game-specific tap). */
  press: (a: A) => void
  poll: () => Polled<A>
}

export function isTouchDevice(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window
}

export function createInput<A extends string>(config: InputConfig<A>): Input<A> {
  const held = new Set<string>() // `${source}:${action}`
  const pressed = new Set<A>()
  let padHeld = new Set<A>()

  const down = (source: string, a: A) => {
    const key = `${source}:${a}`
    if (!held.has(key)) pressed.add(a)
    held.add(key)
  }
  const up = (source: string, a: A) => { held.delete(`${source}:${a}`) }
  const isHeld = (a: A) => {
    for (const k of held) if (k.endsWith(`:${a}`)) return true
    return false
  }

  function init(onFirstInteraction: () => void) {
    window.addEventListener('keydown', e => {
      const a = config.keys[e.code]
      onFirstInteraction()
      if (!a) return
      e.preventDefault()
      if (!e.repeat) down('key', a)
    })
    window.addEventListener('keyup', e => {
      const a = config.keys[e.code]
      if (a) up('key', a)
    })
    window.addEventListener('blur', () => held.clear())

    if (isTouchDevice()) document.getElementById('touch')?.classList.add('on')
    document.querySelectorAll<HTMLButtonElement>('button[data-key]').forEach(btn => {
      const a = btn.dataset.key as A
      const id = `touch-${a}`
      const release = () => { up(id, a); btn.classList.remove('down') }
      btn.addEventListener('pointerdown', e => {
        e.preventDefault()
        e.stopPropagation()
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
  }

  function pollGamepad() {
    if (!config.gamepad) return
    const now = new Set<A>()
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (pad) for (const a of config.gamepad(pad)) now.add(a)
    }
    for (const a of now) down('pad', a)
    for (const a of padHeld) if (!now.has(a)) up('pad', a)
    padHeld = now
  }

  function poll(): Polled<A> {
    pollGamepad()
    const snapshot = new Set(pressed)
    pressed.clear()
    return { held: isHeld, pressed: a => snapshot.has(a) }
  }

  return { init, press: a => { pressed.add(a) }, poll }
}
