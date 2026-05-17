import React from 'react'

export type AttackUrgency = 'imminent' | 'soon' | 'calm'

export interface AttackStrengthLabel {
  text: string
  cls:  string
}

export interface Props {
  msToAttack:          number
  attackCountdown:     string
  attackUrgency:       AttackUrgency
  attackStrengthLabel: AttackStrengthLabel
}

export function AttackStrip({ msToAttack, attackCountdown, attackUrgency, attackStrengthLabel }: Props) {
  return (
    <div className="city-attack-strip">
      <div className={`city-attack-pill city-attack-pill--${attackUrgency}`}>
        ⚔ ATTACK INCOMING {msToAttack <= 0 ? 'NOW!' : attackCountdown}
        <span className={`city-attack-strength ${attackStrengthLabel.cls}`}>{attackStrengthLabel.text}</span>
      </div>
    </div>
  )
}
