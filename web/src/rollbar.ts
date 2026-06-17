// Rollbar is loaded via CDN snippet in index.html.
// This module re-exports the global so existing imports keep working.
//
// In environments where the CDN snippet isn't present — Storybook, the
// Vitest/Storybook test runner, SSR — `window.Rollbar` is undefined. Reading
// `.error`/`.configure` off the bare global would then throw
// "Cannot read properties of undefined". To stay safe everywhere, we expose a
// thin wrapper that resolves `window.Rollbar` at call time and no-ops when it
// isn't available.

interface RollbarClient {
  info: (msg: string | Error, extra?: object) => void
  error: (msg: string | Error, extra?: object) => void
  warn: (msg: string | Error, extra?: object) => void
  debug: (msg: string | Error, extra?: object) => void
  configure: (options: object) => void
}

declare global {
  interface Window {
    Rollbar?: RollbarClient
  }
}

const client = (): RollbarClient | undefined =>
  typeof window !== 'undefined' ? window.Rollbar : undefined

const rollbar: RollbarClient = {
  info: (msg, extra) => client()?.info(msg, extra),
  error: (msg, extra) => client()?.error(msg, extra),
  warn: (msg, extra) => client()?.warn(msg, extra),
  debug: (msg, extra) => client()?.debug(msg, extra),
  configure: (options) => client()?.configure(options),
}

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
