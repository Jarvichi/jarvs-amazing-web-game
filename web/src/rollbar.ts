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
  accessToken: '156cc859626f4d8eb21842c3308a19599276edac62de44cda800b91ee50ba1b8b693afcba4c0cd9e3c87775f5701d2cc',
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
