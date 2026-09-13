import React from 'react'
import { UnitTemplate } from '../../../game/types'
import { StatRow } from '../../ui/StatRow'

interface Props {
  unit: UnitTemplate
}

/** Preview of a spawner structure's interval at each mastery level. Mirrors
 *  applyMasteryBonus in game/collection.ts: the engine applies
 *  intervalMs * 0.95^level — keep this in step if that formula changes. */
export function CardSpawnRatePreview({ unit: u }: Props) {
  if (u.moveSpeed !== 0 || u.maxHp <= 0 || u.structureEffect?.type !== 'spawn') return null

  const base = u.structureEffect.intervalMs
  const rates = [base, ...[2, 3, 4].map(lvl => Math.round(base * Math.pow(0.95, lvl)))]

  return (
    <div className="cdm-stats-block u-flex u-wrap">
      <StatRow compact label="Spawn" value={`${(rates[0] / 1000).toFixed(1)}s`} />
      <div className="cdm-spawn-levels">
        {rates.slice(1).map((r, i) => (
          <span key={i} className="cdm-spawn-lvl">Lv{i + 2}: {(r / 1000).toFixed(1)}s</span>
        ))}
      </div>
    </div>
  )
}
