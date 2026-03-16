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

  // Show all cards face-down immediately, then flip each 800ms apart after a 600ms pause
  useEffect(() => {
    if (revealed >= pack.length) {
      addCardsToCollection(pack.map(name => ({ cardName: name, count: 1 })))
      setDone(true)
      return
    }
    const delay = revealed === 0 ? 600 : 800
    const t = setTimeout(() => setRevealed(r => r + 1), delay)
    return () => clearTimeout(t)
  }, [revealed, pack.length])

  const cards = pack.map(name => catalog.find(c => c.name === name) ?? null)

  function renderCard(card: typeof cards[0], i: number) {
    const rarity = card?.rarity ?? 'common'
    const isSpecial = rarity === 'legendary' || rarity === 'rare'
    const isRevealed = i < revealed
    const classes = [
      'pack-card-slot',
      isRevealed ? 'pack-card-slot--revealed' : '',
      !isRevealed && isSpecial ? `pack-card-slot--glow-${rarity}` : '',
      isRevealed && isSpecial ? `pack-card-slot--flash-${rarity}` : '',
    ].filter(Boolean).join(' ')

    return (
      <div
        key={i}
        className={classes}
        style={{ animationDelay: `${i * 80}ms` }}
      >
        <div className="pack-card-flip">
          <div className="pack-card-back">
            <div className="pack-card-hidden">?</div>
          </div>
          <div className="pack-card-front">
            {card ? (
              <div className="pack-card-reveal">
                <CardTile card={card} canAfford={true} onClick={done ? () => openDetail(card) : undefined} />
                <div className={`pack-card-rarity pack-card-rarity--${card.rarity}`}>
                  {rarityStars(card.rarity)}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  const row1 = cards.slice(0, 3)
  const row2 = cards.slice(3)

  return (
    <div className="pack-screen">
      <div className="pack-title">✦ PACK OPENED ✦</div>
      <div className="pack-subtitle">You earned a reward for winning!</div>

      <div className="pack-rows">
        <div className="pack-cards">{row1.map((card, i) => renderCard(card, i))}</div>
        {row2.length > 0 && (
          <div className="pack-cards">{row2.map((card, i) => renderCard(card, i + 3))}</div>
        )}
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
