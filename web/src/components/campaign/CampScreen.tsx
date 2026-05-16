import React from 'react'

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

  if (result) {
    return (
      <div className="overlay-screen camp-screen">
        <div className="camp-header u-text-c">
          <div className="camp-title">— CAMP —</div>
          <div className="camp-stats u-flex u-gap-8 u-just-c">
            <span>HP: {playerHp}/{maxHp}</span>
            <span>Lives: {livesRemaining}/{maxLives}</span>
          </div>
        </div>
        <div className="camp-result">
          <div className="camp-result-message">{result}</div>
          <button className="camp-continue" onClick={onContinue}>CONTINUE</button>
        </div>
      </div>
    )
  }

  return (
    <div className="overlay-screen camp-screen">
      <div className="camp-header u-text-c">
        <div className="camp-title">— CAMP —</div>
        <div className="camp-sub">Rest your weary troops. Choose wisely.</div>
        <div className="camp-stats u-flex u-gap-8 u-just-c">
          <span>HP: {playerHp}/{maxHp}</span>
          <span>Lives: {livesRemaining}/{maxLives}</span>
          {fatiguedCards.length > 0 && <span>Resting: {fatiguedCards.join(', ')}</span>}
        </div>
      </div>

      <div className="camp-choices u-col">
        <button className="camp-choice" onClick={() => onChoose('heal')}>
          <div className="camp-choice-icon">⛺</div>
          <div className="camp-choice-name">HEAL</div>
          <div className="camp-choice-desc">
            {atMaxHp
              ? `You're already at full health — gain +${healAmount} bonus HP above your maximum.`
              : `Restore ${healAmount} HP. (${playerHp} → ${Math.min(playerHp + healAmount, maxHp)})`}
          </div>
        </button>

        <button
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
        </button>

        <button
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
        </button>
      </div>
    </div>
  )
}
