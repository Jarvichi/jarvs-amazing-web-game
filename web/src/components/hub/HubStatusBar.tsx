import React from 'react'
import type { User } from 'firebase/auth'
import { Toolbar } from '../ui/Toolbar/Toolbar'
import { ToolbarLabel } from '../ui/Toolbar/ToolbarLabel'
import { ToolbarButton } from '../ui/Toolbar/ToolbarButton'
import { ToolbarSpacer } from '../ui/Toolbar/ToolbarSpacer'
import { ToolbarDropdown } from '../ui/Toolbar/ToolbarDropdown'
import { Icon } from '../ui/icons/Icon'
import { LoginButton } from '../ui/LoginButton'

interface Props {
  townName: string
  /** Real-date-driven festival badge, e.g. "🎪 Harvest Fair", or null. */
  festivalLabel: string | null
  crystals: number
  timeLabel: string
  isNight: boolean
  /** Secret #9 (Wrong Save File) glitch — crystals only; the card-count
   *  version of this glitch went with the card count itself. */
  wrongSaveCrystals: number | null
  onOpenMenu: () => void
  worldMapLocked: boolean
  onWorldMap: () => void
  /** Fires instead of onWorldMap while locked, so a tap always does
   *  something rather than silently nothing on a touchscreen. */
  onWorldMapLocked: () => void
  user: User | null
  playerName: string
  onSignIn?: () => void
  onSignOut?: () => void
  onPlayerTap?: () => void
  onFeedback: () => void
  onSettings: () => void
}

/**
 * The hub's entire header, in one row: town name, economy stats, the clock,
 * and every button — replacing what used to be two separate chrome bands
 * (a PageHeader title row, then a full Toolbar row underneath it).
 *
 * Hub-specific rather than a shared primitive: nothing else in the game wants
 * this exact "town name + stats + nav" combination. If another hub screen
 * needs the same merged-row layout later, that's the point to generalise it.
 */
export function HubStatusBar({
  townName, festivalLabel, crystals, timeLabel, isNight, wrongSaveCrystals,
  onOpenMenu, worldMapLocked, onWorldMap, onWorldMapLocked,
  user, playerName, onSignIn, onSignOut, onPlayerTap, onFeedback, onSettings,
}: Props) {
  const glitching = wrongSaveCrystals != null
  const statClass = `title-deck-info${glitching ? ' title-deck-info--glitch' : ''}`

  const accountMenu = (
    <>
      <LoginButton onSignIn={() => onSignIn?.()} onSignOut={() => onSignOut?.()} onPlayerTap={onPlayerTap} user={user} playerName={playerName} />
      <ToolbarButton className="title-auth-btn" onClick={onFeedback} title="Send feedback or report a bug" icon="🗣️" />
      <ToolbarButton className="action-btn hub-hud__btn" onClick={onSettings} icon="⚙" title="Settings" />
    </>
  )

  return (
    <Toolbar>
      <span className="hub-status-bar__town">
        🏠 {townName}
        {festivalLabel && <span className="hub-status-bar__festival">{festivalLabel}</span>}
      </span>

      <ToolbarLabel className={statClass}>💎 {(glitching ? wrongSaveCrystals! : crystals).toLocaleString()}</ToolbarLabel>
      <ToolbarLabel className="title-deck-info">{isNight ? '🌙' : '☀️'} {timeLabel}</ToolbarLabel>

      <ToolbarButton icon="📋" title="Menu" onClick={onOpenMenu} />
      <ToolbarButton
        icon={worldMapLocked ? '🔒🗺' : '🗺'}
        title={worldMapLocked ? 'World Map — locked' : 'World Map'}
        className={worldMapLocked ? 'hub-status-bar__map-btn--locked' : undefined}
        onClick={worldMapLocked ? onWorldMapLocked : onWorldMap}
      />

      <ToolbarSpacer />
      <div className="toolbar-overflow-inline">
        {accountMenu}
      </div>
      <div className="toolbar-overflow-dropdown">
        <ToolbarDropdown label={<Icon name="player" size={16} aria-label="Account" />} align="right">
          {accountMenu}
        </ToolbarDropdown>
      </div>
    </Toolbar>
  )
}
