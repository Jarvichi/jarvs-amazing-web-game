// ─── Economy ──────────────────────────────────────────────────────────────────
//
// Single source of truth for game economy calculations.
// All magic numbers come from ../../data/economy.json — edit them there.
// No side-effects: every export is a pure value or a pure function.

import raw from '../data/economy.json'
import type { CardRarity } from './types'

// ── Typed constants ───────────────────────────────────────────────────────────

export const CRYSTAL_PACK_COST: number = raw.crystalPackCost

export const DISENCHANT_VALUE: Record<CardRarity, number> =
  raw.disenchantValue as Record<CardRarity, number>

export const MERCHANT_PRICES: Record<CardRarity, number> =
  raw.merchantPrices as Record<CardRarity, number>

// Exported as Record<string, number> to avoid a circular dependency with
// miniGames.ts, which re-casts it to Record<MiniGameId, number>.
export const MINI_GAME_COSTS: Record<string, number> = raw.miniGameCosts

// ── Ticket prize types ────────────────────────────────────────────────────────

export interface PrizeReward {
  type: 'card' | 'cards' | 'crystals' | 'bundle'
  count?: number
  amount?: number
  rarity?: CardRarity
}

export interface EconomyPrize {
  id: string
  cost: number
  reward: PrizeReward
}

export const TICKET_PRIZE_COSTS: Record<string, number> = Object.fromEntries(
  (raw.ticketPrizes as Array<{ id: string; cost: number }>).map(p => [p.id, p.cost]),
)

// ── Bulk card pricing ─────────────────────────────────────────────────────────

interface BulkTier { count: number; totalCost: number }
const BULK_TIERS: BulkTier[] = [...(raw.cardBulkTiers as BulkTier[])].sort(
  (a, b) => a.count - b.count,
)

/**
 * Returns the total crystal cost to bulk-buy `n` cards of the same rarity.
 * Uses the tiers in economy.json; linearly interpolates between defined points.
 * Returns 0 for n ≤ 0 and Infinity for counts beyond the largest tier.
 */
export function bulkCardCost(n: number): number {
  if (n <= 0) return 0
  const exact = BULK_TIERS.find(t => t.count === n)
  if (exact) return exact.totalCost

  const below = [...BULK_TIERS].reverse().find(t => t.count < n)
  const above = BULK_TIERS.find(t => t.count > n)
  if (!below) return above ? above.totalCost : Infinity
  if (!above) return Infinity

  const frac = (n - below.count) / (above.count - below.count)
  return Math.round(below.totalCost + frac * (above.totalCost - below.totalCost))
}

// ── Ticket prize valuation ────────────────────────────────────────────────────

/**
 * Returns the crystal value of a ticket prize reward.
 * - `crystals` prizes → face value.
 * - `card` / `cards` prizes → merchant price for that rarity (conservative peg).
 */
export function ticketPrizeCrystalValue(reward: PrizeReward): number {
  if (reward.type === 'crystals') {
    return reward.amount ?? 0
  }
  if (reward.type === 'card') {
    return MERCHANT_PRICES[(reward.rarity ?? 'common') as CardRarity]
  }
  if (reward.type === 'cards') {
    return MERCHANT_PRICES[(reward.rarity ?? 'common') as CardRarity] * (reward.count ?? 1)
  }
  return 0
}

/**
 * Returns the crystal value per ticket for a given prize:
 *   ticketPrizeCrystalValue(reward) / ticketCost
 */
export function ticketPrizeRoi(ticketCost: number, reward: PrizeReward): number {
  if (ticketCost <= 0) return Infinity
  return ticketPrizeCrystalValue(reward) / ticketCost
}
