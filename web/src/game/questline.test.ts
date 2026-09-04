import { describe, it, expect } from 'vitest'
import { generateRewardChoices } from './questline'
import { getCardCatalog } from './cards'

// ─── generateRewardChoices — tier reward scaling (#2291/#2294) ─────────────
//
// tierBoostedRarity (economy.ts) is unit-tested directly; these confirm it's
// actually wired into the pool generateRewardChoices draws from.

describe('generateRewardChoices — tier reward scaling', () => {
  const catalog = getCardCatalog()
  const rarityOf = (name: string) => catalog.find(c => c.name === name)?.rarity

  it('picks a common card for a regular battle at tier 2 (the authored baseline)', () => {
    const [name] = generateRewardChoices('battle', undefined, 2)
    expect(rarityOf(name)).toBe('common')
  })

  it('defaults to tier 2 (no boost) when effectiveTier is omitted, for any caller outside the campaign tier system', () => {
    const [name] = generateRewardChoices('battle')
    expect(rarityOf(name)).toBe('common')
  })

  it('does not boost below the rarity-floor-boost tier (4)', () => {
    for (const tier of [1, 2, 3]) {
      const [name] = generateRewardChoices('battle', undefined, tier)
      expect(rarityOf(name)).toBe('common')
    }
  })

  it('boosts a regular battle reward from common to uncommon at tier 4+', () => {
    for (const tier of [4, 5]) {
      const [name] = generateRewardChoices('battle', undefined, tier)
      expect(rarityOf(name)).toBe('uncommon')
    }
  })

  it('caps a boss reward at legendary rather than reaching past it at tier 5', () => {
    // Unboosted picks are rare/legendary/rare; at tier 5 rare→epic and legendary is already capped.
    const choices = generateRewardChoices('boss', undefined, 5)
    for (const name of choices) {
      expect(['epic', 'legendary']).toContain(rarityOf(name))
    }
  })
})
