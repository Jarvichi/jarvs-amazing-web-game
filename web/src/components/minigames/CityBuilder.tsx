// ─── City Builder ─────────────────────────────────────────────────────────────
// Idle city: place owned structure cards on a grid. Spawn buildings show their
// unit walking around the city. Units need wages; if unpaid, happiness drops
// and the building earns at half rate.

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { getCardCatalog } from '../../game/cards'
import { loadCollection, getOwnedCount } from '../../game/collection'
import {
  CITY_COLS, CITY_ROWS, CITY_CELLS, CELL_PX,
  CityCell, CityState,
  loadCityState, saveCityState, tickCity,
  placeCard, removeCard,
  goldIncomeRate, goldWageRate, goldNetRate,
  getCardLevel, levelUpCost, levelUpCard,
  LEVEL_UP_COSTS, MAX_CARD_LEVEL, LEVEL_ATK_BONUS, LEVEL_MAX_HP_BONUS,
} from '../../game/cityBuilder'
import { SpriteImg, AnimatedSpriteImg } from '../SpriteImg'
import { Card } from '../../game/types'

// ── Walking unit state ────────────────────────────────────────────────────────

const OVERLAY_W = CITY_COLS * CELL_PX
const OVERLAY_H = CITY_ROWS * CELL_PX
const UNIT_SIZE = 20
const SPEED     = 0.8 // px per 100 ms tick

interface Walker {
  cellIndex: number
  unitName:  string
  x:   number
  y:   number
  vx:  number
  vy:  number
  turnTimer: number
}

function makeWalker(cellIndex: number, unitName: string): Walker {
  const angle = Math.random() * Math.PI * 2
  return {
    cellIndex,
    unitName,
    x: Math.random() * (OVERLAY_W - UNIT_SIZE),
    y: Math.random() * (OVERLAY_H - UNIT_SIZE),
    vx: Math.cos(angle) * SPEED,
    vy: Math.sin(angle) * SPEED,
    turnTimer: 20 + Math.floor(Math.random() * 30),
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void
}

type SubScreen = 'city' | 'picker' | 'levelup'

export function CityBuilder({ onBack }: Props) {
  const [city, setCity]       = useState<CityState>(() => tickCity(loadCityState()))
  const [screen, setScreen]   = useState<SubScreen>('city')
  const [pickerIndex, setPickerIndex] = useState<number>(0)
  const [levelCard, setLevelCard]     = useState<string | null>(null)
  const [toast, setToast]     = useState<string | null>(null)
  const [walkers, setWalkers] = useState<Walker[]>([])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function save(next: CityState) {
    setCity(next)
    saveCityState(next)
  }

  // ── Sync walkers when grid changes ───────────────────────────────────────────

  useEffect(() => {
    setWalkers(prev => {
      const next: Walker[] = []
      for (let i = 0; i < city.grid.length; i++) {
        const cell = city.grid[i]
        if (!cell?.spawnedUnitName) continue
        const existing = prev.find(w => w.cellIndex === i && w.unitName === cell.spawnedUnitName)
        next.push(existing ?? makeWalker(i, cell.spawnedUnitName))
      }
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.grid])

  // ── Animation loop ────────────────────────────────────────────────────────────

  const walkersRef = useRef(walkers)
  walkersRef.current = walkers

  useEffect(() => {
    const id = setInterval(() => {
      setWalkers(prev => prev.map(w => {
        let { x, y, vx, vy, turnTimer } = w
        x += vx
        y += vy
        if (x < 0)                 { x = 0;                  vx = Math.abs(vx) }
        if (x > OVERLAY_W - UNIT_SIZE) { x = OVERLAY_W - UNIT_SIZE; vx = -Math.abs(vx) }
        if (y < 0)                 { y = 0;                  vy = Math.abs(vy) }
        if (y > OVERLAY_H - UNIT_SIZE) { y = OVERLAY_H - UNIT_SIZE; vy = -Math.abs(vy) }
        turnTimer--
        if (turnTimer <= 0) {
          const angle = Math.random() * Math.PI * 2
          vx = Math.cos(angle) * SPEED
          vy = Math.sin(angle) * SPEED
          turnTimer = 20 + Math.floor(Math.random() * 30)
        }
        return { ...w, x, y, vx, vy, turnTimer }
      }))
    }, 100)
    return () => clearInterval(id)
  }, []) // stable — no deps

  // ── Gold tick (every 10 s while screen is open) ───────────────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      setCity(prev => {
        const next = tickCity(prev)
        saveCityState(next)
        return next
      })
    }, 10_000)
    return () => clearInterval(id)
  }, [])

  // ── Cell interaction ──────────────────────────────────────────────────────────

  function handleCellTap(index: number) {
    if (city.grid[index]) {
      const cell = city.grid[index]!
      save(removeCard(city, index))
      showToast(`${cell.cardName} removed.`)
    } else {
      setPickerIndex(index)
      setScreen('picker')
    }
  }

  // ── Place a card ──────────────────────────────────────────────────────────────

  const handlePickCard = useCallback((card: Card) => {
    const spawnEffect = card.unit?.structureEffect
    const spawnedUnitName = spawnEffect?.type === 'spawn'
      ? (spawnEffect as { type: 'spawn'; unitTemplate: { name: string }; intervalMs: number }).unitTemplate.name
      : undefined
    const cell: CityCell = {
      cardName:        card.name,
      rarity:          card.rarity,
      spawnedUnitName,
    }
    save(placeCard(city, pickerIndex, cell))
    setScreen('city')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerIndex, city])

  // ── Level up ──────────────────────────────────────────────────────────────────

  function handleLevelUp(cardName: string) {
    const next = levelUpCard(city, cardName)
    if (!next) { showToast('Not enough gold!'); return }
    save(next)
    showToast(`${cardName} levelled up to ★${next.cardLevels[cardName]}!`)
  }

  // ── Derived data ──────────────────────────────────────────────────────────────

  const catalog    = getCardCatalog()
  const collection = loadCollection()

  const ownedStructures = catalog.filter(c =>
    c.cardType === 'structure' && getOwnedCount(collection, c.name) > 0
  )

  const placedCounts: Record<string, number> = {}
  for (const cell of city.grid) {
    if (cell) placedCounts[cell.cardName] = (placedCounts[cell.cardName] ?? 0) + 1
  }

  const availableForPlace = ownedStructures.filter(c =>
    (placedCounts[c.name] ?? 0) < getOwnedCount(collection, c.name)
  )

  const levellable = catalog.filter(c => c.cardType === 'structure' && getOwnedCount(collection, c.name) > 0)

  const incomeRate = Math.round(goldIncomeRate(city))
  const wageRate   = Math.round(goldWageRate(city))
  const netRate    = Math.round(goldNetRate(city))

  // ── Card picker sub-screen ────────────────────────────────────────────────────

  if (screen === 'picker') {
    return (
      <div className="city-screen">
        <div className="city-picker-header">
          <button className="action-btn" onClick={() => setScreen('city')}>← BACK</button>
          <div className="city-picker-title">PLACE A BUILDING</div>
        </div>
        {availableForPlace.length === 0 ? (
          <div className="city-picker-empty">No buildings available. Earn more from battles!</div>
        ) : (
          <div className="city-picker-grid">
            {availableForPlace.map(card => {
              const spawnEffect = card.unit?.structureEffect
              const spawnName = spawnEffect?.type === 'spawn'
                ? (spawnEffect as { type: 'spawn'; unitTemplate: { name: string }; intervalMs: number }).unitTemplate.name
                : null
              return (
                <button key={card.name} className="city-picker-card" onClick={() => handlePickCard(card)}>
                  <SpriteImg name={card.name} className="city-picker-sprite" />
                  <div className="city-picker-name">{card.name}</div>
                  <div className={`city-picker-rarity city-picker-rarity--${card.rarity}`}>{card.rarity}</div>
                  {spawnName && (
                    <div className="city-picker-spawns">
                      spawns <SpriteImg name={spawnName} className="city-picker-spawn-icon" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Level-up sub-screen ───────────────────────────────────────────────────────

  if (screen === 'levelup' && levelCard !== null) {
    const card  = catalog.find(c => c.name === levelCard)
    const level = getCardLevel(city, levelCard)
    const cost  = levelUpCost(level)
    return (
      <div className="city-screen">
        <div className="city-picker-header">
          <button className="action-btn" onClick={() => setScreen('city')}>← BACK</button>
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

  // ── Main city view ────────────────────────────────────────────────────────────

  return (
    <div className="city-screen">
      {toast && <div className="city-toast" role="alert">{toast}</div>}

      {/* Header */}
      <div className="city-header">
        <button className="action-btn" onClick={onBack}>← BACK</button>
        <div className="city-title">🏙 CITY</div>
        <div className="city-gold-display">⚙ {city.gold.toLocaleString()}</div>
      </div>

      {/* Income breakdown */}
      <div className="city-income-row">
        <span className="city-income-in">+{incomeRate} income</span>
        {wageRate > 0 && <span className="city-income-wage"> − {wageRate} wages</span>}
        <span className={`city-income-net${netRate >= 0 ? ' city-income-net--pos' : ' city-income-net--neg'}`}>
          {netRate >= 0 ? `= +${netRate}` : `= ${netRate}`}/min
        </span>
      </div>

      {/* City world: grid + walker overlay */}
      <div className="city-world">
        <div
          className="city-grid"
          style={{ gridTemplateColumns: `repeat(${CITY_COLS}, 1fr)` }}
        >
          {Array.from({ length: CITY_CELLS }, (_, i) => {
            const cell      = city.grid[i]
            const happiness = cell?.spawnedUnitName ? (city.happiness[i] ?? 100) : 100
            const unhappy   = happiness === 0
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
                    {cell.spawnedUnitName && (
                      <div
                        className="city-cell-happiness"
                        style={{
                          width: `${happiness}%`,
                          background: happiness > 60 ? '#40a040' : happiness > 30 ? '#a0a020' : '#a03020',
                        }}
                      />
                    )}
                    {unhappy && <span className="city-cell-unhappy-icon">⚠</span>}
                  </>
                ) : (
                  <span className="city-cell-empty">+</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Walking units overlay */}
        <div className="city-unit-overlay" aria-hidden="true">
          {walkers.map(w => {
            const happiness = city.happiness[w.cellIndex] ?? 100
            return (
              <div
                key={w.cellIndex}
                className={`city-walker${happiness === 0 ? ' city-walker--unhappy' : ''}`}
                style={{ left: Math.round(w.x), top: Math.round(w.y) }}
              >
                <AnimatedSpriteImg
                  name={w.unitName}
                  frameCount={3}
                  fps={6}
                  className="city-walker-sprite"
                />
                {happiness < 30 && <span className="city-walker-need">!</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Level up section */}
      <div className="city-section-title">LEVEL UP BUILDINGS</div>
      <div className="city-hint">Spend gold to permanently boost your structures in battle.</div>
      <div className="city-level-grid">
        {levellable.map(card => {
          const level     = getCardLevel(city, card.name)
          const cost      = levelUpCost(level)
          const canAfford = cost !== null && city.gold >= cost
          return (
            <button
              key={card.name}
              className={`city-level-card${level > 0 ? ' city-level-card--levelled' : ''}`}
              onClick={() => { setLevelCard(card.name); setScreen('levelup') }}
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
