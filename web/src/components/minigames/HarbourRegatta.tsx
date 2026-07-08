// ─── Harbour Regatta ──────────────────────────────────────────────────────────
// Row a skiff round the Millhaven harbour buoys against 3 crewed rivals. Tap the
// LEFT and RIGHT oar buttons in a steady alternating rhythm to row straight —
// favour one oar and the skiff veers that way. Prize is based on finishing place.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  createRowState, applyStroke, decayLateral, advanceAiProgress,
  COURSE_LENGTH, type RowState, type OarSide,
} from './HarbourRegatta.physics'

interface Props {
  onDone: (ticketsEarned: number) => void
}

const PLAYER_IDX  = 0
const BOAT_NAMES  = ['You', 'Gale', 'Tern', 'Reef'] as const
const BOAT_COLORS = ['#ffcc00', '#ff4444', '#4488ff', '#44cc44'] as const
const PLACE_PRIZES = [40, 20, 10, 5]
const PLACE_LABELS = ['1st 🥇', '2nd 🥈', '3rd 🥉', '4th']

const RENDER_INTERVAL_MS = 50
const MAX_RACE_TIME_MS   = 60000

// ── SVG layout ────────────────────────────────────────────────────────────────
const SVG_W  = 380
const SVG_H  = 640
const LANE_XS = [65, 145, 225, 305]
const START_Y  = 40
const FINISH_Y = 600
const LATERAL_PX_PER_UNIT = 1.1
const OPEN_WATER_FRAC  = 0.30
const WINDWARD_FRAC    = 0.55
const SPINNAKER_FRAC   = 0.85

function progressToY(progress: number): number {
  const t = Math.max(0, Math.min(1, progress / COURSE_LENGTH))
  return START_Y + (FINISH_Y - START_Y) * t
}

interface Display {
  progress: number[]        // [player, ai1, ai2, ai3]
  lateralOffset: number
}

type Phase = 'intro' | 'racing' | 'result'

export function HarbourRegatta({ onDone }: Props) {
  const [phase, setPhase]     = useState<Phase>('intro')
  const [display, setDisplay] = useState<Display>({ progress: [0, 0, 0, 0], lateralOffset: 0 })
  const [finishOrder, setFinishOrder]     = useState<number[]>([])
  const [ticketsEarned, setTicketsEarned] = useState(0)

  const rowStateRef    = useRef<RowState>(createRowState())
  const aiProgressRef  = useRef<number[]>([0, 0, 0])
  const finishedRef    = useRef(false)
  const rafRef         = useRef<number | null>(null)
  const lastFrameRef   = useRef(0)
  const raceStartRef   = useRef(0)
  const lastCommitRef  = useRef(0)

  function startRace() {
    rowStateRef.current   = createRowState()
    aiProgressRef.current = [0, 0, 0]
    finishedRef.current   = false
    const now = performance.now()
    raceStartRef.current  = now
    lastFrameRef.current  = now
    lastCommitRef.current = 0
    setDisplay({ progress: [0, 0, 0, 0], lateralOffset: 0 })
    setFinishOrder([])
    setPhase('racing')
  }

  const tapOar = useCallback((side: OarSide) => {
    if (finishedRef.current) return
    rowStateRef.current = applyStroke(rowStateRef.current, side, performance.now())
  }, [])

  function finishRace(progresses: number[]) {
    finishedRef.current = true
    const order = [0, 1, 2, 3].sort((a, b) => progresses[b] - progresses[a])
    const place = order.indexOf(PLAYER_IDX)
    const tickets = PLACE_PRIZES[place]
    setFinishOrder(order)
    setTicketsEarned(tickets)
    setDisplay({
      progress: progresses.map(p => Math.min(p, COURSE_LENGTH)),
      lateralOffset: rowStateRef.current.lateralOffset,
    })
    setPhase('result')
  }

  useEffect(() => {
    if (phase !== 'racing') return

    function frame(now: number) {
      const dt = now - lastFrameRef.current
      lastFrameRef.current = now

      rowStateRef.current = decayLateral(rowStateRef.current, dt)
      const ai = aiProgressRef.current
      for (let i = 0; i < ai.length; i++) ai[i] = advanceAiProgress(ai[i], dt)

      const progresses = [rowStateRef.current.progress, ai[0], ai[1], ai[2]]
      const timedOut = now - raceStartRef.current >= MAX_RACE_TIME_MS

      if (!finishedRef.current && (progresses.some(p => p >= COURSE_LENGTH) || timedOut)) {
        finishRace(progresses)
        return
      }

      if (now - lastCommitRef.current > RENDER_INTERVAL_MS) {
        lastCommitRef.current = now
        setDisplay({
          progress: progresses.map(p => Math.min(p, COURSE_LENGTH)),
          lateralOffset: rowStateRef.current.lateralOffset,
        })
      }
      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Optional keyboard support for desktop play.
  useEffect(() => {
    if (phase !== 'racing') return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') tapOar('left')
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') tapOar('right')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, tapOar])

  // ── Intro phase ────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="minigame-screen">
        <div className="minigame-title">⛵ HARBOUR REGATTA</div>
        <p className="minigame-subtitle">
          Row your skiff round the harbour buoys! Tap LEFT and RIGHT oars in a
          steady alternating rhythm to go straight — favour one oar and you'll veer that way.
        </p>

        <div className="race-prize-table">
          {PLACE_LABELS.map((label, i) => (
            <div key={i} className="race-prize-row u-flex u-just-sb u-gap-7">
              <span className="race-prize-place">{label}</span>
              <span className="race-prize-tickets">+{PLACE_PRIZES[i]} 🎫</span>
            </div>
          ))}
        </div>

        <div className="minigame-result-panel u-col u-items-c u-gap-5">
          <button className="action-btn action-btn--gold" onClick={startRace}>
            ROW OUT!
          </button>
        </div>
      </div>
    )
  }

  // ── Racing / result phase ────────────────────────────────────────────────────
  const place      = finishOrder.indexOf(PLAYER_IDX)
  const placeLabel = phase === 'result' ? PLACE_LABELS[place] : null

  const openWaterY  = progressToY(OPEN_WATER_FRAC * COURSE_LENGTH)
  const windwardY   = progressToY(WINDWARD_FRAC * COURSE_LENGTH)
  const spinnakerY  = progressToY(SPINNAKER_FRAC * COURSE_LENGTH)

  return (
    <div className="minigame-screen">
      <div className="minigame-title">⛵ HARBOUR REGATTA</div>

      {phase === 'racing' && (
        <p className="minigame-subtitle">Racing… keep a steady L-R-L-R rhythm!</p>
      )}
      {phase === 'result' && (
        <p className="minigame-subtitle">You finished {placeLabel}!</p>
      )}

      {/* SVG Course */}
      <div className="race-svg-wrap">
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="race-svg" aria-label="Harbour regatta course">

          {/* ── Section labels ── */}
          <text x="6" y={openWaterY - 10} className="race-section-label">OPEN WATER</text>
          <text x="6" y={windwardY - 10} className="race-section-label">WINDWARD MARK</text>
          <text x="6" y={spinnakerY - 10} className="race-section-label">SPINNAKER RUN</text>

          {/* ── Lane tracks ── */}
          {LANE_XS.map((lx, i) => (
            <line key={i} x1={lx} y1={START_Y} x2={lx} y2={FINISH_Y} className="race-lane-track" />
          ))}

          {/* ── Windward buoy marker ── */}
          <polygon
            points={`${SVG_W / 2},${windwardY - 8} ${SVG_W / 2 + 8},${windwardY} ${SVG_W / 2},${windwardY + 8} ${SVG_W / 2 - 8},${windwardY}`}
            className="regatta-buoy"
          />

          {/* ── Start line ── */}
          <line x1={LANE_XS[0] - 22} y1={START_Y} x2={LANE_XS[3] + 22} y2={START_Y}
                className="race-start-line" />
          <text x={SVG_W / 2} y={START_Y - 7} textAnchor="middle" className="race-line-label">
            QUAY START
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

          {/* ── Lane headers ── */}
          {LANE_XS.map((lx, i) => (
            <text
              key={i}
              x={lx} y={START_Y - 16}
              textAnchor="middle"
              className={`race-lane-label${i === PLAYER_IDX ? ' race-lane-label--chosen' : ''}`}
            >
              {i === PLAYER_IDX ? '⛵ YOU' : BOAT_NAMES[i]}
            </text>
          ))}

          {/* ── Skiffs ── */}
          {LANE_XS.map((lx, i) => {
            const x = lx + (i === PLAYER_IDX ? display.lateralOffset * LATERAL_PX_PER_UNIT : 0)
            const y = progressToY(display.progress[i])
            return (
              <g
                key={i}
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                  transition: `transform ${i === PLAYER_IDX ? 60 : Math.round(RENDER_INTERVAL_MS * 1.2)}ms linear`,
                }}
              >
                {i === PLAYER_IDX && <circle r={13} className="regatta-boat-glow" style={{ stroke: BOAT_COLORS[i] }} />}
                <polygon
                  points="0,-9 6,7 0,4 -6,7"
                  className={`regatta-boat-hull${i === PLAYER_IDX ? ' regatta-boat-hull--player' : ''}`}
                  style={{ fill: BOAT_COLORS[i] }}
                />
              </g>
            )
          })}

        </svg>
      </div>

      {/* ── Oar controls ── */}
      {phase === 'racing' && (
        <div className="regatta-oars u-flex u-gap-6 u-just-c">
          <button className="action-btn action-btn--large regatta-oar-btn" onClick={() => tapOar('left')}>
            ⬅ LEFT OAR
          </button>
          <button className="action-btn action-btn--large regatta-oar-btn" onClick={() => tapOar('right')}>
            RIGHT OAR ➡
          </button>
        </div>
      )}

      {/* ── Finishing order ── */}
      {phase === 'result' && finishOrder.length > 0 && (
        <div className="race-results u-col u-gap-2">
          {finishOrder.map((boatIdx, pos) => (
            <div
              key={boatIdx}
              className={`race-result-row${boatIdx === PLAYER_IDX ? ' race-result-row--chosen' : ''}`}
            >
              <span className="race-result-place">{PLACE_LABELS[pos]}</span>
              <span className="race-result-marble u-grow">
                {boatIdx === PLAYER_IDX ? '⛵' : '🚣'} {BOAT_NAMES[boatIdx]}
              </span>
              {boatIdx === PLAYER_IDX && (
                <span className="race-result-prize">+{ticketsEarned} 🎫</span>
              )}
            </div>
          ))}
        </div>
      )}

      {phase === 'result' && (
        <div className="minigame-result-panel u-col u-items-c u-gap-5">
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

