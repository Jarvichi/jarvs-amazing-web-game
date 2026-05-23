import React, { useState } from 'react'
import { ModalBackdrop } from '../../ui/ModalBackdrop'

interface Props {
  data:            number[]
  attacks?:        boolean[]  // parallel array, true = attack occurred at that sample
  color:           string
  height?:         number     // chart height in px, default 54
  dimColor?:       string     // fill/glow color override (defaults to color)
  /** Storage ceiling for this series. Scales Y to [0, capacity] and draws a cap line. */
  capacity?:       number
  formatCapacity?: (n: number) => string
  /** If provided, tapping the chart opens a fullscreen expanded view. */
  label?:          string
  formatValue?:    (n: number) => string
}

export function StatsSparkline({ data, attacks, color, height = 54, dimColor, capacity, formatCapacity, label, formatValue }: Props) {
  const [expanded, setExpanded] = useState(false)
  const n    = data.length
  const fill = dimColor ?? color

  if (n < 2) {
    return (
      <div className="city-sparkline city-sparkline--empty" style={{ height }}>
        <span className="city-sparkline-nodata">collecting data…</span>
      </div>
    )
  }

  // viewBox: x in [0,100], y in [0, height]. preserveAspectRatio="none" stretches
  // horizontally to fill container width without distorting y-scale.
  const W   = 100
  const H   = height
  const PAD = 3   // top/bottom padding in viewBox units

  const dataMin = Math.min(...data)
  const dataMax = Math.max(...data)

  // When a capacity is provided scale Y from 0 → max(dataMax, capacity)
  // so the cap line is meaningful and data is shown relative to the ceiling.
  const yMin = capacity !== undefined ? 0 : dataMin
  const yMax = capacity !== undefined ? Math.max(dataMax, capacity) : dataMax
  const range = Math.max(yMax - yMin, 1)

  const toX = (i: number) => (i / (n - 1)) * W
  const toY = (v: number) => PAD + (H - PAD * 2) * (1 - (v - yMin) / range)

  const pts      = data.map((v, i) => `${toX(i).toFixed(2)},${toY(v).toFixed(2)}`)
  const linePath = `M ${pts.join(' L ')}`
  const baseY    = (H - PAD).toFixed(2)
  const areaPath = `${linePath} L ${W},${baseY} L 0,${baseY} Z`

  // Subtle horizontal grid lines at 25 / 50 / 75 %
  const gridYs = [0.25, 0.5, 0.75].map(f => (PAD + (H - PAD * 2) * (1 - f)).toFixed(2))

  const hasAttacks = attacks?.some(Boolean)

  const capY     = capacity !== undefined ? toY(capacity) : null
  const capLabel = capacity !== undefined
    ? (formatCapacity ? formatCapacity(capacity) : String(Math.floor(capacity)))
    : null

  const fmt = formatValue ?? ((n: number) => String(Math.round(n)))

  function renderChart(h: number) {
    const H2   = h
    const toY2 = (v: number) => PAD + (H2 - PAD * 2) * (1 - (v - yMin) / range)
    const pts2 = data.map((v, i) => `${toX(i).toFixed(2)},${toY2(v).toFixed(2)}`)
    const lp2  = `M ${pts2.join(' L ')}`
    const base2 = (H2 - PAD).toFixed(2)
    const ap2  = `${lp2} L ${W},${base2} L 0,${base2} Z`
    const gy2  = [0.25, 0.5, 0.75].map(f => (PAD + (H2 - PAD * 2) * (1 - f)).toFixed(2))
    const cy2  = capacity !== undefined ? toY2(capacity) : null
    const gradId = `sg-exp-${color.replace('#', '')}`
    return (
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H2}`} preserveAspectRatio="none"
          width="100%" height={h} style={{ display: 'block' }} aria-hidden>
          {gy2.map((y, i) => (
            <line key={i} x1="0" y1={y} x2={W} y2={y}
              stroke="rgba(255,255,255,0.05)" strokeWidth="0.6" />
          ))}
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={fill} stopOpacity="0.25" />
              <stop offset="100%" stopColor={fill} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={ap2} fill={`url(#${gradId})`} stroke="none" />
          {cy2 !== null && (
            <line x1="0" y1={cy2.toFixed(2)} x2={W} y2={cy2.toFixed(2)}
              stroke="rgba(255,255,255,0.28)" strokeWidth="0.8"
              strokeDasharray="3,2" vectorEffect="non-scaling-stroke" />
          )}
          <path d={lp2} stroke={color} strokeWidth="1.5" fill="none"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {capLabel && (
          <span className="city-sparkline-cap-label" title={`Storage cap: ${capLabel}`}>
            cap {capLabel}
          </span>
        )}
      </div>
    )
  }

  const clickProps = label ? {
    onClick: () => setExpanded(true),
    style: { position: 'relative' as const, cursor: 'pointer' },
    title: 'Tap to expand',
  } : { style: { position: 'relative' as const } }

  return (
    <>
      <div className="city-sparkline" {...clickProps}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          width="100%"
          height={height}
          style={{ display: 'block' }}
          aria-hidden
        >
          {/* Grid lines */}
          {gridYs.map((y, i) => (
            <line key={i} x1="0" y1={y} x2={W} y2={y}
              stroke="rgba(255,255,255,0.05)" strokeWidth="0.6" />
          ))}

          {/* Area fill with gradient fade */}
          <defs>
            <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={fill} stopOpacity="0.25" />
              <stop offset="100%" stopColor={fill} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#sg-${color.replace('#', '')})`} stroke="none" />

          {/* Capacity line */}
          {capY !== null && (
            <line
              x1="0" y1={capY.toFixed(2)} x2={W} y2={capY.toFixed(2)}
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="0.8"
              strokeDasharray="3,2"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Line */}
          <path
            d={linePath}
            stroke={color}
            strokeWidth="1.5"
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Capacity label */}
        {capLabel && (
          <span className="city-sparkline-cap-label" title={`Storage cap: ${capLabel}`}>
            cap {capLabel}
          </span>
        )}

        {/* Attack markers — HTML positioned so they don't distort */}
        {hasAttacks && (
          <div className="city-sparkline-attack-row" aria-label="Attack events" style={{ height: 10 }}>
            {attacks!.map((a, i) => a ? (
              <span
                key={i}
                className="city-sparkline-attack-mark"
                title="Attack"
                style={{ left: `${toX(i)}%` }}
              />
            ) : null)}
          </div>
        )}
      </div>

      {expanded && label && (
        <ModalBackdrop onClose={() => setExpanded(false)}>
          <div className="city-sparkline-modal">
            <div className="city-sparkline-modal-header">
              <span>{label}</span>
              <button className="action-btn" onClick={() => setExpanded(false)}>✕ CLOSE</button>
            </div>
            {renderChart(220)}
            <div className="city-sparkline-modal-stats">
              <div className="city-sparkline-modal-stat">current <span>{fmt(data[data.length - 1])}</span></div>
              <div className="city-sparkline-modal-stat">min <span>{fmt(dataMin)}</span></div>
              <div className="city-sparkline-modal-stat">max <span>{fmt(dataMax)}</span></div>
              {capLabel && (
                <div className="city-sparkline-modal-stat">cap <span>{capLabel}</span></div>
              )}
              {hasAttacks && (
                <div className="city-sparkline-modal-stat">raids <span>{attacks!.filter(Boolean).length}</span></div>
              )}
            </div>
          </div>
        </ModalBackdrop>
      )}
    </>
  )
}
