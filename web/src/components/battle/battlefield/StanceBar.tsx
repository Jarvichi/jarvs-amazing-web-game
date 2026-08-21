import React, { useId, useRef, useState } from 'react'
import { useClickOutsideToClose } from '../../../hooks/useClickOutsideToClose'
import { SpeedClover } from './SpeedClover'
import { Icon } from '../../ui/icons/Icon'
import type { IconName } from '../../ui/icons/IconSprite'
import {
  CORNER_CLASS_4, CORNER_CLASS_2, CLOVER_VIEWBOX, ARC_RANGE_4, ARC_RANGE_2, arcPath,
  petalIconTransform,
} from './cloverGeometry'

type Stance = 'attack' | 'hold' | 'defend' | 'auto'

const STANCE_LABEL: Record<Stance, string> = {
  attack: 'CHARGE',
  hold:   'HOLD',
  defend: 'DEFEND',
  auto:   'ATTACK',
}

// One small icon per stance, sitting in the wedge between the label arc and the
// shared center (see petalIconTransform in cloverGeometry.ts). 4-petal layout only —
// see that function's doc comment for why the 2-petal case doesn't get one.
const STANCE_ICON: Record<Stance, IconName> = {
  attack: 'bolt',
  hold:   'pause',
  defend: 'shield',
  auto:   'sword',
}
const STANCE_ICON_SIZE = 16

// Reading order for the 4-petal layout is tl/tr/bl/br (see CORNER_CLASS_4), so this
// array's order IS the grid position: auto(ATTACK)->tl, defend(DEFEND)->tr,
// attack(CHARGE)->bl, hold(HOLD)->br.
const STANCE_ORDER = ['auto', 'defend', 'attack', 'hold'] as const

// Each stance gets its own petal colour (see battle.css's --petal-color modifiers) —
// keyed by stance value rather than grid position, so a stance's colour stays fixed
// even when only 2 are allowed and petals render as l/r halves instead of quadrants.
const STANCE_COLOR_CLASS: Record<Stance, string> = {
  attack: 'stance-petal--attack',
  hold:   'stance-petal--hold',
  defend: 'stance-petal--defend',
  auto:   'stance-petal--auto',
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
  onSetSpeed?: (m: 1 | 2 | 4 | 8) => void
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
 * The speed control beside it (SpeedClover) is a sibling using the same shape
 * language, not a StanceBar concern — see Battlefield.tsx for how the two are
 * laid out together.
 */
export function StanceBar({ stance, allowedStances, suddenDeath, onCooldown, cooldownSecsLeft, durationSecsLeft, speedMultiplier, onSetStance, onSetSpeed }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  // Namespaces the SVG arc ids so two StanceBars on one page (e.g. a
  // Storybook docs page rendering several stories at once) never collide —
  // <textPath href="#..."> resolves by document-wide id, not by component.
  const idPrefix = useId()

  const allowed = STANCE_ORDER.filter(s => !allowedStances || allowedStances.includes(s))
  const cornerClasses = allowed.length === 2 ? CORNER_CLASS_2 : CORNER_CLASS_4

  // The trigger — and the expanded overlay's center badge — carry whichever
  // timer is currently meaningful, so the state the old row showed inline is
  // still visible without anything being tapped.
  const timerText =
    durationSecsLeft > 0 && stance !== 'auto' ? `${durationSecsLeft}s`
    : onCooldown && cooldownSecsLeft > 0     ? `${cooldownSecsLeft}s`
    : null

  useClickOutsideToClose(open, () => setOpen(false), wrapRef)

  return (
    <span className="stance-control u-flex u-items-c u-gap-2">
      {/* Own positioning context, separate from the speed control beside it —
          the expanded clover anchors to THIS box, not the whole control, so
          growing it never covers anything else in the row. */}
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
                  className={`stance-petal ${cornerClasses[i]} ${STANCE_COLOR_CLASS[s]}${stance === s ? ' stance-petal--active' : ''}`}
                />
              ))}
            </span>
            {/* Current selection's icon, centered over the whole tiny clover — at
                22px there's no room to show which petal is "active" any other way
                than the existing glow, so this repeats that same information as a
                recognisable shape rather than making the player decode a colour. */}
            <Icon name={STANCE_ICON[stance]} size={14} className="stance-clover-tiny-icon" />
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
                    className={`stance-petal ${cornerClasses[i]} ${STANCE_COLOR_CLASS[s]}${isActive ? ' stance-petal--active' : ''}`}
                    disabled={blockedBySuddenDeath || isCoolingDown}
                    title={isCoolingDown ? `Available in ${cooldownSecsLeft}s` : undefined}
                    onClick={() => { onSetStance?.(s); setOpen(false) }}
                    // The visible label is the curved SVG text drawn on top (see
                    // below) — plain button text can't follow the petal's own
                    // curve, so this stays as the accessible name only.
                    aria-label={STANCE_LABEL[s]}
                  />
                )
              })}
            </span>
            {/* Decorative labels, curved along each petal's own rim — see
                arcPath/ARC_RANGE_4/ARC_RANGE_2 in cloverGeometry.ts for why.
                pointer-events:none (in CSS) so taps still land on the real
                petal buttons beneath. */}
            <svg className="stance-clover-labels" viewBox={`0 0 ${CLOVER_VIEWBOX} ${CLOVER_VIEWBOX}`} aria-hidden="true">
              <defs>
                {allowed.map((s, i) => {
                  const [from, to] = (allowed.length === 2 ? ARC_RANGE_2 : ARC_RANGE_4)[i]
                  return <path key={s} id={`stance-arc-${idPrefix}-${s}`} d={arcPath(from, to)} />
                })}
              </defs>
              {allowed.map(s => (
                <text key={s} className={`stance-petal-label${stance === s ? ' stance-petal-label--active' : ''}`}>
                  <textPath href={`#stance-arc-${idPrefix}-${s}`} startOffset="50%" textAnchor="middle">
                    {STANCE_LABEL[s]}
                  </textPath>
                </text>
              ))}
              {/* One icon per stance, rotated to match that petal's own label tilt —
                  see petalIconTransform's doc comment. 4-petal layout only. */}
              {allowed.length === 4 && allowed.map((s, i) => {
                const [from, to] = ARC_RANGE_4[i]
                return (
                  <use
                    key={`icon-${s}`}
                    href={`#icon-${STANCE_ICON[s]}`}
                    width={24}
                    height={24}
                    className={`stance-petal-label${stance === s ? ' stance-petal-label--active' : ''}`}
                    transform={petalIconTransform(from, to, STANCE_ICON_SIZE)}
                  />
                )
              })}
            </svg>
            {timerText && <span className="stance-clover-timer">{timerText}</span>}
          </div>
        )}
      </span>

      <SpeedClover speedMultiplier={speedMultiplier} onSetSpeed={onSetSpeed} />
    </span>
  )
}
