import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canDigToday, recordDig } from './digs'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

describe('digs', () => {
  beforeEach(() => {
    installLocalStorageStub()
    vi.useRealTimers()
  })

  it('allows digging a fresh spot, then blocks it for the rest of the day', () => {
    expect(canDigToday('Millhaven:shore-dig-1')).toBe(true)
    recordDig('Millhaven:shore-dig-1')
    expect(canDigToday('Millhaven:shore-dig-1')).toBe(false)
    // Other spots are unaffected
    expect(canDigToday('Millhaven:shore-dig-2')).toBe(true)
  })

  it('allows digging again on a new day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T12:00:00Z'))
    recordDig('Appleford:orchard-dig-1')
    expect(canDigToday('Appleford:orchard-dig-1')).toBe(false)
    vi.setSystemTime(new Date('2026-07-02T12:00:00Z'))
    expect(canDigToday('Appleford:orchard-dig-1')).toBe(true)
  })

  it('fails open (diggable) when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(canDigToday('Anywhere:spot')).toBe(true)
    expect(() => recordDig('Anywhere:spot')).not.toThrow()
  })
})
