import { describe, it, expect, beforeEach, vi } from 'vitest'

// weeklyChallenge.ts imports the firebase singleton for the leaderboard;
// stub it so node tests don't initialise a real app.
vi.mock('../firebase', () => ({ auth: {}, db: {} }))

// Minimal localStorage for the node test environment.
const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem:    (k: string) => storage.get(k) ?? null,
  setItem:    (k: string, v: string) => { storage.set(k, String(v)) },
  removeItem: (k: string) => { storage.delete(k) },
  clear:      () => { storage.clear() },
})

import {
  getISOWeekKey, getNextWeeklyReset, getWeeklyChallenge, WEEKLY_CHALLENGES,
  getWeeklyPlayerDeck, getWeeklyOpponentDeck, getAllCardTags,
  getWeeklyChallengeState, saveWeeklyChallengeResult, grantWeeklyReward,
} from './weeklyChallenge'
import {
  getChronicleFragments, addChronicleFragments, getExoticShards,
} from './itemStore'

beforeEach(() => storage.clear())

// ── ISO week key ──────────────────────────────────────────────────────────────

describe('getISOWeekKey', () => {
  it('matches well-known ISO week facts', () => {
    expect(getISOWeekKey(new Date('2020-12-31T12:00:00Z'))).toBe('2020-W53')
    expect(getISOWeekKey(new Date('2021-01-01T12:00:00Z'))).toBe('2020-W53')  // year boundary
    expect(getISOWeekKey(new Date('2021-01-04T12:00:00Z'))).toBe('2021-W01')
    expect(getISOWeekKey(new Date('2024-12-30T12:00:00Z'))).toBe('2025-W01')  // Monday in old year
  })

  it('rolls over at Monday 00:00 UTC', () => {
    const sundayLate   = new Date('2026-06-14T23:59:59Z')
    const mondayStart  = new Date('2026-06-15T00:00:00Z')
    const sundayAfter  = new Date('2026-06-21T23:59:59Z')
    expect(getISOWeekKey(sundayLate)).not.toBe(getISOWeekKey(mondayStart))
    expect(getISOWeekKey(mondayStart)).toBe(getISOWeekKey(sundayAfter))
  })
})

describe('getNextWeeklyReset', () => {
  it('returns the next Monday 00:00 UTC', () => {
    const reset = getNextWeeklyReset(new Date('2026-06-11T15:00:00Z'))  // a Thursday
    expect(reset.toISOString()).toBe('2026-06-15T00:00:00.000Z')
    // From a Monday, the reset is the following Monday (never today)
    const fromMonday = getNextWeeklyReset(new Date('2026-06-15T00:00:00Z'))
    expect(fromMonday.toISOString()).toBe('2026-06-22T00:00:00.000Z')
  })
})

// ── Challenge selection ───────────────────────────────────────────────────────

describe('getWeeklyChallenge', () => {
  it('picks deterministically from the pool by week', () => {
    const d = new Date('2026-06-11T12:00:00Z')
    const a = getWeeklyChallenge(d)
    const b = getWeeklyChallenge(new Date('2026-06-14T23:00:00Z'))  // same ISO week
    expect(a.id).toBe(b.id)
    expect(WEEKLY_CHALLENGES.some(c => c.id === a.id)).toBe(true)
  })
})

// ── Deck building ─────────────────────────────────────────────────────────────

describe('weekly decks', () => {
  it('builds full, deterministic decks', () => {
    const a = getWeeklyPlayerDeck()
    const b = getWeeklyPlayerDeck()
    expect(a.length).toBe(20)
    expect(a.map(c => c.name)).toEqual(b.map(c => c.name))
    expect(getWeeklyOpponentDeck().length).toBe(20)
  })

  it('respects the current constraint', () => {
    const constraint = getWeeklyChallenge().constraint
    const deck = getWeeklyPlayerDeck()
    if (constraint.type === 'deck_tags') {
      for (const card of deck) {
        const themed = getAllCardTags(card).some(t => constraint.tags.includes(t))
        const isManaStructure = card.unit?.structureEffect?.type === 'mana'
        expect(themed || isManaStructure).toBe(true)
      }
    } else if (constraint.type === 'no_units') {
      expect(deck.every(c => c.cardType !== 'unit')).toBe(true)
    } else {
      const opponent = getWeeklyOpponentDeck()
      for (const card of opponent) {
        const themed = getAllCardTags(card).some(t => constraint.tags.includes(t))
        const isManaStructure = card.unit?.structureEffect?.type === 'mana'
        expect(themed || isManaStructure).toBe(true)
      }
    }
  })
})

// ── Local state ───────────────────────────────────────────────────────────────

describe('weekly challenge state', () => {
  it('tracks attempts and stops counting after a win', () => {
    expect(getWeeklyChallengeState()).toMatchObject({ won: null, attempts: 0 })
    saveWeeklyChallengeResult(false)
    expect(getWeeklyChallengeState()).toMatchObject({ won: false, attempts: 1 })
    saveWeeklyChallengeResult(true)
    expect(getWeeklyChallengeState()).toMatchObject({ won: true, attempts: 2 })
    saveWeeklyChallengeResult(false)  // ignored — already won this week
    expect(getWeeklyChallengeState()).toMatchObject({ won: true, attempts: 2 })
  })
})

// ── Rewards ───────────────────────────────────────────────────────────────────

describe('grantWeeklyReward', () => {
  it('grants one fragment per win', () => {
    const r = grantWeeklyReward()
    expect(r).toEqual({ fragments: 1, shards: 0, combined: false })
    expect(getChronicleFragments()).toBe(1)
  })

  it('fuses three fragments into an exotic relic shard', () => {
    addChronicleFragments(2)
    const r = grantWeeklyReward()
    expect(r).toEqual({ fragments: 0, shards: 1, combined: true })
    expect(getChronicleFragments()).toBe(0)
    expect(getExoticShards()).toBe(1)
  })
})
