import React from 'react'
import { masteryProgress } from '../game/collection'
import { ProgressBar } from './ProgressBar'

interface Props {
  xp: number
}

export function MasteryBar({ xp }: Props) {
  const { level, current, needed } = masteryProgress(xp)
  const pct = needed > 0 ? Math.round((current / needed) * 100) : 100
  return (
    <div className="mastery-bar-wrap">
      <span className="mastery-level">★{level}</span>
      <ProgressBar pct={pct} color="linear-gradient(90deg, #b8860b, #ffd700)" className="mastery-bar-track" />
      <span className="mastery-xp">{current}/{needed}</span>
    </div>
  )
}
