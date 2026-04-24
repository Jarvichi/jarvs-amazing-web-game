import React from 'react'

interface Props {
  onStartBattle: (mode: 'normal' | 'easy') => void
  onBack: () => void
}

export function QuickBattleScreen({ onStartBattle, onBack }: Props) {
  return (
    <div className="qb-screen">
      <div className="qb-header">
        <div className="qb-title">⚔  QUICK BATTLE</div>
        <div className="qb-subtitle">Choose your difficulty</div>
      </div>

      <div className="qb-options">
        <div className="qb-option">
          <div className="qb-option-name">Normal</div>
          <div className="qb-option-desc">
            <p>Opponent builds their deck from cards you own.</p>
            <p>Reward: standard card pack (5 cards).</p>
          </div>
          <button className="action-btn action-btn--large" onClick={() => onStartBattle('normal')}>
            ▶  PLAY NORMAL
          </button>
        </div>

        <div className="qb-option qb-option--easy">
          <div className="qb-option-name">Mirror Deck</div>
          <div className="qb-option-desc">
            <p>Opponent uses a copy of your own deck.</p>
            <p>Reward: standard card pack (5 cards).</p>
          </div>
          <button className="action-btn" onClick={() => onStartBattle('easy')}>
            ▶  PLAY EASY
          </button>
        </div>
      </div>

      <button className="action-btn action-btn--danger" onClick={onBack}>← BACK</button>
    </div>
  )
}
