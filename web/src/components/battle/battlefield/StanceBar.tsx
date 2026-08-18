import React from 'react'
import { Button } from '../../ui/Button'

type Stance = 'attack' | 'hold' | 'defend' | 'auto'

const STANCE_LABEL: Record<Stance, string> = {
  attack: 'CHARGE',
  hold:   'HOLD',
  defend: 'DEFEND',
  auto:   'ATTACK',
}

interface Props {
  stance: Stance
  allowedStances: Stance[] | null
  suddenDeath: boolean
  onCooldown: boolean
  cooldownSecsLeft: number
  durationSecsLeft: number
  speedMultiplier: 1 | 2 | 4 | 8
  onSetStance?: (s: Stance) => void
  onCycleSpeed?: () => void
}

/** Stance selector + speed-cycle control, unchanged behavior from the inline
 *  version — same allowed/cooldown/duration rules, now on ui/Button so it
 *  gets real :disabled/focus handling instead of a raw <button>. */
export function StanceBar({ stance, allowedStances, suddenDeath, onCooldown, cooldownSecsLeft, durationSecsLeft, speedMultiplier, onSetStance, onCycleSpeed }: Props) {
  return (
    <div className="stance-bar">
      {(['attack', 'hold', 'defend', 'auto'] as const).map(s => {
        const isAllowed = !allowedStances || allowedStances.includes(s)
        if (!isAllowed) return null
        const isActive = stance === s
        const isCoolingDown = onCooldown && s !== 'auto' && !isActive
        const showCountdown = isActive && s !== 'auto' && durationSecsLeft > 0
        const showCooldown = isCoolingDown && cooldownSecsLeft > 0
        return (
          <Button
            key={s}
            className={`filter-btn${isActive ? ' filter-btn--active' : ''}${isCoolingDown ? ' filter-btn--cooldown' : ''}`}
            onClick={() => onSetStance?.(s)}
            disabled={(suddenDeath && s !== 'attack') || isCoolingDown}
            title={isCoolingDown ? `Available in ${cooldownSecsLeft}s` : undefined}
          >
            {STANCE_LABEL[s]}
            {showCountdown && <span className="stance-timer"> {durationSecsLeft}s</span>}
            {showCooldown && <span className="stance-timer stance-timer--cd"> {cooldownSecsLeft}s</span>}
          </Button>
        )
      })}
      <Button className="filter-btn stance-bar__speed" onClick={onCycleSpeed}>
        x{speedMultiplier}
      </Button>
    </div>
  )
}
