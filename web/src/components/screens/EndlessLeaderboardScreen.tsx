import React, { useEffect, useState } from 'react'
import { fetchEndlessLeaderboard, fetchTodaysEndlessLeaderboard, getEndlessPersonalBest, EndlessLeaderboardEntry, fetchDailyLeaderboard, LeaderboardEntry } from '../../game/dailyChallenge'

interface Props {
  onBack: () => void
}

function formatSurvival(ms: number): string {
  const sec = Math.floor(ms / 1000)
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  return `${min}:${String(rem).padStart(2, '0')}`
}

type DisplayEntry = EndlessLeaderboardEntry & { isGhost?: boolean }

function EndlessTable({ entries, ghostWave }: { entries: EndlessLeaderboardEntry[] | null; ghostWave?: number }) {
  if (entries === null) return <div className="el-leaderboard-empty">Loading…</div>
  if (entries.length === 0 && ghostWave === undefined) return <div className="el-leaderboard-empty">⏳ No scores yet — be the first!</div>

  // Secret 7 — Score Ghost: inject a mysterious entry just above personal best
  const display: DisplayEntry[] = [...entries]
  if (ghostWave !== undefined) {
    const insertAt = display.findIndex(e => e.wave <= ghostWave) ?? display.length
    const idx = insertAt === -1 ? display.length : insertAt
    display.splice(idx, 0, {
      uid: '__ghost__',
      characterName: '???',
      wave: ghostWave + 1,
      survivalMs: 0,
      achievedAt: new Date(0),
      isGhost: true,
    })
  }

  return (
    <ol className="el-leaderboard-list">
      {display.map((entry, i) => (
        <li key={entry.uid} className={`el-leaderboard-entry${entry.isGhost ? ' el-lb-ghost' : ''}`}>
          <span className="el-lb-rank">{entry.isGhost ? '?' : `${i + 1}.`}</span>
          <span className="el-lb-name">{entry.characterName}</span>
          <span className="el-lb-wave">{entry.isGhost ? `Wave ${entry.wave}` : `Wave ${entry.wave}`}</span>
          <span className="el-lb-time">{entry.isGhost ? '?:??' : formatSurvival(entry.survivalMs)}</span>
        </li>
      ))}
    </ol>
  )
}

export function EndlessLeaderboardScreen({ onBack }: Props) {
  const [endlessLb, setEndlessLb] = useState<EndlessLeaderboardEntry[] | null>(null)
  const [todayLb, setTodayLb] = useState<EndlessLeaderboardEntry[] | null>(null)
  const [dailyLb, setDailyLb] = useState<LeaderboardEntry[] | null>(null)
  const best = getEndlessPersonalBest()

  useEffect(() => {
    if (!navigator.onLine) { setEndlessLb([]); setTodayLb([]); setDailyLb([]); return }
    fetchEndlessLeaderboard(10).then(setEndlessLb).catch(() => setEndlessLb([]))
    fetchTodaysEndlessLeaderboard(10).then(setTodayLb).catch(() => setTodayLb([]))
    fetchDailyLeaderboard(5).then(setDailyLb).catch(() => setDailyLb([]))
  }, [])

  return (
    <div className="el-screen">
      <div className="el-header u-text-c">
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

        {best && (
          <div className="el-personal-best">
            Your best: Wave {best.wave} &nbsp;·&nbsp; {formatSurvival(best.survivalMs)}
          </div>
        )}

        <div className="el-subtitle">Today's best players</div>
        <div className="el-leaderboard">
          <EndlessTable entries={todayLb} />
        </div>

        <div className="el-subtitle" style={{ marginTop: '0.75rem' }}>All time best</div>
        <div className="el-leaderboard">
          <EndlessTable entries={endlessLb} ghostWave={best?.wave} />
        </div>
      </div>

      <div className="el-actions">
        <button className="action-btn" onClick={onBack}>← BACK</button>
      </div>
    </div>
  )
}
