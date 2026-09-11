import React from 'react'

interface Props {
  title: React.ReactNode
  detail?: React.ReactNode
  /** Primary action label. Omit for a card that is informational only. */
  actionLabel?: string
  onAction?: () => void
  /** 'gold' = do this now, 'quiet' = waiting on something else (another town). */
  tone?: 'gold' | 'quiet'
}

/** A bordered card is a promise that something can be done.
 *
 *  Deliberately scarce: if a screen shows more than about three of these, its
 *  sorting is wrong and the player can't tell what matters. Everything else is
 *  a ListRow. */
export function ActionCard({ title, detail, actionLabel, onAction, tone = 'gold' }: Props) {
  return (
    <div className={`action-card action-card--${tone}`}>
      <div className="action-card__title">{title}</div>
      {detail != null && <div className="action-card__detail">{detail}</div>}
      {actionLabel && onAction && (
        <button type="button" className="action-card__cta" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
