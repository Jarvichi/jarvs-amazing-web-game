import React from 'react'

// ─── Rack status bar ──────────────────────────────────────────────────────────
// How much of the cellar is named. Counts *soured casks named* rather than
// casks touched: the goal is naming the bad ones, so that is the number that
// should climb — a "casks touched" figure would climb fastest for the player
// who is thinking least.

interface Props {
  /** Soured casks in the cellar, known from the start. */
  total:  number
  /** How many the player has named, by chalk or by striking them. */
  named:  number
  sorted: boolean
}

export function RackStatusBar({ total, named, sorted }: Props) {
  const left = Math.max(0, total - named)
  const message = sorted
    ? 'Every soured cask is accounted for.'
    : `${named} of ${total} soured casks named, ${left} still to find.`

  return (
    <div
      className={`rack-status${sorted ? ' rack-status--sorted' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <span className="rack-status-item">
        <span aria-hidden="true">✕</span> Named {named}/{total}
      </span>
      <span className={`rack-status-item${!sorted && left > 0 ? ' rack-status-item--warn' : ''}`}>
        <span aria-hidden="true">{sorted ? '✓' : '🛢️'}</span>{' '}
        {sorted ? 'Cellar sorted' : `${left} to find`}
      </span>
    </div>
  )
}
