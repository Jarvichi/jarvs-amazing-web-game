import React from 'react'
import { Button } from '../../ui/Button'
import type { BattleEventType } from '../../../game/types'

const EVENT_LABEL: Record<BattleEventType, string> = {
  bloodMoon:   '🌑 BLOOD MOON',
  fogOfWar:    '🌫 FOG OF WAR',
  supplyDrop:  '📦 SUPPLY DROP',
  earthquake:  '🌋 QUAKE',
}

interface RelicChip {
  icon: string
  name: string
  desc: string
}

interface Props {
  timeStr: string
  suddenDeath: boolean
  endlessMode?: boolean
  endlessWave?: number
  endlessTruceSecs: number
  playerScore: number
  opponentScore: number
  eventType: BattleEventType | null
  activeRelic: RelicChip | null
  devMode: boolean
  logAvailable: boolean
  logOpen: boolean
  onToggleLog: () => void
  onPause: () => void
}

/** The always-visible top strip: pause, clock, endless-mode chips, score,
 *  active event/relic chips, dev badge, and the combat-log toggle. */
export function TopBar({ timeStr, suddenDeath, endlessMode, endlessWave, endlessTruceSecs, playerScore, opponentScore, eventType, activeRelic, devMode, logAvailable, logOpen, onToggleLog, onPause }: Props) {
  return (
    <div className={`top-bar${suddenDeath ? ' top-bar--sudden-death' : ''}`}>
      <Button size="xs" className="bf-pause-btn" onClick={onPause} title="Menu">MENU</Button>
      <span className="game-clock">{timeStr}</span>
      {endlessMode && (
        <span className="endless-wave-chip">WAVE {endlessWave ?? 1}</span>
      )}
      {endlessMode && endlessTruceSecs > 0 && (
        <span className="endless-truce-chip">TRUCE {endlessTruceSecs}s</span>
      )}
      <span className="score-display">
        <span className="score-player">{playerScore}</span>
        <span className="score-sep"> – </span>
        <span className="score-opponent">{opponentScore}</span>
      </span>
      {eventType && (
        <span className={`event-status-chip event-status-chip--${eventType}`}>
          {EVENT_LABEL[eventType]}
        </span>
      )}
      {activeRelic && (
        <span className="relic-chip" title={activeRelic.desc}>
          {activeRelic.icon} {activeRelic.name}
        </span>
      )}
      {devMode && (
        <span className="dev-badge">DEV MODE</span>
      )}
      {logAvailable && (
        <Button
          size="xs"
          className={`bf-log-toggle${logOpen ? ' bf-log-toggle--active' : ''}`}
          onClick={onToggleLog}
          title="Battle log"
        >LOG</Button>
      )}
    </div>
  )
}
