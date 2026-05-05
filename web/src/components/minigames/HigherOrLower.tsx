// ─── Higher or Lower ──────────────────────────────────────────────────────────
// 5 cards are dealt. The first is revealed. Guess whether each next card is
// higher or lower than the previous one. Get all 4 right for the jackpot!
// Ties always count as a loss.

import React, { useState } from 'react'
import { playMinigameCorrect, playMinigameWrong } from '../../game/sound'

interface Props {
  onDone: (ticketsEarned: number) => void
}

interface PlayingCard {
  rank: number  // 1 (Ace) through 13 (King)
  suit: string  // '♠' | '♥' | '♦' | '♣'
}

const SUITS = ['♠', '♥', '♦', '♣']
const REWARDS = [0, 5, 12, 25, 50]  // tickets for 0–4 correct guesses
const PERFECT_BONUS = 10             // extra tickets for all 4 correct

function rankLabel(rank: number): string {
  if (rank === 1)  return 'A'
  if (rank === 11) return 'J'
  if (rank === 12) return 'Q'
  if (rank === 13) return 'K'
  return String(rank)
}

function buildDeck(): PlayingCard[] {
  const deck: PlayingCard[] = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ rank, suit })
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck.slice(0, 5)
}

export function HigherOrLower({ onDone }: Props) {
  const [cards]                   = useState<PlayingCard[]>(() => buildDeck())
  const [revealed, setRevealed]   = useState(1)     // index of next card to guess (first card already shown)
  const [phase, setPhase]         = useState<'playing' | 'won' | 'lost'>('playing')
  const [tickets, setTickets]     = useState(0)
  const [feedback, setFeedback]   = useState<'correct' | 'wrong' | null>(null)

  function guess(direction: 'higher' | 'lower') {
    if (phase !== 'playing') return
    const prev = cards[revealed - 1]
    const next = cards[revealed]
    const correct =
      direction === 'higher' ? next.rank > prev.rank :
      direction === 'lower'  ? next.rank < prev.rank :
      false

    const newRevealed = revealed + 1
    setRevealed(newRevealed)

    if (!correct) {
      playMinigameWrong()
      setFeedback('wrong')
      setPhase('lost')
      return
    }

    playMinigameCorrect()
    setFeedback('correct')
    setTimeout(() => setFeedback(null), 600)

    const earned = REWARDS[newRevealed - 1] ?? 0
    setTickets(earned)

    if (newRevealed === 5) {
      // All 4 guesses correct
      const total = REWARDS[4] + PERFECT_BONUS
      setTickets(total)
      setPhase('won')
    }
  }

  const isRed = (suit: string) => suit === '♥' || suit === '♦'

  return (
    <div className="minigame-screen">
      <div className="minigame-title">🎴 HIGHER OR LOWER</div>

      <div className="hol-cards-row">
        {cards.map((card, i) => {
          const faceUp = i < revealed
          return (
            <div
              key={i}
              className={`hol-card${faceUp ? ' hol-card--face-up' : ' hol-card--face-down'}${
                faceUp && i === revealed - 1 ? ' hol-card--current' : ''
              }`}
            >
              {faceUp ? (
                <>
                  <span className={`hol-card-rank${isRed(card.suit) ? ' hol-card-red' : ''}`}>
                    {rankLabel(card.rank)}
                  </span>
                  <span className={`hol-card-suit${isRed(card.suit) ? ' hol-card-red' : ''}`}>
                    {card.suit}
                  </span>
                </>
              ) : (
                <span className="hol-card-back">?</span>
              )}
            </div>
          )
        })}
      </div>

      {feedback && (
        <div className={`hol-feedback${feedback === 'correct' ? ' hol-feedback--correct' : ' hol-feedback--wrong'}`}>
          {feedback === 'correct' ? '✓ Correct!' : '✗ Wrong!'}
        </div>
      )}

      {phase === 'playing' && (
        <div className="hol-buttons">
          <button className="action-btn action-btn--large" onClick={() => guess('higher')}>
            ▲ HIGHER
          </button>
          <button className="action-btn action-btn--large" onClick={() => guess('lower')}>
            ▼ LOWER
          </button>
        </div>
      )}

      {(phase === 'won' || phase === 'lost') && (
        <div className="minigame-result-panel">
          <div className="minigame-result-headline">
            {phase === 'won' ? '🎉 JACKPOT!' : 'Bad luck!'}
          </div>
          <div className="minigame-result-breakdown">
            {phase === 'won' ? (
              <>
                <div>4 correct guesses: +{REWARDS[4]} 🎫</div>
                <div>Perfect bonus: +{PERFECT_BONUS} 🎫</div>
                <div className="minigame-result-total">Total: {tickets} 🎫</div>
              </>
            ) : (
              <>
                {tickets > 0
                  ? <div>{revealed - 1} correct {revealed - 1 === 1 ? 'guess' : 'guesses'}: +{tickets} 🎫</div>
                  : <div>No correct guesses.</div>
                }
                <div className="minigame-result-total">Total: {tickets} 🎫</div>
              </>
            )}
          </div>
          <button className="action-btn action-btn--gold" onClick={() => onDone(tickets)}>
            COLLECT &amp; EXIT
          </button>
        </div>
      )}

      <div className="hol-progress">
        {phase === 'playing'
          ? `Card ${revealed} of 5 — guess ${revealed} of 4`
          : phase === 'won'
          ? 'All 4 correct!'
          : `Out on card ${revealed} of 5`
        }
      </div>
    </div>
  )
}
