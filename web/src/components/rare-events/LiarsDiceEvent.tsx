import React, { useState, useMemo } from 'react'
import { RareEventEffect } from './types'

interface Props {
  onDone: (effect: RareEventEffect) => void
}

const DICE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅']

function rollDice(n: number): number[] {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 6) + 1)
}

function countFace(dice: number[], face: number): number {
  return dice.filter(d => d === face).length
}

interface Bid { qty: number; face: number }

// Stranger's AI: makes a reasonable opening bid based on their actual dice
function makeBid(strangDice: number[]): Bid {
  // Find the face with the most dice, bid conservatively
  let bestFace = 1, bestCount = 0
  for (let f = 1; f <= 6; f++) {
    const c = countFace(strangDice, f)
    if (c > bestCount) { bestCount = c; bestFace = f }
  }
  // Bid conservatively: actual count, or at least 1
  return { qty: Math.max(1, bestCount), face: bestFace }
}

// Is the stranger's bid a lie given all dice?
function isLie(bid: Bid, allDice: number[]): boolean {
  return countFace(allDice, bid.face) < bid.qty
}

type Phase = 'intro' | 'bidding' | 'challenge' | 'reveal' | 'result'

export function LiarsDiceEvent({ onDone }: Props) {
  const playerDice   = useMemo(() => rollDice(5), [])
  const strangerDice = useMemo(() => rollDice(5), [])
  const strangerBid  = useMemo(() => makeBid(strangerDice), [strangerDice])
  const allDice      = useMemo(() => [...playerDice, ...strangerDice], [playerDice, strangerDice])

  const [phase, setPhase] = useState<Phase>('intro')
  const [playerChallenged, setPlayerChallenged] = useState(false)
  const [playerRaisedBid, setPlayerRaisedBid]   = useState<Bid | null>(null)
  const [strangerCalledLiar, setStrangerCalledLiar] = useState(false)

  function handleCallLiar() {
    // Player calls the stranger's bid a lie
    setPlayerChallenged(true)
    setPhase('reveal')
  }

  function handleRaise() {
    // Player raises: add 1 to the quantity
    const raised: Bid = { qty: strangerBid.qty + 1, face: strangerBid.face }
    setPlayerRaisedBid(raised)
    // Stranger responds: if player's raised bid is also a lie, stranger calls liar
    const playerBidIsLie = isLie(raised, allDice)
    if (playerBidIsLie || Math.random() < 0.6) {
      setStrangerCalledLiar(true)
    }
    setPhase('challenge')
  }

  function finaliseResult() {
    setPhase('result')
  }

  const strangerBidIsLie = isLie(strangerBid, allDice)
  const playerBidIsLie   = playerRaisedBid ? isLie(playerRaisedBid, allDice) : false

  // Determine win/lose
  let playerWon = false
  if (playerChallenged) {
    playerWon = strangerBidIsLie  // Player called liar on stranger
  } else if (strangerCalledLiar && playerRaisedBid) {
    playerWon = !playerBidIsLie   // Stranger called liar on player, player wins if their bid was true
  }

  const winEffect: RareEventEffect = {
    damage: 20,
    logMessage: '[STRANGER] "You\'ve got sharp eyes, commander." A debt paid.',
  }
  const loseEffect: RareEventEffect = {
    selfDamage: 12,
    logMessage: '[STRANGER] "Liar\'s dice is a game of nerve. You lacked nerve."',
  }

  return (
    <div className="ld-backdrop">
      <div className="ld-panel">
        <div className="ld-header">
          <span className="ld-title">LIAR'S DICE</span>
          <span className="ld-sub">
            {phase === 'intro' ? 'A stranger steps forward, rattling a cup of dice.' :
             phase === 'bidding' ? '"Five dice each. I\'ll open the bidding."' :
             phase === 'challenge' ? (strangerCalledLiar ? '"Liar!" — The Stranger' : '"Your move, commander."') :
             phase === 'reveal' ? 'Revealing all dice...' :
             playerWon ? '"...well played." — The Stranger' : '"Better luck next time, commander."'}
          </span>
        </div>

        <div className="ld-dice-row">
          <div className="ld-dice-col">
            <div className="ld-dice-label">YOUR DICE</div>
            <div className="ld-dice">
              {playerDice.map((d, i) => (
                <span key={i} className="ld-die">{DICE_FACES[d - 1]}</span>
              ))}
            </div>
          </div>
          <div className="ld-dice-col">
            <div className="ld-dice-label">STRANGER</div>
            <div className="ld-dice">
              {strangerDice.map((d, i) => (
                <span key={i} className="ld-die">
                  {phase === 'reveal' || phase === 'result' ? DICE_FACES[d - 1] : '▓'}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bidding phase */}
        {phase === 'intro' && (
          <div className="ld-bid-box">
            <button className="action-btn action-btn--large" onClick={() => setPhase('bidding')}>
              ROLL THE DICE →
            </button>
          </div>
        )}

        {phase === 'bidding' && (
          <div className="ld-bid-box">
            <div className="ld-bid-text">
              Stranger bids: <strong>at least {strangerBid.qty} × {DICE_FACES[strangerBid.face - 1]}</strong>
            </div>
            <div className="ld-bid-actions">
              <button className="action-btn" onClick={handleCallLiar}>
                CALL LIAR
              </button>
              <button className="action-btn" onClick={handleRaise}>
                RAISE ({strangerBid.qty + 1} × {DICE_FACES[strangerBid.face - 1]})
              </button>
            </div>
          </div>
        )}

        {phase === 'challenge' && (
          <div className="ld-bid-box">
            {strangerCalledLiar ? (
              <>
                <div className="ld-bid-text">
                  You bid: <strong>{playerRaisedBid!.qty} × {DICE_FACES[playerRaisedBid!.face - 1]}</strong>
                  {' '}— stranger calls LIAR!
                </div>
                <button className="action-btn action-btn--large" onClick={finaliseResult}>
                  REVEAL →
                </button>
              </>
            ) : (
              <>
                <div className="ld-bid-text">
                  You bid: <strong>{playerRaisedBid!.qty} × {DICE_FACES[playerRaisedBid!.face - 1]}</strong>
                  {' '}— stranger backs down.
                </div>
                <button className="action-btn action-btn--large" onClick={finaliseResult}>
                  REVEAL →
                </button>
              </>
            )}
          </div>
        )}

        {phase === 'reveal' && (
          <div className="ld-bid-box">
            <div className="ld-bid-text">
              {DICE_FACES[strangerBid.face - 1]} appears{' '}
              <strong>{countFace(allDice, strangerBid.face)} times</strong> across all dice.
              {' '}Stranger bid {strangerBid.qty}.
              {strangerBidIsLie ? ' That was a LIE.' : ' That was TRUE.'}
            </div>
            <button className="action-btn action-btn--large" onClick={finaliseResult}>
              {strangerBidIsLie ? 'COLLECT YOUR WINNINGS →' : 'PAY UP →'}
            </button>
          </div>
        )}

        {phase === 'result' && (
          <div className="ld-bid-box">
            <div className={`ld-result${playerWon ? ' ld-result--win' : ' ld-result--lose u-text-red'}`}>
              {playerWon ? 'YOU WIN' : 'YOU LOSE'}
            </div>
            <div className="ld-bid-text">
              {playerWon
                ? '25 damage dealt to enemy base.'
                : '12 damage dealt to your base.'}
            </div>
            <button
              className="action-btn action-btn--large"
              onClick={() => onDone(playerWon ? winEffect : loseEffect)}
            >
              CONTINUE →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
