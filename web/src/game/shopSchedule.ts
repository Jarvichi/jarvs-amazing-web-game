// ─── Shop Schedule & NPC Logic ────────────────────────────────────────────────
//
// All shop-related scheduling, NPC config, card deals, sell slots, and shop
// purchase state. NPC definitions live in src/data/shopNpcs.json.

import { getCardCatalog } from './cards'
import { CardRarity } from './types'
import { ALL_ITEMS, RewardDef } from './dailyLogin'
import { getAugmentCatalog } from './augments'
import shopNpcsJson from '../data/shopNpcs.json'

const SHOP_STATE_KEY  = 'jarv_shop_daily'
const SEEN_NPCS_KEY   = 'jarv_seen_npcs'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShopNPCRole = 'owner' | 'apprentice' | 'specialist' | 'wanderer' | 'legendary_dealer'

export interface ShopNPC {
  name: string
  title: string
  role: ShopNPCRole
  greeting: string
  /** Shown as a small perk note under the NPC name */
  perk: string
  /** In-character line about when their shift ends. Use {time} as placeholder. */
  shiftEndLine: string
  /** Additional in-character dialogue lines, shown randomly alongside greeting. */
  dialogues: string[]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Simple LCG seeded RNG — deterministic for a given seed. */
function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

/** Numeric hash of a string. */
function dateHash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

// ── Date / shift helpers ──────────────────────────────────────────────────────

export function isWeekend(): boolean {
  const day = new Date().getDay()
  return day === 0 || day === 6
}

/** Day shift: 06:00–17:59. Night shift: 18:00–05:59. */
export function isNightShift(at?: Date): boolean {
  const h = (at ?? new Date()).getHours()
  return h < 6 || h >= 18
}

/** Returns seconds until the next 3-hour slot boundary. */
export function getSecondsUntilShopReset(): number {
  const now = new Date()
  const slotHour = (Math.floor(now.getHours() / 3) + 1) * 3
  const next = new Date(now)
  next.setSeconds(0, 0)
  next.setMinutes(0, 0)
  if (slotHour >= 24) {
    next.setDate(next.getDate() + 1)
    next.setHours(0, 0)
  } else {
    next.setHours(slotHour, 0)
  }
  return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000))
}

/** Returns seconds until the end of the current 12-hour NPC shift (06:00 or 18:00). */
export function getSecondsUntilShiftEnd(): number {
  const now = new Date()
  const h = now.getHours()
  const next = new Date(now)
  next.setMinutes(0, 0, 0)
  if (h >= 6 && h < 18) {
    next.setHours(18)
  } else if (h >= 18) {
    next.setDate(next.getDate() + 1)
    next.setHours(6)
  } else {
    next.setHours(6)
  }
  return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000))
}

/**
 * Returns a string key identifying the current 3-hour stock slot.
 * Format: "YYYY-MM-DD-N" where N is 0–7.
 */
export function getShopSlotKey(at?: Date): string {
  const d = at ?? new Date()
  const date = d.toISOString().slice(0, 10)
  const slot = Math.floor(d.getHours() / 3)
  return `${date}-${slot}`
}

/**
 * Returns a key identifying the current 12-hour NPC shift.
 * Format: "YYYY-MM-DD-day" or "YYYY-MM-DD-night".
 */
export function getShiftKey(at?: Date): string {
  const d = at ?? new Date()
  const h = d.getHours()
  if (h >= 6 && h < 18) {
    return `${d.toISOString().slice(0, 10)}-day`
  } else if (h >= 18) {
    return `${d.toISOString().slice(0, 10)}-night`
  } else {
    const prev = new Date(d)
    prev.setDate(prev.getDate() - 1)
    return `${prev.toISOString().slice(0, 10)}-night`
  }
}

// ── NPC pools (sourced from shopNpcs.json) ────────────────────────────────────

const DAY_SHIFT_NPCS: ShopNPC[]   = shopNpcsJson.dayShift   as ShopNPC[]
const NIGHT_SHIFT_NPCS: ShopNPC[] = shopNpcsJson.nightShift as ShopNPC[]

export function getDailyShopNPC(at?: Date): ShopNPC {
  const shiftKey = getShiftKey(at)
  const night    = isNightShift(at)
  const pool     = night ? NIGHT_SHIFT_NPCS : DAY_SHIFT_NPCS
  const shiftSeed = night ? 0xbaadf00d : 0xdeadbeef
  const rng      = makeSeededRng(dateHash(shiftKey) ^ shiftSeed)
  const idx      = Math.floor(rng() * pool.length)
  const npc      = { ...pool[idx] }

  // Resolve Pip's dynamic greeting/perk at call time
  if (npc.name === 'Pip' && npc.role === 'apprentice') {
    const weekend = isWeekend()
    npc.perk = weekend ? '10% weekend discount · buys select items' : '10% discount on weekends'
    if (!night) {
      npc.greeting = weekend
        ? "Um, hi! I'm looking after the shop today. It's the weekend so I'm doing discounts!"
        : "Um, hi! I'm looking after the shop today. I think."
    }
  }

  return npc
}

/**
 * Pick a random dialogue line from an NPC's dialogue pool.
 * Uses a session-stable seed so the line doesn't change on re-render.
 */
export function getRandomNPCDialogue(npc: ShopNPC, sessionSeed?: number): string {
  if (!npc.dialogues || npc.dialogues.length === 0) return npc.greeting
  const seed = sessionSeed ?? Date.now()
  const idx  = Math.floor(makeSeededRng(seed >>> 0)() * npc.dialogues.length)
  return npc.dialogues[idx]
}

// ── Shop card deals ────────────────────────────────────────────────────────────

export const SHOP_CARD_PRICES: Record<CardRarity, number> = {
  common:    30,
  uncommon:  75,
  rare:      180,
  epic:      250,
  legendary: 350,
  mythic:    2000,
  shiny:     1000,
  holofoil:  1000,
  glass:     800,
}

export interface ShopCardDeal {
  cardName: string
  rarity: CardRarity
  price: number
}

/** Returns the current stock's 3 card deals (refreshes every 3 hours). */
export function getDailyShopCards(at?: Date): ShopCardDeal[] {
  const slotKey = getShopSlotKey(at)
  const rng     = makeSeededRng(dateHash(slotKey) ^ 0xcafebabe)
  const catalog = getCardCatalog()
  const npc     = getDailyShopNPC(at)

  const pick = (rarity: CardRarity): ShopCardDeal => {
    const pool = catalog.filter(c => c.rarity === rarity)
    if (pool.length === 0) return { cardName: '', rarity, price: SHOP_CARD_PRICES[rarity] }
    const card = pool[Math.floor(rng() * pool.length)]
    return { cardName: card.name, rarity, price: SHOP_CARD_PRICES[rarity] }
  }

  const topSlot = npc.role === 'legendary_dealer' ? pick('legendary') : pick('rare')
  return [pick('common'), pick('uncommon'), topSlot]
}

// ── Daily augment deal ────────────────────────────────────────────────────────

export const SHOP_AUGMENT_PRICES: Record<CardRarity, number> = {
  common:    80,
  uncommon:  200,
  rare:      500,
  epic:      800,
  legendary: 1200,
  mythic:    0,
  shiny:     0,
  holofoil:  0,
  glass:     0,
}

export interface ShopAugmentDeal {
  augmentName: string
  rarity: CardRarity
  price: number
}

/** Returns a single random augment deal for the current stock slot (refreshes every 3 hours). */
export function getDailyShopAugment(at?: Date): ShopAugmentDeal {
  const slotKey = getShopSlotKey(at)
  const rng     = makeSeededRng(dateHash(slotKey) ^ 0xdeadbeef)
  const catalog = getAugmentCatalog().filter(c =>
    c.rarity === 'common' || c.rarity === 'uncommon' || c.rarity === 'rare' || c.rarity === 'epic' || c.rarity === 'legendary'
  )
  if (catalog.length === 0) return { augmentName: '', rarity: 'common', price: SHOP_AUGMENT_PRICES.common }
  const aug = catalog[Math.floor(rng() * catalog.length)]
  return {
    augmentName: aug.name,
    rarity: aug.rarity as CardRarity,
    price: SHOP_AUGMENT_PRICES[aug.rarity as CardRarity] ?? SHOP_AUGMENT_PRICES.common,
  }
}

// ── Daily sell slots ───────────────────────────────────────────────────────────

/** Items the shopkeeper is looking to buy this slot. 1 on weekdays, 3 on weekends. */
export function getDailyShopSellSlots(at?: Date): RewardDef[] {
  const slotKey = getShopSlotKey(at)
  const seed    = dateHash(slotKey) ^ 0xf00dcafe
  const d       = at ?? new Date()
  const count   = (d.getDay() === 0 || d.getDay() === 6) ? 3 : 1
  const rng     = makeSeededRng(seed)
  const result: RewardDef[] = []
  const used    = new Set<number>()

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
  boughtCardNames: string[]
  soldItemIds: string[]
  boughtAugment?: boolean
}

function freshShopState(): DailyShopState {
  return { date: getShopSlotKey(), boughtCardNames: [], soldItemIds: [] }
}

export function loadDailyShopState(): DailyShopState {
  try {
    const raw = localStorage.getItem(SHOP_STATE_KEY)
    if (!raw) return freshShopState()
    const parsed = JSON.parse(raw) as DailyShopState
    if (parsed.date !== getShopSlotKey()) return freshShopState()
    return parsed
  } catch {
    return freshShopState()
  }
}

export function saveDailyShopState(state: DailyShopState): void {
  try { localStorage.setItem(SHOP_STATE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

// ── Seen NPCs tracking ────────────────────────────────────────────────────────

export function loadSeenNPCs(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_NPCS_KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch { /* ignore */ }
  return new Set()
}

/**
 * Records an NPC visit. Returns true if this is the first time meeting them.
 */
export function recordNPCVisit(name: string): boolean {
  const seen = loadSeenNPCs()
  if (seen.has(name)) return false
  seen.add(name)
  try { localStorage.setItem(SEEN_NPCS_KEY, JSON.stringify([...seen])) } catch { /* ignore */ }
  return true
}

// ── Dev schedule logger ───────────────────────────────────────────────────────

export function logDevSchedule(): void {
  const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const now = new Date()
  const slotStart = new Date(now)
  slotStart.setMinutes(0, 0, 0)
  slotStart.setHours(Math.floor(now.getHours() / 3) * 3)

  const fmt = (d: Date) => {
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${hh}:${mm}`
  }
  const fmtTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:00`

  console.group('%c🏪 SHOP SCHEDULE — next 48h', 'font-weight:bold;color:#8bc34a')

  let lastShiftKey = ''
  for (let i = 0; i < 16; i++) {
    const slot     = new Date(slotStart.getTime() + i * 3 * 60 * 60 * 1000)
    const shiftKey = getShiftKey(slot)

    if (shiftKey !== lastShiftKey) {
      lastShiftKey = shiftKey
      const night      = isNightShift(slot)
      const npc        = getDailyShopNPC(slot)
      const shiftLabel = night ? 'Night (18:00–06:00)' : 'Day (06:00–18:00)'
      console.group(`%c[SHIFT] ${fmt(slot)} — ${shiftLabel}`, 'font-weight:bold;color:#ffd54f')
      console.log(`%c  👤 ${npc.name} — ${npc.title}`, 'color:#ce93d8')
      console.log(`%c  ✦  ${npc.perk}`, 'color:#80cbc4')
      console.log(`%c  💬 "${npc.greeting}"`, 'color:#90a4ae')
    }

    const cards   = getDailyShopCards(slot)
    const sells   = getDailyShopSellSlots(slot)
    const slotEnd = new Date(slot.getTime() + 3 * 60 * 60 * 1000)
    const cardLine = cards.map(c => `${c.cardName} (${c.rarity[0].toUpperCase()} ${c.price}💎)`).join('  •  ')
    const sellLine = sells.map(s => `${s.icon} ${s.name}`).join(', ')
    console.log(
      `  [${fmtTime(slot)}–${fmtTime(slotEnd)}]  ${cardLine}  │  Buys: ${sellLine}`,
    )

    const nextSlot = new Date(slot.getTime() + 3 * 60 * 60 * 1000)
    if (i === 15 || getShiftKey(nextSlot) !== shiftKey) {
      console.groupEnd()
    }
  }

  console.groupEnd()
}
