import React from 'react'
import {
  CityState, SPAWNER_PLACE_COST, RESOURCE_ICONS, ResourceType,
  INCOME_SPAWN, INCOME_UTILITY, INCOME_WALL,
  canAffordPlacement, getBuildingProduces, masteryOutputMultiplier, getCardMasteryLevel,
} from '../../../game/cityBuilder'
import { CollectionEntry, getMasteryXp, masteryLevel } from '../../../game/collection'
import { Card } from '../../../game/types'
import { SpriteImg } from '../../ui/SpriteImg'

export interface Props {
  availableForPlace: Card[]
  city:              CityState
  collection:        CollectionEntry[]
  pickerSearch:      string
  setPickerSearch:   (s: string) => void
  onBack:            () => void
  onPickCard:        (card: Card) => void
}

type PickerGroup = { label: string; cards: Card[] }

export function CardPicker({
  availableForPlace, city, collection,
  pickerSearch, setPickerSearch,
  onBack, onPickCard,
}: Props) {
  const pickerQ = pickerSearch.toLowerCase()
  const filteredForPlace = pickerQ
    ? availableForPlace.filter(c => {
        if (c.name.toLowerCase().includes(pickerQ)) return true
        const se = c.unit?.structureEffect
        if (se?.type === 'spawn') {
          const spawnedName = (se as { type: 'spawn'; unitTemplate: { name: string } }).unitTemplate.name
          if (spawnedName.toLowerCase().includes(pickerQ)) return true
        }
        return false
      })
    : availableForPlace

  const groups: PickerGroup[] = [
    {
      label: 'SPAWNERS',
      cards: filteredForPlace.filter(c => c.unit?.structureEffect?.type === 'spawn'),
    },
    {
      label: 'PRODUCERS',
      cards: filteredForPlace.filter(c => {
        if (c.unit?.structureEffect?.type === 'spawn') return false
        const p = getBuildingProduces(c.name)
        return Object.values(p).some(v => (v ?? 0) > 0)
      }),
    },
  ].filter(g => g.cards.length > 0)

  return (
    <div className="city-screen u-relative u-col u-gap-2">
      <div className="overlay-header u-flex u-items-c u-gap-6">
        <button className="action-btn" onClick={onBack}>← BACK</button>
        <div className="overlay-title">PLACE A BUILDING</div>
      </div>
      <div className="city-subscreen-scroll">
        <input
          className="city-search"
          type="search"
          placeholder="Search buildings…"
          value={pickerSearch}
          onChange={e => setPickerSearch(e.target.value)}
        />
        {availableForPlace.length === 0 ? (
          <div className="city-picker-empty">No buildings available. Earn more from battles!</div>
        ) : groups.length === 0 ? (
          <div className="city-picker-empty">No buildings match "{pickerSearch}"</div>
        ) : (
          groups.map(group => (
            <div key={group.label} className="city-picker-section">
              <div className="city-picker-section-label">{group.label}</div>
              <div className="city-picker-grid">
                {group.cards.map(card => {
                  const spawnEffect = card.unit?.structureEffect
                  const isSpawner   = spawnEffect?.type === 'spawn'
                  const spawnName   = isSpawner
                    ? (spawnEffect as { type: 'spawn'; unitTemplate: { name: string }; intervalMs: number }).unitTemplate.name
                    : null
                  const affordable  = !isSpawner || canAffordPlacement(city, card.rarity)
                  const cost        = isSpawner ? SPAWNER_PLACE_COST[card.rarity] : null
                  const produces    = !isSpawner ? getBuildingProduces(card.name) : null
                  const mLvl        = masteryLevel(getMasteryXp(collection, card.name))
                  const masteryMult = !isSpawner ? masteryOutputMultiplier(getCardMasteryLevel(card.name) ?? 0) : 1
                  const producesEntries = produces ? Object.entries(produces).filter(([, v]) => (v ?? 0) > 0) : []
                  const incomeRateVal = isSpawner
                    ? INCOME_SPAWN[card.rarity]
                    : producesEntries.length === 0 ? INCOME_WALL[card.rarity] : INCOME_UTILITY[card.rarity]

                  return (
                    <button
                      key={card.name}
                      className={`city-picker-card u-col u-items-c u-gap-2 u-pointer${!affordable ? ' city-picker-card--unaffordable' : ''}`}
                      onClick={() => onPickCard(card)}
                      disabled={!affordable}
                    >
                      <SpriteImg name={card.name} className="city-picker-sprite" />
                      <div className="city-picker-name">{card.name}</div>
                      <div className={`city-picker-rarity city-picker-rarity--${card.rarity}`}>{card.rarity}</div>
                      {mLvl > 0 && <div className="city-picker-mastery">★{mLvl}</div>}
                      {spawnName && (
                        <div className="city-picker-spawns">
                          <SpriteImg name={spawnName} className="city-picker-spawn-icon" />
                          <span>{spawnName}</span>
                        </div>
                      )}
                      {cost && (
                        <div className="city-picker-cost">
                          {Object.entries(cost).map(([r, amt]) =>
                            `${RESOURCE_ICONS[r as ResourceType]}${amt}`
                          ).join(' ')}
                        </div>
                      )}
                      {producesEntries.length > 0 && (
                        <div className="city-picker-produces">
                          {producesEntries.map(([r, amt]) =>
                            `+${Math.round((amt as number) * masteryMult)} ${RESOURCE_ICONS[r as ResourceType]}/min`
                          ).join(' ')}
                        </div>
                      )}
                      {incomeRateVal > 0 && (
                        <div className="city-picker-income">+{incomeRateVal} 💰/min</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
