import React, { useState } from 'react'
import { Card } from '../../../game/types'
import { getBuildingProduces, RESOURCE_ICONS, ResourceType } from '../../../game/cityBuilder'

export interface Props {
  availableCards: Card[]
  onPick:         (card: Card) => void
  onBack:         () => void
}

export function FarmBuildingPicker({ availableCards, onPick, onBack }: Props) {
  const [search, setSearch] = useState('')

  const filtered = availableCards.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="farm-picker u-col u-gap-3">
      <div className="overlay-header u-flex u-items-c u-gap-6">
        <button className="action-btn" onClick={onBack}>← BACK</button>
        <span className="overlay-title">🌾 FARM BUILDINGS</span>
      </div>

      <div style={{ fontSize: 11, color: '#669966', padding: '0 4px' }}>
        Only production buildings may be placed on the farm. Farms earn +50% resources but face
        raids every 3–4 hours.
      </div>

      <input
        className="city-picker-search"
        placeholder="Search buildings…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {filtered.length === 0 && (
        <div style={{ color: '#668866', padding: 16, textAlign: 'center' }}>
          {availableCards.length === 0
            ? 'No production buildings available to place on the farm.'
            : 'No buildings match your search.'}
        </div>
      )}

      <div className="farm-picker-grid">
        {filtered.map(card => {
          const produces = getBuildingProduces(card.name)
          const prodEntries = Object.entries(produces).filter(([, v]) => (v as number) > 0) as [ResourceType, number][]

          return (
            <div
              key={card.name}
              className="farm-picker-card"
              onClick={() => onPick(card)}
              title={`Place ${card.name} on the farm`}
            >
              <div className="farm-picker-card-name">{card.name}</div>
              <div className="farm-picker-card-rarity">{card.rarity}</div>
              <div className="farm-picker-card-produces">
                {prodEntries.map(([res, rate]) => (
                  <span key={res} className="farm-picker-prod-chip">
                    {RESOURCE_ICONS[res]} +{(rate * 1.5).toFixed(1)}/min
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
