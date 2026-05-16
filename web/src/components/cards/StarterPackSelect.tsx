import React from 'react'
import { DeckEntry, STARTER_PACK_OPTIONS } from '../../game/collection'
import { getCardCatalog } from '../../game/cards'

interface Props {
  onPick: (cards: DeckEntry[]) => void
  fatiguedCards?: string[]   // card names currently resting — shown with a badge
  bonusCards?: string[]      // card names auto-added to collection as a top-up bonus
}

export function StarterPackSelect({ onPick, fatiguedCards = [], bonusCards = [] }: Props) {
  const catalog = getCardCatalog()

  return (
    <div className="starter-select u-col u-items-c u-gap-8">
      <div className="starter-select-header u-text-c">
        <div className="starter-select-title">DECK RESET</div>
        <div className="starter-select-sub">
          Your deck returns to basics. Choose a starter kit for the next act.<br />
          Your collection and mastery carry forward untouched.
        </div>
        {fatiguedCards.length > 0 && (
          <div className="starter-fatigued-notice">
            Resting this act: {fatiguedCards.map(n => <span key={n} className="fatigued-tag">{n}</span>)}
            {' '}— these cards cannot be added to your deck.
          </div>
        )}
        {bonusCards.length > 0 && (
          <div className="starter-bonus-notice">
            ★ BONUS PACK — {bonusCards.length} cards added to your collection to keep your deck going:
            <span className="bonus-card-list"> {bonusCards.join(', ')}</span>
          </div>
        )}
      </div>

      <div className="starter-packs u-flex u-gap-6 u-just-c u-wrap">
        {STARTER_PACK_OPTIONS.map(pack => (
          <div key={pack.id} className="starter-pack u-col u-gap-4 u-grow u-pointer" onClick={() => onPick(pack.cards)}>
            <div className="starter-pack-name">{pack.name}</div>
            <div className="starter-pack-desc">{pack.description}</div>
            <ul className="starter-pack-list">
              {pack.cards.map(entry => {
                const card = catalog.find(c => c.name === entry.cardName)
                const isFatigued = fatiguedCards.includes(entry.cardName)
                return (
                  <li key={entry.cardName} className={`spl-item u-flex u-gap-3 spl-item--${card?.rarity ?? 'common'}${isFatigued ? ' spl-item--resting' : ''}`}>
                    <span className="spl-count">×{entry.count}</span>
                    <span className="spl-name">{entry.cardName}</span>
                    {isFatigued && <span className="spl-resting-badge">ZZZ</span>}
                  </li>
                )
              })}
            </ul>
            <button className="action-btn starter-pack-btn">CHOOSE</button>
          </div>
        ))}
      </div>
    </div>
  )
}
