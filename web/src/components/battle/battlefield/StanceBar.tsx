import React, { useEffect, useId, useRef, useState } from 'react'
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

// Label curve geometry for the expanded clover. Plain horizontal text ignores
// the petal's own curve entirely — cramped at the sharp center point, wasted
// space out at the rounded rim. Curving each label along an arc concentric
// with that rim uses the petal's actual shape instead of fighting it.
//
// The clover's petals are true quarter/half discs (each cell's outer corner
// rounds at radius = the cell's own size, per .stance-petal's CSS), all
// sharing the SAME center — so one shared arc radius, centered on the
// expanded clover's own center, traces every petal's rim.
const CLOVER_VIEWBOX = 108     // must match .stance-clover--expanded's size
const CLOVER_CENTER  = CLOVER_VIEWBOX / 2
const CLOVER_LABEL_R = 38      // inside the true ~52px petal rim, clear of the border

/**
 * One SVG arc `d` string from `fromDeg` to `toDeg`, both measured clockwise
 * from 3 o'clock (0deg = right, 90deg = bottom, 180deg = left, 270deg = top —
 * standard screen/SVG convention, y grows downward). `sweep` is the raw SVG
 * sweep-flag (0 or 1) — see the comment on ARC_RANGE_4 for why the two
 * bottom petals need it flipped relative to the top two.
 */
function arcPath(fromDeg: number, toDeg: number, sweep: 0 | 1): string {
  const rad = (d: number) => (d * Math.PI) / 180
  const x1 = CLOVER_CENTER + CLOVER_LABEL_R * Math.cos(rad(fromDeg))
  const y1 = CLOVER_CENTER + CLOVER_LABEL_R * Math.sin(rad(fromDeg))
  const x2 = CLOVER_CENTER + CLOVER_LABEL_R * Math.cos(rad(toDeg))
  const y2 = CLOVER_CENTER + CLOVER_LABEL_R * Math.sin(rad(toDeg))
  return `M ${x1} ${y1} A ${CLOVER_LABEL_R} ${CLOVER_LABEL_R} 0 0 ${sweep} ${x2} ${y2}`
}

// One arc range per petal, same index order as CORNER_CLASS_4/2. Two points
// 90deg apart admit two different circles of the shared radius — one centered
// on the clover's own center (the one we want, bulging out to the petal's
// rim) and one mirrored across the chord (bulging in toward the center
// instead). With a fixed sweep-flag, which one gets drawn depends on point
// order — so the top two petals (sweep=1, "start at the shared edge, sweep
// out to the corner") and the bottom two (same points, sweep=0, which keeps
// the same rim-hugging circle but reverses the traversal direction so their
// text reads upright instead of upside-down) need opposite flags. Both the
// bulge and the reading direction were confirmed empirically via Storybook
// screenshots — getting either flag wrong is visually obvious (text bows
// toward the center, or reads upside-down) rather than subtly off.
const ARC_RANGE_4: [number, number, 0 | 1][] = [
  [180, 270, 1], // tl
  [270, 360, 1], // tr
  [180, 90, 0],  // bl (same rim-hugging arc as the un-flipped order, reversed)
  [360, 90, 0],  // br
]
const ARC_RANGE_2: [number, number, 0 | 1][] = [
  [90, 270, 1],  // l (bottom -> top, the long way round through left)
  [270, 90, 1],  // r
]

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
                    // The visible label is the curved SVG text drawn on top (see
                    // below) — plain button text can't follow the petal's own
                    // curve, so this stays as the accessible name only.
                    aria-label={STANCE_LABEL[s]}
                  />
                )
              })}
            </span>
            {/* Decorative labels, curved along each petal's own rim — see
                arcPath/ARC_RANGE_4/ARC_RANGE_2 above for why. pointer-events:none
                (in CSS) so taps still land on the real petal buttons beneath. */}
            <svg className="stance-clover-labels" viewBox={`0 0 ${CLOVER_VIEWBOX} ${CLOVER_VIEWBOX}`} aria-hidden="true">
              <defs>
                {allowed.map((s, i) => {
                  const [from, to, sweep] = (allowed.length === 2 ? ARC_RANGE_2 : ARC_RANGE_4)[i]
                  return <path key={s} id={`stance-arc-${idPrefix}-${s}`} d={arcPath(from, to, sweep)} />
                })}
              </defs>
              {allowed.map(s => (
                <text key={s} className={`stance-petal-label${stance === s ? ' stance-petal-label--active' : ''}`}>
                  <textPath href={`#stance-arc-${idPrefix}-${s}`} startOffset="50%" textAnchor="middle">
                    {STANCE_LABEL[s]}
                  </textPath>
                </text>
              ))}
            </svg>
            {timerText && <span className="stance-clover-timer">{timerText}</span>}
          </div>
        )}
      </span>

      <Button className="stance-bar__speed" onClick={onCycleSpeed} aria-label={`Speed ${speedMultiplier}x — tap to cycle`}>
        ×{speedMultiplier}
      </Button>
    </span>
  )
}
