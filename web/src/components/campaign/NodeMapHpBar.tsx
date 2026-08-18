import React from 'react'

const LOW_HP_PCT = 0.3

function hpColor(hp: number, max: number): string {
  const pct = hp / max
  if (pct > 0.6) return 'var(--color-green-bright)'
  if (pct > LOW_HP_PCT) return 'var(--accent-gold)'
  return 'var(--accent-ember)'
}

export function NodeMapHpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const color = hpColor(hp, maxHp)
  const low = maxHp > 0 && hp / maxHp <= LOW_HP_PCT && hp > 0
  return (
    <div className="nm-hp-area u-flex u-items-c u-gap-3">
      <span className="nm-hp-label">HP</span>
      <div className={`nm-hp-track${low ? ' nm-hp-track--low' : ''}`}>
        <div className="nm-hp-fill" style={{ width: `${Math.max(0, hp / maxHp) * 100}%`, background: color }} />
      </div>
      <span className="nm-hp-text" style={{ color }}>{hp}/{maxHp}</span>
    </div>
  )
}
