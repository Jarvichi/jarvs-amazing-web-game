// Rollbar is loaded via CDN snippet in index.html.
// This module re-exports the global so existing imports keep working.

declare global {
  interface Window {
    Rollbar: {
      info: (msg: string | Error, extra?: object) => void
      error: (msg: string | Error, extra?: object) => void
      warn: (msg: string | Error, extra?: object) => void
      debug: (msg: string | Error, extra?: object) => void
      configure: (options: object) => void
    }
  }
}

const rollbar = window.Rollbar

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
