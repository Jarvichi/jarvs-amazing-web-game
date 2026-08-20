import React, { useEffect, useRef, useState } from 'react'
import { Button } from '../../ui/Button'

type Stance = 'attack' | 'hold' | 'defend' | 'auto'

const STANCE_LABEL: Record<Stance, string> = {
  attack: 'CHARGE',
  hold:   'HOLD',
  defend: 'DEFEND',
  auto:   'ATTACK',
}

const STANCE_ORDER = ['attack', 'hold', 'defend', 'auto'] as const

// Which outer corner each grid cell rounds, by its index in `allowed` — this is
// what turns 4 plain grid squares into 4 petals meeting at a shared center.
// Index 0/1/2/3 = reading order (top-left, top-right, bottom-left, bottom-right).
const CORNER_CLASS_4 = [
  'stance-petal--tl',
  'stance-petal--tr',
  'stance-petal--bl',
  'stance-petal--br',
]
// Two allowed stances render as left/right halves instead of quadrants.
const CORNER_CLASS_2 = ['stance-petal--l', 'stance-petal--r']

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
 * Stance selector, shaped like a four-leaf clover: a 2x2 (or 1x2, when only two
 * stances are allowed) grid of buttons, each rounded on its outer corner only —
 * a small gap between cells is what reads as four separate petals meeting at a
 * center point, rather than one rounded square.
 *
 * Two states rather than one small live control, because four real buttons
 * packed into a ~22px circle would each be a ~10px hit target — well under any
 * usable minimum. Collapsed is a single real <button> (one hit target, one
 * accessible name, current stance shown as a glowing petal); tapping it swaps
 * in the expanded overlay, a real role="group" of full-size petal buttons.
 * Selecting one calls onSetStance and collapses back to the dot.
 *
 * Replaces #2222's dropdown-list version — same allowed/cooldown/duration/
 * sudden-death rules, same STANCE_LABEL/STANCE_ORDER, same Props, so
 * Battlefield.tsx needed no changes to embed this.
 */
export function StanceBar({ stance, allowedStances, suddenDeath, onCooldown, cooldownSecsLeft, durationSecsLeft, speedMultiplier, onSetStance, onCycleSpeed }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  const allowed = STANCE_ORDER.filter(s => !allowedStances || allowedStances.includes(s))
  const cornerClasses = allowed.length === 2 ? CORNER_CLASS_2 : CORNER_CLASS_4

  // The trigger — and the expanded overlay's center badge — carry whichever
  // timer is currently meaningful, so the state the old row showed inline is
  // still visible without anything being tapped.
  const timerText =
    durationSecsLeft > 0 && stance !== 'auto' ? `${durationSecsLeft}s`
    : onCooldown && cooldownSecsLeft > 0     ? `${cooldownSecsLeft}s`
    : null

  useEffect(() => {
    if (!open) return
    function handlePointer(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <span className="stance-control u-flex u-items-c u-gap-2">
      {/* Own positioning context, separate from the speed button beside it —
          the expanded clover anchors to THIS box, not the whole control, so
          growing it never covers the speed button next to it. */}
      <span className="stance-clover-wrap" ref={wrapRef}>
        {!open ? (
          <button
            type="button"
            className="stance-clover stance-clover--tiny"
            onClick={() => setOpen(true)}
            aria-label={`Stance: ${STANCE_LABEL[stance]}${timerText ? `, ${timerText}` : ''} — tap to change`}
          >
            <span className="stance-clover-grid" data-count={allowed.length}>
              {allowed.map((s, i) => (
                <span
                  key={s}
                  className={`stance-petal ${cornerClasses[i]}${stance === s ? ' stance-petal--active' : ''}`}
                />
              ))}
            </span>
          </button>
        ) : (
          <div className="stance-clover stance-clover--expanded" role="group" aria-label="Stance">
            <span className="stance-clover-grid" data-count={allowed.length}>
              {allowed.map((s, i) => {
                const isActive = stance === s
                const isCoolingDown = onCooldown && s !== 'auto' && !isActive
                const blockedBySuddenDeath = suddenDeath && s !== 'attack'
                return (
                  <button
                    key={s}
                    type="button"
                    className={`stance-petal ${cornerClasses[i]}${isActive ? ' stance-petal--active' : ''}`}
                    disabled={blockedBySuddenDeath || isCoolingDown}
                    title={isCoolingDown ? `Available in ${cooldownSecsLeft}s` : undefined}
                    onClick={() => { onSetStance?.(s); setOpen(false) }}
                  >
                    {STANCE_LABEL[s]}
                  </button>
                )
              })}
            </span>
            {timerText && <span className="stance-clover-timer">{timerText}</span>}
          </div>
        )}
      </span>

      <Button className="filter-btn stance-bar__speed" onClick={onCycleSpeed}>
        x{speedMultiplier}
      </Button>
    </span>
  )
}
