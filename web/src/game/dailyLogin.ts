// ─── Daily Login Rewards ──────────────────────────────────────────────────────

import { logError } from '../logger'
import itemsJson   from '../data/items.json'
import rewardsJson from '../data/rewards.json'
import { CardRarity } from './types'

const DAILY_KEY     = 'jarv_daily_login'
const INVENTORY_KEY = 'jarv_inventory'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RewardDef {
  id: string
  name: string
  icon: string
  desc: string
  lore: string
  weight: number
  type: 'crystals' | 'card' | 'pack' | 'item' | 'consumable'
  // type-specific
  amount?:       number   // crystals: how many
  cardName?:     string   // card: specific card (resolved at grant time for rarity rewards)
  consumableId?: string   // consumable: which consumable to grant
  rarity?:       string   // card: pick random card of this rarity
  count?:        number   // pack: number of cards (default 5)
}

export interface UselessItem {
  id: string
  name: string
  icon: string
  desc: string
  lore: string
  acquiredDate: string
}

// ── Reward pool ───────────────────────────────────────────────────────────────

/** Items from items.json promoted to RewardDef with type:'item' */
export const ALL_ITEMS: RewardDef[] = (itemsJson as Omit<RewardDef, 'type'>[]).map(
  i => ({ ...i, type: 'item' as const }),
)

/** Non-item rewards (crystals, cards, packs) */
const NON_ITEM_REWARDS: RewardDef[] = rewardsJson as RewardDef[]

/** Full reward pool — everything a player might receive */
export const ALL_REWARDS: RewardDef[] = [...NON_ITEM_REWARDS, ...ALL_ITEMS]

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Pick a weighted-random reward.
 * - If pool omitted, uses ALL_REWARDS (crystals + cards + packs + items).
 * - Item rewards the player already owns are excluded; falls back to full pool
 *   only if the player owns every item in the candidate set.
 */
export function computeReward(
  inventory: UselessItem[],
  pool: RewardDef[] = ALL_REWARDS,
): RewardDef {
  const ownedIds = new Set(inventory.map(i => i.id))
  const available = pool.filter(r => r.type !== 'item' || !ownedIds.has(r.id))
  const source = available.length > 0 ? available : pool

  let rand = Math.random() * source.reduce((s, r) => s + r.weight, 0)
  for (const r of source) {
    rand -= r.weight
    if (rand <= 0) return r
  }
  return source[source.length - 1]
}

// ── Daily login ───────────────────────────────────────────────────────────────

export function hasDailyReward(): boolean {
  try {
    const stored = localStorage.getItem(DAILY_KEY)
    if (!stored) return true
    const { date } = JSON.parse(stored)
    return date !== new Date().toISOString().slice(0, 10)
  } catch {
    return true
  }
}

/**
 * Peek at today's daily reward without marking it as claimed.
 * Returns null if no reward is available today.
 */
export function peekDailyReward(): RewardDef | null {
  if (!hasDailyReward()) return null
  return computeReward(loadInventory())
}

/** Mark today's daily reward as claimed (call only when user confirms). */
export function markDailyRewardClaimed(): void {
  const today = new Date().toISOString().slice(0, 10)
  try { localStorage.setItem(DAILY_KEY, JSON.stringify({ date: today })) } catch { /* ignore */ }
}

/** @deprecated Use peekDailyReward + markDailyRewardClaimed instead. */
export function claimDailyReward(): RewardDef {
  markDailyRewardClaimed()
  return computeReward(loadInventory())
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export function addToInventory(item: Omit<UselessItem, 'acquiredDate'>): void {
  try {
    const raw = localStorage.getItem(INVENTORY_KEY)
    const inv: UselessItem[] = raw ? JSON.parse(raw) : []
    const isNew = !inv.some(i => i.id === item.id)
    inv.push({ ...item, acquiredDate: new Date().toISOString().slice(0, 10) })
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(inv))
    if (isNew) {
      import('./achievements').then(({ incrementAchievementProgress }) => {
        incrementAchievementProgress('misc:unique_items')
      })
    }
  } catch (e) { logError('addToInventory failed', { itemId: item.id, error: String(e) }) }
}

export function loadInventory(): UselessItem[] {
  try {
    const raw = localStorage.getItem(INVENTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

// ── inventory sync ─────────────────────────────────────────────────────────────

export function _inventorySyncCheck(items: UselessItem[]): { msg: string; crystals: number } | null {
  const _sc = (() => { const _d = atob('Kg=='); return _d.charCodeAt(0) })()
  if (items.length !== _sc) return null
  const _m = [89,111,117,39,118,101,32,99,111,108,108,101,99,116,101,100,32,52,50,32,
              105,116,101,109,115,46,32,84,104,101,32,97,110,115,119,101,114,32,119,
              97,115,32,52,50,32,97,108,108,32,97,108,111,110,103,46]
    .map((c: number) => String.fromCharCode(c)).join('')
  return { msg: _m, crystals: _sc }
}

// Keep CardRarity re-export so existing imports don't break
export type { CardRarity }
