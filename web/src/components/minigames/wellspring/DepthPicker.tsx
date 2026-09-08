import React from 'react'
import type { DepthConfig } from '../Wellspring.logic'

// ─── Depth picker ─────────────────────────────────────────────────────────────
// How far down the shaft to go. Difficulty is a place, not a setting — each
// depth is its own board rather than a modifier on a shared one.
//
// Arcade only: a hub-world well's depth is authored per town, so there is
// nothing to choose there.

interface Props {
  depths:   DepthConfig[]
  value:    string
  onChange: (id: string) => void
  /** Locked once a board is under way, so a half-solved run can't vanish. */
  disabled?: boolean
}

export function DepthPicker({ depths, value, onChange, disabled = false }: Props) {
  return (
    <div className="depth-picker" role="radiogroup" aria-label="Depth">
      {depths.map(depth => {
        const active = depth.id === value
        return (
          <button
            key={depth.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`filter-btn depth-picker-btn${active ? ' filter-btn--active' : ''}`}
            onClick={() => onChange(depth.id)}
            disabled={disabled}
            title={`${depth.subtitle} — ${depth.w}×${depth.h}, up to ${depth.ticketBase} tickets`}
          >
            <span className="depth-picker-label">{depth.label}</span>
            <span className="depth-picker-sub">{depth.w}×{depth.h} · {depth.ticketBase} 🎫</span>
          </button>
        )
      })}
    </div>
  )
}
