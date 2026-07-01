import { describe, it, expect, afterEach } from 'vitest'
import { getTodaysShopItems, SHOP_TRADER_REGISTRY } from './shopStock'
import { ALL_CONSUMABLES } from '../questline'

const slot = (h: number) => new Date(2026, 5, 30, h, 0, 0)

describe('getTodaysShopItems', () => {
  it('is deterministic for the same 3-hour slot', () => {
    expect(getTodaysShopItems('card-shop', slot(9))).toEqual(getTodaysShopItems('card-shop', slot(10)))
    expect(getTodaysShopItems('augment-shop', slot(9))).toEqual(getTodaysShopItems('augment-shop', slot(10)))
    expect(getTodaysShopItems('supply-shop', slot(9))).toEqual(getTodaysShopItems('supply-shop', slot(10)))
  })

  it('can rotate across different slots', () => {
    const days = Array.from({ length: 14 }, (_, i) => new Date(2026, 5, 1 + i, 9))
    const cardSigs = new Set(days.map(d => JSON.stringify(getTodaysShopItems('card-shop', d))))
    const supplySigs = new Set(days.map(d => JSON.stringify(getTodaysShopItems('supply-shop', d))))
    expect(cardSigs.size).toBeGreaterThan(1)
    expect(supplySigs.size).toBeGreaterThan(1)
  })

  it('returns 3 card deals with valid grants', () => {
    const items = getTodaysShopItems('card-shop', slot(9))
    expect(items.length).toBe(3)
    for (const item of items) {
      expect(item.grant.kind).toBe('card')
      expect(item.itemName).not.toBe('')
      expect(item.price).toBeGreaterThan(0)
    }
  })

  it('returns a single augment deal', () => {
    const items = getTodaysShopItems('augment-shop', slot(9))
    expect(items.length).toBe(1)
    expect(items[0].grant.kind).toBe('augment')
  })

  it('returns a rotating subset of consumables for supplies', () => {
    const items = getTodaysShopItems('supply-shop', slot(9))
    expect(items.length).toBe(Math.min(3, ALL_CONSUMABLES.length))
    const ids = items.map(i => (i.grant as { kind: 'consumable'; id: string }).id)
    expect(new Set(ids).size).toBe(ids.length) // no duplicates within a slot
    for (const item of items) expect(item.grant.kind).toBe('consumable')
  })

  describe('trader registry', () => {
    afterEach(() => {
      delete SHOP_TRADER_REGISTRY['test-spellwright']
    })

    it('a filtered registry entry returns only matching items', () => {
      SHOP_TRADER_REGISTRY['test-spellwright'] = { kind: 'card', cardFilter: { cardType: 'upgrade', slotCount: 4 } }
      const items = getTodaysShopItems('test-spellwright', slot(9))
      expect(items.length).toBeGreaterThan(0)
      for (const item of items) expect(item.grant.kind).toBe('card')
    })

    it('an unregistered building id returns an empty array (fail closed)', () => {
      expect(getTodaysShopItems('not-a-real-trader', slot(9))).toEqual([])
    })
  })
})
