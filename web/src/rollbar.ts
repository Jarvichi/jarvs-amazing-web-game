// Rollbar is loaded by the CDN snippet in index.html.
// These wrappers access window.rollbar at call-time so they always
// reach the real instance, not the temporary shim.
/* eslint-disable @typescript-eslint/no-explicit-any */
const rb = () => (window as any).rollbar

const rollbar = {
  info:      (msg: string,         ...args: unknown[]) => rb()?.info(msg, ...args),
  error:     (err: string | Error, ...args: unknown[]) => rb()?.error(err, ...args),
  warn:      (msg: string,         ...args: unknown[]) => rb()?.warn(msg, ...args),
  configure: (opts: object)                            => rb()?.configure(opts),
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
