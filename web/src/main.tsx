import React from 'react'
import ReactDOM from 'react-dom/client'
import rollbar from './rollbar'
import { setErrorLogger } from './logger'
import { initCrashSentinel } from './utils/crashSentinel'
import { initResumeJournal } from './utils/resumeJournal'
import { ErrorBoundary } from './components/ErrorBoundary'
import App from './App'

setErrorLogger((msg, ctx) => rollbar.error(msg, ctx as object))

// Report if the previous session died without a clean exit (e.g. iOS Safari
// killing the page under memory pressure) — before React renders, so crash
// loops are reported even when rendering itself dies.
initCrashSentinel()

// Flush lifecycle breadcrumbs stranded by the previous session (background
// page kill, service-worker reload) and start journaling this session's
// resume behaviour — also before React renders, for the same reason.
initResumeJournal()

// Unlock any achievements whose progress target was already met before the
// achievement was added (e.g. after a game update adds new achievements).
import('./game/achievements').then(({ backfillAchievements }) => backfillAchievements())

// Firebase throws unhandled rejections internally that are not actionable.
// Suppress them here so Rollbar doesn't log noise:
//
// - "Connection to Indexed Database server lost" — Firestore/IndexedDB
//   disconnect in Safari / backgrounded tabs; Firestore recovers automatically.
//
// - "Load failed" — iOS Safari network error thrown by the Firebase SDK's
//   internal fetch() calls (auth + Firestore long-poll) when the ServiceWorker
//   updates and the page reloads mid-session. Firebase reconnects on its own.
window.addEventListener('unhandledrejection', (event) => {
  const msg = String(event.reason?.message ?? event.reason ?? '')
  if (
    msg.includes('Connection to Indexed Database server lost') ||
    msg === 'Load failed'
  ) {
    event.preventDefault()
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
