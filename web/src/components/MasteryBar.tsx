import React from 'react'
import { masteryProgress } from '../game/collection'

interface Props {
  xp: number
}

export function MasteryBar({ xp }: Props) {
  const { level, current, needed } = masteryProgress(xp)
  const pct = needed > 0 ? Math.round((current / needed) * 100) : 100
  return (
    <div className="mastery-bar-wrap">
      <span className="mastery-level">★{level}</span>
      <div className="mastery-bar-track">
        <div className="mastery-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="mastery-xp">{current}/{needed}</span>
    </div>
  )
}
