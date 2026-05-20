import React, { useRef, useEffect, useCallback, useState } from 'react'
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
// the CSS grid gap, appearing IN the gap rather than deep inside the gap.
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

  const HALF = (ROAD_W / 2)/2
  const hy = 100 - HALF
  const vx = 100 - HALF

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      overflow="visible"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
    >
      {hasH && <rect x={-ROAD_EXT} y={hy} width={100 + ROAD_EXT * 2} height={ROAD_W} fill={pathFill(wearH)} />}
      {hasV && <rect x={vx} y={-ROAD_EXT} width={ROAD_W} height={100 + ROAD_EXT * 2} fill={pathFill(wearV)} />}
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
  paintBrush:     boolean
  onCellTap:      (index: number) => void
  onPaint:        (index: number) => void
  onWalkerClick:  (cellIndex: number, unitIndex: number) => void
}

export function CityGrid({
  city, walkers, builderWalkers, visualCarriers, bulldozerMode, worldRef,
  paintBrush, onCellTap, onPaint, onWalkerClick,
}: Props) {
  const cityRows  = city.rows ?? CITY_ROWS
  const cityCols  = city.cols ?? CITY_COLS
  const cityCells = cityCols * cityRows

  // ── Zoom / pan state ─────────────────────────────────────────────────────────
  const wrapperRef  = useRef<HTMLDivElement>(null)
  // t = { s: scale, x: panX in screen px, y: panY in screen px }
  const tRef        = useRef({ s: 1, x: 0, y: 0 })
  const [displayScale, setDisplayScale] = useState(1)

  // Paint gesture state
  const isPaintingRef   = useRef(false)
  const lastPaintedRef  = useRef(-1)

  // Pan gesture state
  const isPanningRef    = useRef(false)
  const panStartRef     = useRef({ px: 0, py: 0, tx: 0, ty: 0 })

  // Pinch gesture state
  const pinchStartRef   = useRef({ dist: 0, s: 1, cx: 0, cy: 0, tx: 0, ty: 0 })
  const isPinchingRef   = useRef(false)

  function applyTransform(s = tRef.current.s, x = tRef.current.x, y = tRef.current.y) {
    if (!wrapperRef.current) return
    wrapperRef.current.style.transform = `matrix(${s},0,0,${s},${x},${y})`
  }

  function clamp(s: number, x: number, y: number) {
    const el = worldRef.current
    const cw = el?.clientWidth  ?? 300
    const ch = el?.clientHeight ?? 300
    s = Math.max(1, Math.min(4, s))
    x = s <= 1 ? 0 : Math.max(-(s - 1) * cw, Math.min(0, x))
    y = s <= 1 ? 0 : Math.max(-(s - 1) * ch, Math.min(0, y))
    return { s, x, y }
  }

  function setTransform(s: number, x: number, y: number, updateDisplay = false) {
    const t = clamp(s, x, y)
    tRef.current = t
    applyTransform(t.s, t.x, t.y)
    if (updateDisplay) setDisplayScale(t.s)
  }

  const ZOOM_STEPS = [1, 1.5, 2, 3, 4]

  function zoomTo(targetScale: number) {
    const el = worldRef.current
    const cw = el?.clientWidth  ?? 300
    const ch = el?.clientHeight ?? 300
    const { s, x, y } = tRef.current
    const cx = cw / 2
    const cy = ch / 2
    const factor = targetScale / s
    setTransform(targetScale, cx - (cx - x) * factor, cy - (cy - y) * factor, true)
  }

  function stepZoom(dir: 1 | -1) {
    const cur = tRef.current.s
    const next = dir > 0
      ? ZOOM_STEPS.find(z => z > cur + 0.01) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]
      : [...ZOOM_STEPS].reverse().find(z => z < cur - 0.01) ?? ZOOM_STEPS[0]
    zoomTo(next)
  }

  // Map a client-space point to a cell index, accounting for current zoom/pan
  const getCellFromPoint = useCallback((cx: number, cy: number): number => {
    const el = worldRef.current
    if (!el) return -1
    const rect = el.getBoundingClientRect()
    const { s, x, y } = tRef.current
    const lx = (cx - rect.left - x) / s
    const ly = (cy - rect.top  - y) / s
    const col = Math.floor((lx / rect.width)  * cityCols)
    const row = Math.floor((ly / rect.height) * cityRows)
    if (col < 0 || col >= cityCols || row < 0 || row >= cityRows) return -1
    return row * cityCols + col
  }, [cityCols, cityRows, worldRef])

  // ── Wheel zoom ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = worldRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { s, x, y } = tRef.current
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const delta = e.deltaY > 0 ? 0.85 : 1 / 0.85
      const sNew = Math.max(1, Math.min(4, s * delta))
      const factor = sNew / s
      setTransform(sNew, cx - (cx - x) * factor, cy - (cy - y) * factor, true)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldRef])

  // ── Touch: pinch zoom + pan + paint ─────────────────────────────────────────
  useEffect(() => {
    const el = worldRef.current
    if (!el) return

    function touchDist(t: TouchList) {
      const dx = t[1].clientX - t[0].clientX
      const dy = t[1].clientY - t[0].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        // Single touch: start paint or pan
        const { s } = tRef.current
        if (paintBrush) {
          // Paint start
          isPaintingRef.current = true
          lastPaintedRef.current = -1
          const idx = getCellFromPoint(e.touches[0].clientX, e.touches[0].clientY)
          if (idx >= 0) { lastPaintedRef.current = idx; onPaint(idx) }
          e.preventDefault()
        } else if (s > 1) {
          // Pan start
          isPanningRef.current = true
          panStartRef.current = { px: e.touches[0].clientX, py: e.touches[0].clientY, tx: tRef.current.x, ty: tRef.current.y }
          e.preventDefault()
        }
      } else if (e.touches.length === 2) {
        // Pinch start
        isPaintingRef.current = false
        isPanningRef.current  = false
        isPinchingRef.current = true
        const dist = touchDist(e.touches)
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
        pinchStartRef.current = { dist, s: tRef.current.s, cx, cy, tx: tRef.current.x, ty: tRef.current.y }
        e.preventDefault()
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1) {
        if (isPaintingRef.current && paintBrush) {
          const idx = getCellFromPoint(e.touches[0].clientX, e.touches[0].clientY)
          if (idx >= 0 && idx !== lastPaintedRef.current) {
            lastPaintedRef.current = idx
            onPaint(idx)
          }
        } else if (isPanningRef.current) {
          const { px, py, tx, ty } = panStartRef.current
          setTransform(tRef.current.s, tx + e.touches[0].clientX - px, ty + e.touches[0].clientY - py)
        }
      } else if (e.touches.length === 2 && isPinchingRef.current) {
        const dist = touchDist(e.touches)
        const { dist: d0, s: s0, cx: cx0, cy: cy0, tx: tx0, ty: ty0 } = pinchStartRef.current
        const sNew = s0 * (dist / d0)
        // Pan delta from two-finger centroid
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const rect = el.getBoundingClientRect()
        const pivot_x = cx0 - rect.left
        const pivot_y = cy0 - rect.top
        const factor = sNew / s0
        const xNew = pivot_x - (pivot_x - tx0) * factor + (cx - cx0)
        const yNew = pivot_y - (pivot_y - ty0) * factor + (cy - cy0)
        setTransform(sNew, xNew, yNew)
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        isPaintingRef.current = false
        isPanningRef.current  = false
        if (isPinchingRef.current) setDisplayScale(tRef.current.s)
        isPinchingRef.current = false
      } else if (e.touches.length === 1) {
        if (isPinchingRef.current) setDisplayScale(tRef.current.s)
        isPinchingRef.current = false
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd,   { passive: false })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldRef, paintBrush, getCellFromPoint, onPaint])

  // ── Mouse pan (desktop, when zoomed) ────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (paintBrush || tRef.current.s <= 1) return
    if (e.button !== 0) return
    isPanningRef.current = true
    panStartRef.current  = { px: e.clientX, py: e.clientY, tx: tRef.current.x, ty: tRef.current.y }
  }, [paintBrush])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanningRef.current) return
    const { px, py, tx, ty } = panStartRef.current
    setTransform(tRef.current.s, tx + e.clientX - px, ty + e.clientY - py)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onMouseUp = useCallback(() => {
    isPanningRef.current = false
  }, [])

  // ── Cell paint helpers ───────────────────────────────────────────────────────
  const startPaint = useCallback((index: number) => {
    isPaintingRef.current  = true
    lastPaintedRef.current = index
    onPaint(index)
  }, [onPaint])

  const continuePaint = useCallback((index: number) => {
    if (!isPaintingRef.current || index < 0 || index === lastPaintedRef.current) return
    lastPaintedRef.current = index
    onPaint(index)
  }, [onPaint])

  // Mouse-based paint drag (desktop)
  const onMouseMovePaint = useCallback((e: React.MouseEvent) => {
    if (!isPaintingRef.current || !paintBrush) return
    continuePaint(getCellFromPoint(e.clientX, e.clientY))
  }, [paintBrush, continuePaint, getCellFromPoint])

  const visibleBubbleSet = new Set(
    walkers
      .filter(w => !w.hidden && w.bubbleTimer > 0 && w.task.type !== 'idle')
      .sort((a, b) => b.bubbleTimer - a.bubbleTimer)
      .slice(0, 3)
      .map(w => `${w.cellIndex}-${w.unitIndex}`)
  )

  return (
    <div
      className={`city-world${paintBrush ? ' city-world--paint' : ''}`}
      ref={worldRef}
      onMouseDown={onMouseDown}
      onMouseMove={e => { onMouseMove(e); onMouseMovePaint(e) }}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Zoom controls — outside the zoom wrapper so they don't scale */}
      <div className="city-zoom-controls" onPointerDown={e => e.stopPropagation()}>
        <button className="city-zoom-btn" onClick={() => stepZoom(-1)} title="Zoom out" disabled={displayScale <= 1}>−</button>
        <div className="city-zoom-bar">
          {ZOOM_STEPS.map((z, i) => (
            <button
              key={z}
              className={`city-zoom-tick${displayScale >= z - 0.01 ? ' city-zoom-tick--active' : ''}`}
              onClick={() => zoomTo(z)}
              title={`${z}×`}
            >
              {i === ZOOM_STEPS.length - 1 ? '|' : '·'}
            </button>
          ))}
        </div>
        <button className="city-zoom-btn" onClick={() => stepZoom(1)} title="Zoom in" disabled={displayScale >= 4}>+</button>
      </div>

      <div className="city-zoom-wrapper" ref={wrapperRef}>
        {/* ── Road wear overlay ───────────────────────────────────────────────
            Rendered BEHIND the main grid. */}
        <div
          className="city-road-layer"
          style={{
            gridTemplateColumns: `repeat(${cityCols}, 1fr)`,
            gridTemplateRows:    `repeat(${cityRows}, 1fr)`,
          }}
        >
          {Array.from({ length: cityCells }, (_, i) => {
            const row = Math.floor(i / cityCols)
            const col = i % cityCols
            const h = city.roadWear?.h ?? []
            const v = city.roadWear?.v ?? []
            const wearLeft   = col === 0            ? 0 : (h[i - 1]       ?? 0)
            const wearRight  = col === cityCols - 1 ? 0 : (h[i]            ?? 0)
            const wearTop    = row === 0            ? 0 : (v[i - cityCols] ?? 0)
            const wearBottom = row === cityRows - 1 ? 0 : (v[i]            ?? 0)
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
                onClick={paintBrush ? undefined : () => onCellTap(i)}
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

        {/* Walking units overlay */}
        <div className="city-unit-overlay">
          {walkers.map(w => {
            if (w.hidden) return null
            const happiness       = city.happiness[w.cellIndex] ?? 100
            const rage            = 100 - happiness
            const wantedNeighbour = w.affinityWith ?? w.unitName
            const gridRows        = city.rows ?? CITY_ROWS
            const wantsFriend     = !getNeighbourIndices(w.cellIndex, gridRows, city.cols ?? CITY_COLS).some(ni => {
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
  )
}
