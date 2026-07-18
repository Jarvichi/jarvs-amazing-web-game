// ── WebGL context-loss recovery state machine ─────────────────────────────────
// Extracted from usePixiApp so the defer/attempt logic is unit-testable without
// Pixi or a DOM. Two mobile-specific rules drive the design:
//
// 1. Never rebuild while the page is hidden. Creating a WebGL context on a
//    backgrounded page routinely fails or is immediately re-lost, which would
//    burn the whole attempt budget before the player even returns. A loss while
//    hidden tears down immediately (freeing GPU memory) but defers the rebuild
//    to the next foreground resume.
// 2. The attempt cap only guards against tight failure loops, never permanent
//    surrender. Attempts reset after every successful rebuild, and a give-up
//    re-arms on the next foreground resume — GPU/memory pressure that failed
//    three attempts in two seconds is usually gone minutes later.
//
// onVisible also handles the loss iOS never announces: a backgrounded tab's
// context can be reclaimed without webglcontextlost ever firing, so the caller
// supplies an isContextLost() probe to detect it on resume.
//
// onInitFailed covers the boot-time variant of the same pressure: app.init()
// rejecting outright (no context to lose yet). Those failures retry on a
// backoff while visible, or defer to the next resume while hidden — previously
// they dead-ended, leaving a permanently black canvas.

export type ContextLossEvent =
  | 'contextlost'
  | 'rebuild-deferred'
  | 'rebuild-started'
  | 'silent-context-loss'
  | 'rebuild-given-up'
  | 'retry-scheduled'
  | 'budget-rearmed'

export interface ContextLossEventData {
  attempts: number
  hidden: boolean
  /** Only on 'retry-scheduled': backoff delay until the retry fires. */
  delayMs?: number
}

export interface ContextLossControllerOpts {
  maxAttempts: number
  isHidden: () => boolean
  teardown: () => void
  rebuild: () => void
  notify: (event: ContextLossEvent, data: ContextLossEventData) => void
  /** Injectable timer for init-failure retries (tests). Returns a cancel fn. */
  scheduleRetry?: (fn: () => void, delayMs: number) => () => void
}

// Backoff for init-failure retries: 1s, 2s, then 4s per attempt already burned.
const RETRY_BASE_DELAY_MS = 1000

export function createContextLossController(opts: ContextLossControllerOpts) {
  const scheduleRetry = opts.scheduleRetry ?? ((fn, delayMs) => {
    const id = setTimeout(fn, delayMs)
    return () => clearTimeout(id)
  })

  let attempts = 0
  let pendingRebuild = false
  let gaveUp = false
  let cancelRetry: (() => void) | null = null

  const state = () => ({ attempts, hidden: opts.isHidden() })

  const cancelPendingRetry = () => {
    cancelRetry?.()
    cancelRetry = null
  }

  // Counts an attempt and either rebuilds or gives up at the cap. The app is
  // expected to be torn down already (or torn down here for the silent-loss path
  // via tearDownFirst). Every rebuild entry point funnels through here, so any
  // scheduled init-failure retry is superseded and cancelled first.
  const tryRebuild = (tearDownFirst: boolean) => {
    cancelPendingRetry()
    attempts++
    if (attempts > opts.maxAttempts) {
      gaveUp = true
      opts.notify('rebuild-given-up', state())
      if (tearDownFirst) opts.teardown()
      return
    }
    opts.notify('rebuild-started', state())
    if (tearDownFirst) opts.teardown()
    opts.rebuild()
  }

  return {
    /** Call from the canvas webglcontextlost handler (after preventDefault). */
    onContextLost(): void {
      opts.notify('contextlost', state())
      if (opts.isHidden()) {
        opts.teardown()
        pendingRebuild = true
        opts.notify('rebuild-deferred', state())
        return
      }
      opts.teardown()
      tryRebuild(false)
    },

    /** Call when app.init() rejects (initial mount or rebuild) — the caller is
     *  expected to have already destroyed the partial app. Retries on a backoff
     *  while visible; while hidden, defers to the next foreground resume. */
    onInitFailed(): void {
      if (gaveUp) return
      if (opts.isHidden()) {
        pendingRebuild = true
        opts.notify('rebuild-deferred', state())
        return
      }
      const delayMs = RETRY_BASE_DELAY_MS * 2 ** Math.min(attempts, 2)
      opts.notify('retry-scheduled', { ...state(), delayMs })
      cancelRetry = scheduleRetry(() => {
        cancelRetry = null
        if (pendingRebuild) return  // the resume path owns the rebuild now
        if (opts.isHidden()) {
          pendingRebuild = true
          opts.notify('rebuild-deferred', state())
          return
        }
        tryRebuild(false)
      }, delayMs)
    },

    /** Call on every visibilitychange → visible. */
    onVisible(isContextLost: () => boolean): void {
      if (gaveUp) {
        // A resume is a fresh opportunity: the pressure that burned the budget
        // has usually passed. Re-arm and let the probe below decide.
        gaveUp = false
        attempts = 0
        opts.notify('budget-rearmed', state())
      }
      if (pendingRebuild) {
        pendingRebuild = false
        tryRebuild(false)
        return
      }
      if (isContextLost()) {
        opts.notify('silent-context-loss', state())
        tryRebuild(true)
      }
    },

    /** User-driven retry (fallback UI): reset the budget and rebuild now. */
    manualRetry(): void {
      gaveUp = false
      attempts = 0
      tryRebuild(false)
    },

    /** Call when a rebuild's init resolves successfully. */
    onRebuildSucceeded(): void {
      attempts = 0
    },

    /** Cancel any scheduled retry — call on hook unmount. */
    dispose(): void {
      cancelPendingRetry()
    },

    hasPendingRebuild: () => pendingRebuild,
    attempts: () => attempts,
  }
}
