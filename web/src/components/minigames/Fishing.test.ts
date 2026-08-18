import { describe, it, expect } from 'vitest'
import { FISH_TIERS, CAVE_FISH_TIERS, LAKE_FISH_TIERS, OCEAN_FISH_TIERS, TIER_HUB_ITEM, CAVE_TIER_HUB_ITEM, LAKE_TIER_HUB_ITEM, OCEAN_TIER_HUB_ITEM, computeFishStars } from './Fishing'
import HUB_ITEMS from '../../data/hubItems.json'

const hubItemIds = new Set(HUB_ITEMS.map(i => i.id))

describe.each([
  ['river', FISH_TIERS, TIER_HUB_ITEM],
  ['cave', CAVE_FISH_TIERS, CAVE_TIER_HUB_ITEM],
  ['lake', LAKE_FISH_TIERS, LAKE_TIER_HUB_ITEM],
  ['ocean', OCEAN_FISH_TIERS, OCEAN_TIER_HUB_ITEM],
] as const)('%s fish tiers', (_variant, tiers, tierHubItem) => {
  it('chances sum to exactly 100', () => {
    expect(tiers.reduce((sum, t) => sum + t.chance, 0)).toBe(100)
  })

  it('has a distinct tier label per entry', () => {
    expect(new Set(tiers.map(t => t.tier)).size).toBe(tiers.length)
  })

  it('gives every tier a hub-item mapping that resolves to a real item', () => {
    const missing = tiers.filter(t => !tierHubItem[t.tier])
    expect(missing.map(t => t.tier)).toEqual([])
    for (const t of tiers) expect(hubItemIds.has(tierHubItem[t.tier])).toBe(true)
  })

  it('never gives a tier an empty species name list', () => {
    expect(tiers.every(t => t.names.length > 0)).toBe(true)
  })
})

describe('computeFishStars', () => {
  const tier = FISH_TIERS[0] // Tiddler: minG 100, maxG 500

  it('gives the bottom of the range 1 star', () => {
    expect(computeFishStars(tier.minG, tier)).toBe(1)
  })

  it('gives the top of the range 5 stars', () => {
    expect(computeFishStars(tier.maxG, tier)).toBe(5)
    expect(computeFishStars(tier.maxG - 1, tier)).toBe(5)
  })

  it('gives a mid-range weight a middle star count', () => {
    const mid = tier.minG + (tier.maxG - tier.minG) / 2
    expect(computeFishStars(mid, tier)).toBe(3)
  })

  it('never returns fewer than 1 or more than 5 stars, even out of range', () => {
    expect(computeFishStars(tier.minG - 1000, tier)).toBe(1)
    expect(computeFishStars(tier.maxG + 1000, tier)).toBe(5)
  })
})

it('cave and river tiers use disjoint hub-items and tier labels', () => {
  const riverTiers = new Set(FISH_TIERS.map(t => t.tier))
  const caveTiers = new Set(CAVE_FISH_TIERS.map(t => t.tier))
  for (const t of caveTiers) expect(riverTiers.has(t)).toBe(false)

  const riverItems = new Set(Object.values(TIER_HUB_ITEM))
  const caveItems = new Set(Object.values(CAVE_TIER_HUB_ITEM))
  for (const id of caveItems) expect(riverItems.has(id)).toBe(false)
})
