import React from 'react'

interface Props {
  data:     number[]
  attacks?: boolean[]  // parallel array, true = attack occurred at that sample
  color:    string
  height?:  number     // chart height in px, default 54
  dimColor?: string    // fill/glow color override (defaults to color)
}

export function StatsSparkline({ data, attacks, color, height = 54, dimColor }: Props) {
  const n = data.length
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

  const min   = Math.min(...data)
  const max   = Math.max(...data)
  const range = Math.max(max - min, 1)

  const toX = (i: number) => (i / (n - 1)) * W
  const toY = (v: number) => PAD + (H - PAD * 2) * (1 - (v - min) / range)

  const pts      = data.map((v, i) => `${toX(i).toFixed(2)},${toY(v).toFixed(2)}`)
  const linePath = `M ${pts.join(' L ')}`
  const baseY    = (H - PAD).toFixed(2)
  const areaPath = `${linePath} L ${W},${baseY} L 0,${baseY} Z`

  // Subtle horizontal grid lines at 25 / 50 / 75 %
  const gridYs = [0.25, 0.5, 0.75].map(f => (PAD + (H - PAD * 2) * (1 - f)).toFixed(2))

  const hasAttacks = attacks?.some(Boolean)

  return (
    <div className="city-sparkline" style={{ position: 'relative' }}>
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
  )
}
