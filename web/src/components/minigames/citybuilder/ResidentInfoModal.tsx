import React from 'react'
import { CityState, CityCell } from '../../../game/cityBuilder'
import { AnimatedSpriteImg } from '../../ui/SpriteImg'
import { Walker, rageDescription, residentName, getUnitRequirements, PERSONALITY_INFO } from './walkerTypes'

export interface Props {
  cellIndex: number
  unitIndex: number
  cell:      CityCell
  city:      CityState
  walkers:   Walker[]
  onClose:   () => void
}

export function ResidentInfoModal({ cellIndex, unitIndex, cell, city, walkers, onClose }: Props) {
  const happiness = city.happiness[cellIndex] ?? 100
  const reqs      = getUnitRequirements(cell, city, cellIndex)
  const moodKey   = happiness === 0 ? 'gone' : happiness < 30 ? 'furious' : happiness < 60 ? 'unsettled' : 'content'
  const w         = walkers.find(w => w.cellIndex === cellIndex && w.unitIndex === unitIndex)

  return (
    <div className="city-req-overlay" onClick={onClose}>
      <div className="city-req-modal" onClick={e => e.stopPropagation()}>
        <div className="city-req-header u-flex u-items-c u-gap-4">
          <AnimatedSpriteImg name={cell.spawnedUnitName!} frameCount={3} fps={6} className="city-req-sprite" />
          <div className="city-req-name">{cell.spawnedUnitName}</div>
        </div>
        <div className={`city-req-mood city-req-mood--${moodKey}`}>{rageDescription(happiness)}</div>
        {w && (
          <div className="city-req-list">
            <div className="city-req-item city-req-item--met">
              <span className="city-req-icon">📍</span>
              {residentName(w.unitName, w.cellIndex, w.unitIndex)}:{' '}
              {w.hidden ? '🏠 Resting at home' : w.task.label}
              {w.trait && (
                <span className="city-req-trait" title={PERSONALITY_INFO[w.trait].desc}>
                  {' '}{PERSONALITY_INFO[w.trait].icon} {PERSONALITY_INFO[w.trait].label}
                </span>
              )}
            </div>
          </div>
        )}
        <div className="city-req-list">
          {reqs.map((r, idx) => (
            <div key={idx} className={`city-req-item${r.met ? ' city-req-item--met' : ' city-req-item--unmet'}`}>
              <span className="city-req-icon">{r.met ? '✓' : '✗'}</span>
              {r.text}
            </div>
          ))}
        </div>
        <button className="action-btn" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  )
}
