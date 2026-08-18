import React from 'react'
import { HpBar } from './HpBar'

interface Props {
  owner: 'player' | 'opponent'
  portraitSrc: string
  portraitAlt: string
  hp: number
  maxHp: number
  color: string
  rightSlot?: React.ReactNode
}

/** One base's HUD row — portrait, HP bar, and an owner-specific slot for
 *  whatever goes on the right (opponent: strategy label; player: mana). */
export function BaseBar({ owner, portraitSrc, portraitAlt, hp, maxHp, color, rightSlot }: Props) {
  return (
    <div className={`base-bar base-bar--${owner}`}>
      <img className={`base-bar-portrait base-bar-portrait--${owner}`} src={portraitSrc} alt={portraitAlt} />
      <HpBar current={hp} max={maxHp} color={color} />
      {rightSlot && (
        <span className="base-bar-info u-flex u-items-c u-gap-3">
          {rightSlot}
        </span>
      )}
    </div>
  )
}
