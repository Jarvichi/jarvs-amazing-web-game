import Rollbar from 'rollbar/replay'

const PLAYER_ID_KEY = 'jarv_player_id'

function getOrCreatePlayerId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY)
  if (!id) {
    id = `player-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    localStorage.setItem(PLAYER_ID_KEY, id)
  }
  return id
}

const environment = window.location.hostname.includes('github.io')
  ? 'production'
  : window.location.hostname === 'localhost'
  ? 'development'
  : 'staging'

const rollbar = new Rollbar({
  accessToken: '8bcd98f07593a1d478ea6d7d6612e146',
  captureUncaught: true,
  captureUnhandledRejections: true,
  payload: {
    environment,
    person: {
      id: getOrCreatePlayerId(),
    },
    client: {
      javascript: {
        code_version: import.meta.env.VITE_GIT_SHA ?? 'dev',
        source_map_enabled: true,
        guess_uncaught_frames: true,
      },
    },
  },
  replay: {
    enabled: true,
  },
})

export default rollbar

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
