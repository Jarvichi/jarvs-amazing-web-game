import React, { useRef } from 'react'
import { Icon } from './icons/Icon'
import { type IconName } from './icons/IconSprite'

export interface TabNavItem<T extends string> {
  id: T
  label: string
  /** Sprite icon name. Emoji glyphs are deliberately not supported (#2172). */
  icon?: IconName
  /**
   * `true` draws an attention dot; a number draws a count pill. `0` and
   * `false` draw nothing, so callers can pass a raw count.
   */
  badge?: boolean | number
}

export type TabNavPlacement = 'top' | 'bar'

interface Props<T extends string> {
  items: TabNavItem<T>[]
  activeId: T
  onSelect: (id: T) => void
  /** Names the tablist for screen readers, e.g. "Settings categories". */
  ariaLabel: string
  /**
   * `top` (default) is a horizontal strip above the panel it controls.
   * `bar` is the satchel's shape: a thumb-reachable bottom bar on phones
   * that becomes a left rail from tablet up.
   */
  placement?: TabNavPlacement
  /** id of the element this nav controls, for `aria-controls`. */
  panelId?: string
  className?: string
}

/**
 * The one tab strip. Replaces `.player-tab` (Player, Collection, Settings),
 * `.hoa-tab` (Hall of Achievements, Home shelf, Pet modal), `.satchel-nav`
 * (satchel sheet), `.ach-tab` (Achievements), `.character-avatar-tab`
 * (Character) and `.city-bld-tab` (building inspector) — six different looks
 * and six different levels of keyboard support for the same control.
 *
 * A real tablist: roving `tabIndex` so the strip is one tab stop, arrow keys
 * (both axes, since `bar` is vertical from tablet up) plus Home/End to move,
 * and `aria-selected` reporting which section is open.
 *
 * Colours come from `--tab-nav-*` custom properties so a surface with its own
 * palette can retint the strip without restyling it — see the satchel sheet's
 * override in tabs.css.
 */
export function TabNav<T extends string>({
  items, activeId, onSelect, ariaLabel,
  placement = 'top', panelId, className,
}: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    const delta =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
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

  const classes = ['tab-nav', `tab-nav--${placement}`, className].filter(Boolean).join(' ')

  return (
    <div className={classes} role="tablist" aria-label={ariaLabel}>
      {items.map((item, i) => {
        const on = item.id === activeId
        return (
          <button
            key={item.id}
            ref={el => { refs.current[i] = el }}
            type="button"
            role="tab"
            /* Scoped to the panel so several strips can coexist on one
               screen (the home shelf renders three) without duplicate ids. */
            id={panelId ? `${panelId}-tab-${item.id}` : undefined}
            aria-selected={on}
            aria-controls={panelId}
            tabIndex={on ? 0 : -1}
            className={`tab-nav__item${on ? ' tab-nav__item--on' : ''}`}
            onClick={() => onSelect(item.id)}
            onKeyDown={e => handleKeyDown(e, i)}
          >
            {item.icon && <Icon name={item.icon} size={17} />}
            <span className="tab-nav__label">{item.label}</span>
            {item.badge === true && <span className="tab-nav__dot" />}
            {typeof item.badge === 'number' && item.badge > 0 && (
              <span className="tab-nav__count">{item.badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
