import React, { useState } from 'react'
import { Card } from '../../../../game/types'
import { getBuildingProduces, RESOURCE_ICONS, ResourceType, GOLD_SYMBOL, masteryOutputMultiplier, getCardMasteryLevel } from '../../../../game/cityBuilder'
import { CoreFarmBuilding, FARM_PLACE_COST } from '../../../../game/farmingSim'
import { SpriteImg } from '../../../ui/SpriteImg'
import { OverlayScreen } from '../../../ui/OverlayScreen'

export interface Props {
  availableCards:    Card[]
  coreFarmBuildings: CoreFarmBuilding[]
  gold:              number
  onPick:            (card: Card) => void
  onPickCore:        (b: CoreFarmBuilding) => void
  onBack:            () => void
}

function ProdLine({ name, gold, canAfford }: { name: string; gold: number; canAfford: boolean }) {
  const produces   = getBuildingProduces(name)
  const prodEntries = (Object.entries(produces).filter(([, v]) => (v as number) > 0)) as [ResourceType, number][]
  return (
    <>
      {prodEntries.length > 0 && (
        <div className="city-picker-produces">
          {prodEntries.map(([res, rate]) =>
            `+${(rate * 1.5 * masteryOutputMultiplier(getCardMasteryLevel(name))).toFixed(1)} ${RESOURCE_ICONS[res]}/min`
          ).join(' ')}
        </div>
      )}
      <div className={`city-picker-cost${canAfford ? '' : ' city-picker-cost--cant'}`}>
        {GOLD_SYMBOL} {gold.toLocaleString()}
      </div>
    </>
  )
}

export function FarmBuildingPicker({ availableCards, coreFarmBuildings, gold, onPick, onPickCore, onBack }: Props) {
  const [search, setSearch] = useState('')

  const q = search.toLowerCase()
  const filteredCards = q
    ? availableCards.filter(c => c.name.toLowerCase().includes(q))
    : availableCards
  const filteredCore = q
    ? coreFarmBuildings.filter(b => b.name.toLowerCase().includes(q))
    : coreFarmBuildings

  const hasResults = filteredCards.length > 0 || filteredCore.length > 0

  return (
    <OverlayScreen
      title="🌾 FARM BUILDINGS"
      onBack={onBack}
      className="city-screen u-relative u-col u-gap-2"
    >
      <div className="city-subscreen-scroll">
        <input
          className="city-search"
          type="search"
          placeholder="Search buildings…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {!hasResults ? (
          q
            ? <div className="city-picker-empty">No buildings match "{search}"</div>
            : <div className="city-picker-empty">No production buildings available to place on the farm.</div>
        ) : (
          <>
            {filteredCore.length > 0 && (
              <div className="city-picker-section">
                <div className="city-picker-section-label">
                  FARM EXCLUSIVE
                  <span className="city-picker-section-sub"> · always available · +50% output on the farm</span>
                </div>
                <div className="city-picker-grid">
                  {filteredCore.map(b => {
                    const canAfford = gold >= b.goldCost
                    return (
                      <button
                        key={b.name}
                        className={`city-picker-card u-col u-items-c u-gap-2 u-pointer${canAfford ? '' : ' city-picker-card--disabled'}`}
                        onClick={() => canAfford && onPickCore(b)}
                        title={b.hint}
                        disabled={!canAfford}
                      >
                        <SpriteImg name={b.name} className="city-picker-sprite" />
                        <div className="city-picker-name">{b.name}</div>
                        <div className={`city-picker-rarity city-picker-rarity--${b.rarity}`}>{b.rarity}</div>
                        <ProdLine name={b.name} gold={b.goldCost} canAfford={canAfford} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {filteredCards.length > 0 && (
              <div className="city-picker-section">
                <div className="city-picker-section-label">
                  PRODUCERS
                  <span className="city-picker-section-sub"> · from your collection · +50% output on the farm · raids every 3–4 hrs</span>
                </div>
                <div className="city-picker-grid">
                  {filteredCards.map(card => {
                    const cost      = FARM_PLACE_COST[card.rarity] ?? 200
                    const canAfford = gold >= cost
                    return (
                      <button
                        key={card.name}
                        className={`city-picker-card u-col u-items-c u-gap-2 u-pointer${canAfford ? '' : ' city-picker-card--disabled'}`}
                        onClick={() => canAfford && onPick(card)}
                        title={`Place ${card.name} on the farm`}
                        disabled={!canAfford}
                      >
                        <SpriteImg name={card.name} className="city-picker-sprite" />
                        <div className="city-picker-name">{card.name}</div>
                        <div className={`city-picker-rarity city-picker-rarity--${card.rarity}`}>{card.rarity}</div>
                        <ProdLine name={card.name} gold={cost} canAfford={canAfford} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </OverlayScreen>
  )
}
