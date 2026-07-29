import { describe, it, expect, beforeEach } from 'vitest'
import {
  isShopItemSold,
  markCardBought,
  markAugmentBought,
  getDailyShopCards,
  resolveShopNpcForHubNpc,
  DailyShopState,
} from './shopSchedule'

const baseState: DailyShopState = { date: '2026-06-30-2', buildings: {}, soldItemIds: [] }

describe('isShopItemSold', () => {
  it('cards are sold once their name is recorded for that building', () => {
    expect(isShopItemSold(baseState, 'card-shop', { kind: 'card', cardName: 'Goblin' })).toBe(false)
    const withPurchase = markCardBought(baseState, 'card-shop', 'Goblin')
    expect(isShopItemSold(withPurchase, 'card-shop', { kind: 'card', cardName: 'Goblin' })).toBe(true)
    expect(isShopItemSold(withPurchase, 'card-shop', { kind: 'card', cardName: 'Ballista Works' })).toBe(false)
  })

  it('the augment slot is sold via the per-building boughtAugment flag', () => {
    expect(isShopItemSold(baseState, 'augment-shop', { kind: 'augment' })).toBe(false)
    const bought = markAugmentBought(baseState, 'augment-shop')
    expect(isShopItemSold(bought, 'augment-shop', { kind: 'augment' })).toBe(true)
  })

  it('consumables are never gated', () => {
    expect(isShopItemSold(baseState, 'supply-shop', { kind: 'consumable' })).toBe(false)
    const withPurchases = markAugmentBought(markCardBought(baseState, 'supply-shop', 'x'), 'supply-shop')
    expect(isShopItemSold(withPurchases, 'supply-shop', { kind: 'consumable' })).toBe(false)
  })

  it('buying a card at one building does not mark it sold at a different building (regression)', () => {
    const withPurchase = markCardBought(baseState, 'card-shop-crownhaven', 'Goblin')
    expect(isShopItemSold(withPurchase, 'card-shop-crownhaven', { kind: 'card', cardName: 'Goblin' })).toBe(true)
    expect(isShopItemSold(withPurchase, 'card-shop', { kind: 'card', cardName: 'Goblin' })).toBe(false)
    expect(isShopItemSold(withPurchase, 'card-shop-millhaven', { kind: 'card', cardName: 'Goblin' })).toBe(false)
  })

  it('buying an augment at one building does not mark it sold at a different building', () => {
    const bought = markAugmentBought(baseState, 'augment-shop-crownhaven')
    expect(isShopItemSold(bought, 'augment-shop-crownhaven', { kind: 'augment' })).toBe(true)
    expect(isShopItemSold(bought, 'augment-shop', { kind: 'augment' })).toBe(false)
  })
})

describe('markCardBought / markAugmentBought', () => {
  it('are immutable — they return a new state and do not mutate the input', () => {
    const before = JSON.stringify(baseState)
    const updated = markCardBought(baseState, 'card-shop', 'Goblin')
    expect(JSON.stringify(baseState)).toBe(before)
    expect(updated).not.toBe(baseState)
    expect(updated.buildings['card-shop'].boughtCardNames).toEqual(['Goblin'])
  })

  it('accumulate multiple card purchases for the same building', () => {
    const s1 = markCardBought(baseState, 'card-shop', 'Goblin')
    const s2 = markCardBought(s1, 'card-shop', 'Ballista Works')
    expect(s2.buildings['card-shop'].boughtCardNames).toEqual(['Goblin', 'Ballista Works'])
  })

  it('do not disturb other buildings already recorded on the state', () => {
    const s1 = markCardBought(baseState, 'card-shop', 'Goblin')
    const s2 = markAugmentBought(s1, 'augment-shop')
    expect(s2.buildings['card-shop'].boughtCardNames).toEqual(['Goblin'])
    expect(s2.buildings['augment-shop'].boughtAugment).toBe(true)
  })
})

describe('getDailyShopCards filters', () => {
  const at = new Date('2026-06-30T12:00:00Z')

  it('with no filter, matches the default 3-slot common/uncommon/rare-or-legendary spread', () => {
    const deals = getDailyShopCards(at)
    expect(deals).toHaveLength(3)
  })

  it('cardType filter restricts every deal to that card type', () => {
    const deals = getDailyShopCards(at, { cardType: 'upgrade' })
    expect(deals.length).toBeGreaterThan(0)
    for (const d of deals) {
      expect(d.cardName).not.toBe('')
    }
  })

  it('rarity filter restricts every deal to a single rarity with no duplicates', () => {
    const deals = getDailyShopCards(at, { rarity: 'common', slotCount: 5 })
    expect(deals.length).toBeGreaterThan(0)
    for (const d of deals) expect(d.rarity).toBe('common')
    const names = deals.map(d => d.cardName)
    expect(new Set(names).size).toBe(names.length)
  })

  it('rarities filter draws from a combined pool with no duplicates', () => {
    const deals = getDailyShopCards(at, { rarities: ['epic', 'legendary'], slotCount: 4 })
    expect(deals.length).toBeGreaterThan(0)
    for (const d of deals) expect(['epic', 'legendary']).toContain(d.rarity)
    const names = deals.map(d => d.cardName)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('resolveShopNpcForHubNpc', () => {
  const at = new Date('2026-06-30T12:00:00Z') // day shift, 2026-06-30-day

  it('returns the matching roster entry by name, ignoring the rare-visitor roll', () => {
    const npc = resolveShopNpcForHubNpc('card-shop', 'Vorn', ['some dialogue'], at)
    expect(npc.name).toBe('Vorn')
    expect(npc.role).toBe('legendary_dealer')
    expect(npc.title).toBe('Shadow Merchant')
  })

  it('falls back to a generic identity built from the hub NPC when there is no roster match and the rare roll misses', () => {
    // Seeded miss for this building/shift (verified against the resolver's own RNG algorithm).
    const npc = resolveShopNpcForHubNpc('supplies-vendor-crownhaven', 'Dealer Sloane', ['line1', 'line2'], at)
    expect(npc.name).toBe('Dealer Sloane')
    expect(npc.role).toBe('owner')
    expect(npc.title).toBe('Shopkeeper')
    expect(npc.greeting).toBe('line1')
    expect(npc.dialogues).toEqual(['line1', 'line2'])
  })

  it('substitutes a rare traveling seller when the per-building-per-shift roll hits', () => {
    // Seeded hit for this building/shift (verified against the resolver's own RNG algorithm) — resolves to Lysandra.
    const npc = resolveShopNpcForHubNpc('augment-shop', 'Dealer Sloane', ['line1'], at)
    expect(npc.name).toBe('Lysandra')
    expect(npc.role).toBe('legendary_dealer')
    expect(['Aldric', 'Lysandra']).toContain(npc.name)
  })

  it('is deterministic for the same building and shift, and can differ across buildings', () => {
    const first  = resolveShopNpcForHubNpc('augment-shop', 'Dealer Sloane', ['line1'], at)
    const second = resolveShopNpcForHubNpc('augment-shop', 'Dealer Sloane', ['line1'], at)
    expect(second).toEqual(first)

    const other = resolveShopNpcForHubNpc('card-shop-bldg', 'Dealer Sloane', ['line1'], at)
    expect(other.name).not.toBe(first.name)
  })
})

describe('getDailyShopCards with npcOverride', () => {
  it('uses the overridden NPC role for the legendary-slot decision instead of the random daily pick', () => {
    const at = new Date('2026-06-30T12:00:00Z')
    const legendaryDealer = resolveShopNpcForHubNpc('card-shop', 'Vorn', [], at)
    const deals = getDailyShopCards(at, undefined, legendaryDealer)
    expect(deals[2].rarity).toBe('legendary')
  })
})

describe('loadDailyShopState migration', () => {
  // In-memory localStorage mock (tests run in node environment)
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

  it('treats an old flat-shape payload as stale and returns a fresh state', async () => {
    const { getShopSlotKey, loadDailyShopState } = await import('./shopSchedule')
    const oldFlatPayload = {
      date: getShopSlotKey(),
      boughtCardNames: ['Goblin'],
      soldItemIds: [],
      boughtAugment: true,
    }
    localStorage.setItem('jarv_shop_daily', JSON.stringify(oldFlatPayload))
    const state = loadDailyShopState()
    expect(state.buildings).toEqual({})
    expect(state.soldItemIds).toEqual([])
  })
})
