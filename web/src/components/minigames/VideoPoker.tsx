// ─── Video Poker ──────────────────────────────────────────────────────────────
// Jacks or Better. Dealt 5 cards, hold any, draw to replace the rest.
// Payout based on the final poker hand.

import React, { useState } from 'react'

interface Props {
  onDone: (ticketsEarned: number) => void
}

interface PlayingCard {
  rank: number  // 1 = Ace, 2–10, 11 = Jack, 12 = Queen, 13 = King
  suit: string  // '♠' | '♥' | '♦' | '♣'
}

interface HandResult {
  name: string
  tickets: number
}

const SUITS = ['♠', '♥', '♦', '♣']

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

function evaluateHand(cards: PlayingCard[]): HandResult {
  const ranks = cards.map(c => c.rank).sort((a, b) => a - b)
  const suits = cards.map(c => c.suit)

  const isFlush = suits.every(s => s === suits[0])
  const allDifferent = new Set(ranks).size === 5
  const normalStraight = allDifferent && ranks[4] - ranks[0] === 4
  const aceHighStraight = JSON.stringify(ranks) === '[1,10,11,12,13]'
  const isStraight = normalStraight || aceHighStraight

  const rankCounts = new Map<number, number>()
  for (const r of ranks) rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1)
  const counts = [...rankCounts.values()].sort((a, b) => b - a)

  if (isFlush && aceHighStraight)              return { name: 'Royal Flush',     tickets: 250 }
  if (isFlush && isStraight)                   return { name: 'Straight Flush',  tickets: 100 }
  if (counts[0] === 4)                         return { name: 'Four of a Kind',  tickets: 50 }
  if (counts[0] === 3 && counts[1] === 2)      return { name: 'Full House',      tickets: 35 }
  if (isFlush)                                 return { name: 'Flush',           tickets: 25 }
  if (isStraight)                              return { name: 'Straight',        tickets: 20 }
  if (counts[0] === 3)                         return { name: 'Three of a Kind', tickets: 15 }
  if (counts[0] === 2 && counts[1] === 2)      return { name: 'Two Pair',        tickets: 10 }
  if (counts[0] === 2) {
    const pairedRank = [...rankCounts.entries()].find(([, c]) => c === 2)?.[0]
    if (pairedRank === 1 || (pairedRank !== undefined && pairedRank >= 11)) {
      return { name: 'Jacks or Better', tickets: 5 }
    }
  }
  return { name: 'No Win', tickets: 0 }
}

function dealHand(deck: PlayingCard[]): { hand: PlayingCard[]; remaining: PlayingCard[] } {
  return { hand: deck.slice(0, 5), remaining: deck.slice(5) }
}

export function VideoPoker({ onDone }: Props) {
  const initialDeck = buildShuffledDeck()
  const { hand: initialHand, remaining: initialRemaining } = dealHand(initialDeck)

  const [hand, setHand]       = useState<PlayingCard[]>(initialHand)
  const [deck, setDeck]       = useState<PlayingCard[]>(initialRemaining)
  const [held, setHeld]       = useState<boolean[]>([false, false, false, false, false])
  const [phase, setPhase]     = useState<'deal' | 'result'>('deal')
  const [result, setResult]   = useState<HandResult | null>(null)

  function toggleHold(i: number) {
    if (phase !== 'deal') return
    setHeld(prev => prev.map((h, idx) => idx === i ? !h : h))
  }

  function draw() {
    let deckIdx = 0
    const newHand = hand.map((card, i) => {
      if (held[i]) return card
      return deck[deckIdx++]
    })
    const handResult = evaluateHand(newHand)
    setHand(newHand)
    setResult(handResult)
    setPhase('result')
  }

  const isWin = result !== null && result.tickets > 0

  return (
    <div className="minigame-screen">
      <div className="minigame-title">♠ VIDEO POKER</div>
      <div className="vp-subtitle">
        {phase === 'deal' ? 'Click cards to hold, then DRAW' : result?.name}
      </div>

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

      {/* Controls */}
      {phase === 'deal' && (
        <div className="vp-controls">
          <button className="action-btn action-btn--gold action-btn--large" onClick={draw}>
            DRAW
          </button>
        </div>
      )}

      {phase === 'result' && result && (
        <div className="minigame-result-panel">
          <div className={`vp-result-name${isWin ? ' vp-result-name--win' : ''}`}>
            {result.name}
          </div>
          <div className="minigame-result-breakdown">
            {isWin
              ? <div className="minigame-result-total">{result.tickets} 🎫</div>
              : <div style={{ color: 'var(--game-text-color-dim)' }}>Better luck next time!</div>
            }
          </div>
          <button className="action-btn action-btn--gold" onClick={() => onDone(result.tickets)}>
            COLLECT &amp; EXIT
          </button>
        </div>
      )}

      {/* Payout reference */}
      <details className="fm-paytable">
        <summary>Payout table</summary>
        <table className="fm-paytable-table">
          <tbody>
            <tr><td>Royal Flush</td><td>250 🎫</td></tr>
            <tr><td>Straight Flush</td><td>100 🎫</td></tr>
            <tr><td>Four of a Kind</td><td>50 🎫</td></tr>
            <tr><td>Full House</td><td>35 🎫</td></tr>
            <tr><td>Flush</td><td>25 🎫</td></tr>
            <tr><td>Straight</td><td>20 🎫</td></tr>
            <tr><td>Three of a Kind</td><td>15 🎫</td></tr>
            <tr><td>Two Pair</td><td>10 🎫</td></tr>
            <tr><td>Jacks or Better</td><td>5 🎫</td></tr>
          </tbody>
        </table>
      </details>
    </div>
  )
}
