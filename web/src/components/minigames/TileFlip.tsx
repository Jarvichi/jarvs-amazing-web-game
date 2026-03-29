// ─── Tile Flip ────────────────────────────────────────────────────────────────
// Memory match game: flip tiles to find all 8 pairs.
// Earn 5 tickets per match + bonus for zero mistakes or fast completion.

import React, { useState, useEffect, useRef, useCallback } from 'react'

interface Props {
  onDone: (ticketsEarned: number, perfect: boolean) => void
}

const ICONS = ['⚔️', '🛡️', '🔮', '🐉', '💎', '🗡️', '🏹', '🧙']
const TICKETS_PER_MATCH = 5
const PERFECT_BONUS = 30
const FAST_BONUS = 10
const FAST_THRESHOLD_MS = 30000  // 30 seconds

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildTiles(): string[] {
  return shuffleArray([...ICONS, ...ICONS])
}

export function TileFlip({ onDone }: Props) {
  const [tiles] = useState<string[]>(() => buildTiles())
  const [flipped, setFlipped] = useState<boolean[]>(() => Array(16).fill(false))
  const [matched, setMatched] = useState<boolean[]>(() => Array(16).fill(false))
  const [selected, setSelected] = useState<number[]>([])
  const [mistakes, setMistakes] = useState(0)
  const [locked, setLocked] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const [phase, setPhase] = useState<'playing' | 'result'>('playing')
  const [finalTickets, setFinalTickets] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAt)
    }, 500)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [startedAt])

  const checkDone = useCallback((newMatched: boolean[]) => {
    if (newMatched.every(Boolean)) {
      if (timerRef.current) clearInterval(timerRef.current)
      const elapsed = Date.now() - startedAt
      const base = (ICONS.length) * TICKETS_PER_MATCH  // 8 pairs × 5 = 40
      const perfectBonus = mistakes === 0 ? PERFECT_BONUS : 0
      const fastBonus = elapsed < FAST_THRESHOLD_MS ? FAST_BONUS : 0
      const total = base + perfectBonus + fastBonus
      setFinalTickets(total)
      setElapsedMs(elapsed)
      setPhase('result')
    }
  }, [mistakes, startedAt])

  function handleFlip(idx: number) {
    if (locked || flipped[idx] || matched[idx] || phase !== 'playing') return

    const newFlipped = [...flipped]
    newFlipped[idx] = true
    setFlipped(newFlipped)

    const newSelected = [...selected, idx]
    setSelected(newSelected)

    if (newSelected.length === 2) {
      setLocked(true)
      const [a, b] = newSelected
      if (tiles[a] === tiles[b]) {
        // Match!
        setTimeout(() => {
          const newMatched = [...matched]
          newMatched[a] = true
          newMatched[b] = true
          setMatched(newMatched)
          setSelected([])
          setLocked(false)
          checkDone(newMatched)
        }, 400)
      } else {
        // No match
        setMistakes(m => m + 1)
        setTimeout(() => {
          const resetFlipped = [...newFlipped]
          resetFlipped[a] = false
          resetFlipped[b] = false
          setFlipped(resetFlipped)
          setSelected([])
          setLocked(false)
        }, 800)
      }
    }
  }

  const matchedCount = matched.filter(Boolean).length / 2

  return (
    <div className="minigame-screen">
      <div className="minigame-title">🃏 TILE FLIP</div>

      <div className="tileflip-stats">
        <span>Pairs: {matchedCount}/{ICONS.length}</span>
        <span>Mistakes: {mistakes}</span>
        <span>Time: {(elapsedMs / 1000).toFixed(1)}s</span>
      </div>

      <div className="tile-grid">
        {tiles.map((icon, idx) => (
          <button
            key={idx}
            className={`tile${flipped[idx] || matched[idx] ? ' tile--flipped' : ''}${matched[idx] ? ' tile--matched' : ''}`}
            onClick={() => handleFlip(idx)}
            disabled={locked || matched[idx] || phase !== 'playing'}
            aria-label={flipped[idx] || matched[idx] ? icon : 'Hidden tile'}
          >
            {(flipped[idx] || matched[idx]) ? icon : '?'}
          </button>
        ))}
      </div>

      {phase === 'result' && (
        <div className="minigame-result-panel">
          <div className="minigame-result-headline">
            {mistakes === 0 ? '✨ PERFECT!' : 'Nice work!'}
          </div>
          <div className="minigame-result-breakdown">
            <div>Base ({ICONS.length} pairs): +{ICONS.length * TICKETS_PER_MATCH} 🎫</div>
            {mistakes === 0 && <div>Perfect bonus: +{PERFECT_BONUS} 🎫</div>}
            {elapsedMs < FAST_THRESHOLD_MS && <div>Speed bonus: +{FAST_BONUS} 🎫</div>}
            <div className="minigame-result-total">Total: {finalTickets} 🎫</div>
          </div>
          <button className="action-btn action-btn--gold" onClick={() => onDone(finalTickets, mistakes === 0)}>
            COLLECT &amp; EXIT
          </button>
        </div>
      )}
    </div>
  )
}
