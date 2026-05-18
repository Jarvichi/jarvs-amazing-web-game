import React from 'react'
import { CityState, Disaster } from '../../../game/cityBuilder'

interface Props {
  city:       CityState
  disaster:   Disaster
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

  const isFire   = type === 'fire'
  const woodCost = affectedCells.length * 40
  const breadCost = Math.max(10, Math.ceil(severity / 100 * 60))

  const canExtinguish = city.resources.wood  >= woodCost
  const canCure       = city.resources.bread >= breadCost

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
