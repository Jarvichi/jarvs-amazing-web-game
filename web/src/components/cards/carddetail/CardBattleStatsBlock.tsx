import React from 'react'
import { StatRow } from '../../ui/StatRow'

interface Props {
  timesPlayed: number
  unitsLost?: number
}

export function CardBattleStatsBlock({ timesPlayed, unitsLost }: Props) {
  return (
    <div className="cdm-battle-stats u-col u-gap-1">
      <StatRow compact label="Times played" value={timesPlayed} />
      {unitsLost != null && <StatRow compact label="Units lost" value={unitsLost} />}
    </div>
  )
}
