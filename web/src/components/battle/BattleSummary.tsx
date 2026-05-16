import React from 'react'
import { BattleStats } from '../../game/types'
import { StatRow } from '../ui/StatRow'

interface Props {
  stats: BattleStats
  gameTime: number       // ms elapsed
  playerScore: number    // cumulative damage dealt to opponent base
  onContinue: () => void
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

export function BattleSummary({ stats, gameTime, playerScore, onContinue }: Props) {
  // Sort cards played: descending by count, take top 5
  const topCards = Object.entries(stats.cardsPlayed)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  const totalCards = Object.values(stats.cardsPlayed).reduce((a, b) => a + b, 0)

  return (
    <div className="bsummary-backdrop">
      <div className="bsummary-panel">
        <div className="bsummary-title">— BATTLE COMPLETE —</div>

        <div className="bsummary-stats u-col u-gap-3">
          <StatRow accent label="UNITS DEFEATED" value={stats.playerKills} />
          <StatRow accent label="UNITS LOST"     value={stats.playerUnitsLost} />
          <StatRow accent label="DAMAGE DEALT"   value={playerScore} />
          <StatRow accent label="DURATION"       value={formatDuration(gameTime)} />
          <StatRow accent label="CARDS PLAYED"   value={totalCards} />
        </div>

        {topCards.length > 0 && (
          <div className="bsummary-cards u-col u-gap-2">
            <div className="bsummary-cards-label">TOP CARDS</div>
            {topCards.map(([name, count]) => (
              <div key={name} className="bsummary-card-row u-flex u-just-sb">
                <span className="bsummary-card-name">{name}</span>
                <span className="bsummary-card-count">×{count}</span>
              </div>
            ))}
          </div>
        )}

        <button className="action-btn action-btn--large bsummary-continue" onClick={onContinue}>
          CLAIM REWARD →
        </button>
      </div>
    </div>
  )
}
