import { describe, it, expect, beforeEach } from 'vitest'
import { hasPlayedFirstBattle, markFirstBattlePlayed, getBattlesPlayed, incrementBattlesPlayed, getDaysActive } from './onboarding'
import { markNodeCleared } from './world/worldState'

// In-memory localStorage mock (tests run in node environment).
function stubLocalStorage(): void {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem:    (k: string) => store.get(k) ?? null,
    setItem:    (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear:      () => { store.clear() },
    key:        (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  } as Storage
}

describe('hasPlayedFirstBattle', () => {
  beforeEach(stubLocalStorage)

  it('is false for a brand-new profile', () => {
    expect(hasPlayedFirstBattle()).toBe(false)
  })

  it('becomes true once markFirstBattlePlayed is called, and persists', () => {
    markFirstBattlePlayed()
    expect(hasPlayedFirstBattle()).toBe(true)
    expect(localStorage.getItem('jarv_first_battle_done')).toBe('true')
  })

  it('backfills true for a profile with a pre-existing win streak', () => {
    localStorage.setItem('jarv_win_streak', '3')
    expect(hasPlayedFirstBattle()).toBe(true)
    // Backfill should persist so future checks skip the legacy scan.
    expect(localStorage.getItem('jarv_first_battle_done')).toBe('true')
  })

  it('backfills true for a profile with cleared campaign nodes', () => {
    markNodeCleared('node-1')
    expect(hasPlayedFirstBattle()).toBe(true)
  })
})

describe('getBattlesPlayed / incrementBattlesPlayed', () => {
  beforeEach(stubLocalStorage)

  it('starts at 0 for a brand-new profile and increments', () => {
    expect(getBattlesPlayed()).toBe(0)
    expect(incrementBattlesPlayed()).toBe(1)
    expect(incrementBattlesPlayed()).toBe(2)
    expect(getBattlesPlayed()).toBe(2)
  })

  it('backfills a large baseline for a profile with a legacy play signal, so #2307 reveal thresholds pass immediately', () => {
    localStorage.setItem('jarvs_handicap', '2')
    expect(getBattlesPlayed()).toBeGreaterThanOrEqual(10)
  })
})

describe('getDaysActive', () => {
  beforeEach(stubLocalStorage)

  it('is 1 on the calendar day of first launch', () => {
    expect(getDaysActive()).toBe(1)
    // Repeated calls the same day stay at 1, not re-seeding from "now" each time.
    expect(getDaysActive()).toBe(1)
  })

  it('backfills a large baseline for a profile with a legacy play signal', () => {
    markNodeCleared('node-1')
    expect(getDaysActive()).toBeGreaterThanOrEqual(2)
  })
})
