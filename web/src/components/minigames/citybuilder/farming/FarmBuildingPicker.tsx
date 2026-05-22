import React, { useState } from 'react'
import { Card } from '../../../../game/types'
import { getBuildingProduces, RESOURCE_ICONS, ResourceType } from '../../../../game/cityBuilder'
import { SpriteImg } from '../../../ui/SpriteImg'

export interface Props {
  availableCards: Card[]
  onPick:         (card: Card) => void
  onBack:         () => void
}

export function FarmBuildingPicker({ availableCards, onPick, onBack }: Props) {
  const [search, setSearch] = useState('')

  const q = search.toLowerCase()
  const filtered = q
    ? availableCards.filter(c => c.name.toLowerCase().includes(q))
    : availableCards

  return (
    <div className="city-screen u-relative u-col u-gap-2">
      <div className="overlay-header u-flex u-items-c u-gap-6">
        <button className="action-btn" onClick={onBack}>← BACK</button>
        <div className="overlay-title">🌾 FARM BUILDINGS</div>
      </div>
      <div className="city-subscreen-scroll">
        <input
          className="city-search"
          type="search"
          placeholder="Search buildings…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {availableCards.length === 0 ? (
          <div className="city-picker-empty">No production buildings available to place on the farm.</div>
        ) : filtered.length === 0 ? (
          <div className="city-picker-empty">No buildings match "{search}"</div>
        ) : (
          <div className="city-picker-section">
            <div className="city-picker-section-label">
              PRODUCERS
              <span className="city-picker-section-sub"> · +50% output on the farm · raids every 3–4 hrs</span>
            </div>
            <div className="city-picker-grid">
              {filtered.map(card => {
                const produces = getBuildingProduces(card.name)
                const prodEntries = (Object.entries(produces).filter(([, v]) => (v as number) > 0)) as [ResourceType, number][]
                return (
                  <button
                    key={card.name}
                    className="city-picker-card u-col u-items-c u-gap-2 u-pointer"
                    onClick={() => onPick(card)}
                    title={`Place ${card.name} on the farm`}
                  >
                    <SpriteImg name={card.name} className="city-picker-sprite" />
                    <div className="city-picker-name">{card.name}</div>
                    <div className={`city-picker-rarity city-picker-rarity--${card.rarity}`}>{card.rarity}</div>
                    {prodEntries.length > 0 && (
                      <div className="city-picker-produces">
                        {prodEntries.map(([res, rate]) =>
                          `+${(rate * 1.5).toFixed(1)} ${RESOURCE_ICONS[res]}/min`
                        ).join(' ')}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
