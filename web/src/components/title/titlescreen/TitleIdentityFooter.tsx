import React from 'react'
import { type User } from 'firebase/auth'
import { Icon } from '../../ui/icons/Icon'
import { LoginButton } from '../../ui/LoginButton'
import { Button } from '../../ui/Button'

interface Props {
  playerName: string
  bestStreak: number
  cardsLabel: string
  crystalsLabel: string
  deckLabel: string
  glitch: boolean
  user: User | null
  onSignIn: () => void
  onSignOut: () => void
  onFeedback: () => void
}

/** Player identity + progress, given a proper home instead of one cramped
 *  dim line — name and best streak up top, collection/currency/deck stats
 *  below, then the auth row. */
export function TitleIdentityFooter({ playerName, bestStreak, cardsLabel, crystalsLabel, deckLabel, glitch, user, onSignIn, onSignOut, onFeedback }: Props) {
  return (
    <div className="title-footer u-col u-items-c u-gap-2 u-relative">
      <div className="title-identity">
        <span className="title-identity-name">{playerName}</span>
        {bestStreak > 1 && (
          <span className="title-identity-streak">🏆 {bestStreak} best streak</span>
        )}
      </div>
      <div className={`title-deck-info${glitch ? ' title-deck-info--glitch' : ''}`}>
        {cardsLabel} cards &nbsp;·&nbsp; <Icon name="crystal" size={12} /> {crystalsLabel} &nbsp;·&nbsp; Deck: {deckLabel}
      </div>
      <div className="title-auth-bar u-flex u-items-c u-gap-5">
        <LoginButton onSignIn={onSignIn} onSignOut={onSignOut} user={user} playerName={playerName} />
        <Button
          className="title-auth-btn"
          onClick={onFeedback}
          title="Send feedback or report a bug"
        >🗣️ Feedback</Button>
      </div>
    </div>
  )
}
