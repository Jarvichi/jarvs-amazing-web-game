import React from 'react'

interface Props {
  onRemove: () => void
  children: React.ReactNode
}

/** One active-filter chip in the bar's pill row, with its own remove button. */
export function FilterPill({ onRemove, children }: Props) {
  return (
    <span className="filter-pill">
      {children} <button onClick={onRemove} aria-label="Remove filter">✕</button>
    </span>
  )
}
