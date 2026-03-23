import React, { useEffect, useState } from 'react'
import { fetchEndlessLeaderboard, getEndlessPersonalBest, EndlessLeaderboardEntry, fetchDailyLeaderboard, LeaderboardEntry } from '../game/dailyChallenge'

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
  const [endlessLb, setEndlessLb] = useState<EndlessLeaderboardEntry[] | null>(null)
  const [dailyLb, setDailyLb] = useState<LeaderboardEntry[] | null>(null)
  const best = getEndlessPersonalBest()

  useEffect(() => {
    if (!navigator.onLine) { setEndlessLb([]); setDailyLb([]); return }
    fetchEndlessLeaderboard(10).then(setEndlessLb).catch(() => setEndlessLb([]))
    fetchDailyLeaderboard(5).then(setDailyLb).catch(() => setDailyLb([]))
  }, [])

  return (
    <div className="el-screen">
      <div className="el-header">
        <div className="el-label">🏆 LEADERBOARDS</div>
      </div>

      <div className="el-section">
        <div className="el-section-title">📅 DAILY CHALLENGE</div>
        <div className="el-subtitle">Today's top players</div>
        <div className="el-leaderboard">
          {dailyLb === null ? (
            <div className="el-leaderboard-empty">Loading…</div>
          ) : dailyLb.length === 0 ? (
            <div className="el-leaderboard-empty">⏳ No scores yet today</div>
          ) : (
            <ol className="el-leaderboard-list">
              {dailyLb.map((entry, i) => (
                <li key={entry.uid} className="el-leaderboard-entry">
                  <span className="el-lb-rank">{i + 1}.</span>
                  <span className="el-lb-name">{entry.characterName}</span>
                  <span className="el-lb-wave">
                    {entry.attempts === 1 ? '1 attempt' : `${entry.attempts} attempts`}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="el-section">
        <div className="el-section-title">∞ ENDLESS MODE</div>
        <div className="el-subtitle">All-time highest waves</div>

        {best && (
          <div className="el-personal-best">
            Your best: Wave {best.wave} &nbsp;·&nbsp; {formatSurvival(best.survivalMs)}
          </div>
        )}

        <div className="el-leaderboard">
          {endlessLb === null ? (
            <div className="el-leaderboard-empty">Loading…</div>
          ) : endlessLb.length === 0 ? (
            <div className="el-leaderboard-empty">⏳ No scores yet — be the first!</div>
          ) : (
            <ol className="el-leaderboard-list">
              {endlessLb.map((entry, i) => (
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
      </div>

      <div className="el-actions">
        <button className="action-btn" onClick={onBack}>← BACK</button>
      </div>
    </div>
  )
}
