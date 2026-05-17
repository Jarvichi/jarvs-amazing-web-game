import React from 'react'
import { CityState, CityCell } from '../../../game/cityBuilder'
import { AnimatedSpriteImg } from '../../ui/SpriteImg'
import { Walker, rageDescription, residentName, getUnitRequirements } from './walkerTypes'

export interface Props {
  cellIndex: number
  cell:      CityCell
  city:      CityState
  walkers:   Walker[]
  onClose:   () => void
}

export function ResidentInfoModal({ cellIndex, cell, city, walkers, onClose }: Props) {
  const happiness  = city.happiness[cellIndex] ?? 100
  const reqs       = getUnitRequirements(cell, city, cellIndex)
  const moodKey    = happiness === 0 ? 'gone' : happiness < 30 ? 'furious' : happiness < 60 ? 'unsettled' : 'content'
  const cellWalkers = walkers.filter(w => w.cellIndex === cellIndex)

  return (
    <div className="city-req-overlay" onClick={onClose}>
      <div className="city-req-modal" onClick={e => e.stopPropagation()}>
        <div className="city-req-header u-flex u-items-c u-gap-4">
          <AnimatedSpriteImg name={cell.spawnedUnitName!} frameCount={3} fps={6} className="city-req-sprite" />
          <div className="city-req-name">{cell.spawnedUnitName}</div>
        </div>
        <div className={`city-req-mood city-req-mood--${moodKey}`}>{rageDescription(happiness)}</div>
        {cellWalkers.length > 0 && (
          <div className="city-req-list">
            {cellWalkers.map(w => (
              <div key={`${w.cellIndex}-${w.unitIndex}`} className="city-req-item city-req-item--met">
                <span className="city-req-icon">📍</span>
                {residentName(w.unitName, w.cellIndex, w.unitIndex).split(' ')[0]}:{' '}
                {w.hidden ? '🏠 Resting at home' : w.task.label}
              </div>
            ))}
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
