import React from 'react'
import { Icon } from '../../ui/icons/Icon'

interface Props {
  onTraining: () => void
  onMiniGames: () => void
  /** Mini Games hidden until 5 battles played (#2307). */
  showMiniGames?: boolean
}

/** Utility tier — quieter than the play tiers above, these are practice/side
 *  content rather than the game's core modes. */
export function UtilityRow({ onTraining, onMiniGames, showMiniGames = true }: Props) {
  return (
    <div className="title-utility-row">
      <button type="button" className="title-tier-btn title-tier-btn--utility" onClick={onTraining}>
        <Icon name="sword" size={14} /> TRAINING
      </button>
      {showMiniGames && (
        <button type="button" className="title-tier-btn title-tier-btn--utility" onClick={onMiniGames}>
          <Icon name="minigames" size={14} /> MINI GAMES
        </button>
      )}
    </div>
  )
}
