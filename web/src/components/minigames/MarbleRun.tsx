// ─── Marble Run ───────────────────────────────────────────────────────────────
// Plinko-style game: drop 3 marbles through a peg board, earn tickets based on
// which slot each lands in. Each round uses a randomly-chosen grid pattern with
// obstacle pegs that force deflections.

import React, { useState, useEffect, useRef } from 'react'

interface Props {
  onDone: (ticketsEarned: number) => void
}

const COLS = 9
const ROWS = 12
const SLOT_VALUES = [25, 5, 15, 30, 75, 30, 15, 5, 25]
const TOTAL_DROPS = 3

// ── Grid patterns ─────────────────────────────────────────────────────────────
// Each obstacle specifies a (row, col) position and direction it forces the
// marble: 'L' = strongly left, 'R' = strongly right, 'X' = chaos (high deflect)
type ObstacleDir = 'L' | 'R' | 'X'
interface Obstacle { row: number; col: number; dir: ObstacleDir }
interface GridPattern { name: string; obstacles: Obstacle[] }

const GRID_PATTERNS: GridPattern[] = [
  {
    name: 'Standard',
    obstacles: [],
  },
  {
    name: 'Funnel',
    // Guide marbles toward the centre
    obstacles: [
      { row: 1, col: 0, dir: 'R' }, 
      { row: 1, col: 8, dir: 'L' },
      { row: 3, col: 1, dir: 'R' }, 
      { row: 3, col: 7, dir: 'L' },
      { row: 5, col: 2, dir: 'R' }, 
      { row: 5, col: 6, dir: 'L' },
    ],
  },
  {
    name: 'Zigzag',
    // Alternating left/right walls on every other row
    obstacles: [
      { row: 0, col: 4, dir: 'L' },
      { row: 1, col: 3, dir: 'R' }, 
      { row: 1, col: 5, dir: 'L' },
      { row: 2, col: 2, dir: 'R' },
      { row: 3, col: 4, dir: 'R' }, 
      { row: 3, col: 6, dir: 'L' },
      { row: 4, col: 5, dir: 'L' },
      { row: 5, col: 3, dir: 'R' }, 
      { row: 5, col: 5, dir: 'R' },
      { row: 6, col: 2, dir: 'L' }, 
      { row: 6, col: 4, dir: 'R' },
    ],
  },
  {
    name: 'Chaos',
    // High-deflect obstacles scattered throughout
    obstacles: [
      { row: 0, col: 3, dir: 'X' }, 
      { row: 0, col: 5, dir: 'X' },
      { row: 2, col: 2, dir: 'X' }, 
      { row: 2, col: 6, dir: 'X' },
      { row: 4, col: 1, dir: 'X' }, 
      { row: 4, col: 4, dir: 'X' }, 
      { row: 4, col: 7, dir: 'X' },
      { row: 6, col: 3, dir: 'X' }, 
      { row: 6, col: 5, dir: 'X' },
    ],
  },
  {
    name: 'Wall Left',
    // Strong left-side deflectors push marbles toward high-value slots
    obstacles: [
      { row: 1, col: 8, dir: 'L' }, 
      { row: 1, col: 7, dir: 'L' },
      { row: 3, col: 8, dir: 'L' }, 
      { row: 3, col: 6, dir: 'L' },
      { row: 5, col: 8, dir: 'L' }, 
      { row: 5, col: 7, dir: 'L' },
      { row: 7, col: 8, dir: 'L' },
    ],
  },
  {
    name: 'Wall Right',
    // Mirror of Wall Left
    obstacles: [
      { row: 1, col: 0, dir: 'R' }, 
      { row: 1, col: 1, dir: 'R' },
      { row: 3, col: 0, dir: 'R' }, 
      { row: 3, col: 2, dir: 'R' },
      { row: 5, col: 0, dir: 'R' }, 
      { row: 5, col: 1, dir: 'R' },
      { row: 7, col: 0, dir: 'R' },
    ],
  },
]

function pickPattern(): GridPattern {
  return GRID_PATTERNS[Math.floor(Math.random() * GRID_PATTERNS.length)]
}

// ── Marble simulation ──────────────────────────────────────────────────────────
function runMarble(startCol: number, obstacles: Obstacle[]): number[] {
  let col = startCol
  const path = [col]
  for (let r = 0; r < ROWS; r++) {
    const obs = obstacles.find(o => o.row === r && o.col === col)
    let deflectChance = 0.45
    let leftBias = 0.5  // 0.5 = equal chance left/right

    if (obs) {
      if (obs.dir === 'L') { deflectChance = 0.80; leftBias = 0.85 }
      else if (obs.dir === 'R') { deflectChance = 0.80; leftBias = 0.15 }
      else if (obs.dir === 'X') { deflectChance = 0.75; leftBias = 0.5 }
    }

    if (Math.random() < deflectChance) {
      col = Math.random() < leftBias
        ? Math.max(0, col - 1)
        : Math.min(COLS - 1, col + 1)
    }
    path.push(col)
  }
  return path
}

// ── Component ─────────────────────────────────────────────────────────────────
type MarbleState = {
  col: number
  row: number
  done: boolean
  finalSlot: number
}

export function MarbleRun({ onDone }: Props) {
  const [pattern, setPattern] = useState<GridPattern>(() => pickPattern())
  const [phase, setPhase] = useState<'choose' | 'dropping' | 'result'>('choose')
  const [dropsLeft, setDropsLeft] = useState(TOTAL_DROPS)
  const [results, setResults] = useState<number[]>([])
  const [marbleCol, setMarbleCol] = useState<number | null>(null)
  const [marbleRow, setMarbleRow] = useState<number>(-1)
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathRef = useRef<number[]>([])

  function dropMarble(startCol: number) {
    if (phase !== 'choose') return
    setPhase('dropping')
    const path = runMarble(startCol, pattern.obstacles)
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
          // Pick a new pattern for the next drop
          setPattern(pickPattern())
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

  function getObstacleAt(row: number, col: number): Obstacle | undefined {
    return pattern.obstacles.find(o => o.row === row && o.col === col)
  }

  function pegDisplay(row: number, col: number): string {
    const obs = getObstacleAt(row, col)
    if (!obs) return '·'
    if (obs.dir === 'L') return '◄'
    if (obs.dir === 'R') return '►'
    return '✦'
  }

  return (
    <div className="minigame-screen">
      <div className="minigame-title">🔮 MARBLE RUN</div>
      <div className="marble-pattern-label">Pattern: {pattern.name}</div>
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
              const obs = getObstacleAt(row, col)
              return (
                <div
                  key={col}
                  className={`marble-cell${isMarble ? ' marble-cell--active' : ''}${obs ? ' marble-cell--obstacle' : ''}`}
                >
                  {isMarble
                    ? <span className="marble-ball">●</span>
                    : <span className={obs ? 'marble-obstacle' : 'marble-peg'}>{pegDisplay(row, col)}</span>}
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
