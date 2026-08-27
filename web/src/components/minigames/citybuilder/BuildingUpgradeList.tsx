import React from 'react'
import { CityState, getBuildingProduces, GOLD_SYMBOL, levelUpCost } from '../../../game/cityBuilder'
import { CollectionEntry, getMasteryXp, masteryLevel } from '../../../game/collection'
import { Card } from '../../../game/types'
import { SpriteImg } from '../../ui/SpriteImg'
import { OverlayScreen } from '../../ui/OverlayScreen'

export interface Props {
  levellable:      Card[]
  city:            CityState
  collection:      CollectionEntry[]
  upgradeSearch:   string
  setUpgradeSearch: (s: string) => void
  onBack:          () => void
  onSelectCard:    (cardName: string) => void
}

type UpgradeGroup = { label: string; cards: Card[] }

export function BuildingUpgradeList({
  levellable, city, collection, upgradeSearch, setUpgradeSearch, onBack, onSelectCard,
}: Props) {
  const upgradeQ = upgradeSearch.toLowerCase()
  const filteredLevellable = upgradeQ
    ? levellable.filter(c => c.name.toLowerCase().includes(upgradeQ))
    : levellable

  const upgradeGroups: UpgradeGroup[] = [
    {
      label: 'SPAWNERS',
      cards: filteredLevellable.filter(c => c.unit?.structureEffect?.type === 'spawn'),
    },
    {
      label: 'PRODUCERS',
      cards: filteredLevellable.filter(c => {
        if (c.unit?.structureEffect?.type === 'spawn') return false
        const p = getBuildingProduces(c.name)
        return Object.values(p).some(v => (v ?? 0) > 0)
      }),
    },
    {
      label: 'DEFENCE',
      cards: filteredLevellable.filter(c => {
        if (c.unit?.structureEffect?.type === 'spawn') return false
        const p = getBuildingProduces(c.name)
        return !Object.values(p).some(v => (v ?? 0) > 0)
      }),
    },
  ].filter(g => g.cards.length > 0)

  return (
    <OverlayScreen
      title="UPGRADE BUILDINGS"
      onBack={onBack}
      className="city-screen u-relative u-col u-gap-2"
    >
      <div className="city-subscreen-scroll">
        <div className="city-gold-display" style={{ textAlign: 'center', padding: '4px' }}>
          {GOLD_SYMBOL} {city.gold.toLocaleString()} gold
        </div>
        <input
          className="city-search"
          type="search"
          placeholder="Search buildings…"
          value={upgradeSearch}
          onChange={e => setUpgradeSearch(e.target.value)}
        />
        {upgradeGroups.length === 0 ? (
          <div className="city-picker-empty">
            {upgradeQ ? `No buildings match "${upgradeSearch}"` : 'No buildings to upgrade yet.'}
          </div>
        ) : (
          upgradeGroups.map(group => (
            <div key={group.label} className="city-picker-section">
              <div className="city-picker-section-label">{group.label}</div>
              <div className="city-level-grid">
                {group.cards.map(card => {
                  const xp        = getMasteryXp(collection, card.name)
                  const mLvl      = masteryLevel(xp)
                  const cost      = levelUpCost(mLvl, card.name)
                  const canAfford = city.gold >= cost
                  return (
                    <button
                      key={card.name}
                      className={`city-level-card${mLvl > 0 ? ' city-level-card--levelled' : ''}`}
                      onClick={() => onSelectCard(card.name)}
                    >
                      <SpriteImg name={card.name} className="city-level-card-sprite" />
                      <div className="city-level-card-name">{card.name}</div>
                      <div className="city-level-card-stars">★{mLvl} mastery</div>
                      <div className={`city-level-card-cost${canAfford ? ' city-level-card-cost--ready' : ''}`}>
                        {GOLD_SYMBOL} {cost.toLocaleString()}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </OverlayScreen>
  )
}
