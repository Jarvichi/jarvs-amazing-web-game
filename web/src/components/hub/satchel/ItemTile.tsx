import React from 'react'

interface Props {
  icon: string
  /** Shown under the glyph — a stock count, "2/4", or a word like "worn". */
  count?: React.ReactNode
  /** Accessible name; also the tooltip. */
  label: string
  /** Gold corner flag: a quest wants this item. */
  flagged?: boolean
  /** Drawn as satisfied — a quest item you already hold enough of. */
  complete?: boolean
  onClick?: () => void
}

/** One square in the Satchel grid. A bag should look like a bag: tiles you can
 *  count at a glance beat text rows you have to read. */
export function ItemTile({ icon, count, label, flagged, complete, onClick }: Props) {
  const className = [
    'satchel-tile',
    flagged && 'satchel-tile--flagged',
    complete && 'satchel-tile--complete',
  ].filter(Boolean).join(' ')

  const inner = (
    <>
      <span className="satchel-tile__glyph" aria-hidden="true">{icon}</span>
      {count != null && <span className="satchel-tile__count">{count}</span>}
    </>
  )

  if (!onClick) {
    return <div className={className} title={label} aria-label={label} role="img">{inner}</div>
  }
  return (
    <button type="button" className={className} onClick={onClick} title={label} aria-label={label}>
      {inner}
    </button>
  )
}

/** Grid container for ItemTiles — 4 across on a phone, more as width allows. */
export function ItemGrid({ children }: { children: React.ReactNode }) {
  return <div className="satchel-grid">{children}</div>
}
