import React from 'react'
import {
  CityState, CITY_COLS, CITY_ROWS,
  spawnerUnitCount, getNeighbourIndices,
  getRowDistrict, DISTRICT_INFO,
  RESOURCE_ICONS, ResourceType,
} from '../../../game/cityBuilder'
import { SpriteImg, AnimatedSpriteImg } from '../../ui/SpriteImg'
import { BuilderWalker, VisualCarrier } from '../CityBuilder'
import { Walker } from './walkerTypes'

// ── Road path SVG ─────────────────────────────────────────────────────────────
// Strips are centred on the cell boundary (bottom / right) so they straddle
// the CSS grid gap, appearing IN the gap rather than deep inside the cell.
// ROAD_EXT extends each strip beyond the cell boundary to bridge the gap.
//   Horizontal (h wear) → full-width strip centred on the bottom boundary (y=100)
//   Vertical   (v wear) → full-height strip centred on the right  boundary (x=100)
// overflow="visible" on the SVG lets the ±ROAD_EXT portions render in the gap.

const ROAD_W   = 20  // strip width as % of cell
const ROAD_EXT = 12  // extra SVG units beyond boundary to cover the CSS grid gap

function pathFill(wear: number, highlight = false): string {
  const t = Math.min(1, wear / 100)
  const r = Math.round(140 + (170 - 140) * t)
  const g = Math.round(100 + (155 - 100) * t)
  const b = Math.round(40  + (110 - 40)  * t)
  const a = highlight
    ? (0.55 + t * 0.35).toFixed(2)
    : (0.25 + t * 0.45).toFixed(2)
  return `rgba(${r},${g},${b},${a})`
}

interface RoadPathProps {
  left: number; right: number; top: number; bottom: number
}

function RoadPath({ left, right, top, bottom }: RoadPathProps) {
  const hasH = left > 0 || right > 0
  const hasV = top > 0 || bottom > 0
  if (!hasH && !hasV) return null

  const wearH = Math.max(left, right)
  const wearV = Math.max(top, bottom)

  const wearX = Math.max(wearH, wearV)
  const HALF  = ROAD_W / 2
  const hy    = 100 - HALF  // strip top, centred on bottom boundary y=100
  const vx    = 100 - HALF  // strip left, centred on right boundary x=100
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      overflow="visible"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
    >
      {/* Horizontal lane — full-width, centred on bottom boundary, extended to bridge column gap */}
      {hasH && <rect x={-ROAD_EXT} y={hy} width={100 + ROAD_EXT * 2} height={ROAD_W} fill={pathFill(wearH)} />}
      {/* Vertical lane — full-height, centred on right boundary, extended to bridge row gap */}
      {hasV && <rect x={vx} y={-ROAD_EXT} width={ROAD_W} height={100 + ROAD_EXT * 2} fill={pathFill(wearV)} />}
      {/* Intersection — brighter node at the corner where both lanes cross */}
      {hasH && hasV && <rect x={vx} y={hy} width={ROAD_W} height={ROAD_W} fill={pathFill(wearX, true)} />}
    </svg>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

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

      {/* ── Road wear overlay ─────────────────────────────────────────────────
          Rendered BEHIND the main grid. Cell buttons paint on top, hiding the
          in-cell portion of each strip. Only the portion that overflows into
          the CSS grid gap is visible — exactly what the user sees as "road". */}
      <div
        className="city-road-layer"
        style={{
          gridTemplateColumns: `repeat(${CITY_COLS}, 1fr)`,
          gridTemplateRows:    `repeat(${cityRows}, 1fr)`,
        }}
      >
        {Array.from({ length: cityCells }, (_, i) => {
          const row = Math.floor(i / CITY_COLS)
          const col = i % CITY_COLS
          const h = city.roadWear?.h ?? []
          const v = city.roadWear?.v ?? []
          const wearLeft   = col === 0             ? 0 : (h[i - 1]        ?? 0)
          const wearRight  = col === CITY_COLS - 1 ? 0 : (h[i]             ?? 0)
          const wearTop    = row === 0             ? 0 : (v[i - CITY_COLS] ?? 0)
          const wearBottom = row === cityRows - 1  ? 0 : (v[i]             ?? 0)
          return (
            <div key={i} className="city-road-cell">
              <RoadPath left={wearLeft} right={wearRight} top={wearTop} bottom={wearBottom} />
            </div>
          )
        })}
      </div>

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
          const row        = Math.floor(i / CITY_COLS)
          const col        = i % CITY_COLS
          const district   = getRowDistrict(city, row)
          const distColor  = DISTRICT_INFO[district]?.color ?? 'transparent'
          const isRowStart = col === 0
          const isLastCol  = col === CITY_COLS - 1
          const isLastRow  = row === cityRows - 1

          const distShadow = district !== 'none' && isRowStart
            ? `inset 4px 0 0 ${distColor}`
            : undefined

          return (
            <button
              key={i}
              className={`city-cell u-col u-items-c u-just-c u-pointer u-relative${cell ? ' city-cell--occupied' : ''}${cell && bulldozerMode ? ' city-cell--bulldoze' : ''}`}
              style={distShadow ? { boxShadow: distShadow } : undefined}
              onClick={() => onCellTap(i)}
              title={cell ? (bulldozerMode ? `${cell.cardName} — tap to demolish` : `${cell.cardName} — tap to inspect`) : 'Empty — tap to place'}
            >
              {cell ? (
                <>
                  {(() => {
                    const spriteName = cell.cardName === 'Windmill'
                      ? (cell.stock?.wheat ?? 0) >= 3 ? 'Windmill'
                        : (cell.stock?.wheat ?? 0) > 0 ? 'Windmill Slow'
                        : 'Windmill Stopped'
                      : cell.cardName
                    return <SpriteImg name={spriteName} className="city-cell-sprite" />
                  })()}
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
                  {Object.entries(cell.stock ?? {}).some(([, v]) => (v ?? 0) >= 1) && (
                    <div className="city-cell-stock">
                      {(Object.entries(cell.stock ?? {}) as [ResourceType, number][])
                        .filter(([, v]) => (v ?? 0) >= 1)
                        .slice(0, 2)
                        .map(([res, v]) => (
                          <span key={res} className="city-cell-stock-item">
                            {RESOURCE_ICONS[res]}{Math.floor(v)}
                          </span>
                        ))}
                    </div>
                  )}
                </>
              ) : (
                <span className="city-cell-empty u-col u-center">
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
            <div key={vc.id} className="city-walker city-carrier-goblin" style={{ left: Math.round(vc.x), top: Math.round(vc.y), transform: `translate(-50%,-50%) scale(${vc.scale})` }}>
              {vc.phase === 'returning' && <div className="city-carrier-load">{RESOURCE_ICONS[res]}</div>}
              <AnimatedSpriteImg name="Goblin" frameCount={3} fps={8} className="city-walker-sprite" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
