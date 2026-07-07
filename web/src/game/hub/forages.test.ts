import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canForageToday, recordForage } from './forages'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

describe('forages', () => {
  beforeEach(() => {
    installLocalStorageStub()
    vi.useRealTimers()
  })

  it('allows foraging a fresh spot, then blocks it for the rest of the day', () => {
    expect(canForageToday('Ravenwatch:bush-1')).toBe(true)
    recordForage('Ravenwatch:bush-1')
    expect(canForageToday('Ravenwatch:bush-1')).toBe(false)
    // Other spots are unaffected
    expect(canForageToday('Ravenwatch:bush-2')).toBe(true)
  })

  it('allows foraging again on a new day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T12:00:00Z'))
    recordForage('Ravenwatch:tree-1')
    expect(canForageToday('Ravenwatch:tree-1')).toBe(false)
    vi.setSystemTime(new Date('2026-07-02T12:00:00Z'))
    expect(canForageToday('Ravenwatch:tree-1')).toBe(true)
  })

  it('fails open (forageable) when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(canForageToday('Anywhere:spot')).toBe(true)
    expect(() => recordForage('Anywhere:spot')).not.toThrow()
  })
})
