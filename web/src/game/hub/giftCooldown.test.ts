import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canGiftToday, recordGift } from './giftCooldown'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

describe('giftCooldown', () => {
  beforeEach(() => {
    installLocalStorageStub()
  })

  it('allows a gift to an NPC that has never been gifted', () => {
    expect(canGiftToday('scholar')).toBe(true)
  })

  it('blocks a second gift to the same NPC on the same day', () => {
    recordGift('scholar')
    expect(canGiftToday('scholar')).toBe(false)
  })

  it('tracks each NPC independently', () => {
    recordGift('scholar')
    expect(canGiftToday('scholar')).toBe(false)
    expect(canGiftToday('merchant')).toBe(true)
  })

  it('fails open (gift allowed) when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(canGiftToday('scholar')).toBe(true)
    expect(() => recordGift('scholar')).not.toThrow()
  })
})
