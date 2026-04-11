// ─── Fruit Machine ────────────────────────────────────────────────────────────
// 3-reel slot machine. Spin costs 1 credit; hold reels between spins.
// Cash out at any time to convert remaining credits to tickets (2 per credit).
// Buy +5 credits for 25 crystals when running low.

import React, { useState, useRef, useEffect } from 'react'
import { loadCrystals, saveCrystals } from '../../game/collection'

interface Props {
  onDone: (ticketsEarned: number) => void
}

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '⭐', '🔔', '💎']
const WEIGHTS  = [ 30,   20,   20,   15,    8,    5,    2]  // must sum to 100
const STARTING_CREDITS  = 10
const BUY_COST          = 25   // crystals to buy more credits
const BUY_AMOUNT        = 5    // credits per purchase
const MAX_CREDITS       = 20   // cap on held credits
const TICKETS_PER_CREDIT = 2
const SPIN_DURATION_MS  = 1200

function pickSymbol(): string {
  let r = Math.random() * WEIGHTS.reduce((s, w) => s + w, 0)
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= WEIGHTS[i]
    if (r <= 0) return SYMBOLS[i]
  }
  return SYMBOLS[SYMBOLS.length - 1]
}

function calcPayout(s: [string, string, string]): number {
  const [a, b, c] = s
  if (a === b && b === c) {
    if (a === '💎') return 50
    if (a === '⭐') return 30
    if (a === '🔔') return 20
    return 10
  }
  if (a === b || b === c || a === c) {
    const doubled = a === b ? a : b === c ? b : a
    if (doubled === '💎') return 5
    if (doubled === '⭐') return 3
    return 2
  }
  if (a === '🍒') return 1  // cherry consolation on first reel
  return 0
}

export function FruitMachine({ onDone }: Props) {
  const [reels, setReels]         = useState<[string, string, string]>(() => [pickSymbol(), pickSymbol(), pickSymbol()])
  const [display, setDisplay]     = useState<[string, string, string]>(() => [pickSymbol(), pickSymbol(), pickSymbol()])
  const [held, setHeld]           = useState<[boolean, boolean, boolean]>([false, false, false])
  const [phase, setPhase]         = useState<'idle' | 'spinning' | 'done'>('idle')
  const [credits, setCredits]     = useState(STARTING_CREDITS)
  const [lastWin, setLastWin]     = useState<number | null>(null)
  const [cashOutTickets, setCashOutTickets] = useState(0)
  const [availCrystals, setAvailCrystals]  = useState(() => loadCrystals())

  const spinningRef  = useRef<[boolean, boolean, boolean]>([false, false, false])
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sync display with reels on first mount
  useEffect(() => {
    setDisplay([...reels] as [string, string, string])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto cash-out when out of credits
  useEffect(() => {
    if (phase === 'idle' && credits <= 0) {
      setCashOutTickets(0)
      setPhase('done')
    }
  }, [credits, phase])

  function toggleHold(i: 0 | 1 | 2) {
    if (phase !== 'idle') return
    setHeld(prev => {
      const next = [...prev] as [boolean, boolean, boolean]
      next[i] = !next[i]
      return next
    })
  }

  function spin() {
    if (phase !== 'idle' || credits < 1) return

    const nextReels: [string, string, string] = [
      held[0] ? reels[0] : pickSymbol(),
      held[1] ? reels[1] : pickSymbol(),
      held[2] ? reels[2] : pickSymbol(),
    ]
    spinningRef.current = [!held[0], !held[1], !held[2]]

    setPhase('spinning')
    setCredits(c => c - 1)
    setLastWin(null)

    // Rapidly cycle display for non-held reels
    intervalRef.current = setInterval(() => {
      const s = spinningRef.current
      setDisplay(prev => [
        s[0] ? SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)] : prev[0],
        s[1] ? SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)] : prev[1],
        s[2] ? SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)] : prev[2],
      ])
    }, 80)

    setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      spinningRef.current = [false, false, false]

      const win = calcPayout(nextReels)
      setReels(nextReels)
      setDisplay(nextReels)
      setLastWin(win)
      setHeld([false, false, false])
      setCredits(c => Math.max(0, c + win))
      setPhase('idle')
    }, SPIN_DURATION_MS)
  }

  function cashOut() {
    if (phase !== 'idle') return
    const tickets = credits * TICKETS_PER_CREDIT
    setCashOutTickets(tickets)
    setPhase('done')
  }

  function buyCredits() {
    if (availCrystals < BUY_COST || credits >= MAX_CREDITS || phase !== 'idle') return
    saveCrystals(availCrystals - BUY_COST)
    setAvailCrystals(c => c - BUY_COST)
    setCredits(c => Math.min(MAX_CREDITS, c + BUY_AMOUNT))
  }

  // ── Done screen ───────────────────────────────────────────────────────────────

  if (phase === 'done') {
    return (
      <div className="minigame-screen">
        <div className="minigame-title">🎰 FRUIT MACHINE</div>
        <div className="minigame-result-panel">
          <div className="minigame-result-headline">
            {cashOutTickets > 0 ? 'Cashed out!' : 'Out of credits!'}
          </div>
          <div className="minigame-result-breakdown">
            {cashOutTickets > 0 ? (
              <>
                <div>Credits: {cashOutTickets / TICKETS_PER_CREDIT}</div>
                <div>× {TICKETS_PER_CREDIT} tickets per credit</div>
              </>
            ) : (
              <div>No credits remaining.</div>
            )}
            <div className="minigame-result-total">Total: {cashOutTickets} 🎫</div>
          </div>
          <button className="action-btn action-btn--gold" onClick={() => onDone(cashOutTickets)}>
            COLLECT &amp; EXIT
          </button>
        </div>
      </div>
    )
  }

  // ── Playing screen ────────────────────────────────────────────────────────────

  const isSpinning = phase === 'spinning'
  const canBuy = phase === 'idle' && credits > 0 && credits < MAX_CREDITS && availCrystals >= BUY_COST

  return (
    <div className="minigame-screen">
      <div className="minigame-title">🎰 FRUIT MACHINE</div>

      <div className="fm-header">
        <span className="fm-credits">Credits: {credits}</span>
        {lastWin !== null && lastWin > 0 && (
          <span className="fm-win-flash">+{lastWin} credit{lastWin !== 1 ? 's' : ''}!</span>
        )}
        {lastWin === 0 && <span className="fm-no-win">No win</span>}
      </div>

      {/* Reels */}
      <div className="fm-reels">
        {([0, 1, 2] as const).map(i => (
          <div
            key={i}
            className={`fm-reel${held[i] ? ' fm-reel--held' : ''}${isSpinning && !held[i] ? ' fm-reel--spinning' : ''}`}
          >
            <div className="fm-symbol">{display[i]}</div>
          </div>
        ))}
      </div>

      {/* Hold buttons */}
      <div className="fm-holds">
        {([0, 1, 2] as const).map(i => (
          <button
            key={i}
            className={`fm-hold-btn${held[i] ? ' fm-hold-btn--active' : ''}`}
            onClick={() => toggleHold(i)}
            disabled={isSpinning}
          >
            {held[i] ? 'HELD' : 'HOLD'}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="fm-controls">
        <button
          className="action-btn action-btn--gold"
          onClick={spin}
          disabled={!(!isSpinning && credits >= 1)}
        >
          SPIN (1 credit)
        </button>
        <button
          className="action-btn"
          onClick={cashOut}
          disabled={isSpinning}
        >
          CASH OUT ({credits * TICKETS_PER_CREDIT} 🎫)
        </button>
      </div>

      {canBuy && (
        <button className="fm-buy-credits" onClick={buyCredits}>
          + Buy 5 credits — 25 💎 (you have {availCrystals})
        </button>
      )}

      {/* Payout reference */}
      <details className="fm-paytable">
        <summary>Payout table</summary>
        <table className="fm-paytable-table">
          <tbody>
            <tr><td>💎💎💎</td><td>50 credits</td></tr>
            <tr><td>⭐⭐⭐</td><td>30 credits</td></tr>
            <tr><td>🔔🔔🔔</td><td>20 credits</td></tr>
            <tr><td>Any triple</td><td>10 credits</td></tr>
            <tr><td>💎💎 pair</td><td>5 credits</td></tr>
            <tr><td>⭐⭐ pair</td><td>3 credits</td></tr>
            <tr><td>Any pair</td><td>2 credits</td></tr>
            <tr><td>🍒 on reel 1</td><td>1 credit</td></tr>
          </tbody>
        </table>
      </details>
    </div>
  )
}
