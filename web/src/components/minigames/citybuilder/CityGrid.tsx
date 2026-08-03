import React, { useRef, useCallback, useMemo } from 'react'
import {
  CityState, CITY_COLS, CITY_ROWS,
  spawnerUnitCount, getNeighbourIndices,
  getRowDistrict, DISTRICT_INFO,
  RESOURCE_ICONS, ResourceType,
} from '../../../game/cityBuilder'
import { SpriteImg, AnimatedSpriteImg } from '../../ui/SpriteImg'
import { BuilderWalker, VisualCarrier } from '../CityBuilder'
import { Walker } from './walkerTypes'
import { CityZoomControls } from './CityZoomControls'
import { useZoomPan } from './useZoomPan'
import { CityTerrainCanvas } from './CityTerrainCanvas'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface Props {
  toolbar?:       React.ReactNode
  city:           CityState
  walkers:        Walker[]
  builderWalkers: BuilderWalker[]
  visualCarriers: VisualCarrier[]
  bulldozerMode:  boolean
  worldRef:       React.RefObject<HTMLDivElement>
  paintBrush:     boolean
  environment?:   string
  onCellTap:      (index: number) => void
  onPaint:        (index: number) => void
  onWalkerClick:  (cellIndex: number, unitIndex: number) => void
}

export function CityGrid({
  toolbar,
  city, walkers, builderWalkers, visualCarriers, bulldozerMode, worldRef,
  paintBrush, environment, onCellTap, onPaint, onWalkerClick,
}: Props) {
  const cityRows  = city.rows ?? CITY_ROWS
  const cityCols  = city.cols ?? CITY_COLS
  const cityCells = cityCols * cityRows

  // ── Zoom / pan (shared hook) ─────────────────────────────────────────────────
  const { wrapperRef, displayScale, stepZoom, zoomTo, getCellFromPoint: getCellFromPointRaw } =
    useZoomPan(worldRef, paintBrush, onPaint)

  const getCellFromPoint = useCallback(
    (cx: number, cy: number) => getCellFromPointRaw(cx, cy, cityCols, cityRows),
    [getCellFromPointRaw, cityCols, cityRows],
  )

  // Stable ref so the grid-cell useMemo doesn't invalidate every render
  const onCellTapRef = useRef(onCellTap)
  onCellTapRef.current = onCellTap

  const onWalkerClickRef = useRef(onWalkerClick)
  onWalkerClickRef.current = onWalkerClick

  // ── Cell paint helpers (pointer-down on individual cells) ────────────────────
  const startPaint = useCallback((index: number) => {
    onPaint(index)
  }, [onPaint])

  const visibleBubbleSet = new Set(
    walkers
      .filter(w => !w.hidden && w.bubbleTimer > 0 && w.task.type !== 'idle')
      .sort((a, b) => b.bubbleTimer - a.bubbleTimer)
      .slice(0, 3)
      .map(w => `${w.cellIndex}-${w.unitIndex}`)
  )

  // Precomputed per city tick (not per animation frame) — which walkers want a friend next door
  const wantsFriendSet = useMemo(() => {
    const set = new Set<string>()
    const gridRows = city.rows ?? CITY_ROWS
    const gridCols = city.cols ?? CITY_COLS
    for (const w of walkers) {
      if (w.hidden) continue
      const wantedNeighbour = w.affinityWith ?? w.unitName
      const hasFriend = getNeighbourIndices(w.cellIndex, gridRows, gridCols).some(ni => {
        const nc = city.grid[ni]
        return nc?.spawnedUnitName === wantedNeighbour && (city.happiness[ni] ?? 100) > 0
      })
      if (!hasFriend) set.add(`${w.cellIndex}-${w.unitIndex}`)
    }
    return set
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.grid, city.happiness, city.rows, city.cols])

  return (
    <>
      {toolbar}
      <div
        className={`city-world${paintBrush ? ' city-world--paint' : ''}`}
        ref={worldRef}
      >
      {/* Zoom controls — outside the zoom wrapper so they don't scale */}
      <CityZoomControls
        scale={displayScale}
        onZoomIn={() => stepZoom(1)}
        onZoomOut={() => stepZoom(-1)}
        onZoomTo={zoomTo}
      />

      <div className="city-zoom-wrapper" ref={wrapperRef}>
        {/* ── Terrain background + road wear ──────────────────────────────────
            World-scale tile canvas, rendered behind everything. Roads share
            this app rather than opening a WebGL context of their own. */}
        <CityTerrainCanvas
          environment={environment} id={environment}
          roadWear={city.roadWear} cols={cityCols} rows={cityRows}
        />

        {useMemo(() => (
        <div
          className="city-grid"
          style={{
            gridTemplateColumns: `repeat(${cityCols}, 1fr)`,
            gridTemplateRows:    `repeat(${cityRows}, 1fr)`,
          }}
        >
          {Array.from({ length: cityCells }, (_, i) => {
            const cell      = city.grid[i]
            const happiness = cell?.spawnedUnitName ? (city.happiness[i] ?? 100) : 100
            const rage      = 100 - happiness
            const despawned = cell?.spawnedUnitName && happiness === 0
            const row        = Math.floor(i / cityCols)
            const col        = i % cityCols
            const district   = getRowDistrict(city, row)
            const distColor  = DISTRICT_INFO[district]?.color ?? 'transparent'
            const isRowStart = col === 0
            const distShadow = district !== 'none' && isRowStart
              ? `inset 4px 0 0 ${distColor}`
              : undefined

            return (
              <button
                key={i}
                className={`city-cell u-col u-items-c u-just-c u-pointer u-relative${cell ? ' city-cell--occupied' : ''}${cell && bulldozerMode ? ' city-cell--bulldoze' : ''}${!cell && paintBrush ? ' city-cell--paintable' : ''}`}
                style={distShadow ? { boxShadow: distShadow } : undefined}
                onClick={paintBrush ? undefined : () => onCellTapRef.current(i)}
                onPointerDown={paintBrush && !cell ? () => startPaint(i) : undefined}
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
                    {paintBrush ? (
                      <span className="city-cell-paint-dot" />
                    ) : (
                      <>
                        <span className="city-cell-forsale-sign">FOR<br/>SALE</span>
                        <span className="city-cell-forsale-post" />
                      </>
                    )}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        // eslint-disable-next-line react-hooks/exhaustive-deps
        ), [city, cityCols, cityRows, cityCells, bulldozerMode, paintBrush, startPaint])}

        {/* Walking units overlay */}
        <div className="city-unit-overlay">
          {walkers.map(w => {
            if (w.hidden) return null
            const happiness      = city.happiness[w.cellIndex] ?? 100
            const rage           = 100 - happiness
            const wKey           = `${w.cellIndex}-${w.unitIndex}`
            const wantsFriend    = wantsFriendSet.has(wKey)
            const showTaskBubble = visibleBubbleSet.has(wKey)
            return (
              <div
                key={`${w.cellIndex}-${w.unitIndex}`}
                role="button"
                tabIndex={0}
                className={`city-walker${rage >= 60 ? ' city-walker--unhappy' : ''}`}
                style={{ left: Math.round(w.x), top: Math.round(w.y) }}
                onClick={e => { e.stopPropagation(); onWalkerClickRef.current(w.cellIndex, w.unitIndex) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onWalkerClickRef.current(w.cellIndex, w.unitIndex) } }}
              >
                {w.task.type === 'chatting' && (
                  <div className="city-chat-bubble">{w.task.label}</div>
                )}
                {showTaskBubble && w.task.type !== 'chatting' && (
                  <div className="city-task-bubble">{w.task.label}</div>
                )}
                {!showTaskBubble && wantsFriend && (
                  <div className="city-speech-bubble" title={`Wants a ${w.affinityWith ?? w.unitName} next door!`}>
                    <SpriteImg name={w.affinityWith ?? w.unitName} className="city-speech-icon" />
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
      </div>{/* end zoom wrapper */}
    </div>
    </>
  )
}
