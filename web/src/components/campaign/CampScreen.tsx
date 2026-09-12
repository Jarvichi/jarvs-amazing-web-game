import React from 'react'
import { NodeScreen } from './node/NodeScreen'
import { Button } from '../ui/Button'

export type CampChoice = 'heal' | 'rest' | 'meditate'

interface Props {
  playerHp: number
  maxHp: number
  livesRemaining: number
  maxLives: number
  fatiguedCards: string[]
  healAmount: number
  onChoose: (choice: CampChoice) => void
  result: string | null
  onContinue: () => void
}

export function CampScreen({
  playerHp,
  maxHp,
  livesRemaining,
  maxLives,
  fatiguedCards,
  healAmount,
  onChoose,
  result,
  onContinue,
}: Props) {
  const atMaxHp = playerHp >= maxHp
  const atMaxLives = livesRemaining >= maxLives
  const hasRestingCards = fatiguedCards.length > 0
  const stats = { hp: playerHp, maxHp, lives: livesRemaining, maxLives }

  if (result) {
    return (
      <NodeScreen title="CAMP" stats={stats} actions={<Button size="lg" onClick={onContinue}>CONTINUE</Button>}>
        <div className="camp-result">
          <div className="camp-result-message">{result}</div>
        </div>
      </NodeScreen>
    )
  }

  return (
    <NodeScreen title="CAMP" stats={stats}>
      <div className="camp-header u-text-c">
        <div className="camp-sub">Rest your weary troops. Choose wisely.</div>
        {fatiguedCards.length > 0 && <div className="camp-stats">Resting: {fatiguedCards.join(', ')}</div>}
      </div>

      <div className="camp-choices u-col">
        <Button className="camp-choice" onClick={() => onChoose('heal')}>
          <div className="camp-choice-icon">⛺</div>
          <div className="camp-choice-name">HEAL</div>
          <div className="camp-choice-desc">
            {atMaxHp
              ? `You're already at full health — gain +${healAmount} bonus HP above your maximum.`
              : `Restore ${healAmount} HP. (${playerHp} → ${Math.min(playerHp + healAmount, maxHp)})`}
          </div>
        </Button>

        <Button
          className="camp-choice"
          onClick={() => onChoose('rest')}
          disabled={!hasRestingCards}
          title={!hasRestingCards ? 'No resting cards to recover' : undefined}
        >
          <div className="camp-choice-icon">💤</div>
          <div className="camp-choice-name">REST</div>
          <div className="camp-choice-desc">
            {hasRestingCards
              ? '50% chance to recover one of your resting cards and return it to the deck.'
              : 'No cards are currently resting — nothing to recover.'}
          </div>
        </Button>

        <Button
          className="camp-choice"
          onClick={() => onChoose('meditate')}
          disabled={atMaxLives}
          title={atMaxLives ? 'Already at maximum lives' : undefined}
        >
          <div className="camp-choice-icon">🧘</div>
          <div className="camp-choice-name">MEDITATE</div>
          <div className="camp-choice-desc">
            {atMaxLives
              ? 'You are already at maximum lives.'
              : '50% chance to gain an extra life.'}
          </div>
        </Button>
      </div>
    </NodeScreen>
  )
}
