import React, { useEffect, useState } from 'react'
import { MilestoneDef } from '../../../game/cityBuilder'

export interface Props {
  milestone: MilestoneDef
  onDone: () => void
}

export function MilestoneBanner({ milestone, onDone }: Props) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 3200)
    const doneTimer = setTimeout(onDone, 4000)
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer) }
  }, [onDone])

  return (
    <div className={`city-milestone-banner${fading ? ' city-milestone-banner--fading' : ''}`}>
      <div className="city-milestone-icon">{milestone.icon}</div>
      <div className="city-milestone-text">
        <div className="city-milestone-title">MILESTONE: {milestone.label.toUpperCase()}</div>
        <div className="city-milestone-reward">+{milestone.goldReward.toLocaleString()} gold
          {milestone.resourceReward && Object.entries(milestone.resourceReward).map(([r, v]) => ` · +${v} ${r}`).join('')}
        </div>
      </div>
    </div>
  )
}
