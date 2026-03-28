// ─── Gift System ──────────────────────────────────────────────────────────────
// One-off gifts the developer can distribute to players via gifts.json.
// Each gift has a unique ID; claimed IDs are stored in localStorage so the
// player never receives the same gift twice.

import { logError } from '../logger'
import { addCardsToCollection } from './collection'
import { saveCrystals, loadCrystals } from './collection'
import { addItem } from './itemStore'
import { generatePack } from './collection'
import giftsData from '../data/gifts.json'

// ── Types ────────────────────────────────────────────────────────────────────

export type GiftRewardType = 'crystals' | 'card' | 'pack' | 'consumable' | 'item'

export interface GiftReward {
  type: GiftRewardType
  /** crystals: amount to add */
  amount?: number
  /** card: exact card name to add (1 copy) */
  cardName?: string
  /** pack: number of cards to generate */
  count?: number
  /** consumable: consumable id */
  consumableId?: string
  /** consumable: how many to add (default 1) */
  consumableCount?: number
  /** item: useless item id */
  itemId?: string
}

export interface GiftDef {
  id: string
  name: string
  description: string
  createdAt: string
  /** Optional ISO date; gift is unavailable after this date */
  expiresAt?: string
  rewards: GiftReward[]
}

// ── Storage ──────────────────────────────────────────────────────────────────

const CLAIMED_GIFTS_KEY = 'jarv_claimed_gifts'

export function loadClaimedGiftIds(): string[] {
  try {
    const raw = localStorage.getItem(CLAIMED_GIFTS_KEY)
    if (raw) return JSON.parse(raw) as string[]
  } catch { /* ignore */ }
  return []
}

function saveClaimedGiftIds(ids: string[]): void {
  try {
    localStorage.setItem(CLAIMED_GIFTS_KEY, JSON.stringify(ids))
  } catch (e) {
    logError('saveClaimedGiftIds failed', { error: String(e) })
  }
}

export function markGiftClaimed(id: string): void {
  const ids = loadClaimedGiftIds()
  if (!ids.includes(id)) {
    saveClaimedGiftIds([...ids, id])
  }
}

export function resetClaimedGifts(): void {
  try {
    localStorage.removeItem(CLAIMED_GIFTS_KEY)
  } catch { /* ignore */ }
}

// ── Registry ─────────────────────────────────────────────────────────────────

export function getAllGifts(): GiftDef[] {
  return giftsData as GiftDef[]
}

/** Returns gifts that are available (not expired) and not yet claimed by this player. */
export function getUnclaimedGifts(): GiftDef[] {
  const claimed = new Set(loadClaimedGiftIds())
  const today = new Date().toISOString().slice(0, 10)
  return getAllGifts().filter(g => {
    if (claimed.has(g.id)) return false
    if (g.expiresAt && g.expiresAt < today) return false
    return true
  })
}

// ── Reward application ────────────────────────────────────────────────────────

/** Apply all rewards from a gift and mark it claimed. Returns crystals delta. */
export function applyGiftRewards(gift: GiftDef): number {
  let crystalsDelta = 0
  for (const reward of gift.rewards) {
    try {
      if (reward.type === 'crystals' && reward.amount) {
        const next = loadCrystals() + reward.amount
        saveCrystals(next)
        crystalsDelta += reward.amount
      } else if (reward.type === 'card' && reward.cardName) {
        addCardsToCollection([{ cardName: reward.cardName, count: 1 }])
      } else if (reward.type === 'pack') {
        const names = generatePack().slice(0, reward.count ?? 5)
        addCardsToCollection(names.map(name => ({ cardName: name, count: 1 })))
      } else if (reward.type === 'consumable' && reward.consumableId) {
        addItem('consumable', reward.consumableId, reward.consumableCount ?? 1)
      } else if (reward.type === 'item' && reward.itemId) {
        addItem('item', reward.itemId, 1)
      }
    } catch (e) {
      logError('applyGiftReward failed', { rewardType: reward.type, error: String(e) })
    }
  }
  markGiftClaimed(gift.id)
  return crystalsDelta
}

/** Summarise a reward as a short human-readable string for display. */
export function rewardSummary(reward: GiftReward): string {
  switch (reward.type) {
    case 'crystals':  return `${reward.amount} Crystals`
    case 'card':      return `Card: ${reward.cardName}`
    case 'pack':      return `Card Pack (${reward.count ?? 5} cards)`
    case 'consumable': return `Consumable ×${reward.consumableCount ?? 1}`
    case 'item':      return `Inventory item`
    default:          return 'Unknown reward'
  }
}
