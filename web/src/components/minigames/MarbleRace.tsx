// ─── Marble Race ──────────────────────────────────────────────────────────────
// Pick one of 4 coloured marbles, then watch all 4 race down a 20-row track.
// Obstacles randomly pause marbles for a tick. Prize is based on finishing place.

import React, { useState, useEffect, useRef } from 'react'

interface Props {
  onDone: (ticketsEarned: number) => void
}

const TRACK_LENGTH  = 20    // rows in the track (0 = top, TRACK_LENGTH = finish)
const OBSTACLE_CHANCE = 0.22 // probability of a pause obstacle per row per marble
const TICK_MS       = 160   // ms between animation frames

const MARBLE_NAMES   = ['Red',  'Blue',  'Green', 'Yellow'] as const
const MARBLE_EMOJIS  = ['🔴',  '🔵',   '🟢',    '🟡']   as const
const PLACE_PRIZES   = [40, 20, 10, 5] // tickets for 1st / 2nd / 3rd / 4th
const PLACE_LABELS   = ['1st 🥇', '2nd 🥈', '3rd 🥉', '4th']

// ── Race simulation ───────────────────────────────────────────────────────────
// Returns a path array for one marble: each element is the row position at that
// tick.  Repeated values represent obstacle pauses.
function simulatePath(): number[] {
  const path: number[] = [0]
  let row = 0
  while (row < TRACK_LENGTH) {
    if (Math.random() < OBSTACLE_CHANCE) {
      path.push(row) // stall for one extra tick
    }
    row++
    path.push(row)
  }
  return path
}

// Simulate all 4 marble paths and return finishing order (marble indices, 1st→4th).
function simulateRace(): { paths: number[][]; order: number[] } {
  const paths = Array.from({ length: 4 }, simulatePath)
  // Finishing tick = index of first occurrence of TRACK_LENGTH in each path.
  // Break ties by the marble index (lower = earlier draw).
  const finishTicks = paths.map(p => p.indexOf(TRACK_LENGTH))
  const order = [0, 1, 2, 3].sort((a, b) => finishTicks[a] - finishTicks[b])
  return { paths, order }
}

// ── Component ─────────────────────────────────────────────────────────────────
type Phase = 'choose' | 'racing' | 'result'

export function MarbleRace({ onDone }: Props) {
  const [phase, setPhase]             = useState<Phase>('choose')
  const [chosen, setChosen]           = useState<number | null>(null)
  // rows[i] = current display row of marble i during animation
  const [rows, setRows]               = useState<number[]>([0, 0, 0, 0])
  const [finishOrder, setFinishOrder] = useState<number[]>([])
  const [ticketsEarned, setTicketsEarned] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pathsRef    = useRef<number[][]>([])
  const orderRef    = useRef<number[]>([])
  const tickRef     = useRef(0)
  const maxTickRef  = useRef(0)

  function startRace() {
    if (chosen === null) return
    const { paths, order } = simulateRace()
    pathsRef.current  = paths
    orderRef.current  = order
    tickRef.current   = 0
    maxTickRef.current = Math.max(...paths.map(p => p.length - 1))
    setRows([0, 0, 0, 0])
    setFinishOrder([])
    setPhase('racing')
  }

  useEffect(() => {
    if (phase !== 'racing') return

    intervalRef.current = setInterval(() => {
      const t = tickRef.current
      const paths = pathsRef.current

      setRows(paths.map(p => p[Math.min(t, p.length - 1)]))

      if (t >= maxTickRef.current) {
        clearInterval(intervalRef.current!)
        const order = orderRef.current
        setFinishOrder(order)
        const place = order.indexOf(chosen!)
        const tickets = PLACE_PRIZES[place]
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
  const place       = finishOrder.indexOf(chosen ?? 0)
  const placeLabel  = phase === 'result' ? PLACE_LABELS[place] : null

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

      {/* Track */}
      <div className="race-track">
        {/* Header: marble emoji per lane */}
        <div className="race-track-header">
          {MARBLE_NAMES.map((name, i) => (
            <div
              key={i}
              className={`race-lane-header${chosen === i ? ' race-lane-header--chosen' : ''}`}
            >
              {MARBLE_EMOJIS[i]}
            </div>
          ))}
        </div>

        {/* Rows */}
        {Array.from({ length: TRACK_LENGTH }, (_, rowIdx) => (
          <div key={rowIdx} className="race-row">
            {MARBLE_NAMES.map((_, marbleIdx) => {
              const marbleRow = rows[marbleIdx]
              const isHere    = marbleRow === rowIdx
              const isChosen  = chosen === marbleIdx
              return (
                <div
                  key={marbleIdx}
                  className={`race-cell${isHere ? ' race-cell--marble' : ''}${isChosen && isHere ? ' race-cell--chosen' : ''}`}
                >
                  {isHere
                    ? <span className="race-marble">{MARBLE_EMOJIS[marbleIdx]}</span>
                    : <span className="race-track-dot">·</span>}
                </div>
              )
            })}
          </div>
        ))}

        {/* Finish line */}
        <div className="race-finish-line">
          {MARBLE_NAMES.map((_, i) => (
            <div key={i} className={`race-finish-cell${rows[i] >= TRACK_LENGTH ? ' race-finish-cell--arrived' : ''}`}>
              {rows[i] >= TRACK_LENGTH ? MARBLE_EMOJIS[i] : '▭'}
            </div>
          ))}
        </div>
      </div>

      {/* Finishing order (shown progressively as marbles arrive) */}
      {phase === 'result' && finishOrder.length > 0 && (
        <div className="race-results">
          {finishOrder.map((marbleIdx, pos) => (
            <div
              key={marbleIdx}
              className={`race-result-row${marbleIdx === chosen ? ' race-result-row--chosen' : ''}`}
            >
              <span className="race-result-place">{PLACE_LABELS[pos]}</span>
              <span className="race-result-marble">{MARBLE_EMOJIS[marbleIdx]} {MARBLE_NAMES[marbleIdx]}</span>
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
