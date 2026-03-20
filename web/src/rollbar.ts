// Rollbar is initialised by the CDN snippet in index.html.
// This module re-exports the global instance so the rest of the app can
// import rollbar as a typed module rather than reaching for window.rollbar.

interface RollbarInstance {
  info:      (msg: string, ...args: unknown[]) => void
  error:     (err: string | Error, ...args: unknown[]) => void
  warn:      (msg: string, ...args: unknown[]) => void
  configure: (opts: object) => void
}

declare global {
  interface Window { rollbar: RollbarInstance }
}

// Use a proxy so every call resolves window.rollbar at call-time, not at
// module-load time. The CDN snippet sets window.rollbar to a shim immediately,
// then replaces it with the real instance once the async library finishes loading.
const rollbar: RollbarInstance = new Proxy({} as RollbarInstance, {
  get(_target, prop: string) {
    const rb = window.rollbar as unknown as Record<string, unknown>
    if (rb && typeof rb[prop] === 'function') {
      return (rb[prop] as (...a: unknown[]) => unknown).bind(rb)
    }
    return () => { /* rollbar not yet loaded */ }
  },
})

export default rollbar

const PLAYER_ID_KEY = 'jarv_player_id'

function getOrCreatePlayerId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY)
  if (!id) {
    id = `player-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    localStorage.setItem(PLAYER_ID_KEY, id)
  }
  return id
}

/** Call after loading run state to enrich person tracking with gameplay context. */
export function updateRollbarPerson(opts: { actId?: string; runCount?: number }): void {
  const id = getOrCreatePlayerId()
  rollbar.configure({
    payload: {
      person: {
        id,
        username: id,
        ...(opts.actId && { act: opts.actId }),
        ...(opts.runCount != null && { run_count: opts.runCount }),
      },
    },
  })
}
