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

// ── Versions & updates ──────────────────────────────────────────────────────
// The arcade pages are deliberately left out of the main app's service-worker
// precache (see vite.config.ts), so a plain reload always fetches the latest
// deploy. These helpers show which build is running and notice when a newer
// one has been published, so players can pick it up without knowing that.

/** Short build label for a title screen, e.g. "V0CC7216 2026-09-24", or "DEV BUILD". */
export function buildLabel(sha: string | undefined, buildDate: string): string {
  if (!sha) return 'DEV BUILD'
  return `V${sha.slice(0, 7).toUpperCase()} ${buildDate.slice(0, 10)}`
}

/**
 * The page's entry script path from its HTML, e.g. "/assets/shmup-AbC123.js".
 * Vite puts a content hash in that filename, so it changes on every deploy
 * that changes the game.
 */
export function entryScript(html: string): string | null {
  const m = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/)
    ?? html.match(/<script[^>]*src="([^"]+)"[^>]*type="module"/)
  if (!m) return null
  try { return new URL(m[1], 'https://x').pathname } catch { return null }
}

/**
 * Periodically re-fetch this page's HTML (bypassing every cache) and call
 * `onUpdate` once if it now points at a different entry script. Only checks
 * while the tab is visible; network errors are ignored (offline is fine).
 */
export function watchForUpdates(onUpdate: () => void, intervalMs = 5 * 60_000): void {
  const current = entryScript(document.documentElement.outerHTML)
  if (!current || current.startsWith('/src/')) return // dev server: nothing to compare
  let done = false
  const check = async () => {
    if (done || document.hidden) return
    try {
      const res = await fetch(location.pathname, { cache: 'no-store' })
      if (!res.ok) return
      const latest = entryScript(await res.text())
      if (latest && latest !== current) {
        done = true
        onUpdate()
      }
    } catch { /* offline or blocked: try again next time */ }
  }
  window.setTimeout(check, 3000)
  window.setInterval(check, intervalMs)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check() })
}

// ── Back to the arcade ──────────────────────────────────────────────────────
/**
 * A small "ARCADE" link in the top-left corner, back to the /arcade index.
 * Games show it on their title screen only (call `show(screen === 'title')`
 * whenever the screen changes); Esc follows it while it is showing.
 */
export function arcadeLink(): { show: (on: boolean) => void } {
  const a = document.createElement('a')
  a.href = '/arcade'
  a.textContent = '◀ ARCADE'
  a.setAttribute('aria-label', 'Back to the arcade')
  Object.assign(a.style, {
    position: 'fixed',
    top: 'calc(8px + env(safe-area-inset-top))',
    left: 'calc(8px + env(safe-area-inset-left))',
    padding: '7px 10px',
    border: '2px solid rgba(255, 255, 255, 0.35)',
    borderRadius: '6px',
    background: 'rgba(0, 0, 0, 0.45)',
    color: 'rgba(255, 255, 255, 0.75)',
    font: 'bold 13px ui-monospace, Menlo, Consolas, monospace',
    textDecoration: 'none',
    touchAction: 'manipulation',
    zIndex: '10',
  } satisfies Partial<CSSStyleDeclaration>)
  a.addEventListener('pointerdown', e => {
    // The games treat any tap as "start"; this tap is only for the link.
    e.stopPropagation()
    a.style.transform = 'translateY(1px)'
  })
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) a.addEventListener(ev, () => { a.style.transform = '' })
  document.body.appendChild(a)
  let on = true
  window.addEventListener('keydown', e => {
    if (on && e.code === 'Escape') location.href = a.href
  })
  return {
    show: v => {
      on = v
      a.style.display = v ? 'block' : 'none'
    },
  }
}

/**
 * Stop a phone zooming a game page. iOS Safari ignores `user-scalable=no`
 * and doesn't apply `touch-action` to the page itself, so two fast taps on a
 * control zoomed in, and with pinch blocked there was no way back out.
 *  - Double tap: cancelling touchend stops it; the games read pointer events,
 *    which still fire. Links are left alone so they still get a click.
 *  - Pinch: Safari's own gesture events, plus any two-finger touchmove for
 *    browsers without them. One-finger drags are untouched.
 * Keyboard zoom on desktop (Ctrl/Cmd +/-) is left alone: it's easy to undo
 * and the canvas refits to the window.
 */
export function preventZoom(): void {
  const cancel = (e: Event) => { if (e.cancelable) e.preventDefault() }
  document.addEventListener('touchend', e => {
    if ((e.target as Element).closest?.('a, input, select, textarea')) return
    cancel(e)
  }, { passive: false })
  document.addEventListener('touchmove', e => {
    if (e.touches.length > 1) cancel(e)
  }, { passive: false })
  document.addEventListener('dblclick', cancel)
  // Safari-only (not in the standard event map).
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, cancel, { passive: false })
  }
}
