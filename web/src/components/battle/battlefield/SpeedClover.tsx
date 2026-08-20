import React, { useId, useRef, useState } from 'react'
import { useClickOutsideToClose } from '../../../hooks/useClickOutsideToClose'
import { CORNER_CLASS_4, CLOVER_VIEWBOX, ARC_RANGE_4, arcPath } from './cloverGeometry'

const SPEED_ORDER = [1, 2, 4, 8] as const
type Speed = typeof SPEED_ORDER[number]

interface Props {
  speedMultiplier: Speed
  onSetSpeed?: (m: Speed) => void
}

/**
 * Battle-speed control, shaped like the stance clover beside it. Collapsed, it's a
 * level meter rather than a selector — one quadrant filled at 1x, two at 2x, three at
 * 4x, all four at 8x — since speed is a single quantity growing, not four distinct
 * choices. Tapping it expands into the same kind of picker StanceBar uses: one real
 * button per speed value, tap to select and collapse.
 */
export function SpeedClover({ speedMultiplier, onSetSpeed }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const idPrefix = useId()

  const filledCount = SPEED_ORDER.indexOf(speedMultiplier) + 1

  useClickOutsideToClose(open, () => setOpen(false), wrapRef)

  return (
    <span className="stance-clover-wrap" ref={wrapRef}>
      {!open ? (
        <button
          type="button"
          className="stance-clover stance-clover--tiny"
          onClick={() => setOpen(true)}
          aria-label={`Speed: ${speedMultiplier}x — tap to change`}
        >
          <span className="stance-clover-grid" data-count={4}>
            {SPEED_ORDER.map((s, i) => (
              <span
                key={s}
                className={`stance-petal ${CORNER_CLASS_4[i]}${i < filledCount ? ' stance-petal--filled' : ''}`}
              />
            ))}
          </span>
        </button>
      ) : (
        <div className="stance-clover stance-clover--expanded" role="group" aria-label="Speed">
          <span className="stance-clover-grid" data-count={4}>
            {SPEED_ORDER.map((s, i) => (
              <button
                key={s}
                type="button"
                className={`stance-petal ${CORNER_CLASS_4[i]}${s === speedMultiplier ? ' stance-petal--active' : ''}`}
                onClick={() => { onSetSpeed?.(s); setOpen(false) }}
                // The visible label is the curved SVG text drawn on top (see below) —
                // plain button text can't follow the petal's own curve, so this stays
                // as the accessible name only.
                aria-label={`${s}x`}
              />
            ))}
          </span>
          {/* Decorative labels, curved along each petal's own rim — see arcPath in
              cloverGeometry.ts for why. pointer-events:none (in CSS) so taps still
              land on the real petal buttons beneath. */}
          <svg className="stance-clover-labels" viewBox={`0 0 ${CLOVER_VIEWBOX} ${CLOVER_VIEWBOX}`} aria-hidden="true">
            <defs>
              {SPEED_ORDER.map((s, i) => {
                const [from, to] = ARC_RANGE_4[i]
                return <path key={s} id={`speed-arc-${idPrefix}-${s}`} d={arcPath(from, to)} />
              })}
            </defs>
            {SPEED_ORDER.map(s => (
              <text key={s} className={`stance-petal-label${s === speedMultiplier ? ' stance-petal-label--active' : ''}`}>
                <textPath href={`#speed-arc-${idPrefix}-${s}`} startOffset="50%" textAnchor="middle">
                  {s}x
                </textPath>
              </text>
            ))}
          </svg>
        </div>
      )}
    </span>
  )
}
