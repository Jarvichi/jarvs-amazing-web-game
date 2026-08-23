import React, { useRef } from 'react'
import { SATCHEL_NAV, type SatchelNavItem, type SatchelSectionId } from './types'

interface Props {
  activeId: SatchelSectionId
  onSelect: (id: SatchelSectionId) => void
  /** Section ids that should show an attention dot. */
  badges?: Partial<Record<SatchelSectionId, boolean>>
  items?: SatchelNavItem[]
}

/** Section nav — a bottom bar on phones (thumb-reachable, always one row), a
 *  left rail from tablet up. A real tablist: arrow keys move between sections
 *  and `aria-selected` reports which one is open, neither of which the old
 *  plain-button tab strip did. */
export function SatchelNav({ activeId, onSelect, badges, items = SATCHEL_NAV }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1
      : e.key === 'Home' ? -index
      : e.key === 'End' ? items.length - 1 - index
      : 0
    if (delta === 0) return
    e.preventDefault()
    const next = (index + delta + items.length) % items.length
    onSelect(items[next].id)
    refs.current[next]?.focus()
  }

  return (
    <nav className="satchel-nav" role="tablist" aria-label="Satchel sections">
      {items.map((item, i) => (
        <button
          key={item.id}
          ref={el => { refs.current[i] = el }}
          type="button"
          role="tab"
          id={`satchel-tab-${item.id}`}
          aria-selected={item.id === activeId}
          aria-controls="satchel-panel"
          tabIndex={item.id === activeId ? 0 : -1}
          className={`satchel-nav__item${item.id === activeId ? ' satchel-nav__item--on' : ''}`}
          onClick={() => onSelect(item.id)}
          onKeyDown={e => onKeyDown(e, i)}
        >
          <span className="satchel-nav__glyph" aria-hidden="true">
            {item.icon}
            {(badges?.[item.id] ?? item.badge) && <span className="satchel-nav__dot" />}
          </span>
          <span className="satchel-nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
