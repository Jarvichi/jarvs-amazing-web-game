import React from 'react'
import { Icon } from '../../ui/icons/Icon'

interface Props {
  onTraining: () => void
  onMiniGames: () => void
}

/** Utility tier — quieter than the play tiers above, these are practice/side
 *  content rather than the game's core modes. */
export function UtilityRow({ onTraining, onMiniGames }: Props) {
  return (
    <div className="title-utility-row">
      <button type="button" className="title-tier-btn title-tier-btn--utility" onClick={onTraining}>
        <Icon name="sword" size={14} /> TRAINING
      </button>
      <button type="button" className="title-tier-btn title-tier-btn--utility" onClick={onMiniGames}>
        <Icon name="minigames" size={14} /> MINI GAMES
      </button>
    </div>
  )
}
