// ─── Arcade: shared page plumbing ───────────────────────────────────────────
//
// Storage that survives private mode, the optional CRT overlay, and scaling a
// fixed-resolution canvas (inside `#frame`) to fit the window with square
// pixels.

export function readNumber(key: string): number {
  try { return Number(localStorage.getItem(key)) || 0 } catch { return 0 }
}

export function write(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* private mode */ }
}

/** CRT scanlines on `frame` (CSS class `crt`), on by default, remembered. */
export function crtToggle(frame: HTMLElement, key: string): () => void {
  let on = (() => { try { return localStorage.getItem(key) !== '0' } catch { return true } })()
  frame.classList.toggle('crt', on)
  return () => {
    on = !on
    frame.classList.toggle('crt', on)
    write(key, on ? '1' : '0')
  }
}

/**
 * Keep `frame` as large as fits the window at the given aspect. Whole-number
 * scaling keeps pixels square; screens too small for 2× fall back to a
 * fractional fit. `reserve` shrinks the usable area (e.g. for touch controls).
 */
export function fitToWindow(
  frame: HTMLElement, viewW: number, viewH: number,
  reserve: () => { w: number; h: number } = () => ({ w: 0, h: 0 }),
): void {
  const resize = () => { fitFrame(frame, viewW, viewH, reserve()) }
  window.addEventListener('resize', resize)
  resize()
}

/** One-off version of fitToWindow, for pages whose resolution changes. Returns the scale. */
export function fitFrame(frame: HTMLElement, viewW: number, viewH: number, reserve = { w: 0, h: 0 }): number {
  const fit = Math.min((window.innerWidth - reserve.w) / viewW, (window.innerHeight - reserve.h) / viewH)
  const scale = fit >= 2 ? Math.floor(fit) : fit
  frame.style.width = `${Math.floor(viewW * scale)}px`
  frame.style.height = `${Math.floor(viewH * scale)}px`
  return scale
}
