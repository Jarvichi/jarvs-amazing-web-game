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
}

/** Secondary play tier — Quick Battle, Endless, and Hub World when unlocked.
 *  Steps down from the hero action but stays a primary, always-visible mode. */
export function SecondaryPlayRow({ quickBattleLabel, quickBattleHint, onQuickBattle, endlessHint, onEndless, hubUnlocked, onHub }: Props) {
  return (
    <div className="title-secondary-row">
      <button type="button" className="title-tier-btn title-tier-btn--secondary" onClick={onQuickBattle} title={quickBattleHint}>
        {quickBattleLabel}
      </button>
      <button type="button" className="title-tier-btn title-tier-btn--secondary" onClick={onEndless} title={endlessHint}>
        <Icon name="infinity" size={16} /> ENDLESS
      </button>
      {hubUnlocked && onHub && (
        <button type="button" className="title-tier-btn title-tier-btn--secondary" onClick={onHub}>
          <Icon name="hub" size={16} /> HUB WORLD
        </button>
      )}
    </div>
  )
}
