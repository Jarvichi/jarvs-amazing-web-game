import React, { useState, useMemo } from 'react'
import { RareEventEffect } from './types'
import { Button } from '../ui/Button'

interface Props {
  onDone: (effect: RareEventEffect) => void
}

type Suit  = '♠' | '♥' | '♦' | '♣'
type Rank  = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
interface PCard { rank: Rank; suit: Suit }

const SUITS: Suit[]  = ['♠', '♥', '♦', '♣']
const RANKS: Rank[]  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']

function buildDeck(): PCard[] {
  const d: PCard[] = []
  for (const suit of SUITS) for (const rank of RANKS) d.push({ rank, suit })
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

function rankVal(rank: Rank): number {
  if (rank === 'A') return 11
  if (['J','Q','K'].includes(rank)) return 10
  return parseInt(rank, 10)
}

function handTotal(hand: PCard[]): number {
  let total = hand.reduce((s, c) => s + rankVal(c.rank), 0)
  let aces  = hand.filter(c => c.rank === 'A').length
  while (total > 21 && aces-- > 0) total -= 10
  return total
}

function isRed(suit: Suit): boolean { return suit === '♥' || suit === '♦' }

function CardDisplay({ card, hidden }: { card: PCard; hidden?: boolean }) {
  if (hidden) return <span className="bj-card bj-card--hidden">?</span>
  return (
    <span className={`bj-card${isRed(card.suit) ? ' bj-card--red' : ''}`}>
      {card.rank}{card.suit}
    </span>
  )
}

type Phase = 'playing' | 'dealer' | 'result'

interface Result {
  label: string
  sub: string
  effect: RareEventEffect
}

function calcResult(playerHand: PCard[], dealerHand: PCard[]): Result {
  const p = handTotal(playerHand)
  const d = handTotal(dealerHand)
  const blackjack = playerHand.length === 2 && p === 21

  if (blackjack) return {
    label: 'BLACKJACK!',
    sub: '"...that never happens." — The Gambler',
    effect: { damage: 40, logMessage: '[GAMBLER] "...that never happens." A debt paid in full.' },
  }
  if (p > 21) return {
    label: 'BUST',
    sub: '"The house always wins, commander." — The Gambler',
    effect: { selfDamage: 15, logMessage: '[GAMBLER] "The house always wins, commander."' },
  }
  if (d > 21 || p > d) return {
    label: 'YOU WIN',
    sub: '"Well played. A deal\'s a deal." — The Gambler',
    effect: { damage: 25, logMessage: '[GAMBLER] "Well played. A deal\'s a deal."' },
  }
  if (p === d) return {
    label: 'PUSH',
    sub: '"We\'ll call it even." — The Gambler',
    effect: { damage: 5, logMessage: '[GAMBLER] "We\'ll call it even. For now."' },
  }
  return {
    label: 'YOU LOSE',
    sub: '"The house always wins, commander." — The Gambler',
    effect: { selfDamage: 15, logMessage: '[GAMBLER] "The house always wins, commander."' },
  }
}

export function BlackjackEvent({ onDone }: Props) {
  const deck = useMemo(() => buildDeck(), [])
  const [drawIndex, setDrawIndex] = useState(4)

  const [playerHand, setPlayerHand] = useState<PCard[]>([deck[0], deck[2]])
  const [dealerHand, setDealerHand] = useState<PCard[]>([deck[1], deck[3]])
  const [phase, setPhase]           = useState<Phase>('playing')
  const [result, setResult]         = useState<Result | null>(null)

  const playerTotal  = handTotal(playerHand)
  const dealerTotal  = phase === 'result' ? handTotal(dealerHand) : handTotal([dealerHand[0]])

  function hit() {
    if (phase !== 'playing') return
    let di = drawIndex
    const newHand = [...playerHand, deck[di++]]
    setDrawIndex(di)
    setPlayerHand(newHand)
    if (handTotal(newHand) > 21) {
      runDealer(newHand, dealerHand, di)
    }
  }

  function stand() {
    if (phase !== 'playing') return
    runDealer(playerHand, dealerHand, drawIndex)
  }

  function runDealer(pHand: PCard[], dHand: PCard[], di: number) {
    setPhase('dealer')
    let hand = [...dHand]
    while (handTotal(hand) < 17) {
      hand = [...hand, deck[di++]]
    }
    setDealerHand(hand)
    const res = calcResult(pHand, hand)
    setResult(res)
    setPhase('result')
  }

  return (
    <div className="bj-backdrop">
      <div className="bj-table">
        <div className="bj-header">
          <span className="bj-title">THE GAMBLER</span>
          <span className="bj-sub">
            {phase === 'playing'
              ? '"I\'ve been waiting for this hand."'
              : phase === 'dealer'
                ? '"Let\'s see what I\'ve got..."'
                : (result?.sub ?? '')}
          </span>
        </div>

        <div className="bj-rows">
          <div className="bj-row">
            <span className="bj-label">DEALER</span>
            <span className="bj-cards">
              <CardDisplay card={dealerHand[0]} />
              {dealerHand.slice(1).map((c, i) =>
                <CardDisplay key={i} card={c} hidden={phase === 'playing'} />
              )}
            </span>
            <span className="bj-total">
              {phase === 'playing' ? `shows ${rankVal(dealerHand[0].rank)}` : `total: ${handTotal(dealerHand)}`}
            </span>
          </div>

          <div className="bj-row bj-row--player">
            <span className="bj-label">YOU</span>
            <span className="bj-cards">
              {playerHand.map((c, i) => <CardDisplay key={i} card={c} />)}
            </span>
            <span className="bj-total">total: {playerTotal}</span>
          </div>
        </div>

        {phase === 'result' && result && (
          <div className={`bj-result bj-result--${result.label.toLowerCase().replace(/[^a-z]/g, '')}`}>
            {result.label}
          </div>
        )}

        <div className="bj-actions">
          {phase === 'playing' && playerTotal < 21 && (
            <>
              <Button onClick={hit}>HIT</Button>
              <Button onClick={stand}>STAND</Button>
            </>
          )}
          {phase === 'result' && result && (
            <Button size="lg" onClick={() => onDone(result.effect)}>
              CONTINUE →
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
