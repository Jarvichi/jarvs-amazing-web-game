import React from 'react'
import ReactDOM from 'react-dom/client'
import rollbar from './rollbar'
import { setErrorLogger } from './logger'
import App from './App'

setErrorLogger((msg, ctx) => rollbar.error(msg, ctx as object))

// Firebase uses IndexedDB internally for Firestore caching. If the browser
// drops that connection (common in Safari / backgrounded tabs), Firebase throws
// an UnknownError that would otherwise surface as an unhandled rejection in
// Rollbar. We catch it here and swallow it — Firestore recovers automatically
// on the next operation, so no user action is needed.
window.addEventListener('unhandledrejection', (event) => {
  const msg = String(event.reason?.message ?? event.reason ?? '')
  if (msg.includes('Connection to Indexed Database server lost')) {
    event.preventDefault()
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
