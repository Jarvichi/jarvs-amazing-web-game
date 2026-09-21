import React from 'react'
import { Icon } from '../../ui/icons/Icon'

interface Props {
  quickBattleLabel: React.ReactNode
  quickBattleHint?: string
  onQuickBattle: () => void
  endlessHint?: string
  onEndless: () => void
  hubUnlocked?: boolean
  onHub?: () => void
  /** Hidden when the hero button already is the Quick Battle CTA, to avoid
   *  showing it twice (#2306/#2307). */
  showQuickBattle?: boolean
  /** Endless hidden until a campaign run has been completed (#2307). */
  showEndless?: boolean
}

/** Secondary play tier — Quick Battle, Endless, and Hub World when unlocked.
 *  Steps down from the hero action but stays a primary, always-visible mode. */
export function SecondaryPlayRow({ quickBattleLabel, quickBattleHint, onQuickBattle, endlessHint, onEndless, hubUnlocked, onHub, showQuickBattle = true, showEndless = true }: Props) {
  if (!showQuickBattle && !showEndless && !(hubUnlocked && onHub)) return null
  return (
    <div className="title-secondary-row">
      {showQuickBattle && (
        <button type="button" className="title-tier-btn title-tier-btn--secondary" onClick={onQuickBattle} title={quickBattleHint}>
          {quickBattleLabel}
        </button>
      )}
      {showEndless && (
        <button type="button" className="title-tier-btn title-tier-btn--secondary" onClick={onEndless} title={endlessHint}>
          <Icon name="infinity" size={16} /> ENDLESS
        </button>
      )}
      {hubUnlocked && onHub && (
        <button type="button" className="title-tier-btn title-tier-btn--secondary" onClick={onHub}>
          <Icon name="hub" size={16} /> HUB WORLD
        </button>
      )}
    </div>
  )
}
