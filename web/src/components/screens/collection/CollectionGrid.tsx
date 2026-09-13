import React, { memo, useEffect, useRef, useState } from 'react'
import { Card } from '../../../game/types'
import { CardTile } from '../../cards/CardTile'
import { CardCellFooter } from '../../cards/CardCellFooter'

const LazyCell = memo(function LazyCell({ children, className }: { children: React.ReactNode; className: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={className}>
      {visible ? children : null}
    </div>
  )
})

export interface CollectionGridItem {
  card: Card
  owned: number
  extras: number
  xp: number
  level: number
  groupLabel: string | null
  earnViaQuest: boolean
  levelingUp: boolean
}

interface Props {
  items: CollectionGridItem[]
  onCardClick: (card: Card) => void
}

/** The card catalogue grid — every card, owned or not, grouped and sorted
 *  per the filter bar above it. */
export function CollectionGrid({ items, onCardClick }: Props) {
  return (
    <div className="collection-grid u-flex u-wrap u-just-c u-grow">
      {items.map(({ card, owned, extras, xp, level, groupLabel, earnViaQuest, levelingUp }) => (
        <React.Fragment key={card.name}>
          {groupLabel && (
            <div className="collection-group-header">{groupLabel}</div>
          )}
          <LazyCell className={`collection-cell u-col${owned === 0 ? ' collection-cell--unowned' : ''}${levelingUp ? ' collection-cell--levelup' : ''}`}>
            <CardTile
              card={card}
              canAfford={true}
              upgradeable={extras > 0}
              onClick={() => onCardClick(card)}
            />
            <CardCellFooter xp={xp}>
              {owned === 0 && earnViaQuest
                ? <span className="earn-via-quest-badge">EARN VIA QUEST</span>
                : <span className="cell-count">
                    ×{owned}{level > 0 && <span className="cell-mastery-badge">★{level}</span>}
                  </span>}
            </CardCellFooter>
          </LazyCell>
        </React.Fragment>
      ))}
    </div>
  )
}
