import { describe, it, expect, beforeEach, vi } from 'vitest'
import { recordSellerSeen, recordBuyerSeen, getKnownSellers, getKnownBuyers } from './tradeJournal'

function installLocalStorageStub(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  })
}

describe('tradeJournal', () => {
  beforeEach(() => {
    installLocalStorageStub()
  })

  it('records a new seller and returns it from getKnownSellers', () => {
    expect(getKnownSellers()).toEqual([])
    const entry = { itemId: 'chicken-feed', town: 'Millhaven', speaker: 'Baker Pernel', price: 5, currency: 'crystals' as const }
    expect(recordSellerSeen(entry)).toBe(true)
    expect(getKnownSellers()).toEqual([entry])
  })

  it('dedupes sellers by itemId+town+speaker', () => {
    const entry = { itemId: 'net', town: 'Saltmere Port', speaker: 'Net-Maker Quill', price: 60, currency: 'crystals' as const }
    expect(recordSellerSeen(entry)).toBe(true)
    expect(recordSellerSeen(entry)).toBe(false)
    expect(getKnownSellers()).toHaveLength(1)
  })

  it('treats the same item from a different speaker/town as a distinct seller', () => {
    recordSellerSeen({ itemId: 'fish-bait', town: 'Millhaven', speaker: 'Harbour Tackle Stall', price: 8, currency: 'crystals' })
    recordSellerSeen({ itemId: 'fish-bait', town: 'Saltmere Port', speaker: 'Some Other Stall', price: 10, currency: 'crystals' })
    expect(getKnownSellers()).toHaveLength(2)
  })

  it('records buyers and dedupes the same way', () => {
    const entry = { itemId: 'egg', town: 'Capital City', speaker: 'Baker Otto', rewardSummary: '+20 💎' }
    expect(recordBuyerSeen(entry)).toBe(true)
    expect(recordBuyerSeen(entry)).toBe(false)
    expect(getKnownBuyers()).toEqual([entry])
  })

  it('fails closed to empty lists when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(getKnownSellers()).toEqual([])
    expect(getKnownBuyers()).toEqual([])
    expect(() => recordSellerSeen({ itemId: 'x', town: 'Y', speaker: 'Z', price: 1, currency: 'crystals' })).not.toThrow()
  })
})
