import React from 'react'
import { StatRow } from '../ui/StatRow'

interface Props {
  playerScore: number
  opponentScore: number
  playerBaseHp: number
  playerBaseMaxHp: number
  unitsDefeated: number
  gameTime: number
  onContinue: () => void
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

export function VictoryPanel({ playerScore, opponentScore, playerBaseHp, playerBaseMaxHp, unitsDefeated, gameTime, onContinue }: Props) {
  return (
    <div className="bsummary-backdrop">
      <div className="bsummary-panel vpanel u-text-c u-items-c">
        <div className="victory-text vpanel-headline">YOU WIN!</div>

        <div className="bsummary-stats u-col u-gap-3">
          <StatRow accent label="SCORE"          value={`${playerScore} — ${opponentScore}`} />
          <StatRow accent label="BASE HP"        value={`${playerBaseHp} / ${playerBaseMaxHp}`} />
          <StatRow accent label="UNITS DEFEATED" value={unitsDefeated} />
          <StatRow accent label="TIME"           value={formatTime(gameTime)} />
        </div>

        <button className="action-btn action-btn--large bsummary-continue" onClick={onContinue}>
          Continue →
        </button>
      </div>
    </div>
  )
}
