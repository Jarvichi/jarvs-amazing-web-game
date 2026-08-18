import React, { useEffect, useState } from 'react'
import {
  getWeeklyChallenge, getWeeklyChallengeState, getWeeklyPlayerDeck, getNextWeeklyReset,
  fetchWeeklyLeaderboard, WeeklyLeaderboardEntry,
} from '../../game/weeklyChallenge'
import { getChronicleFragments, getExoticShards } from '../../game/itemStore'
import { Button } from '../ui/Button'

interface Props {
  onStart: () => void
  onBack: () => void
}

export function WeeklyChallengeScreen({ onStart, onBack }: Props) {
  const challenge = getWeeklyChallenge()
  const state     = getWeeklyChallengeState()
  const deck      = getWeeklyPlayerDeck()
  const fragments = getChronicleFragments()
  const shards    = getExoticShards()
  const resetsAt  = getNextWeeklyReset().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  const [leaderboard, setLeaderboard] = useState<WeeklyLeaderboardEntry[] | null>(null)

  useEffect(() => {
    if (!navigator.onLine) { setLeaderboard([]); return }
    fetchWeeklyLeaderboard(3)
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]))
  }, [])

  const rarityIcon: Record<string, string> = {
    common: '○', uncommon: '◆', rare: '★', legendary: '✦',
  }

  const byCost = [...deck].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))

  return (
    <div className="dc-screen">
      <div className="overlay-header u-flex u-items-c u-gap-6">
        <Button onClick={onBack}>← BACK</Button>
        <span className="overlay-title">WEEKLY CHALLENGE</span>
      </div>
      <div className="u-text-c">
        <div className="wc-lore-title">{challenge.loreTitle}</div>
        <div className="dc-reset-time">Resets {resetsAt} · Monday 00:00 UTC</div>
      </div>

      <div className="wc-lore-context">{challenge.loreContext}</div>

      <div className="dc-rule">
        <strong>This week's constraint:</strong> {challenge.constraint.label}.
        Everyone faces the same challenge — win once to claim a 📜 Chronicle Fragment.
      </div>

      <div className="wc-fragments u-flex u-items-c u-gap-6">
        <span>📜 Fragments: {fragments} / 3</span>
        <span>💠 Shards: {shards}</span>
      </div>

      {state.won === true && (
        <div className="dc-status dc-status--won">
          ✓ You completed this week's challenge
          {state.attempts === 1 ? ' on the first try!' : ` in ${state.attempts} attempt${state.attempts !== 1 ? 's' : ''}.`}
        </div>
      )}
      {state.won !== true && state.attempts > 0 && (
        <div className="dc-status dc-status--pending">
          Attempt {state.attempts + 1} — the Chronicle is watching.
        </div>
      )}

      <div className="dc-leaderboard">
        <div className="dc-leaderboard-label">THIS WEEK'S TOP PLAYERS</div>
        {leaderboard === null ? (
          <div className="dc-leaderboard-empty">Loading…</div>
        ) : leaderboard.length === 0 ? (
          <div className="dc-leaderboard-empty">⏳ Awaiting this week's results</div>
        ) : (
          <ol className="dc-leaderboard-list">
            {leaderboard.map((entry, i) => (
              <li key={entry.uid} className="dc-leaderboard-entry u-flex u-items-c u-gap-4">
                <span className="dc-lb-rank">{i + 1}.</span>
                <span className="dc-lb-name u-grow">{entry.characterName}</span>
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
              <span className="dc-card-name u-grow">{card.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="dc-actions u-col u-gap-4">
        <Button size="lg" onClick={onStart}>
          {state.attempts === 0 ? '▶ START CHALLENGE' : '▶ TRY AGAIN'}
        </Button>
      </div>
    </div>
  )
}
