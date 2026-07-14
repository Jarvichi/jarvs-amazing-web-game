import rollbar from '../rollbar'

// ── Resume journal ─────────────────────────────────────────────────────────────
// Rollbar events emitted while a mobile tab is backgrounded are frequently never
// delivered: iOS suspends timers/network for hidden pages, and a jetsam kill
// discards Rollbar's in-memory send queue. That makes the exact scenario we most
// need to trace — "backgrounded for a while, came back to a blank screen" —
// invisible in Rollbar. This journal persists lifecycle breadcrumbs (visibility
// changes, WebGL context loss/rebuilds, service-worker reloads) to localStorage
// as they happen, then flushes any unsent entries as a single Rollbar event at
// the next boot or foreground resume, when the network is reliable again.

const JOURNAL_KEY = 'jarv_resume_journal'
const MAX_ENTRIES = 20

export interface JournalEntry {
  ts: number
  event: string
  data?: Record<string, unknown>
  sent?: boolean
}

function readEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed as JournalEntry[] : []
  } catch {
    return []
  }
}

function writeEntries(entries: JournalEntry[]): void {
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries))
  } catch {
    // localStorage unavailable/full — the journal is diagnostics-only, and this
    // runs in hot lifecycle paths, so fail silently (no Rollbar call here).
  }
}

/** Append a lifecycle breadcrumb to the persisted journal. Never sends to
 *  Rollbar itself — entries are delivered later by flushResumeJournal().
 *  With coalesce, a repeat of the same still-unsent event replaces the previous
 *  entry instead of appending, so e.g. rapid tab-switching uses one slot. */
export function journal(event: string, data?: Record<string, unknown>, opts?: { coalesce?: boolean }): void {
  const entries = readEntries()
  const entry: JournalEntry = { ts: Date.now(), event, ...(data && { data }), sent: false }
  const last = entries[entries.length - 1]
  if (opts?.coalesce && last && last.event === event && last.sent !== true) {
    entries[entries.length - 1] = entry
  } else {
    entries.push(entry)
  }
  writeEntries(entries.slice(-MAX_ENTRIES))
}

/** Send all not-yet-sent journal entries to Rollbar as one event, then mark
 *  them sent (they age out of the ring buffer naturally, so recent context
 *  stays inspectable in localStorage). No unsent entries → no Rollbar event. */
export function flushResumeJournal(trigger: 'boot' | 'resume', extra?: Record<string, unknown>): void {
  const entries = readEntries()
  const unsent = entries.filter(e => e.sent !== true)
  if (unsent.length === 0) return
  rollbar?.info('[resumeJournal] flush', { trigger, count: unsent.length, entries: unsent, ...extra })
  writeEntries(entries.map(e => e.sent === true ? e : { ...e, sent: true }))
}

let _initialized = false

/** Call once at boot, before React renders: flushes entries stranded by the
 *  previous session (page kill / SW reload) and installs the page-lifecycle
 *  listeners that visibilitychange alone doesn't cover. */
export function initResumeJournal(): void {
  if (_initialized) return
  _initialized = true

  // bfcache restore — the page resumes without reloading or firing boot code.
  window.addEventListener('pageshow', (e: PageTransitionEvent) => {
    if (e.persisted) journal('pageshow', { persisted: true })
  })
  // Page Lifecycle API (Chrome on Android): the browser is about to freeze the
  // page / has just resumed it. No-ops on browsers without these events.
  document.addEventListener('freeze', () => journal('freeze'))
  document.addEventListener('resume', () => journal('resume'))

  let navigationType: string | undefined
  try {
    navigationType = (performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined)?.type
  } catch {
    // performance API unavailable — navigationType stays undefined
  }
  flushResumeJournal('boot', { navigationType })
}

/** Test-only: reset module state between cases. */
export function _resetResumeJournalForTest(): void {
  _initialized = false
}
