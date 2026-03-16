import React, { useEffect, useState } from 'react'
import { getCardCatalog } from '../game/cards'
import { rarityStars } from '../game/cards'
import { addCardsToCollection } from '../game/collection'
import { CardTile } from './CardTile'
import { useCardDetail } from './useCardDetail'

interface Props {
  /** Array of 5 card names in reveal order */
  pack: string[]
  onDone: () => void
}

export function PackOpening({ pack, onDone }: Props) {
  const catalog = getCardCatalog()
  const [revealed, setRevealed] = useState(0)
  const [done, setDone] = useState(false)
  const { openDetail, cardDetailNode } = useCardDetail()

  // Auto-reveal cards one at a time, 700ms apart
  useEffect(() => {
    if (revealed >= pack.length) {
      // All revealed — add them to collection and unlock Continue
      addCardsToCollection(pack.map(name => ({ cardName: name, count: 1 })))
      setDone(true)
      return
    }
    const t = setTimeout(() => setRevealed(r => r + 1), 700)
    return () => clearTimeout(t)
  }, [revealed, pack.length])

  const cards = pack.map(name => catalog.find(c => c.name === name) ?? null)

  return (
    <div className="pack-screen">
      <div className="pack-title">✦ PACK OPENED ✦</div>
      <div className="pack-subtitle">You earned a reward for winning!</div>

      <div className="pack-cards">
        {cards.map((card, i) => (
          <div
            key={i}
            className={`pack-card-slot${i < revealed ? ' pack-card-slot--revealed' : ''}`}
          >
            {i < revealed && card ? (
              <div className="pack-card-reveal">
                <CardTile card={card} canAfford={true} onClick={done ? () => openDetail(card) : undefined} />
                <div className={`pack-card-rarity pack-card-rarity--${card.rarity}`}>
                  {rarityStars(card.rarity)}
                </div>
              </div>
            ) : (
              <div className="pack-card-hidden">?</div>
            )}
          </div>
        ))}
      </div>

      {done ? (
        <button className="action-btn action-btn--large" onClick={onDone}>
          CONTINUE →
        </button>
      ) : (
        <div className="pack-wait">Revealing…</div>
      )}

      {cardDetailNode}
    </div>
  )
}
