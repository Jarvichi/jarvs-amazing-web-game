import React from 'react'
import type { NewsFilterId, NewsFilterOption } from './newsGrouping'

interface Props {
  options: NewsFilterOption[]
  activeId: NewsFilterId
  onChange: (id: NewsFilterId) => void
}

/**
 * Tag chips across the top of the feed. Built from `filter-btn` (the shared
 * chip class) rather than a new one, and scrolls sideways instead of
 * wrapping so it never costs more than a single line on a phone.
 */
export function NewsFilters({ options, activeId, onChange }: Props) {
  if (options.length < 2) return null
  return (
    <div className="news-filters" role="group" aria-label="Filter news">
      {options.map(opt => (
        <button
          key={opt.id}
          type="button"
          className={`filter-btn${opt.id === activeId ? ' filter-btn--active' : ''}`}
          aria-pressed={opt.id === activeId}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
          <span className="news-filters__count">{opt.count}</span>
        </button>
      ))}
    </div>
  )
}
