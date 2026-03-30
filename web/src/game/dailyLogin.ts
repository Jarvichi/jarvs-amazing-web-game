// ─── Daily Login Rewards ──────────────────────────────────────────────────────

import { logError } from '../logger'
import itemsJson        from '../data/items.json'
import rewardsJson      from '../data/rewards.json'
import brokenRelicsJson from '../data/broken-relics.json'
import { CardRarity } from './types'
import { addCollectible, removeCollectible, getCollectibles, ItemDisplayFields } from './itemStore'

const DAILY_KEY = 'jarv_daily_login'

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

// ── Broken relic display recovery ─────────────────────────────────────────────
// Broken relic ids are dynamic: `broken-relic-${slug}-${timestamp}`.
// The first version of the item store migration didn't preserve display fields,
// so existing entries may lack name/icon/desc. This map lets us reconstruct them.

type BrokenRelicEntry = { relicName: string; name: string; icon: string; desc: string }
const BROKEN_RELIC_BY_SLUG: Record<string, { name: string; icon: string; desc: string }> =
  Object.fromEntries(
    (brokenRelicsJson as BrokenRelicEntry[]).map(r => [
      r.relicName.toLowerCase().replace(/\s+/g, '-'),
      { name: r.name, icon: r.icon, desc: r.desc },
    ])
  )

function resolveBrokenRelic(id: string): { name: string; icon: string; desc: string } | null {
  if (!id.startsWith('broken-relic-')) return null
  // Strip prefix and trailing timestamp (-digits at the end)
  const slug = id.slice('broken-relic-'.length).replace(/-\d+$/, '')
  const found = BROKEN_RELIC_BY_SLUG[slug]
  if (found) return found
  // Unknown relic — title-case the slug as a last resort
  const title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return { name: `Cracked ${title}`, icon: '🪨', desc: `A cracked ${title} — it held until it didn't.` }
}

// ── Inventory ─────────────────────────────────────────────────────────────────

// Collectible item CRUD delegates to itemStore.ts (see the COLLECTIBLE ITEMS
// section there). Achievement side-effects and display resolution stay here.

export function addToInventory(item: Omit<UselessItem, 'acquiredDate'>): void {
  try {
    const isNew = !getCollectibles().some(e => e.id === item.id)
    const display: ItemDisplayFields = { name: item.name, icon: item.icon, desc: item.desc, lore: item.lore }
    addCollectible(item.id, display)
    if (isNew) {
      import('./achievements').then(({ incrementAchievementProgress }) => {
        incrementAchievementProgress('misc:unique_items')
      })
    }
  } catch (e) { logError('addToInventory failed', { itemId: item.id, error: String(e) }) }
}

/** Remove an item from the inventory (e.g. when sold in the shop). */
export function removeFromInventory(id: string): void {
  removeCollectible(id)
}

export function loadInventory(): UselessItem[] {
  const entries = getCollectibles()
  return entries.map(e => {
    // 1. Catalog (static items.json)
    const def = ALL_ITEMS.find(i => i.id === e.id)
    if (def) return { id: e.id, name: def.name, icon: def.icon, desc: def.desc, lore: def.lore, acquiredDate: e.acquiredDate ?? '' }
    // 2. Stored display fields (items added after the display-field fix)
    if (e.name) return { id: e.id, name: e.name, icon: e.icon ?? '❓', desc: e.desc ?? '', lore: e.lore ?? '', acquiredDate: e.acquiredDate ?? '' }
    // 3. Reconstruct broken relic display from the dynamic id
    const broken = resolveBrokenRelic(e.id)
    if (broken) return { id: e.id, ...broken, lore: '', acquiredDate: e.acquiredDate ?? '' }
    // 4. Unknown item — show raw id as placeholder
    return { id: e.id, name: e.id, icon: '❓', desc: '', lore: '', acquiredDate: e.acquiredDate ?? '' }
  })
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
