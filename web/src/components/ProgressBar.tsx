import React from 'react'

interface Props {
  pct: number
  color?: string
  className?: string
}

export function ProgressBar({ pct, color, className }: Props) {
  const clampedPct = Math.max(0, Math.min(100, pct))
  return (
    <div className={['progress-bar-track', className].filter(Boolean).join(' ')}>
      <div
        className="progress-bar-fill"
        style={{ width: `${clampedPct}%`, ...(color ? { background: color } : {}) }}
      />
    </div>
  )
}
