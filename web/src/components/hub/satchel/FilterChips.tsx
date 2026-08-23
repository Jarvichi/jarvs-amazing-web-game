import React from 'react'

export interface FilterOption {
  id: string
  label: string
  count?: number
}

interface Props {
  options: FilterOption[]
  activeId: string
  onChange: (id: string) => void
  /** Accessible name for the group (e.g. "Filter quests"). */
  label: string
}

/** Horizontal chip row that replaces the old tab bar's "show me a subset" job.
 *  Scrolls sideways rather than wrapping, so it never costs more than one line
 *  — the wrapping tab bar taking three rows on a phone is what this fixes. */
export function FilterChips({ options, activeId, onChange, label }: Props) {
  return (
    <div className="satchel-chips" role="group" aria-label={label}>
      {options.map(opt => (
        <button
          key={opt.id}
          type="button"
          className={`satchel-chip${opt.id === activeId ? ' satchel-chip--on' : ''}`}
          aria-pressed={opt.id === activeId}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
          {opt.count != null && <span className="satchel-chip__count">{opt.count}</span>}
        </button>
      ))}
    </div>
  )
}
