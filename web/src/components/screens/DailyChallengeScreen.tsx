import React, { useEffect, useState } from 'react'
import { getDailyChallengeState, getDailyPlayerDeck, fetchDailyLeaderboard, LeaderboardEntry } from '../../game/dailyChallenge'

interface Props {
  onStart: () => void
  onBack: () => void
}

function getResetTimeLocal(): string {
  const now = new Date()
  const nextMidnightUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  ))
  return nextMidnightUTC.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function DailyChallengeScreen({ onStart, onBack }: Props) {
  const state   = getDailyChallengeState()
  const deck    = getDailyPlayerDeck()
  const today   = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null)

  useEffect(() => {
    if (!navigator.onLine) { setLeaderboard([]); return }
    fetchDailyLeaderboard(3)
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]))
  }, [])

  const rarityIcon: Record<string, string> = {
    common: '○', uncommon: '◆', rare: '★', legendary: '✦',
  }

  const byCost = [...deck].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))

  return (
    <div className="dc-screen">
      <div className="dc-header">
        <div className="dc-label">DAILY CHALLENGE</div>
        <div className="dc-date">{today}</div>
        <div className="dc-reset-time">Resets at {getResetTimeLocal()}</div>
      </div>

      <div className="dc-rule">
        Everyone plays the same fixed deck against the same opponent today.
        Your result is saved — try as many times as you like.
      </div>

      {state.won === true && (
        <div className="dc-status dc-status--won">
          ✓ You completed today's challenge
          {state.attempts === 1 ? ' on the first try!' : ` in ${state.attempts} attempt${state.attempts !== 1 ? 's' : ''}.`}
        </div>
      )}
      {state.won !== true && state.attempts > 0 && (
        <div className="dc-status dc-status--pending">
          Attempt {state.attempts + 1} — keep going!
        </div>
      )}

      <div className="dc-leaderboard">
        <div className="dc-leaderboard-label">TODAY'S TOP PLAYERS</div>
        {leaderboard === null ? (
          <div className="dc-leaderboard-empty">Loading…</div>
        ) : leaderboard.length === 0 ? (
          <div className="dc-leaderboard-empty">⏳ Awaiting today's results</div>
        ) : (
          <ol className="dc-leaderboard-list">
            {leaderboard.map((entry, i) => (
              <li key={entry.uid} className="dc-leaderboard-entry">
                <span className="dc-lb-rank">{i + 1}.</span>
                <span className="dc-lb-name">{entry.characterName}</span>
                <span className="dc-lb-attempts">
                  {entry.attempts === 1 ? '1 attempt' : `${entry.attempts} attempts`}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="dc-deck">
        <div className="dc-deck-label">YOUR DECK ({deck.length} cards)</div>
        <ul className="dc-deck-list">
          {byCost.map((card, i) => (
            <li key={i} className="dc-deck-card">
              <span className="dc-card-rarity" title={card.rarity}>
                {rarityIcon[card.rarity] ?? '○'}
              </span>
              <span className="dc-card-cost">{card.cost}💎</span>
              <span className="dc-card-name">{card.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="dc-actions">
        <button className="action-btn action-btn--large" onClick={onStart}>
          {state.attempts === 0 ? '▶ START CHALLENGE' : '▶ TRY AGAIN'}
        </button>
        <button className="action-btn" onClick={onBack}>← BACK</button>
      </div>
    </div>
  )
}
