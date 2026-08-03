import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// townAccess.ts imports the firebase singleton at module load; stub it so node
// tests don't initialise a real app.
vi.mock('../firebase', () => ({ auth: {}, db: {} }))

const getDoc = vi.fn()
vi.mock('firebase/firestore', () => ({
  doc:    () => ({}),
  getDoc: (...args: unknown[]) => getDoc(...args),
  setDoc: vi.fn(),
}))

const logError = vi.fn()
const logWarn  = vi.fn()
vi.mock('../logger', () => ({
  logError: (...args: unknown[]) => logError(...args),
  logWarn:  (...args: unknown[]) => logWarn(...args),
}))

// Minimal localStorage for the node test environment. Re-applied in beforeEach
// because afterEach clears the navigator stub with it.
const storage = new Map<string, string>()
const stubLocalStorage = () => vi.stubGlobal('localStorage', {
  getItem:    (k: string) => storage.get(k) ?? null,
  setItem:    (k: string, v: string) => { storage.set(k, String(v)) },
  removeItem: (k: string) => { storage.delete(k) },
  clear:      () => { storage.clear() },
})

import {
  fetchEnabledTownIds, isTownAccessible, ALWAYS_OPEN_LOCATION_IDS,
} from './townAccess'

const CACHE_KEY = 'jarv_town_access_cache'

const snapshot = (enabled?: string[]) => ({
  exists: () => enabled !== undefined,
  data:   () => ({ enabled }),
})

const setOnline = (online: boolean) => vi.stubGlobal('navigator', { onLine: online })

/**
 * Runs the fetch with the retry backoff collapsed. Timers must advance while
 * the promise is mid-flight, so drain the microtask queue between ticks.
 */
async function fetchWithFakeTimers(): Promise<string[]> {
  vi.useFakeTimers()
  try {
    const pending = fetchEnabledTownIds()
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(2000)
    }
    return await pending
  } finally {
    vi.useRealTimers()
  }
}

beforeEach(() => {
  storage.clear()
  getDoc.mockReset()
  logError.mockReset()
  logWarn.mockReset()
  stubLocalStorage()
  setOnline(true)
})

afterEach(() => vi.unstubAllGlobals())

// ── fetchEnabledTownIds ───────────────────────────────────────────────────────

describe('fetchEnabledTownIds', () => {
  it('returns the enabled list and caches it', async () => {
    getDoc.mockResolvedValue(snapshot(['gravemoor', 'appleford']))

    expect(await fetchEnabledTownIds()).toEqual(['gravemoor', 'appleford'])
    expect(storage.get(CACHE_KEY)).toBe(JSON.stringify(['gravemoor', 'appleford']))
    expect(logWarn).not.toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
  })

  it('skips the network entirely when offline', async () => {
    setOnline(false)
    storage.set(CACHE_KEY, JSON.stringify(['hollowmere']))

    // Being offline is expected, not a failure — nothing should be reported.
    expect(await fetchEnabledTownIds()).toEqual(['hollowmere'])
    expect(getDoc).not.toHaveBeenCalled()
    expect(logWarn).not.toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
  })

  it('retries after a transient failure and reports nothing on success', async () => {
    getDoc
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(snapshot(['gearford']))

    expect(await fetchWithFakeTimers()).toEqual(['gearford'])
    expect(getDoc).toHaveBeenCalledTimes(2)
    expect(logWarn).not.toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
  })

  it('warns and serves the cache when every attempt fails', async () => {
    storage.set(CACHE_KEY, JSON.stringify(['gravemoor']))
    getDoc.mockRejectedValue(Object.assign(new Error('boom'), { code: 'unavailable' }))

    expect(await fetchWithFakeTimers()).toEqual(['gravemoor'])
    expect(getDoc).toHaveBeenCalledTimes(3)
    // The player carries on with last-known-good access, so this is not an error.
    expect(logError).not.toHaveBeenCalled()
    expect(logWarn).toHaveBeenCalledTimes(1)
    expect(logWarn.mock.calls[0][1]).toMatchObject({ code: 'unavailable', attempts: 3, hadCache: true })
  })

  it('errors when every attempt fails and there is no cache', async () => {
    getDoc.mockRejectedValue(new Error('boom'))

    // Nothing to fall back on — the player is locked out of every toggleable town.
    expect(await fetchWithFakeTimers()).toEqual([])
    expect(logWarn).not.toHaveBeenCalled()
    expect(logError).toHaveBeenCalledTimes(1)
    expect(logError.mock.calls[0][1]).toMatchObject({ attempts: 3, hadCache: false })
  })

  it('falls back to the cache without reporting when the doc does not exist', async () => {
    storage.set(CACHE_KEY, JSON.stringify(['appleford']))
    getDoc.mockResolvedValue(snapshot(undefined))

    expect(await fetchEnabledTownIds()).toEqual(['appleford'])
    expect(getDoc).toHaveBeenCalledTimes(1)
    expect(logWarn).not.toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
  })
})

// ── isTownAccessible ──────────────────────────────────────────────────────────

describe('isTownAccessible', () => {
  it('lets the admin reach everything', () => {
    expect(isTownAccessible('royal-palace', new Set(), true)).toBe(true)
  })

  it('keeps the always-open towns open even with nothing enabled', () => {
    for (const id of ALWAYS_OPEN_LOCATION_IDS) {
      expect(isTownAccessible(id, new Set(), false)).toBe(true)
    }
  })

  it('gates every other town on the enabled set', () => {
    const enabled = new Set(['gravemoor'])
    expect(isTownAccessible('gravemoor', enabled, false)).toBe(true)
    expect(isTownAccessible('royal-palace', enabled, false)).toBe(false)
  })
})
