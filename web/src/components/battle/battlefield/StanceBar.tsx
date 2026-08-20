import React, { useState } from 'react'
import { Button } from '../../ui/Button'
import { FilterPopup } from '../../ui/filters/FilterPopup'
import { FilterOption } from '../../ui/filters/FilterOption'

type Stance = 'attack' | 'hold' | 'defend' | 'auto'

const STANCE_LABEL: Record<Stance, string> = {
  attack: 'CHARGE',
  hold:   'HOLD',
  defend: 'DEFEND',
  auto:   'ATTACK',
}

const STANCE_ORDER = ['attack', 'hold', 'defend', 'auto'] as const

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

/**
 * Stance selector + speed cycle. Same allowed/cooldown/duration/sudden-death
 * rules as before, but as a single trigger plus a popup rather than a row of
 * up to five always-visible buttons.
 *
 * That row was a whole 39px band of the battlefield frame, and on a phone the
 * frame's height is what caps the play area's *width* too (the lane is
 * letterboxed to a fixed ratio). Collapsing it to one trigger is what pays for
 * the base HP bars to sit above and below the lane instead of on top of it,
 * where they were covering the spawn strip.
 *
 * A popup also fits the control better than a fixed row did: `allowedStances`
 * varies by node — boss battles permit only auto/defend — so the row's width
 * changed under the player anyway, and a cooling-down stance reads more clearly
 * as a disabled list row than as one greyed button among five.
 */
export function StanceBar({ stance, allowedStances, suddenDeath, onCooldown, cooldownSecsLeft, durationSecsLeft, speedMultiplier, onSetStance, onCycleSpeed }: Props) {
  const [open, setOpen] = useState(false)

  const allowed = STANCE_ORDER.filter(s => !allowedStances || allowedStances.includes(s))

  // The trigger carries whichever timer is currently meaningful, so the state
  // the row used to show inline is still visible without opening anything.
  const suffix =
    durationSecsLeft > 0 && stance !== 'auto' ? ` ${durationSecsLeft}s`
    : onCooldown && cooldownSecsLeft > 0     ? ` ${cooldownSecsLeft}s`
    : ''

  return (
    <span className="stance-control u-flex u-items-c u-gap-2">
      <FilterPopup
        label={STANCE_LABEL[stance]}
        activeSuffix={suffix}
        isActive={stance !== 'auto'}
        open={open}
        onToggle={() => setOpen(o => !o)}
        onClose={() => setOpen(false)}
      >
        <div className="filter-popup-section u-col">
          <span className="filter-group-label">STANCE</span>
          <div className="filter-popup-btns u-flex u-wrap u-gap-2">
            {allowed.map(s => {
              const isActive = stance === s
              const isCoolingDown = onCooldown && s !== 'auto' && !isActive
              const blockedBySuddenDeath = suddenDeath && s !== 'attack'
              return (
                <FilterOption
                  key={s}
                  active={isActive}
                  disabled={blockedBySuddenDeath || isCoolingDown}
                  title={isCoolingDown ? `Available in ${cooldownSecsLeft}s` : undefined}
                  onClick={() => { onSetStance?.(s); setOpen(false) }}
                >
                  {STANCE_LABEL[s]}
                  {isActive && s !== 'auto' && durationSecsLeft > 0 && (
                    <span className="stance-timer"> {durationSecsLeft}s</span>
                  )}
                  {isCoolingDown && cooldownSecsLeft > 0 && (
                    <span className="stance-timer stance-timer--cd"> {cooldownSecsLeft}s</span>
                  )}
                </FilterOption>
              )
            })}
          </div>
        </div>
      </FilterPopup>

      <Button className="filter-btn stance-bar__speed" onClick={onCycleSpeed}>
        x{speedMultiplier}
      </Button>
    </span>
  )
}
