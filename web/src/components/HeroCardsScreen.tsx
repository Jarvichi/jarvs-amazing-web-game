import React from 'react'
import { HERO_CARDS } from '../game/cards'
import { CardTile } from './CardTile'
import { useCardDetail } from './useCardDetail'

interface Props {
  onBack: () => void
}

export function HeroCardsScreen({ onBack }: Props) {
  const { openDetail, cardDetailNode } = useCardDetail()

  return (
    <div className="overlay-screen">
      <div className="overlay-header">
        <button className="action-btn" onClick={onBack}>← BACK</button>
        <span className="overlay-title">🦸 HERO CARDS</span>
      </div>
      <div style={{ padding: '8px 12px', color: 'var(--game-text-color-dim)', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        One hero appears in every battle.<br/>
        Hero cards are shuffled into your deck at the start of each battle. You cannot choose which hero appears — fate decides.
      </div>
      <div className="collection-grid" style={{ padding: '12px' }}>
        {HERO_CARDS.map(card => (
          <div key={card.id} className="collection-cell">
            <CardTile
              card={card}
              canAfford={true}
              onClick={() => openDetail(card)}
            />
            <div className="cell-footer">
              <span className="cell-count" style={{ color: '#ffd700', fontSize: '10px' }}>HERO</span>
              <button
                className="extra-btn cdm-info-btn"
                onClick={() => openDetail(card)}
                title="Card details"
              >ⓘ</button>
            </div>
          </div>
        ))}
      </div>
      {cardDetailNode}
    </div>
  )
}
