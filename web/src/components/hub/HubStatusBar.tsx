import React from 'react'
import type { User } from 'firebase/auth'
import { WEATHER_READOUT, type WeatherType } from '../../game/hub/weather'
import { Toolbar } from '../ui/Toolbar/Toolbar'
import { ToolbarButton } from '../ui/Toolbar/ToolbarButton'
import { ToolbarSpacer } from '../ui/Toolbar/ToolbarSpacer'
import { ToolbarAccountMenu } from '../ui/Toolbar/ToolbarAccountMenu'

interface Props {
  townName: string
  /** Real-date-driven festival badge, e.g. "🎪 Harvest Fair", or null. */
  festivalLabel: string | null
  crystals: number
  timeLabel: string
  isNight: boolean
  /** The town's current weather. Anything but 'clear' shows as a readout;
   *  see WEATHER_READOUT for why 'clear' shows nothing. */
  weather: WeatherType
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
  townName, festivalLabel, crystals, timeLabel, isNight, weather, wrongSaveCrystals,
  onOpenMenu, worldMapLocked, onWorldMap, onWorldMapLocked,
  user, playerName, onSignIn, onSignOut, onPlayerTap, onFeedback, onSettings,
}: Props) {
  const glitching = wrongSaveCrystals != null
  const weatherReadout = WEATHER_READOUT[weather]

  return (
    <Toolbar>
      <span className="hub-status-bar__town">
        🏠 {townName}
        {festivalLabel && <span className="hub-status-bar__festival">{festivalLabel}</span>}
      </span>

      {/* Readouts, grouped into one recessed panel. They used to sit loose in
          the row, immediately beside the buttons and styled much like them,
          which left no cue as to which parts of the bar you could press. */}
      <div className="hub-status-bar__stats">
        <span className={`hub-status-bar__stat${glitching ? ' title-deck-info--glitch' : ''}`}>
          <span aria-hidden="true">💎</span>
          {(glitching ? wrongSaveCrystals! : crystals).toLocaleString()}
        </span>
        <span className="hub-status-bar__stat">
          <span aria-hidden="true">{isNight ? '🌙' : '☀️'}</span>
          {timeLabel}
        </span>
        {weatherReadout && (
          <span className="hub-status-bar__stat">
            <span aria-hidden="true">{weatherReadout.glyph}</span>
            <span className="hub-status-bar__stat-label">{weatherReadout.label}</span>
          </span>
        )}
      </div>

      <ToolbarButton icon="📋" title="Menu" onClick={onOpenMenu} />
      <ToolbarButton
        icon={worldMapLocked ? '🔒🗺' : '🗺'}
        title={worldMapLocked ? 'World Map — locked' : 'World Map'}
        className={worldMapLocked ? 'hub-status-bar__map-btn--locked' : undefined}
        onClick={worldMapLocked ? onWorldMapLocked : onWorldMap}
      />

      <ToolbarSpacer />
      <ToolbarAccountMenu
        user={user}
        playerName={playerName}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        onPlayerTap={onPlayerTap}
        onFeedback={onFeedback}
        onSettings={onSettings}
      />
    </Toolbar>
  )
}
