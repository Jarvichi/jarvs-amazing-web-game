import React from 'react'
import {
  CityState, CITY_COLS, CITY_ROWS,
  spawnerUnitCount, getNeighbourIndices,
  getRowDistrict, DISTRICT_INFO,
  roadTier,
  RESOURCE_ICONS, ResourceType,
} from '../../../game/cityBuilder'
import { SpriteImg, AnimatedSpriteImg } from '../../ui/SpriteImg'
import { BuilderWalker, VisualCarrier } from '../CityBuilder'
import { Walker } from './walkerTypes'

export interface Props {
  city:           CityState
  walkers:        Walker[]
  builderWalkers: BuilderWalker[]
  visualCarriers: VisualCarrier[]
  bulldozerMode:  boolean
  worldRef:       React.RefObject<HTMLDivElement>
  onCellTap:      (index: number) => void
  onWalkerClick:  (cellIndex: number, unitIndex: number) => void
}

export function CityGrid({
  city, walkers, builderWalkers, visualCarriers, bulldozerMode, worldRef, onCellTap, onWalkerClick,
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
          const isLastCol   = col === CITY_COLS - 1
          const isLastRow   = row === cityRows - 1
          const tierR = isLastCol ? 0 : roadTier((city.roadWear?.h ?? [])[i] ?? 0)
          const tierB = isLastRow ? 0 : roadTier((city.roadWear?.v ?? [])[i] ?? 0)
          const ROAD1 = 'rgba(120,80,20,0.75)'
          const ROAD2 = 'rgba(160,150,110,0.85)'
          const shadows: string[] = []
          if (district !== 'none' && isRowStart) shadows.push(`inset 4px 0 0 ${distColor}`)
          if (tierR > 0) shadows.push(`inset -3px 0 0 ${tierR === 2 ? ROAD2 : ROAD1}`)
          if (tierB > 0) shadows.push(`inset 0 -3px 0 ${tierB === 2 ? ROAD2 : ROAD1}`)
          return (
            <button
              key={i}
              className={`city-cell u-col u-items-c u-just-c u-pointer u-relative${cell ? ' city-cell--occupied' : ''}${cell && bulldozerMode ? ' city-cell--bulldoze' : ''}`}
              style={shadows.length > 0 ? { boxShadow: shadows.join(', ') } : undefined}
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

      {/* Carrier overlay — animated at walker speed via visualCarriers */}
      <div className="city-unit-overlay city-carrier-overlay">
        {visualCarriers.map(vc => {
          const res = Object.keys(vc.carrying)[0] as ResourceType
          return (
            <div key={vc.id} className="city-walker city-carrier-goblin" style={{ left: Math.round(vc.x), top: Math.round(vc.y) }}>
              <div className="city-carrier-load">{RESOURCE_ICONS[res]}</div>
              <AnimatedSpriteImg name="Goblin" frameCount={3} fps={8} className="city-walker-sprite" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
