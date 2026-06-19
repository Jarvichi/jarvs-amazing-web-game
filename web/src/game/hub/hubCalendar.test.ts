import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getActiveFestival, getFestivalOverride, setFestivalOverride, FESTIVALS } from './hubCalendar'

const d = (month: number, day: number) => new Date(2026, month - 1, day)

// In-memory localStorage mock (tests run in node environment).
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
afterEach(() => setFestivalOverride(null))

describe('getActiveFestival (date-driven)', () => {
  it('returns the festival whose window contains the date', () => {
    expect(getActiveFestival(d(6, 19))?.id).toBe('midsummer')   // mid-June
    expect(getActiveFestival(d(10, 1))?.id).toBe('harvest')     // October
  })

  it('handles the year-wrapping Midwinter window', () => {
    expect(getActiveFestival(d(12, 25))?.id).toBe('midwinter')  // late December
    expect(getActiveFestival(d(1, 3))?.id).toBe('midwinter')    // early January
  })

  it('returns null outside every window', () => {
    expect(getActiveFestival(d(3, 1))).toBeNull()   // March — no festival
    expect(getActiveFestival(d(8, 1))).toBeNull()   // August — between midsummer & harvest
  })
})

describe('override', () => {
  it('forces a festival regardless of date', () => {
    setFestivalOverride('midwinter')
    expect(getActiveFestival(d(6, 19))?.id).toBe('midwinter')   // June, but forced
    expect(getFestivalOverride()).toBe('midwinter')
  })

  it("'none' forces no festival even inside a window", () => {
    setFestivalOverride('none')
    expect(getActiveFestival(d(6, 19))).toBeNull()
  })

  it('clears back to date-driven behaviour', () => {
    setFestivalOverride('harvest')
    setFestivalOverride(null)
    expect(getActiveFestival(d(6, 19))?.id).toBe('midsummer')
  })

  it('ignores an unknown override id', () => {
    setFestivalOverride('not-a-festival')
    expect(getActiveFestival(d(6, 19))).toBeNull()
  })
})

describe('FESTIVALS registry', () => {
  it('every festival has a unique id, name, and icon', () => {
    const ids = FESTIVALS.map(f => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const f of FESTIVALS) { expect(f.name).toBeTruthy(); expect(f.icon).toBeTruthy() }
  })
})
