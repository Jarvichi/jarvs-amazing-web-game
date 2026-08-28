import React, { useId } from 'react'
import type { FishVariant } from '../Fishing.data'

// ─── Fishing scene ────────────────────────────────────────────────────────────
// The whole visual of the fishing minigame: a layered SVG water scene that
// reacts to the phase of the cast. Replaces the old five-line ASCII "≈≈≈≈≈"
// art. Purely presentational — every position it draws comes in as a prop.

export type ScenePhase =
  | 'idle'      // rod shouldered, nothing in the water
  | 'charging'  // winding up the cast
  | 'flying'    // float arcing out over the water
  | 'waiting'   // float down, fish circling below
  | 'bite'      // float yanked under
  | 'fight'     // hooked; the fish runs up and down the water column
  | 'missed'    // struck too late
  | 'lost'      // line went slack mid-fight
  | 'caught'    // landed

interface SceneTheme {
  skyTop: string
  skyBottom: string
  waterTop: string
  waterDeep: string
  surface: string
  backdrop: string
  accent: string
  /** Small celestial body: the sun, the moon, or a cave glow. */
  orb: string
  /** Silhouette drawn along the far bank / horizon. */
  horizon: (w: number, y: number) => React.ReactNode
  /** Drawn above the sky band — a cave ceiling, gulls, drifting cloud. */
  canopy?: (w: number) => React.ReactNode
}

const W = 320
const H = 210
const WATER_Y = 84          // surface line
const BED_Y = H - 4         // bottom of the water column
const ROD_TIP = { x: 66, y: 30 }
const CAST_MIN_X = 108      // float x at power 0
const CAST_MAX_X = 296      // float x at power 100

/** Float's resting x for a cast of `power` (0-100). */
export function floatX(power: number): number {
  return CAST_MIN_X + (CAST_MAX_X - CAST_MIN_X) * Math.min(1, Math.max(0, power / 100))
}

/** Depth (svg y) of a fight-position 0 (bed) … 1 (surface). */
function depthY(pos: number): number {
  return BED_Y - (BED_Y - (WATER_Y + 14)) * Math.min(1, Math.max(0, pos))
}

const THEMES: Record<FishVariant, SceneTheme> = {
  river: {
    skyTop: '#1a2418', skyBottom: '#3d4a2c', waterTop: '#2f5d4a', waterDeep: '#08170f',
    surface: '#6fd6a8', backdrop: '#101a10', accent: '#8fe0b0', orb: '#ffe9a8',
    horizon: (w, y) => (
      <path
        d={`M0 ${y} L0 ${y - 16} L14 ${y - 30} L26 ${y - 14} L38 ${y - 34} L52 ${y - 12}
            L70 ${y - 26} L84 ${y - 10} L104 ${y - 22} L120 ${y - 34} L136 ${y - 12}
            L158 ${y - 28} L176 ${y - 9} L198 ${y - 24} L220 ${y - 38} L240 ${y - 14}
            L262 ${y - 26} L284 ${y - 11} L300 ${y - 20} L${w} ${y - 14} L${w} ${y} Z`}
      />
    ),
  },
  lake: {
    skyTop: '#171a2e', skyBottom: '#4a3b52', waterTop: '#2b4468', waterDeep: '#070c18',
    surface: '#8fb8ff', backdrop: '#141326', accent: '#a9c8ff', orb: '#ffd9e6',
    horizon: (w, y) => (
      <path d={`M0 ${y} L0 ${y - 12} Q46 ${y - 40} 96 ${y - 16} Q140 ${y - 36} 190 ${y - 14}
                Q244 ${y - 34} 292 ${y - 15} L${w} ${y - 20} L${w} ${y} Z`} />
    ),
  },
  cave: {
    skyTop: '#0a0d12', skyBottom: '#141c22', waterTop: '#123b46', waterDeep: '#03090c',
    surface: '#4fe8d6', backdrop: '#0b1013', accent: '#5ef0dc', orb: '#7ef7e6',
    horizon: (w, y) => (
      <path d={`M0 ${y} L0 ${y - 10} L30 ${y - 18} L58 ${y - 8} L92 ${y - 20} L128 ${y - 9}
                L170 ${y - 19} L212 ${y - 8} L256 ${y - 17} L${w} ${y - 10} L${w} ${y} Z`} />
    ),
    // Stalactites hanging from the cave roof.
    canopy: (w) => (
      <g className="fishing-stalactites">
        {[8, 34, 58, 92, 126, 158, 196, 230, 268, 300].map((x, i) => {
          const len = 10 + ((i * 7) % 17)
          const half = 5 + (i % 3)
          return <path key={x} d={`M${x - half} 0 L${x + half} 0 L${x} ${len} Z`} />
        })}
        <rect x={0} y={0} width={w} height={5} />
      </g>
    ),
  },
  ocean: {
    skyTop: '#101a2c', skyBottom: '#5a3f4e', waterTop: '#1d4a70', waterDeep: '#040b16',
    surface: '#7fd8ff', backdrop: '#0d1522', accent: '#9fe4ff', orb: '#ffc79a',
    horizon: (w, y) => (
      <g>
        <rect x={0} y={y - 8} width={w} height={8} />
        {/* Harbour wall + lighthouse on the far mole */}
        <rect x={228} y={y - 16} width={54} height={16} />
        <path d={`M252 ${y - 16} L250 ${y - 40} L262 ${y - 40} L260 ${y - 16} Z`} />
        <rect x={249} y={y - 46} width={14} height={7} />
      </g>
    ),
  },
}

interface Props {
  variant: FishVariant
  phase: ScenePhase
  /** Locked cast power, 0-100 — sets how far out the float sits. */
  castPower: number
  /** Fight position of the hooked fish, 0 (bed) … 1 (surface). */
  fishPos?: number
  /** Emoji shown breaking the surface on a landed catch. */
  catchIcon?: string
}

export function FishingScene({ variant, phase, castPower, fishPos = 0.5, catchIcon }: Props) {
  const t = THEMES[variant]
  const uid = useId().replace(/:/g, '')
  const skyId = `fsky-${uid}`
  const waterId = `fwater-${uid}`
  const glowId = `fglow-${uid}`

  const inWater = phase !== 'idle' && phase !== 'charging'
  const fx = floatX(castPower)
  // The float rides the surface, is dragged under on a bite, and is pulled
  // taut over the fighting fish while it runs.
  const fy = phase === 'bite' ? WATER_Y + 7 : phase === 'fight' ? WATER_Y + 3 : WATER_Y - 1
  const taut = phase === 'bite' || phase === 'fight'
  // Slack line sags between rod tip and float; a hooked fish pulls it straight.
  const sag = taut ? 4 : 20
  const line = `M${ROD_TIP.x} ${ROD_TIP.y} Q${(ROD_TIP.x + fx) / 2} ${(ROD_TIP.y + fy) / 2 + sag} ${fx} ${fy}`

  return (
    <div className={`fishing-scene fishing-scene--${variant} fishing-scene--${phase}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="fishing-scene-svg" aria-label={`${variant} fishing spot`}>
        <defs>
          <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.skyTop} />
            <stop offset="100%" stopColor={t.skyBottom} />
          </linearGradient>
          <linearGradient id={waterId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.waterTop} />
            <stop offset="100%" stopColor={t.waterDeep} />
          </linearGradient>
          <radialGradient id={glowId}>
            <stop offset="0%" stopColor={t.orb} stopOpacity="0.55" />
            <stop offset="100%" stopColor={t.orb} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── Sky / cavern air ── */}
        <rect x={0} y={0} width={W} height={WATER_Y} fill={`url(#${skyId})`} />
        <circle cx={252} cy={30} r={30} fill={`url(#${glowId})`} />
        <circle cx={252} cy={30} r={9} fill={t.orb} opacity={0.85} className="fishing-orb" />
        {variant === 'cave' && (
          <g className="fishing-glowworms" fill={t.accent}>
            {[[36, 14], [72, 26], [118, 12], [156, 30], [198, 18], [286, 24]].map(([x, y], i) => (
              <circle key={x} cx={x} cy={y} r={1.4} style={{ animationDelay: `${i * 0.4}s` }} />
            ))}
          </g>
        )}
        {t.canopy?.(W)}
        <g fill={t.backdrop}>{t.horizon(W, WATER_Y)}</g>

        {/* ── Water column ── */}
        <rect x={0} y={WATER_Y} width={W} height={H - WATER_Y} fill={`url(#${waterId})`} />

        {/* Light shafts raking down through the water */}
        <g className="fishing-shafts" fill={t.surface}>
          <path d={`M198 ${WATER_Y} L226 ${WATER_Y} L262 ${BED_Y} L226 ${BED_Y} Z`} opacity={0.06} />
          <path d={`M148 ${WATER_Y} L162 ${WATER_Y} L186 ${BED_Y} L164 ${BED_Y} Z`} opacity={0.045} />
        </g>

        {/* Silhouettes cruising the deep — the reason to cast far */}
        <g className="fishing-deep-fish" fill={t.waterDeep} opacity={0.75}>
          <g className="fishing-deep-fish--a">
            <ellipse cx={0} cy={0} rx={13} ry={4.5} />
            <path d="M12 0 L20 -5 L20 5 Z" />
          </g>
          <g className="fishing-deep-fish--b">
            <ellipse cx={0} cy={0} rx={9} ry={3.2} />
            <path d="M8 0 L15 -3.6 L15 3.6 Z" />
          </g>
          <g className="fishing-deep-fish--c">
            <ellipse cx={0} cy={0} rx={18} ry={6} />
            <path d="M16 0 L27 -7 L27 7 Z" />
          </g>
        </g>

        {/* Surface: three offset wave bands scrolling at different speeds */}
        <g className="fishing-waves" stroke={t.surface} fill="none">
          <path className="fishing-wave fishing-wave--1" strokeWidth={1.6} opacity={0.75}
                d={`M-320 ${WATER_Y} q20 -4 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0
                    t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0`} />
          <path className="fishing-wave fishing-wave--2" strokeWidth={1.1} opacity={0.4}
                d={`M-320 ${WATER_Y + 9} q16 -3 32 0 t32 0 t32 0 t32 0 t32 0 t32 0 t32 0 t32 0
                    t32 0 t32 0 t32 0 t32 0 t32 0 t32 0 t32 0 t32 0 t32 0 t32 0 t32 0 t32 0`} />
          <path className="fishing-wave fishing-wave--3" strokeWidth={0.9} opacity={0.22}
                d={`M-320 ${WATER_Y + 20} q24 -4 48 0 t48 0 t48 0 t48 0 t48 0 t48 0 t48 0 t48 0
                    t48 0 t48 0 t48 0 t48 0 t48 0`} />
        </g>

        {/* ── Bank, angler and rod ── */}
        <g className="fishing-bank" fill={t.backdrop}>
          <path d={`M0 ${WATER_Y - 6} L58 ${WATER_Y - 6} L74 ${WATER_Y + 6} L84 ${BED_Y} L0 ${BED_Y} Z`} />
          {variant === 'ocean' && <rect x={0} y={WATER_Y - 10} width={78} height={5} />}
        </g>
        <g className="fishing-angler">
          {/* Silhouetted figure: head, body, planted legs */}
          <circle cx={34} cy={44} r={7} />
          <path d="M26 52 L44 52 L48 74 L24 74 Z" />
          <path d="M28 74 L24 96 L31 96 L35 78 L39 96 L46 96 L44 74 Z" />
          {/* Arms up to the rod butt */}
          <path d="M42 55 L58 46 L60 51 L44 60 Z" />
        </g>
        <line className="fishing-rod" x1={46} y1={62} x2={ROD_TIP.x} y2={ROD_TIP.y} />

        {/* ── Line, float and hooked fish ── */}
        {inWater && (
          <>
            <path className="fishing-line-path" d={line} />

            {/* Expanding rings where the float sits */}
            {(phase === 'waiting' || phase === 'bite') && (
              <g className="fishing-ripples" stroke={t.surface} fill="none">
                <ellipse cx={fx} cy={WATER_Y + 1} rx={6} ry={2} />
                <ellipse cx={fx} cy={WATER_Y + 1} rx={6} ry={2} style={{ animationDelay: '0.9s' }} />
              </g>
            )}

            {/* The hooked fish, running the water column */}
            {phase === 'fight' && (
              <g className="fishing-hooked" transform={`translate(${fx - 6} ${depthY(fishPos)})`} fill={t.accent}>
                <ellipse cx={0} cy={0} rx={11} ry={4} />
                <path d="M10 0 L18 -5 L18 5 Z" />
                <circle cx={-6} cy={-1} r={1} fill={t.waterDeep} />
              </g>
            )}

            {/* Landed: the catch breaks the surface in a burst of spray */}
            {phase === 'caught' && (
              <g className="fishing-landed">
                <text x={fx} y={WATER_Y - 6} textAnchor="middle" className="fishing-landed-icon">
                  {catchIcon}
                </text>
                <g className="fishing-splash" fill={t.surface}>
                  {[-22, -13, -5, 5, 13, 22].map((dx, i) => (
                    <circle key={dx} cx={fx + dx} cy={WATER_Y} r={2.4 - Math.abs(dx) / 18}
                            style={{ animationDelay: `${i * 0.05}s` }} />
                  ))}
                </g>
              </g>
            )}

            {/* Float: red-over-white, bobbing, yanked under on a bite */}
            {phase !== 'caught' && (
              <g className={`fishing-float${taut ? ' fishing-float--under' : ''}`}
                 transform={`translate(${fx} ${fy})`}>
                <path d="M0 -7 L4 -1 L-4 -1 Z" fill="#ff4444" />
                <circle cx={0} cy={2} r={4} fill="#f2f2f2" />
                <path d="M-4 2 a4 4 0 0 1 8 0 Z" fill="#ff4444" />
              </g>
            )}
          </>
        )}

        {/* Missed / snapped: spray and a slack, wobbling line */}
        {(phase === 'missed' || phase === 'lost') && (
          <g className="fishing-splash" fill={t.surface}>
            {[-18, -8, 0, 8, 18].map((dx, i) => (
              <circle key={dx} cx={fx + dx} cy={WATER_Y} r={2}
                      style={{ animationDelay: `${i * 0.06}s` }} />
            ))}
          </g>
        )}
      </svg>
    </div>
  )
}
