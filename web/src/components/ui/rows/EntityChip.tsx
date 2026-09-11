import React from 'react'

export type ChipTone = 'default' | 'gold' | 'away' | 'quiet'

interface Props {
  label: string
  icon?: string
  /** 'gold' = actionable, 'away' = in another town, 'quiet' = passive label. */
  tone?: ChipTone
  onClick?: () => void
  title?: string
  disabled?: boolean
}

/** A tappable proper noun — an NPC, item, town or area.
 *
 *  Every name the player reads should be reachable: tapping a chip is what
 *  turns five separate lists into one connected thing (a quest's "Deliver to
 *  Mira" becomes a way to find Mira). Rendered as a plain span when no
 *  `onClick` is given, so a purely decorative label can't be tabbed to. */
export function EntityChip({ label, icon, tone = 'default', onClick, title, disabled }: Props) {
  const className = `entity-chip entity-chip--${tone}${onClick ? ' entity-chip--tappable' : ''}`

  if (!onClick) {
    return (
      <span className={className} title={title}>
        {icon && <span aria-hidden="true">{icon}</span>}
        {label}
      </span>
    )
  }

  return (
    <button type="button" className={className} onClick={onClick} title={title} disabled={disabled}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
    </button>
  )
}
