import { describe, it, expect } from 'vitest'
import { isShopItemSold, DailyShopState } from './shopSchedule'

const baseState: DailyShopState = { date: '2026-06-30-2', boughtCardNames: [], soldItemIds: [] }

describe('isShopItemSold', () => {
  it('cards are sold once their name is in boughtCardNames', () => {
    expect(isShopItemSold(baseState, { kind: 'card', cardName: 'Goblin' })).toBe(false)
    const withPurchase = { ...baseState, boughtCardNames: ['Goblin'] }
    expect(isShopItemSold(withPurchase, { kind: 'card', cardName: 'Goblin' })).toBe(true)
    expect(isShopItemSold(withPurchase, { kind: 'card', cardName: 'Ballista Works' })).toBe(false)
  })

  it('the augment slot is sold via the boughtAugment flag', () => {
    expect(isShopItemSold(baseState, { kind: 'augment' })).toBe(false)
    expect(isShopItemSold({ ...baseState, boughtAugment: true }, { kind: 'augment' })).toBe(true)
    expect(isShopItemSold({ ...baseState, boughtAugment: false }, { kind: 'augment' })).toBe(false)
  })

  it('consumables are never gated', () => {
    expect(isShopItemSold(baseState, { kind: 'consumable' })).toBe(false)
    expect(isShopItemSold({ ...baseState, boughtCardNames: ['x'], boughtAugment: true }, { kind: 'consumable' })).toBe(false)
  })
})
