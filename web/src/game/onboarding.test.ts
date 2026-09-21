import { describe, it, expect, beforeEach } from 'vitest'
import { hasPlayedFirstBattle, markFirstBattlePlayed } from './onboarding'
import { markNodeCleared } from './world/worldState'

// In-memory localStorage mock (tests run in node environment).
describe('hasPlayedFirstBattle', () => {
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
