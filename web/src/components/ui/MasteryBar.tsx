import React from 'react'
import { masteryProgress } from '../../game/collection'
import { ProgressBar } from './ProgressBar'

interface Props {
  xp: number
}

export function MasteryBar({ xp }: Props) {
  const { level, current, needed } = masteryProgress(xp)
  const pct = needed > 0 ? Math.round((current / needed) * 100) : 100
  return (
    <div className="mastery-bar-wrap u-flex u-items-c">
      {/* No "★0" — callers show the gold ★N badge only from level 1, so
          labelling a level-0 bar contradicted it. Below level 1 the bar just
          shows raw progress toward the first level. */}
      {level > 0 && <span className="mastery-level">★{level}</span>}
      <ProgressBar
        pct={pct}
        color="linear-gradient(90deg, var(--color-gold-dim), var(--color-gold))"
        className="mastery-bar-track"
      />
      <span className="mastery-xp">{current}/{needed}</span>
    </div>
  )
}
