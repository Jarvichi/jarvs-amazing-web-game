import React from 'react'
import { Icon } from '../../ui/icons/Icon'

interface Props {
  hp: number
  maxHp: number
  lives?: number
  maxLives?: number
}

/** The run's HP/lives readout, shown in a NodeScreen's header right-slot. */
export function NodeStatsStrip({ hp, maxHp, lives, maxLives }: Props) {
  return (
    <div className="node-stats-strip">
      <span className="node-stat"><Icon name="heart" size={12} /> {hp}/{maxHp}</span>
      {lives != null && maxLives != null && (
        <span className="node-stat"><Icon name="shield" size={12} /> {lives}/{maxLives}</span>
      )}
    </div>
  )
}
