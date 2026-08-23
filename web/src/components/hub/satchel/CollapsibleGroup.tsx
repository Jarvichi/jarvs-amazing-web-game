import React, { useState } from 'react'

interface Props {
  title: React.ReactNode
  count?: number
  children: React.ReactNode
  defaultOpen?: boolean
}

/** A group that collapses to a single line with a count.
 *
 *  The house rule is that anything over ~10 entries collapses: 108 completed
 *  quests rendered as an open list is what made the old menu unusable. */
export function CollapsibleGroup({ title, count, children, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`satchel-collapse${open ? ' satchel-collapse--open' : ''}`}>
      <button
        type="button"
        className="satchel-collapse__toggle"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span className="satchel-collapse__title">{title}</span>
        <span className="satchel-collapse__meta">
          {count != null && <b>{count}</b>}
          <span className="satchel-collapse__caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
        </span>
      </button>
      {open && <div className="satchel-collapse__body">{children}</div>}
    </div>
  )
}
