import React from 'react'
import { Icon } from '../../ui/icons/Icon'

interface Props {
  onTraining: () => void
  onMiniGames: () => void
  /** Mini Games hidden until 5 battles played (#2307). */
  showMiniGames?: boolean
}

/** Utility tier — quieter than the play tiers above, these are practice/side
 *  content rather than the game's core modes. ARCADE is a plain link: the
 *  arcade games are separate pages (jawg.uk/arcade), not screens of this app. */
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
      <a href="/arcade" className="title-tier-btn title-tier-btn--utility">
        <Icon name="arcade" size={14} /> ARCADE
      </a>
    </div>
  )
}
