import React from 'react'

export interface FilterChipOption {
  id: string
  label: string
  count?: number
  disabled?: boolean
  /** Tooltip shown on hover — e.g. why a disabled chip can't be picked. */
  title?: string
}

interface Props {
  options: FilterChipOption[]
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
    <div className="filter-chips" role="group" aria-label={label}>
      {options.map(opt => (
        <button
          key={opt.id}
          type="button"
          className={`filter-chip${opt.id === activeId ? ' filter-chip--on' : ''}`}
          aria-pressed={opt.id === activeId}
          onClick={() => onChange(opt.id)}
          disabled={opt.disabled}
          title={opt.title}
        >
          {opt.label}
          {opt.count != null && <span className="filter-chip__count">{opt.count}</span>}
        </button>
      ))}
    </div>
  )
}
