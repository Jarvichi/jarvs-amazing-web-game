// ─── Lucky Spinner ────────────────────────────────────────────────────────────
// Spin the wheel and see how many tickets you land on.
// Jackpot = 50 tickets.

import React, { useState, useRef } from 'react'

interface Props {
  onDone: (ticketsEarned: number, isJackpot: boolean) => void
}

const SEGMENTS = [2, 5, 10, 20, 5, 10, 50, 2]
const SEGMENT_COLORS = [
  '#4a3060', '#3a5a40', '#6a2a2a', '#2a4a6a',
  '#3a5a40', '#6a2a2a', '#c8a000', '#4a3060',
]
const SEGMENT_COUNT = SEGMENTS.length
const DEG_PER_SEGMENT = 360 / SEGMENT_COUNT
const JACKPOT_VALUE = 50

export function LuckySpinner({ onDone }: Props) {
  const [phase, setPhase] = useState<'ready' | 'spinning' | 'result'>('ready')
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<number | null>(null)
  const wheelRef = useRef<SVGSVGElement>(null)

  function spin() {
    if (phase !== 'ready') return
    setPhase('spinning')

    // Pick a winning segment deterministically
    const winSegment = Math.floor(Math.random() * SEGMENT_COUNT)
    const tickets = SEGMENTS[winSegment]

    // Calculate final angle: spin 5-8 full rotations + land on winning segment
    const fullSpins = 5 + Math.floor(Math.random() * 4)
    // The pointer is at the top (0°). Segment 0 starts at 0°.
    // To land on winSegment, the wheel should stop so that winSegment is at the top.
    const segmentMidAngle = winSegment * DEG_PER_SEGMENT + DEG_PER_SEGMENT / 2
    const finalAngle = fullSpins * 360 + (360 - segmentMidAngle)

    const newRotation = rotation + finalAngle
    setRotation(newRotation)

    setTimeout(() => {
      setResult(tickets)
      setPhase('result')
    }, 3500)
  }

  const isJackpot = result === JACKPOT_VALUE

  return (
    <div className="minigame-screen">
      <div className="minigame-title">🎡 LUCKY SPINNER</div>

      <div className="spinner-wrap">
        {/* Pointer */}
        <div className="spinner-pointer">▼</div>

        {/* Wheel */}
        <svg
          ref={wheelRef}
          className="spinner-wheel"
          viewBox="0 0 240 240"
          style={{ transform: `rotate(${rotation}deg)`, transition: phase === 'spinning' ? 'transform 3.4s cubic-bezier(0.17, 0.67, 0.12, 1.0)' : 'none' }}
        >
          {SEGMENTS.map((val, i) => {
            const startAngle = i * DEG_PER_SEGMENT
            const endAngle = startAngle + DEG_PER_SEGMENT
            const midAngle = startAngle + DEG_PER_SEGMENT / 2
            const r = 110
            const innerR = 20
            const toRad = (d: number) => (d - 90) * Math.PI / 180
            const x1 = 120 + r * Math.cos(toRad(startAngle))
            const y1 = 120 + r * Math.sin(toRad(startAngle))
            const x2 = 120 + r * Math.cos(toRad(endAngle))
            const y2 = 120 + r * Math.sin(toRad(endAngle))
            const ix1 = 120 + innerR * Math.cos(toRad(startAngle))
            const iy1 = 120 + innerR * Math.sin(toRad(startAngle))
            const ix2 = 120 + innerR * Math.cos(toRad(endAngle))
            const iy2 = 120 + innerR * Math.sin(toRad(endAngle))
            const labelX = 120 + (r * 0.65) * Math.cos(toRad(midAngle))
            const labelY = 120 + (r * 0.65) * Math.sin(toRad(midAngle))
            return (
              <g key={i}>
                <path
                  d={`M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 0 0 ${ix1} ${iy1}`}
                  fill={SEGMENT_COLORS[i]}
                  stroke="#1a1a2e"
                  strokeWidth="1"
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={val === JACKPOT_VALUE ? '#ffd700' : '#e0e0e0'}
                  fontSize={val === JACKPOT_VALUE ? '13' : '11'}
                  fontWeight={val === JACKPOT_VALUE ? 'bold' : 'normal'}
                  fontFamily="monospace"
                  transform={`rotate(${midAngle}, ${labelX}, ${labelY})`}
                >
                  {val}
                </text>
              </g>
            )
          })}
          <circle cx="120" cy="120" r="20" fill="#1a1a2e" stroke="#444" strokeWidth="2" />
        </svg>
      </div>

      {phase === 'ready' && (
        <button className="action-btn action-btn--gold spinner-btn" onClick={spin}>
          SPIN THE WHEEL
        </button>
      )}

      {phase === 'spinning' && (
        <p className="spinner-spinning-label">Spinning...</p>
      )}

      {phase === 'result' && result !== null && (
        <div className="minigame-result-panel">
          {isJackpot && <div className="spinner-jackpot-flash">⭐ JACKPOT! ⭐</div>}
          <div className="minigame-result-headline">You won {result} tickets!</div>
          <button className="action-btn action-btn--gold" onClick={() => onDone(result, isJackpot)}>
            COLLECT &amp; EXIT
          </button>
        </div>
      )}
    </div>
  )
}
