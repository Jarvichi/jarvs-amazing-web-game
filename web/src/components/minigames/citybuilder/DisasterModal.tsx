import React from 'react'
import {
  CityState, Disaster,
  fireExtinguishCost, plagueCureCost, getCellTrait, getRowDistrict, CITY_COLS,
} from '../../../game/cityBuilder'

interface Props {
  city:         CityState
  disaster:     Disaster
  onExtinguish: () => void
  onCure:       () => void
  onClose:      () => void
}

function fmtElapsed(ms: number): string {
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export function DisasterModal({ city, disaster, onExtinguish, onCure, onClose }: Props) {
  const { type, affectedCells, startedAt, severity } = disaster
  const elapsed = Date.now() - startedAt
  const cityCols = city.cols ?? CITY_COLS

  const isFire    = type === 'fire'
  const woodCost  = fireExtinguishCost(city)
  const breadCost = plagueCureCost(city)

  const canExtinguish = city.resources.wood  >= woodCost
  const canCure       = city.resources.bread >= breadCost

  // ── Fire context ─────────────────────────────────────────────────────────────
  const braveInFire    = affectedCells.filter(ci => {
    const cell = city.grid[ci]
    return cell?.spawnedUnitName && getCellTrait(cell, ci) === 'brave'
  }).length
  const braveDiscount    = affectedCells.length * 40 - woodCost
  const isIndustrialFire = affectedCells.some(
    ci => getRowDistrict(city, Math.floor(ci / cityCols)) === 'industrial',
  )

  // ── Plague context ────────────────────────────────────────────────────────────
  let militarySpawners = 0, totalSpawners = 0
  let gluttonCount = 0, sociableCount = 0
  for (let i = 0; i < city.grid.length; i++) {
    const cell = city.grid[i]
    if (cell?.spawnedUnitName) {
      totalSpawners++
      const trait = getCellTrait(cell, i)
      if (getRowDistrict(city, Math.floor(i / cityCols)) === 'military') militarySpawners++
      if (trait === 'glutton')  gluttonCount++
      if (trait === 'sociable') sociableCount++
    }
  }
  const milPct = totalSpawners > 0 ? Math.round(militarySpawners / totalSpawners * 50) : 0

  return (
    <div className="city-disaster-overlay" onClick={onClose}>
      <div className="city-disaster-modal" onClick={e => e.stopPropagation()}>

        <div className={`city-disaster-header city-disaster-header--${type}`}>
          <span className="city-disaster-icon">{isFire ? '🔥' : '☠'}</span>
          <span className="city-disaster-title">{isFire ? 'FIRE' : 'PLAGUE'}</span>
        </div>

        <div className="city-disaster-body">
          {isFire ? (
            <>
              <p className="city-disaster-desc">
                Fire is burning through your city! It has been raging for{' '}
                <strong>{fmtElapsed(elapsed)}</strong> and is spreading.
              </p>
              {affectedCells.length > 0 && (
                <div className="city-disaster-affected">
                  <span className="city-disaster-affected-label">Burning:</span>
                  {affectedCells.map(ci => (
                    <span key={ci} className="city-disaster-affected-cell">
                      {city.grid[ci]?.cardName ?? `Cell ${ci}`}
                    </span>
                  ))}
                </div>
              )}
              {isIndustrialFire && (
                <div className="city-disaster-context city-disaster-context--warning">
                  ⚠ Industrial zone — fire is spreading faster than normal!
                </div>
              )}
              {braveInFire > 0 && (
                <div className="city-disaster-context city-disaster-context--good">
                  ⚔ {braveInFire} brave resident{braveInFire > 1 ? 's are' : ' is'} fighting the flames
                  {braveDiscount > 0 && <span> (−{braveDiscount} wood)</span>}
                </div>
              )}
              <div className={`city-disaster-cost${canExtinguish ? '' : ' city-disaster-cost--unaffordable'}`}>
                🪵 Extinguish cost: <strong>{woodCost} wood</strong>
                {!canExtinguish && <span className="city-disaster-short"> (need {woodCost - Math.floor(city.resources.wood)} more)</span>}
              </div>
            </>
          ) : (
            <>
              <p className="city-disaster-desc">
                Plague is sweeping through the city! Residents are losing happiness.
                Severity: <strong>{Math.round(severity)}%</strong>
              </p>
              <div className="city-disaster-severity-bar">
                <div
                  className="city-disaster-severity-fill"
                  style={{ width: `${severity}%` }}
                />
              </div>
              {milPct > 0 && (
                <div className="city-disaster-context city-disaster-context--good">
                  🛡 Military districts slowing spread by {milPct}%
                </div>
              )}
              {gluttonCount > 0 && (
                <div className="city-disaster-context city-disaster-context--warning">
                  🍖 {gluttonCount} glutton resident{gluttonCount > 1 ? 's are' : ' is'} eating extra bread in a panic
                </div>
              )}
              {sociableCount > 0 && (
                <div className="city-disaster-context city-disaster-context--warning">
                  💬 {sociableCount} sociable resident{sociableCount > 1 ? 's are' : ' is'} spreading fear to neighbours
                </div>
              )}
              <div className={`city-disaster-cost${canCure ? '' : ' city-disaster-cost--unaffordable'}`}>
                🍞 Cure cost: <strong>{breadCost} bread</strong>
                {!canCure && <span className="city-disaster-short"> (need {breadCost - Math.floor(city.resources.bread)} more)</span>}
              </div>
            </>
          )}

          <div className="city-disaster-note">
            The {isFire ? 'fire' : 'plague'} will subside on its own eventually,
            but will cause lasting happiness damage while active.
          </div>
        </div>

        <div className="city-disaster-actions">
          {isFire ? (
            <button
              className={`action-btn city-disaster-cure-btn${canExtinguish ? '' : ' city-disaster-cure-btn--disabled'}`}
              onClick={canExtinguish ? onExtinguish : undefined}
              disabled={!canExtinguish}
            >
              🪵 Extinguish ({woodCost} wood)
            </button>
          ) : (
            <button
              className={`action-btn city-disaster-cure-btn${canCure ? '' : ' city-disaster-cure-btn--disabled'}`}
              onClick={canCure ? onCure : undefined}
              disabled={!canCure}
            >
              🍞 Cure Plague ({breadCost} bread)
            </button>
          )}
          <button className="filter-btn" onClick={onClose}>IGNORE FOR NOW</button>
        </div>
      </div>
    </div>
  )
}
