import React from 'react'

// ─── Stow status bar ──────────────────────────────────────────────────────────
// How much of the crate is done. It counts *open slots* rather than goods
// stowed, because slots are what the win condition is written in — a player
// with seven of eight goods in and four slots still showing has not nearly
// finished, and a "7/8" would tell them they had.

interface Props {
  stowed: number
  total:  number
  /** Free slots still uncovered. */
  open:   number
  packed: boolean
}

export function StowStatusBar({ stowed, total, open, packed }: Props) {
  const message = packed
    ? 'Packed square — not a slot wasted.'
    : `${stowed} of ${total} goods stowed, ${open} slots still open.`

  return (
    <div
      className={`stow-status${packed ? ' stow-status--packed' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <span className="stow-status-item">
        <span aria-hidden="true">📦</span> Stowed {stowed}/{total}
      </span>
      <span className={`stow-status-item${!packed && open > 0 ? ' stow-status-item--warn' : ''}`}>
        <span aria-hidden="true">{packed ? '✓' : '▫'}</span>{' '}
        {packed ? 'Packed square' : `${open} slots open`}
      </span>
    </div>
  )
}
