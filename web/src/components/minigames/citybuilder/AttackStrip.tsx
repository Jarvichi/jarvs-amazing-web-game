import React from 'react'
import { formatCountdown } from '../CityBuilder'

export type AttackUrgency = 'imminent' | 'soon' | 'calm'

export interface AttackStrengthLabel {
  text: string
  cls:  string
}

export interface Props {
  msToAttack:          number
occupiedCount: number
defense:      number
}

export function AttackStrip({ msToAttack,occupiedCount, defense }: Props) {

  const attackCountdown = formatCountdown(msToAttack)
  const attackUrgency = msToAttack < 3_600_000 ? 'imminent' : msToAttack < 10_800_000 ? 'soon' : 'calm'

    const attackPowerMid = 20 + occupiedCount * 3 + 12  // midpoint of rand(25)
  const attackRatio = defense / Math.max(attackPowerMid, 1)
  const attackStrengthLabel =
    attackRatio >= 1.5 ? { text: 'Weak', cls: 'strength--weak' } :
      attackRatio >= 1.0 ? { text: 'Moderate', cls: 'strength--mod' } :
        attackRatio >= 0.6 ? { text: 'Strong', cls: 'strength--strong' } :
          { text: 'Overwhelming', cls: 'strength--overwhelm' }

  return (
    <div className="city-attack-strip">
      <div className={`city-attack-pill city-attack-pill--${attackUrgency}`}>
        ⚔ ATTACK INCOMING {msToAttack <= 0 ? 'NOW!' : attackCountdown}
        <span className={`city-attack-strength ${attackStrengthLabel.cls}`}>{attackStrengthLabel.text}</span>
      </div>
    </div>
  )
}
