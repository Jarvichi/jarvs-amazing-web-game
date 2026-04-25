// ─── City Builder ─────────────────────────────────────────────────────────────
// Idle city minigame: place owned cards on a grid, collect gold, level up cards.

import React, { useState, useCallback } from 'react'
import { getCardCatalog } from '../../game/cards'
import { loadCollection, getOwnedCount } from '../../game/collection'
import {
  CITY_COLS, CITY_ROWS, CITY_CELLS,
  CityCell, CityState,
  loadCityState, saveCityState, tickCity,
  placeCard, removeCard,
  goldPerMinute, getCardLevel, levelUpCost, levelUpCard,
  LEVEL_UP_COSTS, MAX_CARD_LEVEL, LEVEL_ATK_BONUS, LEVEL_MAX_HP_BONUS,
} from '../../game/cityBuilder'
import { SpriteImg } from '../SpriteImg'
import { Card } from '../../game/types'

interface Props {
  onBack: () => void
}

type PickerMode = { type: 'place'; index: number } | null

export function CityBuilder({ onBack }: Props) {
  const [city, setCity]       = useState<CityState>(() => tickCity(loadCityState()))
  const [picker, setPicker]   = useState<PickerMode>(null)
  const [levelCard, setLevelCard] = useState<string | null>(null)
  const [toast, setToast]     = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function save(next: CityState) {
    setCity(next)
    saveCityState(next)
  }

  // ── Cell tap ─────────────────────────────────────────────────────────────────

  function handleCellTap(index: number) {
    const cell = city.grid[index]
    if (cell) {
      // Remove existing card
      save(removeCard(city, index))
      showToast(`${cell.cardName} removed.`)
    } else {
      setPicker({ type: 'place', index })
    }
  }

  // ── Place a card ──────────────────────────────────────────────────────────────

  const handlePickCard = useCallback((card: Card) => {
    if (!picker) return
    const cell: CityCell = {
      cardName: card.name,
      cardType: card.cardType as 'unit' | 'structure',
      rarity:   card.rarity,
    }
    save(placeCard(city, picker.index, cell))
    setPicker(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker, city])

  // ── Level up ──────────────────────────────────────────────────────────────────

  function handleLevelUp(cardName: string) {
    const next = levelUpCard(city, cardName)
    if (!next) {
      showToast('Not enough gold!')
      return
    }
    save(next)
    const newLevel = next.cardLevels[cardName] ?? 0
    showToast(`${cardName} levelled up to ★${newLevel}!`)
  }

  // ── Picker contents ───────────────────────────────────────────────────────────

  const catalog     = getCardCatalog()
  const collection  = loadCollection()
  const ownedCards  = catalog.filter(c =>
    (c.cardType === 'unit' || c.cardType === 'structure') &&
    getOwnedCount(collection, c.name) > 0
  )

  // Cards already placed on the grid (by name, to allow duplicates only if owned count covers it)
  const placedCounts: Record<string, number> = {}
  for (const cell of city.grid) {
    if (cell) placedCounts[cell.cardName] = (placedCounts[cell.cardName] ?? 0) + 1
  }

  const availableForPlace = ownedCards.filter(c =>
    (placedCounts[c.name] ?? 0) < getOwnedCount(collection, c.name)
  )

  // ── Levellable cards (cards player owns) ──────────────────────────────────────

  const levellable = catalog.filter(c => getOwnedCount(collection, c.name) > 0)

  const gpm = goldPerMinute(city)

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (picker) {
    return (
      <div className="city-screen">
        <div className="city-picker-header">
          <button className="action-btn" onClick={() => setPicker(null)}>← BACK</button>
          <div className="city-picker-title">PLACE A CARD</div>
        </div>
        {availableForPlace.length === 0 ? (
          <div className="city-picker-empty">No cards available. Earn more from battles!</div>
        ) : (
          <div className="city-picker-grid">
            {availableForPlace.map(card => (
              <button
                key={card.name}
                className="city-picker-card"
                onClick={() => handlePickCard(card)}
              >
                <SpriteImg name={card.name} className="city-picker-sprite" />
                <div className="city-picker-name">{card.name}</div>
                <div className={`city-picker-rarity city-picker-rarity--${card.rarity}`}>
                  {card.rarity}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (levelCard !== null) {
    const card  = catalog.find(c => c.name === levelCard)
    const level = getCardLevel(city, levelCard)
    const cost  = levelUpCost(level)
    return (
      <div className="city-screen">
        <div className="city-picker-header">
          <button className="action-btn" onClick={() => setLevelCard(null)}>← BACK</button>
          <div className="city-picker-title">LEVEL UP CARD</div>
        </div>
        <div className="city-level-detail">
          {card && <SpriteImg name={card.name} className="city-level-sprite" />}
          <div className="city-level-name">{levelCard}</div>
          <div className="city-level-stars">
            {Array.from({ length: MAX_CARD_LEVEL }, (_, i) => (
              <span key={i} className={`city-star${i < level ? ' city-star--filled' : ''}`}>★</span>
            ))}
          </div>
          <div className="city-level-stats">
            <div>+{level * LEVEL_ATK_BONUS} ATK bonus</div>
            <div>+{level * LEVEL_MAX_HP_BONUS} max HP bonus</div>
          </div>
          {level < MAX_CARD_LEVEL ? (
            <>
              <div className="city-level-cost">
                Next level costs <span className="city-gold">⚙ {cost}</span>
              </div>
              <div className="city-level-costs-table">
                {LEVEL_UP_COSTS.map((c, i) => (
                  <div key={i} className={`city-cost-row${i < level ? ' city-cost-row--done' : ''}`}>
                    <span>★{i + 1}</span>
                    <span>⚙ {c}</span>
                    <span>+{(i + 1) * LEVEL_ATK_BONUS} ATK / +{(i + 1) * LEVEL_MAX_HP_BONUS} HP</span>
                  </div>
                ))}
              </div>
              <button
                className={`action-btn${city.gold >= (cost ?? 0) ? ' action-btn--gold' : ''}`}
                onClick={() => handleLevelUp(levelCard)}
                disabled={city.gold < (cost ?? 0)}
              >
                {city.gold >= (cost ?? 0) ? `LEVEL UP (⚙ ${cost})` : `NEED ⚙ ${cost}`}
              </button>
            </>
          ) : (
            <div className="city-level-maxed">MAX LEVEL REACHED!</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="city-screen">
      {toast && <div className="city-toast" role="alert">{toast}</div>}

      {/* Header */}
      <div className="city-header">
        <button className="action-btn" onClick={onBack}>← BACK</button>
        <div className="city-title">🏙 CITY</div>
        <div className="city-gold-display">⚙ {city.gold.toLocaleString()}</div>
      </div>
      <div className="city-subheader">
        {gpm > 0
          ? `+${gpm} gold/min — place buildings to earn more`
          : 'Place units and buildings to generate gold'}
      </div>

      {/* Grid */}
      <div
        className="city-grid"
        style={{ gridTemplateColumns: `repeat(${CITY_COLS}, 1fr)` }}
      >
        {Array.from({ length: CITY_CELLS }, (_, i) => {
          const cell = city.grid[i]
          return (
            <button
              key={i}
              className={`city-cell${cell ? ' city-cell--occupied' : ''}`}
              onClick={() => handleCellTap(i)}
              title={cell ? `${cell.cardName} — tap to remove` : 'Empty — tap to place'}
            >
              {cell ? (
                <>
                  <SpriteImg name={cell.cardName} className="city-cell-sprite" />
                  <div className="city-cell-name">{cell.cardName}</div>
                  {getCardLevel(city, cell.cardName) > 0 && (
                    <div className="city-cell-level">★{getCardLevel(city, cell.cardName)}</div>
                  )}
                </>
              ) : (
                <span className="city-cell-empty">+</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Level up section */}
      <div className="city-section-title">LEVEL UP CARDS</div>
      <div className="city-hint">Spend gold to permanently boost cards in battle.</div>
      <div className="city-level-grid">
        {levellable.map(card => {
          const level = getCardLevel(city, card.name)
          const cost  = levelUpCost(level)
          const canAfford = cost !== null && city.gold >= cost
          return (
            <button
              key={card.name}
              className={`city-level-card${level > 0 ? ' city-level-card--levelled' : ''}`}
              onClick={() => setLevelCard(card.name)}
            >
              <SpriteImg name={card.name} className="city-level-card-sprite" />
              <div className="city-level-card-name">{card.name}</div>
              <div className="city-level-card-stars">
                {Array.from({ length: MAX_CARD_LEVEL }, (_, i) => (
                  <span key={i} className={`city-star-sm${i < level ? ' city-star-sm--filled' : ''}`}>★</span>
                ))}
              </div>
              {level < MAX_CARD_LEVEL ? (
                <div className={`city-level-card-cost${canAfford ? ' city-level-card-cost--ready' : ''}`}>
                  ⚙ {cost}
                </div>
              ) : (
                <div className="city-level-card-maxed">MAX</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
