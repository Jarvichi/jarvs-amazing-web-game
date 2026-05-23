import React from 'react'

function hpColor(hp: number, max: number): string {
  const pct = hp / max
  if (pct > 0.6) return '#33ff33'
  if (pct > 0.3) return '#ffcc00'
  return '#ff4444'
}

export function NodeMapHpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const color = hpColor(hp, maxHp)
  return (
    <div className="nm-hp-area u-flex u-items-c u-gap-3">
      <span className="nm-hp-label">HP</span>
      <div className="nm-hp-track">
        <div className="nm-hp-fill" style={{ width: `${Math.max(0, hp / maxHp) * 100}%`, background: color }} />
      </div>
      <span className="nm-hp-text" style={{ color }}>{hp}/{maxHp}</span>
    </div>
  )
}
