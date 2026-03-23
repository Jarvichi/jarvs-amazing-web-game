import React, { useEffect, useState } from 'react'
import { fetchEndlessLeaderboard, getEndlessPersonalBest, EndlessLeaderboardEntry } from '../game/dailyChallenge'

interface Props {
  onBack: () => void
}

function formatSurvival(ms: number): string {
  const sec = Math.floor(ms / 1000)
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  return `${min}:${String(rem).padStart(2, '0')}`
}

export function EndlessLeaderboardScreen({ onBack }: Props) {
  const [leaderboard, setLeaderboard] = useState<EndlessLeaderboardEntry[] | null>(null)
  const best = getEndlessPersonalBest()

  useEffect(() => {
    if (!navigator.onLine) { setLeaderboard([]); return }
    fetchEndlessLeaderboard(10)
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]))
  }, [])

  return (
    <div className="el-screen">
      <div className="el-header">
        <div className="el-label">∞ ENDLESS LEADERBOARD</div>
        <div className="el-subtitle">All-time highest waves</div>
      </div>

      {best && (
        <div className="el-personal-best">
          Your best: Wave {best.wave} &nbsp;·&nbsp; {formatSurvival(best.survivalMs)}
        </div>
      )}

      <div className="el-leaderboard">
        {leaderboard === null ? (
          <div className="el-leaderboard-empty">Loading…</div>
        ) : leaderboard.length === 0 ? (
          <div className="el-leaderboard-empty">⏳ No scores yet — be the first!</div>
        ) : (
          <ol className="el-leaderboard-list">
            {leaderboard.map((entry, i) => (
              <li key={entry.uid} className="el-leaderboard-entry">
                <span className="el-lb-rank">{i + 1}.</span>
                <span className="el-lb-name">{entry.characterName}</span>
                <span className="el-lb-wave">Wave {entry.wave}</span>
                <span className="el-lb-time">{formatSurvival(entry.survivalMs)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="el-actions">
        <button className="action-btn" onClick={onBack}>← BACK</button>
      </div>
    </div>
  )
}
