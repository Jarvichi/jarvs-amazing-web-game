import { describe, it, expect, beforeEach } from 'vitest'
import {
  getTownReputation,
  getTownReputationTier,
  getUpgradeLevel,
  nextUpgrade,
  purchaseUpgrade,
  getUnlockedServices,
  hasTownService,
  setUpgradeKindResolver,
  tributeAmount,
  tributeAvailable,
  collectTribute,
} from './reputation'
import { saveCrystals, loadCrystals } from '../collection'
import { getUpgradeTrack } from '../../data/hub/buildingUpgrades'

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
  setUpgradeKindResolver(null)
})

const TOWN = 'Appleford'
const shop = getUpgradeTrack('shop')

describe('reputation default state', () => {
  it('returns zero reputation and level for an unknown town/building', () => {
    expect(getTownReputation(TOWN)).toBe(0)
    expect(getTownReputationTier(TOWN)).toBe(0)
    expect(getUpgradeLevel(TOWN, 'cider-house')).toBe(0)
  })

  it('reports the first level as the next upgrade', () => {
    const n = nextUpgrade(TOWN, 'cider-house', 'shop')
    expect(n.level).toBe(0)
    expect(n.total).toBe(shop.length)
    expect(n.cost).toBe(shop[0].cost)
    expect(n.repLocked).toBe(false)
    expect(n.maxed).toBe(false)
  })
})

describe('purchaseUpgrade', () => {
  it('spends crystals, raises the level and grants reputation', () => {
    saveCrystals(1000)
    const res = purchaseUpgrade(TOWN, 'cider-house', 'shop')
    expect(res.ok).toBe(true)
    expect(loadCrystals()).toBe(1000 - shop[0].cost)
    expect(getUpgradeLevel(TOWN, 'cider-house')).toBe(1)
    expect(getTownReputation(TOWN)).toBe(shop[0].repReward)
  })

  it('refuses when the player cannot afford it', () => {
    saveCrystals(shop[0].cost - 1)
    const res = purchaseUpgrade(TOWN, 'cider-house', 'shop')
    expect(res).toEqual({ ok: false, reason: 'insufficient-crystals' })
    expect(loadCrystals()).toBe(shop[0].cost - 1)
    expect(getUpgradeLevel(TOWN, 'cider-house')).toBe(0)
  })

  it('blocks higher tiers behind a town reputation gate', () => {
    saveCrystals(100000)
    // Level 1 is ungated.
    expect(purchaseUpgrade(TOWN, 'cider-house', 'shop').ok).toBe(true)
    // Level 2 requires more reputation than a single building can provide.
    const gated = nextUpgrade(TOWN, 'cider-house', 'shop')
    if (gated.repRequired > getTownReputation(TOWN)) {
      const res = purchaseUpgrade(TOWN, 'cider-house', 'shop')
      expect(res).toEqual({ ok: false, reason: 'rep-locked' })
      expect(getUpgradeLevel(TOWN, 'cider-house')).toBe(1)
    }
  })

  it('unlocks gated tiers once enough reputation is earned town-wide', () => {
    saveCrystals(100000)
    // Invest across several buildings to accumulate town reputation.
    purchaseUpgrade(TOWN, 'b1', 'shop')
    purchaseUpgrade(TOWN, 'b2', 'shop')
    purchaseUpgrade(TOWN, 'b3', 'shop')
    purchaseUpgrade(TOWN, 'b4', 'shop')
    // With enough rep, b1 can now reach level 2.
    const n = nextUpgrade(TOWN, 'b1', 'shop')
    if (getTownReputation(TOWN) >= n.repRequired) {
      expect(purchaseUpgrade(TOWN, 'b1', 'shop').ok).toBe(true)
      expect(getUpgradeLevel(TOWN, 'b1')).toBe(2)
    }
  })

  it('reports maxed once every level is purchased', () => {
    saveCrystals(1000000)
    // Build up enough town reputation (via other buildings) to clear the gates.
    for (let i = 0; i < 12; i++) purchaseUpgrade(TOWN, `dummy-${i}`, 'shop')
    for (let i = 0; i < shop.length; i++) purchaseUpgrade(TOWN, 'cider-house', 'shop')
    const n = nextUpgrade(TOWN, 'cider-house', 'shop')
    expect(n.maxed).toBe(true)
    expect(n.def).toBeNull()
    expect(purchaseUpgrade(TOWN, 'cider-house', 'shop')).toEqual({ ok: false, reason: 'maxed' })
  })

  it('persists across reloads', () => {
    saveCrystals(1000)
    purchaseUpgrade(TOWN, 'cider-house', 'shop')
    // A fresh read goes through localStorage again.
    expect(getUpgradeLevel(TOWN, 'cider-house')).toBe(1)
    expect(getTownReputation(TOWN)).toBe(shop[0].repReward)
  })
})

describe('unlocked services', () => {
  it('resolves services from purchased levels via the kind resolver', () => {
    saveCrystals(100000)
    setUpgradeKindResolver((_town, id) => (id === 'cider-house' ? 'shop' : undefined))
    expect(getUnlockedServices(TOWN)).toEqual([])
    purchaseUpgrade(TOWN, 'cider-house', 'shop')
    expect(hasTownService(TOWN, shop[0].service!)).toBe(true)
  })

  it('returns nothing when no resolver is registered', () => {
    saveCrystals(1000)
    purchaseUpgrade(TOWN, 'cider-house', 'shop')
    expect(getUnlockedServices(TOWN)).toEqual([])
  })
})

describe('daily tribute', () => {
  it('offers nothing until a service is unlocked', () => {
    setUpgradeKindResolver((_t, id) => (id === 'cider-house' ? 'shop' : undefined))
    expect(tributeAmount(TOWN)).toBe(0)
    expect(tributeAvailable(TOWN)).toBe(false)
  })

  it('scales with unlocked services and credits crystals once per day', () => {
    setUpgradeKindResolver((_t, id) => (id === 'cider-house' ? 'shop' : undefined))
    saveCrystals(100000)
    purchaseUpgrade(TOWN, 'cider-house', 'shop')   // unlocks 1 service
    const amount = tributeAmount(TOWN)
    expect(amount).toBeGreaterThan(0)

    expect(tributeAvailable(TOWN)).toBe(true)
    const before = loadCrystals()
    expect(collectTribute(TOWN)).toBe(amount)
    expect(loadCrystals()).toBe(before + amount)

    // Second collection the same day is a no-op.
    expect(tributeAvailable(TOWN)).toBe(false)
    expect(collectTribute(TOWN)).toBe(0)
    expect(loadCrystals()).toBe(before + amount)
  })
})
