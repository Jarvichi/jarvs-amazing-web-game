// ─── Marble Race ──────────────────────────────────────────────────────────────
// Pick one of 4 coloured marbles, then watch all 4 race down a 20-row SVG track
// with zigzag curves, a loop-the-loop, and a funnel section.
// Obstacles randomly pause marbles for a tick. Prize is based on finishing place.

import React, { useState, useEffect, useRef } from 'react'

interface Props {
  onDone: (ticketsEarned: number) => void
}

const TRACK_LENGTH    = 20     // checkpoints (0 = start, 20 = finish)
const OBSTACLE_CHANCE = 0.22   // probability of a pause obstacle per checkpoint
const TICK_MS         = 160    // ms between animation frames

const MARBLE_NAMES   = ['Red',    'Blue',   'Green',  'Yellow'] as const
const MARBLE_EMOJIS  = ['🔴',    '🔵',     '🟢',     '🟡']    as const
const MARBLE_COLORS  = ['#ff4444','#4488ff','#44cc44','#ffcc00'] as const
const PLACE_PRIZES   = [40, 20, 10, 5]
const PLACE_LABELS   = ['1st 🥇', '2nd 🥈', '3rd 🥉', '4th']

// ── SVG layout ────────────────────────────────────────────────────────────────
const SVG_W       = 380
const SVG_H       = 620
const LANE_XS     = [55, 135, 215, 295] // 4 lane centres, 80 px apart
const LOOP_CY     = 310                 // loop circle centre Y
const LOOP_R      = 35                  // loop radius
const FUNNEL_CX   = 175                 // x-midpoint of all 4 lanes

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }

// Returns 21 waypoints (rows 0–20) for one lane.
function getLaneWaypoints(lx: number): { x: number; y: number }[] {
  const ZZ = 22  // zigzag amplitude
  return [
    // ── straight start (rows 0-2) ────────────────────────────────────────
    { x: lx,       y: 30  },  // 0 start
    { x: lx,       y: 58  },  // 1
    { x: lx,       y: 86  },  // 2 zigzag begins
    // ── zigzag (rows 3-7) ────────────────────────────────────────────────
    { x: lx + ZZ,  y: 114 },  // 3
    { x: lx - ZZ,  y: 142 },  // 4
    { x: lx + ZZ,  y: 170 },  // 5
    { x: lx - ZZ,  y: 198 },  // 6
    { x: lx,       y: 226 },  // 7 zigzag ends
    // ── approach loop (row 8) ────────────────────────────────────────────
    { x: lx,       y: 258 },  // 8
    // ── loop-the-loop (rows 9-13, clockwise: bottom→right→top→left→bottom)
    { x: lx,            y: LOOP_CY + LOOP_R },  // 9  entry (bottom)
    { x: lx + LOOP_R,   y: LOOP_CY          },  // 10 right
    { x: lx,            y: LOOP_CY - LOOP_R },  // 11 top
    { x: lx - LOOP_R,   y: LOOP_CY          },  // 12 left
    { x: lx,            y: LOOP_CY + LOOP_R },  // 13 exit (same as entry)
    // ── funnel (rows 14-17) ──────────────────────────────────────────────
    { x: lx,                          y: 362 },  // 14 below loop
    { x: lerp(lx, FUNNEL_CX, 0.3),   y: 398 },  // 15 converging
    { x: lerp(lx, FUNNEL_CX, 0.65),  y: 432 },  // 16 funnel centre
    { x: lerp(lx, FUNNEL_CX, 0.3),   y: 462 },  // 17 diverging
    // ── straight finish (rows 18-20) ─────────────────────────────────────
    { x: lx,       y: 490 },  // 18
    { x: lx,       y: 522 },  // 19
    { x: lx,       y: 554 },  // 20 FINISH
  ]
}

// Build a smooth SVG path string through waypoints using catmull-rom → cubic bezier.
function getLanePath(lx: number): string {
  const pts = getLaneWaypoints(lx)
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[Math.max(i - 2, 0)]
    const p1 = pts[i - 1]
    const p2 = pts[i]
    const p3 = pts[Math.min(i + 1, pts.length - 1)]
    const cp1x = p1.x + (p2.x - p0.x) * 0.25
    const cp1y = p1.y + (p2.y - p0.y) * 0.25
    const cp2x = p2.x - (p3.x - p1.x) * 0.25
    const cp2y = p2.y - (p3.y - p1.y) * 0.25
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x} ${p2.y}`
  }
  return d
}

// Return the (x,y) position for a marble at a given row.
function getMarblePos(lx: number, row: number): { x: number; y: number } {
  return getLaneWaypoints(lx)[Math.min(row, TRACK_LENGTH)]
}

// ── Race simulation ───────────────────────────────────────────────────────────
function simulatePath(): number[] {
  const path: number[] = [0]
  let row = 0
  while (row < TRACK_LENGTH) {
    if (Math.random() < OBSTACLE_CHANCE) path.push(row)
    row++
    path.push(row)
  }
  return path
}

function simulateRace(): { paths: number[][]; order: number[] } {
  const paths = Array.from({ length: 4 }, simulatePath)
  const finishTicks = paths.map(p => p.indexOf(TRACK_LENGTH))
  const order = [0, 1, 2, 3].sort((a, b) => finishTicks[a] - finishTicks[b])
  return { paths, order }
}

// ── Derived SVG constants ─────────────────────────────────────────────────────
const START_Y   = getLaneWaypoints(LANE_XS[0])[0].y           // 30
const FINISH_Y  = getLaneWaypoints(LANE_XS[0])[TRACK_LENGTH].y // 554
const FUNNEL_Y14 = getLaneWaypoints(LANE_XS[0])[14].y          // 362
const FUNNEL_Y16 = getLaneWaypoints(LANE_XS[0])[16].y          // 432
const FUNNEL_Y18 = getLaneWaypoints(LANE_XS[0])[18].y          // 490

// ── Component ─────────────────────────────────────────────────────────────────
type Phase = 'choose' | 'racing' | 'result'

export function MarbleRace({ onDone }: Props) {
  const [phase, setPhase]               = useState<Phase>('choose')
  const [chosen, setChosen]             = useState<number | null>(null)
  const [rows, setRows]                 = useState<number[]>([0, 0, 0, 0])
  const [finishOrder, setFinishOrder]   = useState<number[]>([])
  const [ticketsEarned, setTicketsEarned] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pathsRef    = useRef<number[][]>([])
  const orderRef    = useRef<number[]>([])
  const tickRef     = useRef(0)
  const maxTickRef  = useRef(0)

  function startRace() {
    if (chosen === null) return
    const { paths, order } = simulateRace()
    pathsRef.current   = paths
    orderRef.current   = order
    tickRef.current    = 0
    maxTickRef.current = Math.max(...paths.map(p => p.length - 1))
    setRows([0, 0, 0, 0])
    setFinishOrder([])
    setPhase('racing')
  }

  useEffect(() => {
    if (phase !== 'racing') return
    intervalRef.current = setInterval(() => {
      const t = tickRef.current
      setRows(pathsRef.current.map(p => p[Math.min(t, p.length - 1)]))
      if (t >= maxTickRef.current) {
        clearInterval(intervalRef.current!)
        const order  = orderRef.current
        const place  = order.indexOf(chosen!)
        const tickets = PLACE_PRIZES[place]
        setFinishOrder(order)
        setTicketsEarned(tickets)
        setPhase('result')
      }
      tickRef.current++
    }, TICK_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Choose phase ─────────────────────────────────────────────────────────────
  if (phase === 'choose') {
    return (
      <div className="minigame-screen">
        <div className="minigame-title">🏁 MARBLE RACE</div>
        <p className="minigame-subtitle">Pick your marble, then race to the finish!</p>

        <div className="race-prize-table">
          {PLACE_LABELS.map((label, i) => (
            <div key={i} className="race-prize-row">
              <span className="race-prize-place">{label}</span>
              <span className="race-prize-tickets">+{PLACE_PRIZES[i]} 🎫</span>
            </div>
          ))}
        </div>

        <div className="race-pick-row">
          {MARBLE_NAMES.map((name, i) => (
            <button
              key={i}
              className={`race-pick-btn${chosen === i ? ' race-pick-btn--active' : ''}`}
              onClick={() => setChosen(i)}
              aria-pressed={chosen === i}
              style={chosen === i ? { borderColor: MARBLE_COLORS[i], color: MARBLE_COLORS[i] } : {}}
            >
              <span className="race-pick-emoji">{MARBLE_EMOJIS[i]}</span>
              <span className="race-pick-name">{name}</span>
            </button>
          ))}
        </div>

        <div className="minigame-result-panel">
          <button
            className="action-btn action-btn--gold"
            onClick={startRace}
            disabled={chosen === null}
          >
            {chosen === null ? 'PICK A MARBLE' : `RACE WITH ${MARBLE_NAMES[chosen].toUpperCase()}!`}
          </button>
        </div>
      </div>
    )
  }

  // ── Racing / result phase ────────────────────────────────────────────────────
  const place      = finishOrder.indexOf(chosen ?? 0)
  const placeLabel = phase === 'result' ? PLACE_LABELS[place] : null

  return (
    <div className="minigame-screen">
      <div className="minigame-title">🏁 MARBLE RACE</div>

      {phase === 'racing' && (
        <p className="minigame-subtitle">
          Racing… your marble: {MARBLE_EMOJIS[chosen!]} {MARBLE_NAMES[chosen!]}
        </p>
      )}
      {phase === 'result' && (
        <p className="minigame-subtitle">
          {MARBLE_EMOJIS[chosen!]} {MARBLE_NAMES[chosen!]} finished {placeLabel}!
        </p>
      )}

      {/* SVG Track */}
      <div className="race-svg-wrap">
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="race-svg" aria-label="Marble race track">

          {/* ── Section labels ── */}
          <text x="6" y="158" className="race-section-label">ZIGZAG</text>
          <text x="6" y="313" className="race-section-label">LOOP</text>
          <text x="6" y="435" className="race-section-label">FUNNEL</text>

          {/* ── Track paths ── */}
          {LANE_XS.map((lx, i) => (
            <path key={i} d={getLanePath(lx)} className="race-lane-track" />
          ))}

          {/* ── Loop ring decorations ── */}
          {LANE_XS.map((lx, i) => (
            <circle key={i} cx={lx} cy={LOOP_CY} r={LOOP_R} className="race-loop-ring" />
          ))}

          {/* ── Funnel guide lines (converge & diverge) ── */}
          {/* left outer → centre */}
          <line x1={LANE_XS[0] - 10} y1={FUNNEL_Y14} x2={FUNNEL_CX - 14} y2={FUNNEL_Y16}
                className="race-funnel-guide" />
          {/* right outer → centre */}
          <line x1={LANE_XS[3] + 10} y1={FUNNEL_Y14} x2={FUNNEL_CX + 14} y2={FUNNEL_Y16}
                className="race-funnel-guide" />
          {/* centre → left outer (exit) */}
          <line x1={FUNNEL_CX - 14} y1={FUNNEL_Y16} x2={LANE_XS[0] - 10} y2={FUNNEL_Y18}
                className="race-funnel-guide" />
          {/* centre → right outer (exit) */}
          <line x1={FUNNEL_CX + 14} y1={FUNNEL_Y16} x2={LANE_XS[3] + 10} y2={FUNNEL_Y18}
                className="race-funnel-guide" />

          {/* ── Start line ── */}
          <line x1={LANE_XS[0] - 22} y1={START_Y} x2={LANE_XS[3] + 22} y2={START_Y}
                className="race-start-line" />
          <text x={SVG_W / 2} y={START_Y - 7} textAnchor="middle" className="race-line-label">
            START
          </text>

          {/* ── Finish line (striped) ── */}
          {Array.from({ length: 10 }, (_, k) => {
            const segW = (LANE_XS[3] + 22 - (LANE_XS[0] - 22)) / 10
            const x1 = LANE_XS[0] - 22 + k * segW
            return (
              <rect key={k} x={x1} y={FINISH_Y - 4} width={segW} height={8}
                    fill={k % 2 === 0 ? '#ffffff18' : '#00000030'} />
            )
          })}
          <line x1={LANE_XS[0] - 22} y1={FINISH_Y} x2={LANE_XS[3] + 22} y2={FINISH_Y}
                className="race-finish-line-svg" />
          <text x={SVG_W / 2} y={FINISH_Y + 13} textAnchor="middle" className="race-line-label">
            FINISH
          </text>

          {/* ── Lane headers (marble emoji above start) ── */}
          {LANE_XS.map((lx, i) => (
            <text
              key={i}
              x={lx} y={START_Y - 16}
              textAnchor="middle"
              className={`race-lane-label${chosen === i ? ' race-lane-label--chosen' : ''}`}
            >
              {MARBLE_EMOJIS[i]}
            </text>
          ))}

          {/* ── Marble circles ── */}
          {LANE_XS.map((lx, i) => {
            const pos = getMarblePos(lx, rows[i])
            return (
              <g
                key={i}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  transition: `transform ${Math.round(TICK_MS * 0.88)}ms ease-out`,
                }}
              >
                {/* glow ring for chosen marble */}
                {chosen === i && (
                  <circle r={14} className="race-marble-glow"
                          style={{ stroke: MARBLE_COLORS[i] }} />
                )}
                <circle
                  r={chosen === i ? 10 : 8}
                  className={`race-marble-circle${chosen === i ? ' race-marble--chosen' : ''}`}
                  style={{ fill: MARBLE_COLORS[i] }}
                />
              </g>
            )
          })}

        </svg>
      </div>

      {/* ── Finishing order ── */}
      {phase === 'result' && finishOrder.length > 0 && (
        <div className="race-results">
          {finishOrder.map((marbleIdx, pos) => (
            <div
              key={marbleIdx}
              className={`race-result-row${marbleIdx === chosen ? ' race-result-row--chosen' : ''}`}
            >
              <span className="race-result-place">{PLACE_LABELS[pos]}</span>
              <span className="race-result-marble">
                {MARBLE_EMOJIS[marbleIdx]} {MARBLE_NAMES[marbleIdx]}
              </span>
              {marbleIdx === chosen && (
                <span className="race-result-prize">+{ticketsEarned} 🎫</span>
              )}
            </div>
          ))}
        </div>
      )}

      {phase === 'result' && (
        <div className="minigame-result-panel">
          <div className="minigame-result-headline">
            You earned {ticketsEarned} ticket{ticketsEarned !== 1 ? 's' : ''}!
          </div>
          <button className="action-btn action-btn--gold" onClick={() => onDone(ticketsEarned)}>
            COLLECT &amp; EXIT
          </button>
        </div>
      )}
    </div>
  )
}
