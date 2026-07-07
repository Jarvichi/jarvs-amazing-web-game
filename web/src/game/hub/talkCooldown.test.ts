import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canTalkToday, recordTalk } from './talkCooldown'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

describe('talkCooldown', () => {
  beforeEach(() => {
    installLocalStorageStub()
    vi.useRealTimers()
  })

  it('allows conversation with a fresh NPC, then blocks it for the rest of the day', () => {
    expect(canTalkToday('scholar')).toBe(true)
    recordTalk('scholar')
    expect(canTalkToday('scholar')).toBe(false)
    // Other NPCs are unaffected
    expect(canTalkToday('merchant')).toBe(true)
  })

  it('allows conversation again on a new day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T12:00:00Z'))
    recordTalk('innkeeper-rosie')
    expect(canTalkToday('innkeeper-rosie')).toBe(false)
    vi.setSystemTime(new Date('2026-07-02T12:00:00Z'))
    expect(canTalkToday('innkeeper-rosie')).toBe(true)
  })

  it('fails open (talkable) when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(canTalkToday('anyone')).toBe(true)
    expect(() => recordTalk('anyone')).not.toThrow()
  })
})
