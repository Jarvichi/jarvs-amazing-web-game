// ─── Marble Run ───────────────────────────────────────────────────────────────
// Plinko-style game: drop 3 marbles through a peg board, earn tickets based on
// which slot each lands in.

import React, { useState, useEffect, useRef } from 'react'

interface Props {
  onDone: (ticketsEarned: number) => void
}

const COLS = 7
const ROWS = 8
const SLOT_VALUES = [5, 15, 30, 75, 30, 15, 5]
const TOTAL_DROPS = 3

type MarbleState = {
  col: number       // current column (0-indexed)
  row: number       // current row (0 = top peg row)
  done: boolean
  finalSlot: number // which slot (0-6) it landed in
}

function runMarble(startCol: number): number[] {
  // Returns the column at each row step (length ROWS + 1, last is the slot)
  let col = startCol
  const path = [col]
  for (let r = 0; r < ROWS; r++) {
    // 55% straight, 45% deflect
    const deflect = Math.random() < 0.45
    if (deflect) {
      col = Math.random() < 0.5
        ? Math.max(0, col - 1)
        : Math.min(COLS - 1, col + 1)
    }
    path.push(col)
  }
  return path
}

export function MarbleRun({ onDone }: Props) {
  const [phase, setPhase] = useState<'choose' | 'dropping' | 'result'>('choose')
  const [dropsLeft, setDropsLeft] = useState(TOTAL_DROPS)
  const [results, setResults] = useState<number[]>([])          // slot index per drop
  const [marbleCol, setMarbleCol] = useState<number | null>(null)
  const [marbleRow, setMarbleRow] = useState<number>(-1)
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathRef = useRef<number[]>([])

  function dropMarble(startCol: number) {
    if (phase !== 'choose') return
    setPhase('dropping')
    const path = runMarble(startCol)
    pathRef.current = path
    setMarbleCol(path[0])
    setMarbleRow(0)

    let step = 0
    const advance = () => {
      step++
      if (step < path.length) {
        setMarbleCol(path[step])
        setMarbleRow(step)
        animRef.current = setTimeout(advance, 130)
      } else {
        const finalSlot = path[path.length - 1]
        setResults(prev => [...prev, finalSlot])
        setMarbleCol(null)
        setMarbleRow(-1)
        const remaining = dropsLeft - 1
        setDropsLeft(remaining)
        if (remaining === 0) {
          setPhase('result')
        } else {
          setPhase('choose')
        }
      }
    }
    animRef.current = setTimeout(advance, 130)
  }

  useEffect(() => {
    return () => { if (animRef.current) clearTimeout(animRef.current) }
  }, [])

  const totalTickets = results.reduce((sum, slot) => sum + SLOT_VALUES[slot], 0)

  return (
    <div className="minigame-screen">
      <div className="minigame-title">🔮 MARBLE RUN</div>
      <p className="minigame-subtitle">
        {phase === 'choose' && dropsLeft > 0
          ? `Click a column to drop marble ${TOTAL_DROPS - dropsLeft + 1} of ${TOTAL_DROPS}`
          : phase === 'dropping'
          ? 'Dropping...'
          : 'All done!'}
      </p>

      {/* Drop column selectors */}
      <div className="marble-col-selectors">
        {phase === 'choose' && Array.from({ length: COLS }, (_, c) => (
          <button
            key={c}
            className="marble-col-btn"
            onClick={() => dropMarble(c)}
            aria-label={`Drop in column ${c + 1}`}
          >▼</button>
        ))}
        {phase !== 'choose' && <div className="marble-col-btn-placeholder" />}
      </div>

      {/* Peg board */}
      <div className="marble-board">
        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} className="marble-peg-row">
            {Array.from({ length: COLS }, (_, col) => {
              const isMarble = marbleCol === col && marbleRow === row
              return (
                <div key={col} className={`marble-cell${isMarble ? ' marble-cell--active' : ''}`}>
                  {isMarble ? <span className="marble-ball">●</span> : <span className="marble-peg">·</span>}
                </div>
              )
            })}
          </div>
        ))}

        {/* Slot row */}
        <div className="marble-slot-row">
          {SLOT_VALUES.map((val, idx) => {
            const isMarbleHere = phase === 'dropping' && marbleRow >= ROWS && marbleCol === idx
            const isResult = results.includes(idx)
            return (
              <div
                key={idx}
                className={`marble-slot${isMarbleHere ? ' marble-slot--active' : ''}${isResult ? ' marble-slot--hit' : ''}`}
              >
                {val}
              </div>
            )
          })}
        </div>
      </div>

      {/* Drop history */}
      {results.length > 0 && (
        <div className="marble-results">
          {results.map((slot, i) => (
            <span key={i} className="marble-result-chip">
              Drop {i + 1}: +{SLOT_VALUES[slot]} 🎫
            </span>
          ))}
          <span className="marble-result-total">Total: {totalTickets} 🎫</span>
        </div>
      )}

      {phase === 'result' && (
        <div className="minigame-result-panel">
          <div className="minigame-result-headline">You earned {totalTickets} tickets!</div>
          <button className="action-btn action-btn--gold" onClick={() => onDone(totalTickets)}>
            COLLECT &amp; EXIT
          </button>
        </div>
      )}
    </div>
  )
}
