import React, { useRef, useCallback, useMemo } from 'react'
import {
  CityState, CITY_COLS, CITY_ROWS,
  spawnerUnitCount, getNeighbourIndices,
  getRowDistrict, DISTRICT_INFO,
  RESOURCE_ICONS, ResourceType,
} from '../../../game/cityBuilder'
import { SpriteImg } from '../../ui/SpriteImg'
import { BuilderWalker, VisualCarrier } from '../CityBuilder'
import { Walker } from './walkerTypes'
import { CityZoomControls } from './CityZoomControls'
import { useZoomPan } from './useZoomPan'
import { CityTerrainCanvas } from './CityTerrainCanvas'
import { CityWalkerCanvas, CitySprite } from './CityWalkerCanvas'

/** Half-extent of a walker's tap target, matching the old 20×20 `.city-walker` box. */
const WALKER_HIT_RADIUS = 12

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
  const { wrapperRef, displayScale, stepZoom, zoomTo, getCellFromPoint: getCellFromPointRaw, getLocalPoint } =
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

  // ── Canvas sprites ───────────────────────────────────────────────────────────
  // Residents, builders and carriers flattened into the one list the canvas
  // draws. Bubbles stay in the DOM below — they carry text and nested sprites.
  const canvasSprites = useMemo<CitySprite[]>(() => {
    const out: CitySprite[] = []
    for (const w of walkers) {
      if (w.hidden) continue
      const rage = 100 - (city.happiness[w.cellIndex] ?? 100)
      out.push({
        key:  `w-${w.cellIndex}-${w.unitIndex}`,
        name: w.unitName,
        x: w.x, y: w.y, fps: 6,
        faded: rage >= 60,
      })
    }
    for (const [idx, b] of builderWalkers.entries()) {
      out.push({ key: `b-${idx}`, name: 'Builder', x: b.x, y: b.y, fps: 8 })
    }
    for (const vc of visualCarriers) {
      out.push({ key: `c-${vc.id}`, name: 'Goblin', x: vc.x, y: vc.y, fps: 8, scale: vc.scale })
    }
    return out
  }, [walkers, builderWalkers, visualCarriers, city.happiness])

  // The canvas is pointer-events:none so it never swallows taps meant for the
  // grid cells underneath. Walker taps are resolved here instead. It has to be
  // the click capture phase: capture runs before the cell button's own onClick,
  // so stopping propagation on a hit keeps the cell from also opening.
  const walkerHitRef = useRef(walkers)
  walkerHitRef.current = walkers
  const onWalkerHitTest = useCallback((e: React.MouseEvent) => {
    if (paintBrush) return
    const p = getLocalPoint(e.clientX, e.clientY)
    if (!p) return
    // Last drawn wins, matching what the player sees on top.
    for (let i = walkerHitRef.current.length - 1; i >= 0; i--) {
      const w = walkerHitRef.current[i]
      if (w.hidden) continue
      if (Math.abs(p.x - w.x) <= WALKER_HIT_RADIUS && Math.abs(p.y - w.y) <= WALKER_HIT_RADIUS) {
        e.stopPropagation()
        e.preventDefault()
        onWalkerClickRef.current(w.cellIndex, w.unitIndex)
        return
      }
    }
  }, [paintBrush, getLocalPoint])

  return (
    <>
      {toolbar}
      <div
        className={`city-world${paintBrush ? ' city-world--paint' : ''}`}
        ref={worldRef}
        onClickCapture={onWalkerHitTest}
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

        {/* Every moving sprite — residents, builders, carriers — on one canvas */}
        <CityWalkerCanvas sprites={canvasSprites} />

        {/* Text stays in the DOM — bubbles, the "!" need marker and the carried
            resource icon. Positioned from the same coords the canvas draws from. */}
        <div className="city-unit-overlay">
          {walkers.map(w => {
            if (w.hidden) return null
            const wKey           = `${w.cellIndex}-${w.unitIndex}`
            const wantsFriend    = wantsFriendSet.has(wKey)
            const showTaskBubble = visibleBubbleSet.has(wKey)
            const chatting       = w.task.type === 'chatting'
            const needs          = (100 - (city.happiness[w.cellIndex] ?? 100)) >= 40
            if (!chatting && !showTaskBubble && !wantsFriend && !needs) return null
            return (
              <div
                key={wKey}
                className="city-walker city-walker--bubble-only"
                style={{ left: Math.round(w.x), top: Math.round(w.y) }}
              >
                {chatting && (
                  <div className="city-chat-bubble">{w.task.label}</div>
                )}
                {showTaskBubble && !chatting && (
                  <div className="city-task-bubble">{w.task.label}</div>
                )}
                {!showTaskBubble && wantsFriend && (
                  <div className="city-speech-bubble" title={`Wants a ${w.affinityWith ?? w.unitName} next door!`}>
                    <SpriteImg name={w.affinityWith ?? w.unitName} className="city-speech-icon" />
                  </div>
                )}
                {needs && <span className="city-walker-need">!</span>}
              </div>
            )
          })}

          {/* Carriers show what they are hauling on the return leg */}
          {visualCarriers.map(vc => {
            if (vc.phase !== 'returning') return null
            const res = Object.keys(vc.carrying)[0] as ResourceType
            return (
              <div
                key={`carrier-${vc.id}`}
                className="city-walker city-walker--bubble-only"
                style={{ left: Math.round(vc.x), top: Math.round(vc.y) }}
              >
                <div className="city-carrier-load">{RESOURCE_ICONS[res]}</div>
              </div>
            )
          })}

          {/* Builder walkers — one per fort under construction */}
          {builderWalkers.map((b, idx) => (
            <div
              key={`builder-${idx}`}
              className="city-walker city-walker--bubble-only city-builder-walker"
              style={{ left: Math.round(b.x), top: Math.round(b.y) }}
              title={b.label}
            >
              <div className="city-builder-bubble">{b.label}</div>
            </div>
          ))}
        </div>
      </div>{/* end zoom wrapper */}
    </div>
    </>
  )
}
