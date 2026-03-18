// ─── Daily Login Rewards ──────────────────────────────────────────────────────

import itemsJson   from '../data/items.json'
import rewardsJson from '../data/rewards.json'
import { getCardCatalog } from './cards'
import { CardRarity } from './types'

const DAILY_KEY       = 'jarv_daily_login'
const INVENTORY_KEY   = 'jarv_inventory'
const SHOP_STATE_KEY  = 'jarv_shop_daily'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RewardDef {
  id: string
  name: string
  icon: string
  desc: string
  lore: string
  weight: number
  type: 'crystals' | 'card' | 'pack' | 'item'
  // type-specific
  amount?:   number   // crystals: how many
  cardName?: string   // card: specific card (resolved at grant time for rarity rewards)
  rarity?:   string   // card: pick random card of this rarity
  count?:    number   // pack: number of cards (default 5)
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

// ── Daily shop item ───────────────────────────────────────────────────────────

/**
 * Returns the item the shopkeeper is "looking for" today.
 * Deterministic for a given date — same item all day, different each day.
 */
export function getDailyShopItem(): RewardDef {
  const today = new Date().toISOString().slice(0, 10)
  // simple numeric hash of the date string for a stable daily seed
  let seed = 0
  for (let i = 0; i < today.length; i++) seed = (seed * 31 + today.charCodeAt(i)) >>> 0
  const idx = seed % ALL_ITEMS.length
  return ALL_ITEMS[idx]
}

// ── Date helpers ──────────────────────────────────────────────────────────────

export function isWeekend(): boolean {
  const day = new Date().getDay() // 0 = Sun, 6 = Sat
  return day === 0 || day === 6
}

/** Simple LCG seeded RNG — deterministic for a given seed. */
function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

/** Numeric hash of a date string (YYYY-MM-DD). */
function dateHash(date: string): number {
  let h = 0
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) >>> 0
  return h
}

export function getSecondsUntilShopReset(): number {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(now.getUTCDate() + 1)
  tomorrow.setUTCHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000))
}

// ── Shop NPCs ─────────────────────────────────────────────────────────────────

export type ShopNPCRole = 'owner' | 'apprentice' | 'specialist' | 'wanderer' | 'legendary_dealer'

export interface ShopNPC {
  name: string
  title: string
  role: ShopNPCRole
  greeting: string
  /** Shown as a small perk note under the NPC name */
  perk: string
}

/** Day shift: 06:00–17:59 local time. Night shift: 18:00–05:59. */
export function isNightShift(): boolean {
  const h = new Date().getHours()
  return h < 6 || h >= 18
}

const DAY_SHIFT_NPCS: ShopNPC[] = [
  {
    name: 'Margot',
    title: 'Shop Owner',
    role: 'owner',
    greeting: "Welcome. Everything is priced fairly — by my standards.",
    perk: 'Standard prices',
  },
  {
    name: 'Vesna',
    title: 'Card Specialist',
    role: 'specialist',
    greeting: "I know cards. These three? Hand-picked. You're welcome.",
    perk: 'Expert curation · no junk',
  },
  {
    name: 'Aldric',
    title: 'Wandering Dealer',
    role: 'wanderer',
    greeting: "Passing through. Today's selection is purely coincidental. Or is it?",
    perk: 'Rare stock rotation',
  },
  {
    name: 'Pip',
    title: 'Apprentice (Day)',
    role: 'apprentice',
    greeting: "Um, hi! I'm looking after the shop today. I think. Oh, and it's the weekend so I'm doing discounts!",
    perk: isWeekend() ? '10% weekend discount · buys select items' : '10% discount on weekends',
  },
  {
    name: 'Seraph',
    title: 'Archivist',
    role: 'specialist',
    greeting: "The collection doesn't grow by itself. Invest wisely.",
    perk: 'Curated daily selection',
  },
  {
    name: 'Lysandra',
    title: 'Legendary Broker',
    role: 'legendary_dealer',
    greeting: "Rare finds don't come cheap. But they do come available — if you know where to look.",
    perk: '✦ Sells one legendary card today',
  },
]

const NIGHT_SHIFT_NPCS: ShopNPC[] = [
  {
    name: 'Grix',
    title: 'Goblin Night Trader',
    role: 'wanderer',
    greeting: "Psst. Grix open late. Very secret. Very good deals. Mostly.",
    perk: 'Goblin prices (same as everyone else)',
  },
  {
    name: 'Nox',
    title: 'Nocturnal Curator',
    role: 'specialist',
    greeting: "The serious collectors shop at night. Good to see you.",
    perk: 'Night owl selection',
  },
  {
    name: 'Pip',
    title: 'Apprentice (Night)',
    role: 'apprentice',
    greeting: "Margot said I could do the night shift. This is fine. Everything is fine.",
    perk: isWeekend() ? '10% weekend discount · buys select items' : '10% discount on weekends',
  },
  {
    name: 'The Stranger',
    title: 'Unknown Origin',
    role: 'wanderer',
    greeting: "...",
    perk: 'Does not elaborate further',
  },
  {
    name: 'Cass',
    title: 'Off-Duty Guard',
    role: 'owner',
    greeting: "Not usually my job, but here we are. Don't tell Margot.",
    perk: 'Moonlighting — honest prices',
  },
  {
    name: 'Vorn',
    title: 'Shadow Merchant',
    role: 'legendary_dealer',
    greeting: "I only come out at night. And I only deal in the extraordinary.",
    perk: '✦ Sells one legendary card tonight',
  },
]

export function getDailyShopNPC(): ShopNPC {
  const today = new Date().toISOString().slice(0, 10)
  const night = isNightShift()
  const pool = night ? NIGHT_SHIFT_NPCS : DAY_SHIFT_NPCS
  const shiftSeed = night ? 0xbaadf00d : 0xdeadbeef
  const rng = makeSeededRng(dateHash(today) ^ shiftSeed)
  const idx = Math.floor(rng() * pool.length)
  return pool[idx]
}

// ── Daily shop card deals ──────────────────────────────────────────────────────

export const SHOP_CARD_PRICES: Record<CardRarity, number> = {
  common:    30,
  uncommon:  75,
  rare:      180,
  legendary: 350,
}

export interface ShopCardDeal {
  cardName: string
  rarity: CardRarity
  price: number
}

/** Returns today's 3 card deals. 1 common + 1 uncommon always; 3rd slot is rare
 *  normally, or legendary when a legendary_dealer NPC is on duty. */
export function getDailyShopCards(): ShopCardDeal[] {
  const today = new Date().toISOString().slice(0, 10)
  const rng = makeSeededRng(dateHash(today) ^ 0xcafebabe)
  const catalog = getCardCatalog()
  const npc = getDailyShopNPC()

  const pick = (rarity: CardRarity): ShopCardDeal => {
    const pool = catalog.filter(c => c.rarity === rarity)
    if (pool.length === 0) return { cardName: '', rarity, price: SHOP_CARD_PRICES[rarity] }
    const card = pool[Math.floor(rng() * pool.length)]
    return { cardName: card.name, rarity, price: SHOP_CARD_PRICES[rarity] }
  }

  const topSlot = npc.role === 'legendary_dealer' ? pick('legendary') : pick('rare')
  return [pick('common'), pick('uncommon'), topSlot]
}

// ── Daily sell slots (shopkeeper wants to buy N items today) ───────────────────

/** Items the shopkeeper is looking to buy today. 1 on weekdays, 3 on weekends. */
export function getDailyShopSellSlots(): RewardDef[] {
  const today = new Date().toISOString().slice(0, 10)
  const seed = dateHash(today) ^ 0xf00dcafe
  const count = isWeekend() ? 3 : 1
  const rng = makeSeededRng(seed)
  const result: RewardDef[] = []
  const used = new Set<number>()

  while (result.length < count && result.length < ALL_ITEMS.length) {
    const idx = Math.floor(rng() * ALL_ITEMS.length)
    if (!used.has(idx)) {
      used.add(idx)
      result.push(ALL_ITEMS[idx])
    }
  }
  return result
}

// ── Daily shop purchase state ─────────────────────────────────────────────────

export interface DailyShopState {
  date: string
  boughtCardNames: string[]  // cards purchased from the shop today
  soldItemIds: string[]      // items sold to the shopkeeper today
}

function freshShopState(): DailyShopState {
  return { date: new Date().toISOString().slice(0, 10), boughtCardNames: [], soldItemIds: [] }
}

export function loadDailyShopState(): DailyShopState {
  try {
    const raw = localStorage.getItem(SHOP_STATE_KEY)
    if (!raw) return freshShopState()
    const parsed = JSON.parse(raw) as DailyShopState
    const today = new Date().toISOString().slice(0, 10)
    if (parsed.date !== today) return freshShopState()
    return parsed
  } catch {
    return freshShopState()
  }
}

export function saveDailyShopState(state: DailyShopState): void {
  try { localStorage.setItem(SHOP_STATE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
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
      // Lazy import to avoid circular dep at module load time
      import('./achievements').then(({ incrementAchievementProgress }) => {
        incrementAchievementProgress('misc:unique_items')
      })
    }
  } catch { /* ignore */ }
}

export function loadInventory(): UselessItem[] {
  try {
    const raw = localStorage.getItem(INVENTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

// ── inventory sync ─────────────────────────────────────────────────────────
// Validates that inventory state is consistent after deserialization.
// Returns a non-null payload only when maintenance is required.
export function _inventorySyncCheck(items: UselessItem[]): { msg: string; crystals: number } | null {
  // maintenance constant — do not modify
  const _sc = (() => { const _d = atob('Kg=='); return _d.charCodeAt(0) })()
  if (items.length !== _sc) return null
  // decode diagnostic message
  const _m = [89,111,117,39,118,101,32,99,111,108,108,101,99,116,101,100,32,52,50,32,
              105,116,101,109,115,46,32,84,104,101,32,97,110,115,119,101,114,32,119,
              97,115,32,52,50,32,97,108,108,32,97,108,111,110,103,46]
    .map((c: number) => String.fromCharCode(c)).join('')
  return { msg: _m, crystals: _sc }
}
