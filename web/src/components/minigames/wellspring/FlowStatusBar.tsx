import React from 'react'

// ─── Flow status bar ──────────────────────────────────────────────────────────
// How close the network is: basins fed and ends still spilling. The board
// already shows both, so this is the screen-reader-friendly restatement of it
// and the one place a live announcement can hang off.

interface Props {
  basinsFed:  number
  basinTotal: number
  leaks:      number
  solved:     boolean
}

export function FlowStatusBar({ basinsFed, basinTotal, leaks, solved }: Props) {
  const message = solved
    ? 'The network runs clear.'
    : `${basinsFed} of ${basinTotal} basins fed, ${leaks} ${leaks === 1 ? 'end' : 'ends'} spilling.`

  return (
    <div
      className={`flow-status${solved ? ' flow-status--solved' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <span className="flow-status-item">
        <span aria-hidden="true">💧</span> Basins {basinsFed}/{basinTotal}
      </span>
      <span className={`flow-status-item${leaks > 0 ? ' flow-status-item--warn' : ''}`}>
        <span aria-hidden="true">{leaks > 0 ? '⚠' : '✓'}</span>{' '}
        {leaks > 0 ? `${leaks} leaking` : 'Sealed'}
      </span>
    </div>
  )
}
