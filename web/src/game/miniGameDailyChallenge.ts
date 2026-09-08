// ─── Mini-Game Daily Challenges ────────────────────────────────────────────────
//
// Per-mini-game, date-seeded high-score target with a small one-time bonus reward.
// Mirrors game/hub/bounties.ts's date-seeded-daily pattern, but reuses the
// canonical seeded-RNG helpers from seededRandom.ts (this module has no React
// dependency either, so there's no need for a local re-implementation).

import { logError } from '../logger'
import { hashStr, makeSeededRng } from './seededRandom'
import { addTickets } from './itemStore'
import { getTodayDate, type MiniGameId } from './miniGames'

const KEY = 'jarv_minigame_daily_challenge'

export const DAILY_CHALLENGE_BONUS_TICKETS = 25

// Per-game target bounds, derived from each game's own reward ceiling (read from
// its component) so a target sits in roughly the 55-75% band of what's possible —
// reachable with a good run, not guaranteed on an average one.
const MINI_GAME_CHALLENGE_RANGE: Record<MiniGameId, [number, number]> = {
  marble:        [70, 110],
  tileflip:      [45, 65],
  crystalcatch:  [12, 25],
  spinner:       [15, 20],
  marblerace:    [20, 40],
  higherOrLower: [35, 55],
  fruitMachine:  [15, 30],
  videoPoker:    [20, 40],
  fishing:       [15, 35],
  towerDefence:  [40, 80],
  regatta:       [20, 40],
}

/** Today's ticket target to beat for a given mini-game, deterministic for the day. */
export function getDailyChallengeTarget(gameId: MiniGameId, at?: Date): number {
  const dateKey   = at ? at.toISOString().slice(0, 10) : getTodayDate()
  const [min, max] = MINI_GAME_CHALLENGE_RANGE[gameId]
  const rng = makeSeededRng(hashStr(`${dateKey}:${gameId}`))
  return min + Math.round(rng() * (max - min))
}

interface DailyChallengeState {
  date:    string
  claimed: MiniGameId[]
}

function freshState(): DailyChallengeState {
  return { date: getTodayDate(), claimed: [] }
}

function loadState(): DailyChallengeState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return freshState()
    const parsed = JSON.parse(raw) as DailyChallengeState
    if (parsed.date !== getTodayDate()) return freshState()
    if (!Array.isArray(parsed.claimed)) parsed.claimed = []
    return parsed
  } catch {
    return freshState()
  }
}

function saveState(state: DailyChallengeState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    logError('miniGameDailyChallenge saveState failed', { error: String(e) })
  }
}

export function isDailyChallengeClaimed(gameId: MiniGameId): boolean {
  return loadState().claimed.includes(gameId)
}

/** If `ticketsEarned` beats today's target and it hasn't been claimed yet today,
 *  grants the bonus tickets and marks it claimed. Returns true if newly claimed. */
export function claimDailyChallengeIfEligible(gameId: MiniGameId, ticketsEarned: number): boolean {
  const state = loadState()
  if (state.claimed.includes(gameId)) return false
  if (ticketsEarned < getDailyChallengeTarget(gameId)) return false

  state.claimed.push(gameId)
  saveState(state)
  addTickets(DAILY_CHALLENGE_BONUS_TICKETS)
  return true
}
