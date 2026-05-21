import React, { useCallback } from 'react'
import { FarmState, FARM_COLS, FARM_ROWS } from '../../../game/farmingSim'
import { AnimatedSpriteImg } from '../../ui/SpriteImg'
import { Walker } from '../citybuilder/walkerTypes'
import { CityZoomControls } from '../citybuilder/CityZoomControls'
import { useZoomPan } from '../citybuilder/useZoomPan'
import { FarmPlotCell } from './FarmPlotCell'

export interface Props {
  farm:          FarmState
  walkers:       Walker[]
  bulldozer:     boolean
  worldRef:      React.RefObject<HTMLDivElement>
  onCellTap:     (index: number) => void
  onWalkerClick: (cellIndex: number, unitIndex: number) => void
}

const UNIT_SIZE = 20

export function FarmGrid({ farm, walkers, bulldozer, worldRef, onCellTap, onWalkerClick }: Props) {
  const cols = farm.cols ?? FARM_COLS
  const rows = farm.rows ?? FARM_ROWS
  const cells = cols * rows

  const { wrapperRef, displayScale, stepZoom, zoomTo, getCellFromPoint: getCellFromPointRaw } =
    useZoomPan(worldRef)

  const getCellFromPoint = useCallback(
    (cx: number, cy: number) => getCellFromPointRaw(cx, cy, cols, rows),
    [getCellFromPointRaw, cols, rows],
  )
  void getCellFromPoint // used by touch handler in useZoomPan

  return (
    <div
      className="farm-world"
      ref={worldRef}
      style={{ position: 'relative', overflow: 'hidden', touchAction: 'none' }}
    >
      <CityZoomControls
        scale={displayScale}
        onZoomIn={() => stepZoom(1)}
        onZoomOut={() => stepZoom(-1)}
        onZoomTo={zoomTo}
      />

      <div className="farm-zoom-wrapper" ref={wrapperRef}>
        {/* Farm grid — fills the wrapper, cells are proportional */}
        <div
          className="farm-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows:    `repeat(${rows}, 1fr)`,
            width: '100%',
            height: '100%',
            gap: 2,
          }}
        >
          {Array.from({ length: cells }).map((_, i) => (
            <FarmPlotCell
              key={i}
              plot={farm.plots[i]}
              index={i}
              farmState={farm}
              highlighted={false}
              bulldozer={bulldozer}
              onTap={onCellTap}
            />
          ))}
        </div>

        {/* Walker overlay inside zoom wrapper so walkers scale/pan with the grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          {walkers.map((w, i) => {
            if (w.hidden) return null
            return (
              <div
                key={`${w.cellIndex}-${w.unitIndex}`}
                style={{
                  position: 'absolute',
                  left: w.x,
                  top: w.y,
                  width: UNIT_SIZE,
                  height: UNIT_SIZE,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  zIndex: 10,
                }}
                onClick={() => onWalkerClick(w.cellIndex, w.unitIndex)}
                title={`Farmer ${i + 1}`}
              >
                <AnimatedSpriteImg
                  name="farmer"
                  frameCount={3}
                  fps={w.vx !== 0 || w.vy !== 0 ? 6 : 1}
                  style={{ width: UNIT_SIZE, height: UNIT_SIZE, imageRendering: 'pixelated' }}
                />
                {w.bubbleTimer > 0 && w.task.type !== 'idle' && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: UNIT_SIZE + 2,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'rgba(0,0,0,0.8)',
                      color: '#c0f0c0',
                      fontSize: 9,
                      padding: '1px 3px',
                      borderRadius: 2,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}
                  >
                    {w.task.label}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
