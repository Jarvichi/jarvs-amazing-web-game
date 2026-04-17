// ─── Video Poker ──────────────────────────────────────────────────────────────
// Blind + bet-multiplier variant of Jacks or Better.
// Pay 1-credit blind to see your hand, then Fold | ×1 | ×2 | ×5.
// Ace plays both high (A-K-Q-J-10) and low (A-2-3-4-5).

import React, { useState, useCallback } from 'react'
import { loadCrystals, saveCrystals } from '../../game/collection'

interface Props {
  onDone: (ticketsEarned: number) => void
}

interface PlayingCard {
  rank: number  // 1 = Ace, 2–10, 11 = Jack, 12 = Queen, 13 = King
  suit: string  // '♠' | '♥' | '♦' | '♣'
}

interface HandResult {
  name: string
  multiplier: number
}

type Phase = 'wager' | 'hold' | 'result' | 'done'

const SUITS = ['♠', '♥', '♦', '♣']
const BLIND              = 1
const STARTING_CREDITS   = 5
const BUY_COST           = 25
const BUY_AMOUNT         = 10
const MAX_CREDITS        = 50
const TICKETS_PER_CREDIT = 2

function rankLabel(rank: number): string {
  if (rank === 1)  return 'A'
  if (rank === 11) return 'J'
  if (rank === 12) return 'Q'
  if (rank === 13) return 'K'
  return String(rank)
}

function isRed(suit: string): boolean {
  return suit === '♥' || suit === '♦'
}

function buildShuffledDeck(): PlayingCard[] {
  const deck: PlayingCard[] = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ rank, suit })
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

function isNaturalStraight(r: number[]): boolean {
  return new Set(r).size === 5 && r[4] - r[0] === 4
}

function evaluateHand(cards: PlayingCard[]): HandResult {
  const ranks       = cards.map(c => c.rank).sort((a, b) => a - b)
  const aceHighRanks = ranks.map(r => r === 1 ? 14 : r).sort((a, b) => a - b)
  const suits       = cards.map(c => c.suit)

  const isFlush     = suits.every(s => s === suits[0])
  const isStraight  = isNaturalStraight(ranks) || isNaturalStraight(aceHighRanks)
  const isRoyal     = isFlush && isNaturalStraight(aceHighRanks) && aceHighRanks[0] === 10

  const rankCounts = new Map<number, number>()
  for (const r of ranks) rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1)
  const counts = [...rankCounts.values()].sort((a, b) => b - a)

  if (isRoyal)                                  return { name: 'Royal Flush',     multiplier: 250 }
  if (isFlush && isStraight)                    return { name: 'Straight Flush',  multiplier: 50  }
  if (counts[0] === 4)                          return { name: 'Four of a Kind',  multiplier: 25  }
  if (counts[0] === 3 && counts[1] === 2)       return { name: 'Full House',      multiplier: 9   }
  if (isFlush)                                  return { name: 'Flush',           multiplier: 6   }
  if (isStraight)                               return { name: 'Straight',        multiplier: 4   }
  if (counts[0] === 3)                          return { name: 'Three of a Kind', multiplier: 3   }
  if (counts[0] === 2 && counts[1] === 2)       return { name: 'Two Pair',        multiplier: 2   }
  if (counts[0] === 2) {
    const pairedRank = [...rankCounts.entries()].find(([, c]) => c === 2)?.[0]
    if (pairedRank === 1 || (pairedRank !== undefined && pairedRank >= 11)) {
      return { name: 'Jacks or Better', multiplier: 1 }
    }
  }
  return { name: 'No Win', multiplier: 0 }
}

function freshDeal(fromDeck: PlayingCard[]): { hand: PlayingCard[]; remaining: PlayingCard[] } {
  return { hand: fromDeck.slice(0, 5), remaining: fromDeck.slice(5) }
}

export function VideoPoker({ onDone }: Props) {
  const initialDeck                = buildShuffledDeck()
  const { hand: h0, remaining: r0 } = freshDeal(initialDeck)

  const [phase, setPhase]           = useState<Phase>('wager')
  const [hand, setHand]             = useState<PlayingCard[]>(h0)
  const [drawDeck, setDrawDeck]     = useState<PlayingCard[]>(r0)
  const [held, setHeld]             = useState<boolean[]>([false, false, false, false, false])
  const [credits, setCredits]       = useState(STARTING_CREDITS - BLIND)
  const [wager, setWager]           = useState(BLIND)
  const [result, setResult]         = useState<HandResult | null>(null)
  const [cashOutTickets, setCashOutTickets] = useState(0)
  const [availCrystals, setAvailCrystals]  = useState(() => loadCrystals())

  function toggleHold(i: number) {
    if (phase !== 'hold') return
    setHeld(prev => prev.map((h, idx) => idx === i ? !h : h))
  }

  const fold = useCallback(() => {
    setResult({ name: 'Fold', multiplier: 0 })
    setPhase('result')
  }, [])

  const playAt = useCallback((n: number) => {
    const extra = n - wager
    setCredits(c => c - extra)
    setWager(n)
    setHeld([false, false, false, false, false])
    setPhase('hold')
  }, [wager])

  function draw() {
    let deckIdx = 0
    const newHand = hand.map((card, i) => held[i] ? card : drawDeck[deckIdx++])
    const handResult = evaluateHand(newHand)
    const win = wager * handResult.multiplier
    setHand(newHand)
    setResult(handResult)
    setCredits(c => c + win)
    setPhase('result')
  }

  function dealAgain() {
    if (credits < BLIND) {
      cashOut()
      return
    }
    const newDeck = buildShuffledDeck()
    const { hand: newHand, remaining } = freshDeal(newDeck)
    setHand(newHand)
    setDrawDeck(remaining)
    setHeld([false, false, false, false, false])
    setResult(null)
    setCredits(c => c - BLIND)
    setWager(BLIND)
    setPhase('wager')
  }

  function cashOut() {
    const tickets = credits * TICKETS_PER_CREDIT
    setCashOutTickets(tickets)
    setPhase('done')
  }

  function buyCredits() {
    if (availCrystals < BUY_COST || credits >= MAX_CREDITS) return
    saveCrystals(availCrystals - BUY_COST)
    setAvailCrystals(c => c - BUY_COST)
    setCredits(c => Math.min(MAX_CREDITS, c + BUY_AMOUNT))
  }

  // ── Done screen ───────────────────────────────────────────────────────────────

  if (phase === 'done') {
    return (
      <div className="minigame-screen">
        <div className="minigame-title">♠ VIDEO POKER</div>
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

  const isWin    = result !== null && result.multiplier > 0
  const canBuy   = phase !== 'done' && credits < MAX_CREDITS && availCrystals >= BUY_COST

  const subtitleText = (() => {
    if (phase === 'wager')  return `Blind paid (${BLIND} credit). Fold or choose your bet.`
    if (phase === 'hold')   return `Wager: ${wager} credit${wager !== 1 ? 's' : ''}. Click cards to hold, then DRAW.`
    if (phase === 'result') return result?.name ?? ''
    return ''
  })()

  return (
    <div className="minigame-screen">
      <div className="minigame-title">♠ VIDEO POKER</div>

      <div className="fm-header">
        <span className="fm-credits">Credits: {credits}</span>
        {phase === 'result' && result && result.multiplier > 0 && (
          <span className="fm-win-flash">+{wager * result.multiplier}!</span>
        )}
        {phase === 'result' && result && result.multiplier === 0 && result.name !== 'Fold' && (
          <span className="fm-no-win">No win</span>
        )}
      </div>

      <div className="vp-subtitle">{subtitleText}</div>

      {/* Hand */}
      <div className="vp-hand">
        {hand.map((card, i) => (
          <div
            key={i}
            className={`vp-card-wrap${held[i] ? ' vp-card-wrap--held' : ''}`}
            onClick={() => toggleHold(i)}
            role="button"
            aria-pressed={held[i]}
          >
            <div className="hol-card hol-card--face-up">
              <span className={`hol-card-rank${isRed(card.suit) ? ' hol-card-red' : ''}`}>
                {rankLabel(card.rank)}
              </span>
              <span className={`hol-card-suit${isRed(card.suit) ? ' hol-card-red' : ''}`}>
                {card.suit}
              </span>
            </div>
            <div className={`vp-hold-badge${held[i] ? ' vp-hold-badge--active' : ''}`}>
              {held[i] ? 'HOLD' : ''}
            </div>
          </div>
        ))}
      </div>

      {/* Wager phase controls */}
      {phase === 'wager' && (
        <div className="vp-controls">
          <button className="action-btn action-btn--danger" onClick={fold}>
            FOLD
          </button>
          <button
            className="action-btn"
            onClick={() => playAt(1)}
            disabled={credits < 0}
          >
            ×1
          </button>
          <button
            className="action-btn"
            onClick={() => playAt(2)}
            disabled={credits < 2 - wager}
          >
            ×2
          </button>
          <button
            className="action-btn action-btn--gold"
            onClick={() => playAt(5)}
            disabled={credits < 5 - wager}
          >
            ×5
          </button>
        </div>
      )}

      {/* Hold phase controls */}
      {phase === 'hold' && (
        <div className="vp-controls">
          <button className="action-btn action-btn--gold action-btn--large" onClick={draw}>
            DRAW
          </button>
        </div>
      )}

      {/* Result phase controls */}
      {phase === 'result' && result && (
        <div className="minigame-result-panel">
          <div className={`vp-result-name${isWin ? ' vp-result-name--win' : ''}`}>
            {result.name}
          </div>
          {isWin && (
            <div className="minigame-result-breakdown">
              <div>{wager} × {result.multiplier} = {wager * result.multiplier} credit{wager * result.multiplier !== 1 ? 's' : ''}</div>
            </div>
          )}
          <div className="vp-controls">
            <button className="action-btn action-btn--gold" onClick={dealAgain}>
              DEAL AGAIN
            </button>
            <button className="action-btn" onClick={cashOut}>
              CASH OUT ({credits * TICKETS_PER_CREDIT} 🎫)
            </button>
          </div>
        </div>
      )}

      {canBuy && (
        <button className="fm-buy-credits" onClick={buyCredits}>
          + Buy {BUY_AMOUNT} credits — {BUY_COST} 💎 (you have {availCrystals})
        </button>
      )}

      {/* Payout reference */}
      <details className="fm-paytable">
        <summary>Payout table (× your wager)</summary>
        <table className="fm-paytable-table">
          <tbody>
            <tr><td>Royal Flush</td><td>250×</td></tr>
            <tr><td>Straight Flush</td><td>50×</td></tr>
            <tr><td>Four of a Kind</td><td>25×</td></tr>
            <tr><td>Full House</td><td>9×</td></tr>
            <tr><td>Flush</td><td>6×</td></tr>
            <tr><td>Straight</td><td>4×</td></tr>
            <tr><td>Three of a Kind</td><td>3×</td></tr>
            <tr><td>Two Pair</td><td>2×</td></tr>
            <tr><td>Jacks or Better</td><td>1×</td></tr>
          </tbody>
        </table>
      </details>
    </div>
  )
}
