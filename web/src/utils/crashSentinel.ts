import rollbar from '../rollbar'
import { getGlStats } from './pixiTelemetry'

// ── Unclean-exit (page-kill) detector ─────────────────────────────────────────
// iOS Safari kills pages under memory pressure with no JS-visible signal: the
// page simply reloads (landing on the title screen) and, when it happens
// repeatedly, Safari shows "A problem repeatedly occurred". This sentinel keeps
// a heartbeat record in localStorage and marks it clean on pagehide; if the app
// boots and finds a record that was never marked clean, the previous session
// died without a normal exit and we report it to Rollbar with the last known
// screen + WebGL context stats so crashes can be located.

const SENTINEL_KEY = 'jarv_crash_sentinel'
const HEARTBEAT_MS = 20_000

interface SentinelRecord {
  ts: number
  screen: string
  location?: string
  visibility: string
  cleanExit: boolean
  contextsCreatedTotal?: number
  contextsDestroyedTotal?: number
  liveContexts?: number
  liveCanvasMB?: number
  largestCanvasMB?: number
}

function readRecord(): SentinelRecord | null {
  try {
    const raw = localStorage.getItem(SENTINEL_KEY)
    return raw ? JSON.parse(raw) as SentinelRecord : null
  } catch {
    return null
  }
}

function writeRecord(patch: Partial<SentinelRecord>): void {
  try {
    const prev = readRecord()
    const next: SentinelRecord = {
      ts: Date.now(),
      screen: prev?.screen ?? 'unknown',
      visibility: document.visibilityState,
      cleanExit: false,
      ...prev,
      ...patch,
    }
    localStorage.setItem(SENTINEL_KEY, JSON.stringify(next))
  } catch (e) {
    // localStorage unavailable/full — sentinel is diagnostics-only, never fatal
    rollbar?.warn('[sentinel] localStorage write failed', { message: (e as Error)?.message })
  }
}

let _initialized = false
let _heartbeatStarted = false

/** Call once at boot, before React renders, so crash loops are reported even
 *  if rendering itself dies. */
export function initCrashSentinel(): void {
  if (_initialized) return
  _initialized = true

  const prev = readRecord()
  if (prev && prev.cleanExit !== true) {
    rollbar?.warn('[sentinel] unclean exit — probable page kill', {
      lastScreen: prev.screen,
      lastLocation: prev.location,
      secondsAgo: Math.round((Date.now() - prev.ts) / 1000),
      visibility: prev.visibility,
      contextsCreatedTotal: prev.contextsCreatedTotal,
      contextsDestroyedTotal: prev.contextsDestroyedTotal,
      liveContexts: prev.liveContexts,
      liveCanvasMB: prev.liveCanvasMB,
      largestCanvasMB: prev.largestCanvasMB,
    })
  }
  try { localStorage.removeItem(SENTINEL_KEY) } catch { /* best effort */ }
  writeRecord({ screen: 'boot', ts: Date.now(), cleanExit: false, visibility: document.visibilityState })

  // Real navigations and tab closes are clean exits. pagehide fires on iOS
  // where unload does not.
  window.addEventListener('pagehide', () => {
    writeRecord({ cleanExit: true })
  })
  // Returning from bfcache / foregrounding means the session is live again.
  window.addEventListener('pageshow', () => {
    writeRecord({ cleanExit: false, visibility: document.visibilityState })
  })
  // Track visibility so dashboards can split foreground jetsam kills (our
  // crash: visibility 'visible') from routine background tab eviction.
  document.addEventListener('visibilitychange', () => {
    writeRecord({ visibility: document.visibilityState, cleanExit: false })
  })
}

/** Record the active screen (and hub location) plus current WebGL stats.
 *  Call on every screen change — crashes cluster around screen transitions. */
export function recordScreen(screen: string, location?: string): void {
  writeRecord({ screen, location, ts: Date.now(), cleanExit: false, ...getGlStats() })
  if (!_heartbeatStarted) {
    _heartbeatStarted = true
    setInterval(() => {
      writeRecord({ ts: Date.now(), ...getGlStats() })
    }, HEARTBEAT_MS)
  }
}

/** Test-only: reset module state between cases. */
export function _resetCrashSentinelForTest(): void {
  _initialized = false
  _heartbeatStarted = false
}
