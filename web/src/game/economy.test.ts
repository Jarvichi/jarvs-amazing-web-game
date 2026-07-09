import { describe, it, expect } from 'vitest'
import {
  CRYSTAL_PACK_COST,
  DISENCHANT_VALUE,
  AUGMENT_DISENCHANT_VALUE,
  MERCHANT_PRICES,
  MINI_GAME_COSTS,
  bulkCardCost,
  ticketPrizeCrystalValue,
  ticketPrizeRoi,
} from './economy'
import economyRaw from '../data/economy.json'
import type { CardRarity } from './types'

const RARITIES: CardRarity[] = ['common', 'uncommon', 'rare', 'legendary']

// ── JSON shape ────────────────────────────────────────────────────────────────

describe('economy.json shape', () => {
  it('crystalPackCost is a positive number', () => {
    expect(CRYSTAL_PACK_COST).toBeGreaterThan(0)
  })

  it('has all four rarities in disenchantValue', () => {
    for (const r of RARITIES) {
      expect(typeof DISENCHANT_VALUE[r]).toBe('number')
      expect(DISENCHANT_VALUE[r]).toBeGreaterThan(0)
    }
  })

  it('has all four rarities in augmentDisenchantValue', () => {
    for (const r of RARITIES) {
      expect(typeof AUGMENT_DISENCHANT_VALUE[r]).toBe('number')
      expect(AUGMENT_DISENCHANT_VALUE[r]).toBeGreaterThan(0)
    }
  })

  it('has all four rarities in merchantPrices', () => {
    for (const r of RARITIES) {
      expect(typeof MERCHANT_PRICES[r]).toBe('number')
      expect(MERCHANT_PRICES[r]).toBeGreaterThan(0)
    }
  })

  it('has all four mini games in miniGameCosts', () => {
    const games = ['marble', 'tileflip', 'crystalcatch', 'spinner']
    for (const g of games) {
      expect(typeof MINI_GAME_COSTS[g]).toBe('number')
      expect(MINI_GAME_COSTS[g]).toBeGreaterThan(0)
    }
  })

  it('every ticket prize has a positive cost and a valid reward type', () => {
    const validTypes = ['card', 'cards', 'crystals', 'bundle']
    for (const prize of economyRaw.ticketPrizes) {
      expect(prize.cost).toBeGreaterThan(0)
      expect(validTypes).toContain(prize.reward.type)
    }
  })
})

// ── Disenchant vs merchant (no buy-then-disenchant arbitrage) ─────────────────

describe('disenchant vs merchant prices', () => {
  it('disenchant value is strictly less than merchant price for every rarity', () => {
    for (const r of RARITIES) {
      expect(DISENCHANT_VALUE[r]).toBeLessThan(MERCHANT_PRICES[r])
    }
  })
})

// ── Merchant price monotonicity ───────────────────────────────────────────────

describe('merchant prices monotonicity', () => {
  it('prices increase strictly with rarity', () => {
    expect(MERCHANT_PRICES.common).toBeLessThan(MERCHANT_PRICES.uncommon)
    expect(MERCHANT_PRICES.uncommon).toBeLessThan(MERCHANT_PRICES.rare)
    expect(MERCHANT_PRICES.rare).toBeLessThan(MERCHANT_PRICES.legendary)
  })
})

// ── Augment disenchant value monotonicity ─────────────────────────────────────

describe('augment disenchant value monotonicity', () => {
  it('a common augment yields fewer souls than a legendary one', () => {
    expect(AUGMENT_DISENCHANT_VALUE.common).toBeLessThan(AUGMENT_DISENCHANT_VALUE.uncommon)
    expect(AUGMENT_DISENCHANT_VALUE.uncommon).toBeLessThan(AUGMENT_DISENCHANT_VALUE.rare)
    expect(AUGMENT_DISENCHANT_VALUE.rare).toBeLessThan(AUGMENT_DISENCHANT_VALUE.legendary)
  })
})

// ── Crystal bundle monotonicity (ticket economy invariants) ───────────────────

describe('Ticket economy invariants', () => {
  type CrystalPrize = {
    id: string
    cost: number
    reward: { type: 'crystals'; amount: number }
  }

  const crystalPrizes = (economyRaw.ticketPrizes as Array<{
    id: string; cost: number; reward: { type: string; amount?: number }
  }>).filter((p): p is CrystalPrize => p.reward.type === 'crystals')

  it('crystal bundles must be monotonic (no arbitrage)', () => {
    for (let i = 0; i < crystalPrizes.length; i++) {
      for (let j = 0; j < crystalPrizes.length; j++) {
        if (i === j) continue

        const a = crystalPrizes[i]
        const b = crystalPrizes[j]

        if (a.reward.amount > b.reward.amount) {
          const rateA = a.reward.amount / a.cost
          const rateB = b.reward.amount / b.cost
          expect(rateA).toBeGreaterThanOrEqual(rateB)
        }
      }
    }
  })

  it('crystal amount grows with ticket cost', () => {
    const sorted = [...crystalPrizes].sort((a, b) => a.cost - b.cost)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].reward.amount).toBeGreaterThan(sorted[i - 1].reward.amount)
    }
  })
})

// ── Bulk card pricing ─────────────────────────────────────────────────────────

describe('bulkCardCost', () => {
  it('returns 0 for 0 cards', () => {
    expect(bulkCardCost(0)).toBe(0)
  })

  it('is monotonically increasing', () => {
    const counts = [1, 2, 3, 5, 10]
    for (let i = 1; i < counts.length; i++) {
      expect(bulkCardCost(counts[i])).toBeGreaterThan(bulkCardCost(counts[i - 1]))
    }
  })

  it('per-card cost decreases with larger quantities (bulk discount exists)', () => {
    const counts = [1, 2, 3, 5, 10]
    for (let i = 1; i < counts.length; i++) {
      const perPrev = bulkCardCost(counts[i - 1]) / counts[i - 1]
      const perCurr = bulkCardCost(counts[i]) / counts[i]
      expect(perCurr).toBeLessThanOrEqual(perPrev)
    }
  })

  it('matches known tier values exactly', () => {
    expect(bulkCardCost(1)).toBe(100)
    expect(bulkCardCost(2)).toBe(195)
    expect(bulkCardCost(3)).toBe(275)
    expect(bulkCardCost(5)).toBe(450)
    expect(bulkCardCost(10)).toBe(900)
  })

  it('interpolates between tiers', () => {
    // 4 cards is between tier 3 (275) and tier 5 (450)
    const cost4 = bulkCardCost(4)
    expect(cost4).toBeGreaterThan(bulkCardCost(3))
    expect(cost4).toBeLessThan(bulkCardCost(5))
  })
})

// ── ticketPrizeCrystalValue ───────────────────────────────────────────────────

describe('ticketPrizeCrystalValue', () => {
  it('returns face value for crystal prizes', () => {
    expect(ticketPrizeCrystalValue({ type: 'crystals', amount: 150 })).toBe(150)
  })

  it('returns merchant price for a single card with rarity', () => {
    expect(ticketPrizeCrystalValue({ type: 'card', count: 1, rarity: 'rare' })).toBe(
      MERCHANT_PRICES.rare,
    )
  })

  it('defaults to common price when no rarity given', () => {
    expect(ticketPrizeCrystalValue({ type: 'card', count: 1 })).toBe(MERCHANT_PRICES.common)
  })

  it('multiplies merchant price by count for card packs', () => {
    expect(ticketPrizeCrystalValue({ type: 'cards', count: 5 })).toBe(
      MERCHANT_PRICES.common * 5,
    )
  })

  it('returns 0 for bundle type', () => {
    expect(ticketPrizeCrystalValue({ type: 'bundle' })).toBe(0)
  })
})

// ── ticketPrizeRoi ────────────────────────────────────────────────────────────

describe('ticketPrizeRoi', () => {
  it('crystal prize ROI equals crystals / ticketCost', () => {
    const roi = ticketPrizeRoi(25, { type: 'crystals', amount: 50 })
    expect(roi).toBeCloseTo(2.0)
  })

  it('returns Infinity when ticketCost is 0', () => {
    expect(ticketPrizeRoi(0, { type: 'crystals', amount: 10 })).toBe(Infinity)
  })
})
