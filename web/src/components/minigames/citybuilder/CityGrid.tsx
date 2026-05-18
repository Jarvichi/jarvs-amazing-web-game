import React from 'react'
import {
  CityState, CITY_COLS, CITY_ROWS, CELL_PX,
  spawnerUnitCount, getNeighbourIndices,
  getRowDistrict, DISTRICT_INFO,
  roadTier, cellCenter,
  RESOURCE_ICONS, ResourceType,
} from '../../../game/cityBuilder'
import { SpriteImg, AnimatedSpriteImg } from '../../ui/SpriteImg'
import { BuilderWalker } from '../CityBuilder'
import { Walker } from './walkerTypes'

export interface Props {
  city:          CityState
  walkers:       Walker[]
  builderWalkers: BuilderWalker[]
  bulldozerMode: boolean
  worldRef:      React.RefObject<HTMLDivElement>
  onCellTap:     (index: number) => void
  onWalkerClick: (cellIndex: number, unitIndex: number) => void
}

export function CityGrid({
  city, walkers, builderWalkers, bulldozerMode, worldRef, onCellTap, onWalkerClick,
}: Props) {
  const cityRows  = city.rows ?? CITY_ROWS
  const cityCells = CITY_COLS * cityRows

  const visibleBubbleSet = new Set(
    walkers
      .filter(w => !w.hidden && w.bubbleTimer > 0 && w.task.type !== 'idle')
      .sort((a, b) => b.bubbleTimer - a.bubbleTimer)
      .slice(0, 3)
      .map(w => `${w.cellIndex}-${w.unitIndex}`)
  )

  return (
    <div className="city-world" ref={worldRef}>
      <div
        className="city-grid"
        style={{
          gridTemplateColumns: `repeat(${CITY_COLS}, 1fr)`,
          gridTemplateRows:    `repeat(${cityRows}, 1fr)`,
        }}
      >
        {Array.from({ length: cityCells }, (_, i) => {
          const cell      = city.grid[i]
          const happiness = cell?.spawnedUnitName ? (city.happiness[i] ?? 100) : 100
          const rage      = 100 - happiness
          const despawned = cell?.spawnedUnitName && happiness === 0
          const row         = Math.floor(i / CITY_COLS)
          const col         = i % CITY_COLS
          const district    = getRowDistrict(city, row)
          const distColor   = DISTRICT_INFO[district]?.color ?? 'transparent'
          const isRowStart  = col === 0
          const tier = roadTier((city.roadWear ?? [])[i] ?? 0)
          return (
            <button
              key={i}
              className={`city-cell u-col u-items-c u-just-c u-pointer u-relative${cell ? ' city-cell--occupied' : ''}${cell && bulldozerMode ? ' city-cell--bulldoze' : ''}${tier > 0 ? ` city-cell--road-${tier}` : ''}`}
              style={district !== 'none' && isRowStart ? { boxShadow: `inset 4px 0 0 ${distColor}` } : undefined}
              onClick={() => onCellTap(i)}
              title={cell ? (bulldozerMode ? `${cell.cardName} — tap to demolish` : `${cell.cardName} — tap to inspect`) : 'Empty — tap to place'}
            >
              {cell ? (
                <>
                  <SpriteImg name={cell.cardName} className="city-cell-sprite" />
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
                  {city.activeDisaster?.type === 'fire' && city.activeDisaster.affectedCells.includes(i) && (
                    <span className="city-cell-fire">🔥</span>
                  )}
                  {city.activeDisaster?.type === 'plague' && city.grid[i]?.spawnedUnitName && (
                    <span className="city-cell-plague">☠</span>
                  )}
                  {!city.activeDisaster && (city.resources.bread ?? 0) < 1 && cell.spawnedUnitName && (
                    <span className="city-cell-bread-warn" title="No bread — residents are hungry">🍞</span>
                  )}
                </>
              ) : (
                <span className="city-cell-empty u-col u-items-c u-just-end">
                  <span className="city-cell-forsale-sign">FOR<br/>SALE</span>
                  <span className="city-cell-forsale-post" />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Walking units overlay */}
      <div className="city-unit-overlay">
        {walkers.map(w => {
          if (w.hidden) return null
          const happiness       = city.happiness[w.cellIndex] ?? 100
          const rage            = 100 - happiness
          const wantedNeighbour = w.affinityWith ?? w.unitName
          const gridRows        = city.rows ?? CITY_ROWS
          const wantsFriend     = !getNeighbourIndices(w.cellIndex, gridRows).some(ni => {
            const nc = city.grid[ni]
            return nc?.spawnedUnitName === wantedNeighbour && (city.happiness[ni] ?? 100) > 0
          })
          const showTaskBubble = visibleBubbleSet.has(`${w.cellIndex}-${w.unitIndex}`)
          return (
            <div
              key={`${w.cellIndex}-${w.unitIndex}`}
              role="button"
              tabIndex={0}
              className={`city-walker${rage >= 60 ? ' city-walker--unhappy' : ''}`}
              style={{ left: Math.round(w.x), top: Math.round(w.y) }}
              onClick={e => { e.stopPropagation(); onWalkerClick(w.cellIndex, w.unitIndex) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onWalkerClick(w.cellIndex, w.unitIndex) } }}
            >
              {w.task.type === 'chatting' && (
                <div className="city-chat-bubble">{w.task.label}</div>
              )}
              {showTaskBubble && w.task.type !== 'chatting' && (
                <div className="city-task-bubble">{w.task.label}</div>
              )}
              {!showTaskBubble && wantsFriend && (
                <div className="city-speech-bubble" title={`Wants a ${wantedNeighbour} next door!`}>
                  <SpriteImg name={wantedNeighbour} className="city-speech-icon" />
                </div>
              )}
              <AnimatedSpriteImg name={w.unitName} frameCount={3} fps={6} className="city-walker-sprite" />
              {rage >= 40 && <span className="city-walker-need">!</span>}
            </div>
          )
        })}

        {/* Builder walkers — one per fort under construction */}
        {builderWalkers.map((b, idx) => (
          <div
            key={`builder-${idx}`}
            className="city-walker city-builder-walker"
            style={{ left: Math.round(b.x), top: Math.round(b.y) }}
            title={b.label}
          >
            <div className="city-builder-bubble">{b.label}</div>
            <AnimatedSpriteImg name="Builder" frameCount={3} fps={8} className="city-walker-sprite" />
          </div>
        ))}
      </div>

      {/* Carrier overlay */}
      <div className="city-unit-overlay city-carrier-overlay">
        {(city.carriers ?? []).map(carrier => {
          const rows = city.rows ?? CITY_ROWS
          const f    = cellCenter(carrier.fromCell, rows)
          const t    = cellCenter(carrier.toCell,   rows)
          // Scale positions to actual overlay dimensions
          const overlayW = CITY_COLS * CELL_PX
          const overlayH = rows * CELL_PX
          const scaleX = worldRef.current ? worldRef.current.clientWidth  / overlayW : 1
          const scaleY = worldRef.current ? worldRef.current.clientHeight / overlayH : 1
          const x = (f.x + (t.x - f.x) * carrier.progress) * scaleX
          const y = (f.y + (t.y - f.y) * carrier.progress) * scaleY
          const res = Object.keys(carrier.carrying)[0] as ResourceType
          return (
            <div key={carrier.id} className="city-carrier" style={{ left: Math.round(x), top: Math.round(y) }}>
              <span className="city-carrier-icon">{RESOURCE_ICONS[res]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
