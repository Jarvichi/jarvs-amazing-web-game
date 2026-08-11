import { describe, it, expect, beforeEach } from 'vitest'
import { recordDeparture, claimArrival, getTravelersOnRoad } from './townTravelers'

// In-memory localStorage mock (tests run in node environment) — same pattern
// as reputation.test.ts / friendship.test.ts.
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

describe('townTravelers default state', () => {
  it('starts with nobody on the road', () => {
    expect(getTravelersOnRoad()).toBe(0)
  })

  it('claimArrival on an empty counter returns false and does not go negative', () => {
    expect(claimArrival()).toBe(false)
    expect(getTravelersOnRoad()).toBe(0)
  })
})

describe('recordDeparture / claimArrival', () => {
  it('a departure can be claimed as an arrival, draining the counter to zero', () => {
    recordDeparture()
    expect(getTravelersOnRoad()).toBe(1)
    expect(claimArrival()).toBe(true)
    expect(getTravelersOnRoad()).toBe(0)
  })

  it('a claimed traveler cannot be claimed a second time', () => {
    recordDeparture()
    expect(claimArrival()).toBe(true)
    expect(claimArrival()).toBe(false)
  })

  it('multiple departures queue up and drain one at a time', () => {
    recordDeparture()
    recordDeparture()
    recordDeparture()
    expect(getTravelersOnRoad()).toBe(3)
    expect(claimArrival()).toBe(true)
    expect(getTravelersOnRoad()).toBe(2)
    expect(claimArrival()).toBe(true)
    expect(claimArrival()).toBe(true)
    expect(getTravelersOnRoad()).toBe(0)
    expect(claimArrival()).toBe(false)
  })

  it('persists across a fresh load (simulating a page reload)', () => {
    recordDeparture()
    recordDeparture()
    // Nothing in the module holds in-memory state beyond localStorage itself
    // — every exported function re-reads via load() — so this really is
    // exercising persistence, not just repeated calls in one session.
    expect(getTravelersOnRoad()).toBe(2)
    expect(claimArrival()).toBe(true)
    expect(getTravelersOnRoad()).toBe(1)
  })
})
