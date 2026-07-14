// ── WebGL context-loss recovery state machine ─────────────────────────────────
// Extracted from usePixiApp so the defer/attempt logic is unit-testable without
// Pixi or a DOM. Two mobile-specific rules drive the design:
//
// 1. Never rebuild while the page is hidden. Creating a WebGL context on a
//    backgrounded page routinely fails or is immediately re-lost, which would
//    burn the whole attempt budget before the player even returns. A loss while
//    hidden tears down immediately (freeing GPU memory) but defers the rebuild
//    to the next foreground resume.
// 2. The attempt cap only guards against tight failure loops. Attempts reset
//    after every successful rebuild, so occasional context losses over a long
//    session never accumulate into a permanent give-up.
//
// onVisible also handles the loss iOS never announces: a backgrounded tab's
// context can be reclaimed without webglcontextlost ever firing, so the caller
// supplies an isContextLost() probe to detect it on resume.

export type ContextLossEvent =
  | 'contextlost'
  | 'rebuild-deferred'
  | 'rebuild-started'
  | 'silent-context-loss'
  | 'rebuild-given-up'

export interface ContextLossControllerOpts {
  maxAttempts: number
  isHidden: () => boolean
  teardown: () => void
  rebuild: () => void
  notify: (event: ContextLossEvent, data: { attempts: number; hidden: boolean }) => void
}

export function createContextLossController(opts: ContextLossControllerOpts) {
  let attempts = 0
  let pendingRebuild = false

  const state = () => ({ attempts, hidden: opts.isHidden() })

  // Counts an attempt and either rebuilds or gives up at the cap. The app is
  // expected to be torn down already (or torn down here for the silent-loss path
  // via tearDownFirst).
  const tryRebuild = (tearDownFirst: boolean) => {
    attempts++
    if (attempts > opts.maxAttempts) {
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

    /** Call on every visibilitychange → visible. */
    onVisible(isContextLost: () => boolean): void {
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

    /** Call when a rebuild's init resolves successfully. */
    onRebuildSucceeded(): void {
      attempts = 0
    },

    hasPendingRebuild: () => pendingRebuild,
    attempts: () => attempts,
  }
}
