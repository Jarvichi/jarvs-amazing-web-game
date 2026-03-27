import React, { useEffect, useState } from 'react'
import { GameState } from '../game/types'
import { MAX_HANDICAP } from '../game/engine'
import { loadWinStreak } from '../game/collection'
import { DailyChallengeState, fetchEndlessLeaderboard, getEndlessPersonalBest, EndlessLeaderboardEntry } from '../game/dailyChallenge'

function formatSurvival(ms: number): string {
  const sec = Math.floor(ms / 1000)
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  return `${min}:${String(rem).padStart(2, '0')}`
}

interface Props {
  state: GameState
  winner: 'player' | 'opponent' | 'draw'
  /** Current opponent deck handicap (cards removed from enemy deck). */
  handicap: number
  onOpenPack?: () => void
  onPlayAgain: () => void
  onMainMenu: () => void
  /** If set, show an Abandon Run button (campaign mode only). */
  campaignAbandon?: () => void
  /** Show a hint to try Quick Play and grow their deck (shown after 2+ failures). */
  quickPlayHint?: boolean
  /** Show win streak (free play only). */
  showStreak?: boolean
  /** If set, show daily challenge result banner. */
  dailyChallengeState?: DailyChallengeState
}

const VICTORY_ART = `   \\o/
    |
   / \\
=========
 VICTORY!
=========`

const DEFEAT_ART = `   ___
  | R |
  | I |
  | P |
  |___|
 /     \\`

const DRAW_ART = `  =====
  |   |
  | = |
  |   |
  =====
  DRAW!`

export function GameOver({ state, winner, handicap, onOpenPack, onPlayAgain, onMainMenu, campaignAbandon, quickPlayHint, showStreak, dailyChallengeState }: Props) {
  const won  = winner === 'player'
  const draw = winner === 'draw'
  const isEndlessDefeat = !!state.endlessMode && !won && !draw

  const [endlessLb, setEndlessLb] = useState<EndlessLeaderboardEntry[] | null>(null)
  const endlessBest = isEndlessDefeat ? getEndlessPersonalBest() : null

  useEffect(() => {
    if (!isEndlessDefeat) return
    if (!navigator.onLine) { setEndlessLb([]); return }
    fetchEndlessLeaderboard(10).then(setEndlessLb).catch(() => setEndlessLb([]))
  }, [isEndlessDefeat])
  const css  = won ? 'gameover--win' : draw ? 'gameover--draw' : 'gameover--lose'
  const art  = won ? VICTORY_ART : draw ? DRAW_ART : DEFEAT_ART

  const title = won ? '═══ VICTORY ═══' : draw ? '═══ DRAW ═══' : '═══ DEFEAT ═══'

  const message = won
    ? 'Enemy base destroyed!'
    : draw
      ? 'Time ran out — scores are tied!'
      : winner === 'opponent'
        ? 'Your base was destroyed...'
        : 'Score: you lost on points.'

  // What happens to the opponent handicap next round
  const nextHandicap = won
    ? Math.max(0, handicap - 1)
    : !draw ? Math.min(MAX_HANDICAP, handicap + 1)
    : handicap

  let handicapNote = ''
  if (won) {
    handicapNote = nextHandicap < handicap
      ? `Enemy regains a card next round (handicap: ${nextHandicap})`
      : 'Enemy deck at full strength!'
  } else if (!draw) {
    handicapNote = `Enemy starts with ${nextHandicap} fewer card${nextHandicap !== 1 ? 's' : ''} next round`
  } else if (handicap > 0) {
    handicapNote = `Handicap unchanged (${handicap} cards removed)`
  }

  const isEndless  = !!state.endlessMode
  const survivalSec = isEndless ? Math.floor((state.endlessSurvivalMs ?? 0) / 1000) : 0
  const survivalMin = Math.floor(survivalSec / 60)
  const survivalRem = survivalSec % 60
  const survivalStr = `${survivalMin}:${String(survivalRem).padStart(2, '0')}`

  return (
    <div className={`gameover-screen ${css}`}>
      <div className="gameover-title">{title}</div>
      {isEndless && (
        <div className="gameover-endless-badge">∞ ENDLESS MODE</div>
      )}
      <pre className="gameover-ascii">{art}</pre>
      <div className="gameover-message">{message}</div>
      {isEndless ? (
        <div className="gameover-endless-stats">
          <div className="gameover-endless-wave">WAVE {state.endlessWave ?? 1}</div>
          <div className="gameover-endless-time">Survived {survivalStr}</div>
        </div>
      ) : (
        <div className="gameover-score">
          <span className="score-player">{state.playerScore}</span>
          <span className="score-sep"> vs </span>
          <span className="score-opponent">{state.opponentScore}</span>
        </div>
      )}
      <div className="gameover-stats">
        <div>Time: {Math.floor(state.gameTime / 1000)}s</div>
        {!draw && !isEndless && (won
          ? <div>Your base HP: {state.playerBase.hp}/{state.playerBase.maxHp}</div>
          : <div>Enemy base HP remaining: {state.opponentBase.hp}/{state.opponentBase.maxHp}</div>
        )}
      </div>

      {isEndlessDefeat && (
        <div className="gameover-endless-lb">
          <div className="gameover-endless-lb-title">∞ ENDLESS LEADERBOARD</div>
          {endlessBest && (
            <div className="gameover-endless-lb-best">
              Your best: Wave {endlessBest.wave} · {formatSurvival(endlessBest.survivalMs)}
            </div>
          )}
          {endlessLb === null ? (
            <div className="gameover-endless-lb-empty">Loading…</div>
          ) : endlessLb.length === 0 ? (
            <div className="gameover-endless-lb-empty">⏳ No scores yet — be the first!</div>
          ) : (
            <ol className="gameover-endless-lb-list">
              {endlessLb.map((entry, i) => (
                <li key={entry.uid} className="gameover-endless-lb-entry">
                  <span className="gameover-lb-rank">{i + 1}.</span>
                  <span className="gameover-lb-name">{entry.characterName}</span>
                  <span className="gameover-lb-wave">Wave {entry.wave}</span>
                  <span className="gameover-lb-time">{formatSurvival(entry.survivalMs)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {handicapNote && !dailyChallengeState && <div className="gameover-handicap">{handicapNote}</div>}

      {dailyChallengeState && (
        <div className={`gameover-daily ${winner === 'player' ? 'gameover-daily--win' : 'gameover-daily--lose'}`}>
          {(() => {
            const attempts = dailyChallengeState.attempts
            return winner === 'player'
              ? attempts === 1
                ? '📅 Daily Challenge complete — first try!'
                : `📅 Daily Challenge complete! (${attempts} attempt${attempts !== 1 ? 's' : ''})`
              : `📅 Daily Challenge — attempt ${attempts}. Keep trying!`
          })()}
        </div>
      )}

      {showStreak && winner === 'player' && (() => {
        const streak = loadWinStreak()
        return streak >= 2 ? (
          <div className="gameover-streak">🔥 Win streak: {streak}</div>
        ) : null
      })()}

      {quickPlayHint && (
        <div className="gameover-hint">
          💡 Struggling? Try <strong>Quick Play</strong> from the main menu to win more cards and strengthen your deck.
        </div>
      )}

      <div className="gameover-actions">
        {won && onOpenPack && (
          <button className="action-btn action-btn--large action-btn--gold" onClick={onOpenPack}>
            ✦ OPEN PACK ✦
          </button>
        )}
        <button className="action-btn" onClick={onPlayAgain}>
          {campaignAbandon ? (won ? '[ Claim Reward ]' : '[ Retry Node ]') : '[ Play Again ]'}
        </button>
        {campaignAbandon && (
          <button className="action-btn action-btn--danger gameover-abandon-btn" onClick={campaignAbandon}>
            [ Abandon Run ]
          </button>
        )}
        <button className="action-btn" onClick={onMainMenu}>
          [ Main Menu ]
        </button>
      </div>
    </div>
  )
}
