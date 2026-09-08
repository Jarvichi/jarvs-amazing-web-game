import React from 'react'

// ─── Flow status bar ──────────────────────────────────────────────────────────
// How close the network is. Conduits-carrying rather than basins-fed: on a
// depth with one basin that counter only flips at the very end, where the
// count of live pipe climbs the whole way and actually reads as progress.
// The basins have their own payoff — they visibly fill on the board.

interface Props {
  /** Cells the water reaches. */
  fed:    number
  /** Cells on the board. */
  total:  number
  leaks:  number
  solved: boolean
}

export function FlowStatusBar({ fed, total, leaks, solved }: Props) {
  const message = solved
    ? 'The network runs clear.'
    : `${fed} of ${total} conduits carrying, ${leaks} ${leaks === 1 ? 'end' : 'ends'} spilling.`

  return (
    <div
      className={`flow-status${solved ? ' flow-status--solved' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <span className="flow-status-item">
        <span aria-hidden="true">💧</span> Conduits {fed}/{total}
      </span>
      <span className={`flow-status-item${leaks > 0 ? ' flow-status-item--warn' : ''}`}>
        <span aria-hidden="true">{leaks > 0 ? '⚠' : '✓'}</span>{' '}
        {leaks > 0 ? `${leaks} leaking` : 'Sealed'}
      </span>
    </div>
  )
}
