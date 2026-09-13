import React from 'react'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/icons/Icon'

interface Props {
  /** Per-game glyph — content, not a shared concept, so this stays a plain
   *  emoji rather than the sprite icon set (#2321). */
  icon: string
  name: string
  description: string
  cost: number
  locked: boolean
  best: number
  challengeDone: boolean
  challengeTarget: number
  challengeBonusTickets: number
  onPlay: () => void
}

/** One tile in the mini-games grid. Not a fit for the satchel's `ItemTile`
 *  (a bare glyph+count square) or `ActionCard` (explicitly capped at ~3 per
 *  screen) — this needs its own cost/best-score/daily-challenge slots and
 *  the grid always shows all eleven games at once. */
export function MinigameCard({ icon, name, description, cost, locked, best, challengeDone, challengeTarget, challengeBonusTickets, onPlay }: Props) {
  return (
    <div className={`minigame-card u-col u-items-c u-gap-3 u-text-c${locked ? ' minigame-card--locked' : ''}`}>
      <div className="minigame-card-icon">{icon}</div>
      <div className="minigame-card-name">{name}</div>
      <div className="minigame-card-desc">{description}</div>
      <div className="minigame-card-meta u-flex u-gap-6">
        <span className="minigame-card-cost"><Icon name="crystal" size={12} /> {cost}</span>
        {best > 0 && <span className="minigame-card-best">Best: {best} 🎫</span>}
      </div>
      <div className={`minigame-card-challenge${challengeDone ? ' minigame-card-challenge--done' : ''}`}>
        {challengeDone
          ? '✅ Today\'s challenge complete!'
          : `🎯 Beat ${challengeTarget} for +${challengeBonusTickets} 🎫`}
      </div>
      <Button
        variant={locked ? 'default' : 'gold'}
        onClick={onPlay}
        disabled={locked}
        title={locked ? `Need ${cost} crystals to play` : undefined}
      >
        {locked ? <>NEED {cost} <Icon name="crystal" size={13} /></> : 'PLAY'}
      </Button>
    </div>
  )
}
