// ─── City Builder ─────────────────────────────────────────────────────────────
// Idle city: place owned structure cards on a grid. Spawn buildings show their
// unit walking around the city. Resources are produced and consumed over time.
// Happiness is driven by food and defence.

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { getCardCatalog } from '../../game/cards'
import {
  loadCollection, saveCollection, getOwnedCount,
  getMasteryXp, masteryLevel, masteryXpForLevel, masteryProgress,
} from '../../game/collection'
import {
  CITY_COLS, CITY_ROWS, CITY_CELLS, CELL_PX,
  CityCell, CityState, ResourceType, ResourceStock,
  RESOURCE_ICONS, SPAWNER_PLACE_COST,
  loadCityState, saveCityState, tickCity,
  placeCard, removeCard,
  goldIncomeRate, goldNetRate,
  cityDefense, cityPopulation,
  canAffordPlacement,
  resourceProductionRate, resourceConsumptionRate,
  levelUpCost, levelUpCard, LEVEL_UP_COSTS,
  getBuildingProduces,
  INCOME_SPAWN, INCOME_UTILITY, INCOME_WALL,
  spawnerUnitCount, masteryOutputMultiplier,
} from '../../game/cityBuilder'
import { MasteryBar } from '../MasteryBar'
import { SpriteImg, AnimatedSpriteImg } from '../SpriteImg'
import { Card } from '../../game/types'

// ── Unit requirement helpers ──────────────────────────────────────────────────

function rageDescription(happiness: number): string {
  if (happiness === 0)   return 'Left the city'
  if (happiness < 30)    return 'Furious — leaving soon!'
  if (happiness < 60)    return 'Unsettled'
  if (happiness < 90)    return 'A little uneasy'
  return 'Content'
}

function getUnitRequirements(
  cell: CityCell,
  cityState: CityState,
  presentNames: Set<string>,
): { text: string; met: boolean }[] {
  const reqs: { text: string; met: boolean }[] = []

  if (cell.affinityWith) {
    reqs.push({
      text: `Wants a ${cell.affinityWith} in the city`,
      met: presentNames.has(cell.affinityWith),
    })
  }

  const pop = Math.max(cityPopulation(cityState), 1)
  const foodScore = Math.min(100, (cityState.resources.wheat / pop) * 5)
  reqs.push({ text: 'Needs adequate food supply', met: foodScore >= 50 })

  const defense = cityDefense(cityState)
  const defenseScore = Math.min(100, (defense / pop) * 8)
  if (defense > 0 || defenseScore < 30) {
    reqs.push({ text: 'Needs city defenses', met: defenseScore >= 50 })
  }

  return reqs
}

// ── Resident name generator ───────────────────────────────────────────────────

const RESIDENT_FIRST_NAMES = [
  'Bob', 'Grak', 'Mira', 'Thorin', 'Zyx', 'Elda', 'Fang', 'Nix', 'Wren', 'Dusk',
  'Pip', 'Crux', 'Vale', 'Sorn', 'Brix', 'Holt', 'Vera', 'Kurn', 'Dex', 'Ori',
  'Sable', 'Flint', 'Rook', 'Ivy', 'Bryn', 'Quill', 'Ash', 'Moss', 'Thorn', 'Lark',
]

function residentName(unitName: string, cellIndex: number, unitIndex: number): string {
  const seed = cellIndex * 17 + unitIndex * 31
  return `${RESIDENT_FIRST_NAMES[seed % RESIDENT_FIRST_NAMES.length]} the ${unitName}`
}

// ── Walking unit state ────────────────────────────────────────────────────────

const OVERLAY_W = CITY_COLS * CELL_PX
const OVERLAY_H = CITY_ROWS * CELL_PX
const UNIT_SIZE = 20
const SPEED     = 0.8 // px per 100 ms tick

interface Walker {
  cellIndex:  number
  unitIndex:  number
  unitName:   string
  affinityWith?: string
  x:   number
  y:   number
  vx:  number
  vy:  number
  turnTimer: number
}

function makeWalker(cellIndex: number, unitIndex: number, unitName: string, affinityWith?: string): Walker {
  const angle = Math.random() * Math.PI * 2
  return {
    cellIndex,
    unitIndex,
    unitName,
    affinityWith,
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

type SubScreen = 'city' | 'picker' | 'upgrade' | 'levelup'

export function CityBuilder({ onBack }: Props) {
  const [city, setCity]       = useState<CityState>(() => tickCity(loadCityState()))
  const [screen, setScreen]   = useState<SubScreen>('city')
  const [pickerIndex, setPickerIndex] = useState<number>(0)
  const [levelCard, setLevelCard]     = useState<string | null>(null)
  const [toast, setToast]     = useState<string | null>(null)
  const [walkers, setWalkers] = useState<Walker[]>([])
  const [selectedWalkerCell, setSelectedWalkerCell] = useState<number | null>(null)
  const [selectedBuildingCell, setSelectedBuildingCell] = useState<number | null>(null)
  const [bulldozerMode, setBulldozerMode] = useState(false)
  const bulldozerRef = useRef(false)

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
        // Skip despawned units (happiness reached 0)
        if ((city.happiness[i] ?? 100) === 0) continue
        const count = spawnerUnitCount(city, cell.cardName)
        for (let u = 0; u < count; u++) {
          const existing = prev.find(w => w.cellIndex === i && w.unitIndex === u && w.unitName === cell.spawnedUnitName)
          next.push(existing ?? makeWalker(i, u, cell.spawnedUnitName, cell.affinityWith))
        }
      }
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.grid, city.cardLevels])

  // ── Animation loop ────────────────────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      setWalkers(prev => prev.map(w => {
        let { x, y, vx, vy, turnTimer } = w
        x += vx
        y += vy
        if (x < 0)                     { x = 0;                    vx = Math.abs(vx) }
        if (x > OVERLAY_W - UNIT_SIZE) { x = OVERLAY_W - UNIT_SIZE; vx = -Math.abs(vx) }
        if (y < 0)                     { y = 0;                    vy = Math.abs(vy) }
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
  }, [])

  // Keep ref in sync so the tick interval can read current bulldozer state
  useEffect(() => { bulldozerRef.current = bulldozerMode }, [bulldozerMode])

  // ── Gold + resource tick (every 10 s while screen is open) ───────────────────

  useEffect(() => {
    const id = setInterval(() => {
      if (bulldozerRef.current) return  // paused while bulldozer is active
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
      if (bulldozerMode) {
        const cell = city.grid[index]!
        save(removeCard(city, index))
        showToast(`${cell.cardName} demolished.`)
      } else {
        setSelectedBuildingCell(index)
      }
    } else {
      setPickerIndex(index)
      setScreen('picker')
    }
  }

  function toggleBulldozer() {
    setBulldozerMode(prev => !prev)
    setSelectedBuildingCell(null)
    setSelectedWalkerCell(null)
  }

  // ── Place a card ──────────────────────────────────────────────────────────────

  const handlePickCard = useCallback((card: Card) => {
    const spawnEffect = card.unit?.structureEffect
    const isSpawner   = spawnEffect?.type === 'spawn'
    const spawnedUnitName = isSpawner
      ? (spawnEffect as { type: 'spawn'; unitTemplate: { name: string }; intervalMs: number }).unitTemplate.name
      : undefined

    if (isSpawner && !canAffordPlacement(city, card.rarity)) {
      showToast('Not enough resources!')
      return
    }

    const affinityWith = card.unit?.affinity?.withName

    const cell: CityCell = {
      cardName: card.name,
      rarity:   card.rarity,
      spawnedUnitName,
      affinityWith,
    }
    save(placeCard(city, pickerIndex, cell))
    setScreen('city')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerIndex, city])

  // ── Level up ──────────────────────────────────────────────────────────────────

  function handleLevelUp(cardName: string) {
    const col = loadCollection()
    const currentXp = getMasteryXp(col, cardName)
    const currentLvl = masteryLevel(currentXp)

    const next = levelUpCard(city, cardName, currentLvl)
    if (!next) { showToast('Not enough gold!'); return }
    save(next)

    // Grant enough mastery XP to advance the card by exactly one mastery level.
    const xpToGrant = masteryXpForLevel(currentLvl + 1) - currentXp
    const updatedCol = col.map(e =>
      e.cardName === cardName
        ? { ...e, masteryXp: (e.masteryXp ?? 0) + xpToGrant }
        : e
    )
    // If the card has no collection entry yet, add one.
    if (!updatedCol.find(e => e.cardName === cardName)) {
      updatedCol.push({ cardName, count: 0, masteryXp: xpToGrant })
    }
    saveCollection(updatedCol)

    showToast(`${cardName} levelled up! Mastery ★${currentLvl + 1}`)
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

  const levellable = catalog.filter(c =>
    c.cardType === 'structure' && getOwnedCount(collection, c.name) > 0
  )

  const incomeRate = Math.round(goldIncomeRate(city))
  const netRate    = Math.round(goldNetRate(city))
  const defense    = cityDefense(city)
  const population = cityPopulation(city)

  const prodRates = resourceProductionRate(city)
  const consRates = resourceConsumptionRate(city)

  // Unit names that are alive (happiness > 0) — despawned units don't count for affinity
  const presentUnitNames = new Set(
    city.grid
      .filter((c, i) => c?.spawnedUnitName && (city.happiness[i] ?? 100) > 0)
      .map(c => c!.spawnedUnitName!) as string[]
  )

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
              const isSpawner   = spawnEffect?.type === 'spawn'
              const spawnName   = isSpawner
                ? (spawnEffect as { type: 'spawn'; unitTemplate: { name: string }; intervalMs: number }).unitTemplate.name
                : null
              const affordable  = !isSpawner || canAffordPlacement(city, card.rarity)
              const cost        = isSpawner ? SPAWNER_PLACE_COST[card.rarity] : null
              const produces    = !isSpawner ? getBuildingProduces(card.name) : null
              const masteryMult = !isSpawner ? masteryOutputMultiplier(city.cardLevels[card.name] ?? 0) : 1
              const producesEntries = produces ? Object.entries(produces).filter(([, v]) => (v ?? 0) > 0) : []
              const isWall      = !isSpawner && producesEntries.length === 0
              const incomeRate  = isSpawner
                ? INCOME_SPAWN[card.rarity]
                : isWall ? INCOME_WALL[card.rarity] : INCOME_UTILITY[card.rarity]

              return (
                <button
                  key={card.name}
                  className={`city-picker-card${!affordable ? ' city-picker-card--unaffordable' : ''}`}
                  onClick={() => handlePickCard(card)}
                  disabled={!affordable}
                >
                  <SpriteImg name={card.name} className="city-picker-sprite" />
                  <div className="city-picker-name">{card.name}</div>
                  <div className={`city-picker-rarity city-picker-rarity--${card.rarity}`}>{card.rarity}</div>
                  {spawnName && (
                    <div className="city-picker-spawns">
                      spawns <SpriteImg name={spawnName} className="city-picker-spawn-icon" />
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
                  {incomeRate > 0 && (
                    <div className="city-picker-income">+{incomeRate} 💰/min</div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Upgrade sub-screen (card level-up grid) ───────────────────────────────────

  if (screen === 'upgrade') {
    return (
      <div className="city-screen">
        <div className="city-picker-header">
          <button className="action-btn" onClick={() => setScreen('city')}>← BACK</button>
          <div className="city-picker-title">UPGRADE BUILDINGS</div>
        </div>
        <div className="city-gold-display" style={{ textAlign: 'center', padding: '4px' }}>
          ⚙ {city.gold.toLocaleString()} gold
        </div>
        <div className="city-hint" style={{ textAlign: 'center', marginBottom: 6 }}>
          Spend gold to permanently boost structures in battle.
        </div>
        <div className="city-level-grid">
          {levellable.map(card => {
            const xp        = getMasteryXp(loadCollection(), card.name)
            const mLvl      = masteryLevel(xp)
            const cost      = levelUpCost(mLvl)
            const canAfford = city.gold >= cost
            return (
              <button
                key={card.name}
                className={`city-level-card${mLvl > 0 ? ' city-level-card--levelled' : ''}`}
                onClick={() => { setLevelCard(card.name); setScreen('levelup') }}
              >
                <SpriteImg name={card.name} className="city-level-card-sprite" />
                <div className="city-level-card-name">{card.name}</div>
                <div className="city-level-card-stars">★{mLvl} mastery</div>
                <div className={`city-level-card-cost${canAfford ? ' city-level-card-cost--ready' : ''}`}>
                  ⚙ {cost.toLocaleString()}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Level-up detail sub-screen ────────────────────────────────────────────────

  if (screen === 'levelup' && levelCard !== null) {
    const card     = catalog.find(c => c.name === levelCard)
    const xp       = getMasteryXp(loadCollection(), levelCard)
    const { level: mLvl } = masteryProgress(xp)
    const cost     = levelUpCost(mLvl)
    return (
      <div className="city-screen">
        <div className="city-picker-header">
          <button className="action-btn" onClick={() => setScreen('upgrade')}>← BACK</button>
          <div className="city-picker-title">LEVEL UP CARD</div>
        </div>
        <div className="city-level-detail">
          {card && <SpriteImg name={card.name} className="city-level-sprite" />}
          <div className="city-level-name">{levelCard}</div>
          <div className="city-level-stats">
            <div style={{ marginBottom: 4 }}>Mastery</div>
            <MasteryBar xp={xp} />
          </div>
          <div className="city-level-cost">
            Next upgrade costs <span className="city-gold">⚙ {cost.toLocaleString()}</span>
            {' '}and grants mastery ★{mLvl + 1}
          </div>
          <div className="city-level-costs-table">
            {LEVEL_UP_COSTS.map((c, i) => (
              <div key={i} className={`city-cost-row${i < mLvl ? ' city-cost-row--done' : ''}`}>
                <span>★{i} → ★{i + 1}</span>
                <span>⚙ {c.toLocaleString()}</span>
              </div>
            ))}
            <div className={`city-cost-row${mLvl >= LEVEL_UP_COSTS.length ? ' city-cost-row--done' : ''}`}>
              <span>★{LEVEL_UP_COSTS.length}+</span>
              <span>⚙ {LEVEL_UP_COSTS[LEVEL_UP_COSTS.length - 1].toLocaleString()}</span>
            </div>
          </div>
          <button
            className={`action-btn${city.gold >= cost ? ' action-btn--gold' : ''}`}
            onClick={() => handleLevelUp(levelCard)}
            disabled={city.gold < cost}
          >
            {city.gold >= cost ? `LEVEL UP (⚙ ${cost.toLocaleString()})` : `NEED ⚙ ${cost.toLocaleString()}`}
          </button>
        </div>
      </div>
    )
  }

  // ── Main city view ────────────────────────────────────────────────────────────

  return (
    <div className="city-screen">
      {toast && <div className="city-toast" role="alert">{toast}</div>}

      {/* Unit requirements modal */}
      {selectedWalkerCell !== null && (() => {
        const cell = city.grid[selectedWalkerCell]
        if (!cell?.spawnedUnitName) return null
        const happiness = city.happiness[selectedWalkerCell] ?? 100
        const reqs = getUnitRequirements(cell, city, presentUnitNames)
        const moodKey = happiness === 0 ? 'gone' : happiness < 30 ? 'furious' : happiness < 60 ? 'unsettled' : 'content'
        return (
          <div className="city-req-overlay" onClick={() => setSelectedWalkerCell(null)}>
            <div className="city-req-modal" onClick={e => e.stopPropagation()}>
              <div className="city-req-header">
                <AnimatedSpriteImg name={cell.spawnedUnitName} frameCount={3} fps={6} className="city-req-sprite" />
                <div className="city-req-name">{cell.spawnedUnitName}</div>
              </div>
              <div className={`city-req-mood city-req-mood--${moodKey}`}>{rageDescription(happiness)}</div>
              <div className="city-req-list">
                {reqs.map((r, idx) => (
                  <div key={idx} className={`city-req-item${r.met ? ' city-req-item--met' : ' city-req-item--unmet'}`}>
                    <span className="city-req-icon">{r.met ? '✓' : '✗'}</span>
                    {r.text}
                  </div>
                ))}
              </div>
              <button className="action-btn" onClick={() => setSelectedWalkerCell(null)}>CLOSE</button>
            </div>
          </div>
        )
      })()}

      {/* Building resident panel */}
      {selectedBuildingCell !== null && (() => {
        const cell = city.grid[selectedBuildingCell]
        if (!cell) return null
        const happiness  = cell.spawnedUnitName ? (city.happiness[selectedBuildingCell] ?? 100) : 100
        const unitCount  = cell.spawnedUnitName ? spawnerUnitCount(city, cell.cardName) : 0
        const moodKey    = happiness === 0 ? 'gone' : happiness < 30 ? 'furious' : happiness < 60 ? 'unsettled' : 'content'
        const produces   = getBuildingProduces(cell.cardName)
        const masteryMult = masteryOutputMultiplier(city.cardLevels[cell.cardName] ?? 0)
        const produceEntries = Object.entries(produces).filter(([, v]) => (v ?? 0) > 0)
        return (
          <div className="city-req-overlay" onClick={() => setSelectedBuildingCell(null)}>
            <div className="city-req-modal" onClick={e => e.stopPropagation()}>
              <div className="city-req-header">
                <SpriteImg name={cell.cardName} className="city-req-sprite" />
                <div className="city-req-name">{cell.cardName}</div>
              </div>
              {cell.spawnedUnitName ? (
                <>
                  <div className="city-bld-section-title">Residents ({happiness === 0 ? 0 : unitCount})</div>
                  {happiness === 0 ? (
                    <div className="city-bld-vacant">Building is vacant — unit left the city</div>
                  ) : (
                    Array.from({ length: unitCount }, (_, u) => {
                      const reqs = getUnitRequirements(cell, city, presentUnitNames)
                      const unmet = reqs.filter(r => !r.met)
                      return (
                        <div key={u} className="city-bld-resident">
                          <AnimatedSpriteImg name={cell.spawnedUnitName!} frameCount={3} fps={6} className="city-bld-resident-sprite" />
                          <div className="city-bld-resident-info">
                            <div className="city-bld-resident-name">{residentName(cell.spawnedUnitName!, selectedBuildingCell, u)}</div>
                            <div className={`city-req-mood city-req-mood--${moodKey}`}>{rageDescription(happiness)}</div>
                            {unmet.map((r, i) => (
                              <div key={i} className="city-bld-resident-req">✗ {r.text}</div>
                            ))}
                          </div>
                        </div>
                      )
                    })
                  )}
                </>
              ) : produceEntries.length > 0 ? (
                <>
                  <div className="city-bld-section-title">Produces</div>
                  {produceEntries.map(([res, amt]) => (
                    <div key={res} className="city-bld-produces-row">
                      +{Math.round((amt as number) * masteryMult)} {RESOURCE_ICONS[res as ResourceType]}/min
                    </div>
                  ))}
                </>
              ) : (
                <div className="city-bld-section-title">Defensive structure</div>
              )}
              <button className="action-btn" onClick={() => setSelectedBuildingCell(null)}>CLOSE</button>
            </div>
          </div>
        )
      })()}

      {/* Header */}
      <div className="city-header">
        <button className="action-btn" onClick={onBack}>← BACK</button>
        <div className="city-title">🏙 CITY</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div className="city-gold-display">⚙ {city.gold.toLocaleString()}</div>
          <button
            className={`filter-btn${bulldozerMode ? ' city-bulldozer-btn--active' : ''}`}
            onClick={toggleBulldozer}
            title={bulldozerMode ? 'Bulldozer mode ON — tap buildings to demolish' : 'Bulldozer mode OFF — tap to toggle'}
          >🏗 BULLDOZE</button>
          <button className="filter-btn" onClick={() => setScreen('upgrade')}>★ UPGRADES</button>
        </div>
      </div>

      {/* Income summary */}
      <div className="city-income-row">
        <span className="city-income-in">+{incomeRate} gold</span>
        {bulldozerMode
          ? <span className="city-bulldozer-paused">⏸ PAUSED</span>
          : <span className={`city-income-net${netRate >= 0 ? ' city-income-net--pos' : ' city-income-net--neg'}`}>
              {netRate >= 0 ? `+${netRate}` : `${netRate}`}/min
            </span>
        }
      </div>

      {/* City stats */}
      <div className="city-stats-row">
        <div className="city-stat city-stat--defense" title="City Defence">
          🛡 {defense}
        </div>
        <div className="city-stat city-stat--population" title="Population — each unit earns gold for its spawner">
          👥 {population}
        </div>
        {(['wheat', 'wood', 'ore', 'bread', 'planks', 'metal'] as ResourceType[]).map(res => {
          const stock   = Math.floor(city.resources[res])
          const prod    = prodRates[res] ?? 0
          const cons    = consRates[res] ?? 0
          const net     = prod - cons
          if (stock === 0 && prod === 0) return null
          return (
            <div key={res} className="city-stat" title={`${res}: ${stock} stock, ${net >= 0 ? '+' : ''}${net}/min`}>
              {RESOURCE_ICONS[res]} {stock}
              {net !== 0 && (
                <span className={net > 0 ? 'city-res-pos' : 'city-res-neg'}>
                  {net > 0 ? `+${net}` : net}/m
                </span>
              )}
            </div>
          )
        })}
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
            const rage      = 100 - happiness
            const despawned = cell?.spawnedUnitName && happiness === 0
            return (
              <button
                key={i}
                className={`city-cell${cell ? ' city-cell--occupied' : ''}${cell && bulldozerMode ? ' city-cell--bulldoze' : ''}`}
                onClick={() => handleCellTap(i)}
                title={cell ? (bulldozerMode ? `${cell.cardName} — tap to demolish` : `${cell.cardName} — tap to inspect`) : 'Empty — tap to place'}
              >
                {cell ? (
                  <>
                    <SpriteImg name={cell.cardName} className="city-cell-sprite" />
                    <div className="city-cell-name">{cell.cardName}</div>
                    {masteryLevel(getMasteryXp(collection, cell.cardName)) > 0 && (
                      <div className="city-cell-level">★{masteryLevel(getMasteryXp(collection, cell.cardName))}</div>
                    )}
                    {cell.spawnedUnitName && rage > 0 && (
                      <div
                        className="city-cell-happiness"
                        style={{
                          width: `${rage}%`,
                          background: rage < 40 ? '#a0a020' : rage < 70 ? '#c05010' : '#a03020',
                        }}
                      />
                    )}
                    {despawned && <span className="city-cell-unhappy-icon">💀</span>}
                    {!despawned && rage >= 60 && <span className="city-cell-unhappy-icon">⚠</span>}
                  </>
                ) : (
                  <span className="city-cell-empty">+</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Walking units overlay */}
        <div className="city-unit-overlay">
          {walkers.map(w => {
            const happiness   = city.happiness[w.cellIndex] ?? 100
            const rage        = 100 - happiness
            const wantsFriend = w.affinityWith && !presentUnitNames.has(w.affinityWith)
            return (
              <div
                key={`${w.cellIndex}-${w.unitIndex}`}
                role="button"
                tabIndex={0}
                className={`city-walker${rage >= 60 ? ' city-walker--unhappy' : ''}`}
                style={{ left: Math.round(w.x), top: Math.round(w.y) }}
                onClick={e => { e.stopPropagation(); setSelectedWalkerCell(w.cellIndex) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setSelectedWalkerCell(w.cellIndex) } }}
              >
                {wantsFriend && (
                  <div className="city-speech-bubble" title={`Wants a ${w.affinityWith}!`}>
                    <SpriteImg name={w.affinityWith!} className="city-speech-icon" />
                  </div>
                )}
                <AnimatedSpriteImg
                  name={w.unitName}
                  frameCount={3}
                  fps={6}
                  className="city-walker-sprite"
                />
                {rage >= 40 && <span className="city-walker-need">!</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
