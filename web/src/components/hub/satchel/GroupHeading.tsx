import React from 'react'

interface Props {
  children: React.ReactNode
  /** Right-aligned figure — usually how many rows follow. */
  count?: React.ReactNode
  /** 'gold' marks the group the player can act on right now. */
  tone?: 'default' | 'gold'
}

/** Small uppercase label that separates groups inside a section. */
export function GroupHeading({ children, count, tone = 'default' }: Props) {
  return (
    <h3 className={`satchel-group satchel-group--${tone}`}>
      <span>{children}</span>
      {count != null && <span className="satchel-group__count">{count}</span>}
    </h3>
  )
}
