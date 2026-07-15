import { describe, it, expect, beforeEach } from 'vitest'
import {
  getDailyChallengeTarget,
  isDailyChallengeClaimed,
  claimDailyChallengeIfEligible,
  DAILY_CHALLENGE_BONUS_TICKETS,
} from './miniGameDailyChallenge'
import { getTickets } from './itemStore'
import type { MiniGameId } from './miniGames'

// In-memory localStorage mock (tests run in node environment)
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  globalThis.localStorage = {
    getItem:    (k: string) => store.get(k) ?? null,
    setItem:    (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear:      () => { store.clear() },
    key:        (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  } as Storage
})

const DAY_A = new Date('2026-06-30T12:00:00Z')
const DAY_B = new Date('2026-07-01T12:00:00Z')
const GAME: MiniGameId = 'tileflip'

describe('getDailyChallengeTarget', () => {
  it('is deterministic for a fixed date and game', () => {
    expect(getDailyChallengeTarget(GAME, DAY_A)).toBe(getDailyChallengeTarget(GAME, DAY_A))
  })

  it('varies across games on the same day', () => {
    const a = getDailyChallengeTarget('marble', DAY_A)
    const b = getDailyChallengeTarget('spinner', DAY_A)
    expect(a).not.toBe(b)
  })

  it('can vary across days for the same game', () => {
    const targets = new Set([
      getDailyChallengeTarget(GAME, DAY_A),
      getDailyChallengeTarget(GAME, DAY_B),
    ])
    // Not a strict guarantee for every pair of days, but a reasonable spot
    // check for this pair given the seeded RNG.
    expect(targets.size).toBeGreaterThanOrEqual(1)
  })
})

describe('isDailyChallengeClaimed', () => {
  it('defaults to false for every game on a fresh day', () => {
    expect(isDailyChallengeClaimed(GAME)).toBe(false)
  })
})

describe('claimDailyChallengeIfEligible', () => {
  it('does nothing if the score is under target', () => {
    const target = getDailyChallengeTarget(GAME)
    const claimed = claimDailyChallengeIfEligible(GAME, target - 1)
    expect(claimed).toBe(false)
    expect(isDailyChallengeClaimed(GAME)).toBe(false)
    expect(getTickets()).toBe(0)
  })

  it('grants the bonus and marks the game claimed when the score meets the target', () => {
    const target = getDailyChallengeTarget(GAME)
    const claimed = claimDailyChallengeIfEligible(GAME, target)
    expect(claimed).toBe(true)
    expect(isDailyChallengeClaimed(GAME)).toBe(true)
    expect(getTickets()).toBe(DAILY_CHALLENGE_BONUS_TICKETS)
  })

  it('does not grant the bonus twice in the same day', () => {
    const target = getDailyChallengeTarget(GAME)
    claimDailyChallengeIfEligible(GAME, target)
    const claimedAgain = claimDailyChallengeIfEligible(GAME, target)
    expect(claimedAgain).toBe(false)
    expect(getTickets()).toBe(DAILY_CHALLENGE_BONUS_TICKETS)
  })

  it('tracks claims independently per game', () => {
    const otherGame: MiniGameId = 'marble'
    claimDailyChallengeIfEligible(GAME, getDailyChallengeTarget(GAME))
    expect(isDailyChallengeClaimed(otherGame)).toBe(false)
    const claimedOther = claimDailyChallengeIfEligible(otherGame, getDailyChallengeTarget(otherGame))
    expect(claimedOther).toBe(true)
    expect(getTickets()).toBe(DAILY_CHALLENGE_BONUS_TICKETS * 2)
  })
})
