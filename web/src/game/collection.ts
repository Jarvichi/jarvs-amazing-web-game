import { Card, CardRarity } from './types'
import { getCardCatalog } from './cards'
import { logError } from '../logger'

// ─── Types ────────────────────────────────────────────────

export interface CollectionEntry {
  cardName: string
  count: number
  masteryXp?: number   // total extra copies consumed for mastery (optional for back-compat)
}

export interface DeckEntry {
  cardName: string
  count: number
}

// ─── Card name migrations ─────────────────────────────────
// Maps old/renamed card names → current names.
// Applied on every load so saves that used old names are transparently upgraded.

const CARD_RENAMES: Record<string, string> = {
  'Build Wall':  'Stone Wall',
  'Build Farm':  'Farm',
  'Arc.Tower':   'Arcane Tower',
  'DrgnLair':    'Dragon Lair',
  'BallstaTwr':  'Ballista Tower',
  'Vamp Coven':  'Vamp. Coven',
  'Cntaur Stbl': 'Centaur Stable',
  'Shadow Acad': 'Shadow Academy',
  'Anc. Altar':  'Ancient Altar',
  'Anc. Grove':  'Ancient Grove',
  'Lizard Den':  'Lizard Warren',
}

function migrateCollectionNames(entries: CollectionEntry[]): CollectionEntry[] {
  const merged: CollectionEntry[] = []
  for (const entry of entries) {
    const name = CARD_RENAMES[entry.cardName] ?? entry.cardName
    const existing = merged.find(e => e.cardName === name)
    if (existing) {
      existing.count += entry.count
      if (entry.masteryXp) existing.masteryXp = (existing.masteryXp ?? 0) + entry.masteryXp
    } else {
      merged.push(name === entry.cardName ? entry : { ...entry, cardName: name })
    }
  }
  return merged
}

function migrateDeckNames(entries: DeckEntry[]): DeckEntry[] {
  const merged: DeckEntry[] = []
  for (const entry of entries) {
    const name = CARD_RENAMES[entry.cardName] ?? entry.cardName
    const existing = merged.find(e => e.cardName === name)
    if (existing) {
      existing.count += entry.count
    } else {
      merged.push(name === entry.cardName ? entry : { ...entry, cardName: name })
    }
  }
  return merged
}

// ─── Constants ────────────────────────────────────────────

const COLLECTION_KEY  = 'jarv_collection'
const DECK_KEY        = 'jarv_deck'
const CRYSTALS_KEY    = 'jarv_crystals'
const WIN_STREAK_KEY  = 'jarv_win_streak'

export const DECK_MIN  = 10
export const DECK_MAX  = 30
export const COPIES_MAX = 4

export const CRYSTAL_PACK_COST = 250

/** Crystals gained per card dismantled, by rarity. */
export const DISENCHANT_VALUE: Record<CardRarity, number> = {
  common:    5,
  uncommon: 15,
  rare:     40,
  legendary: 100,
}

// ─── Starter data ─────────────────────────────────────────

export const STARTER_COLLECTION: CollectionEntry[] = [
  { cardName: 'Goblin',         count: 4 },
  { cardName: 'Archer',         count: 4 },
  { cardName: 'Barbarian',      count: 3 },
  { cardName: 'Knight',         count: 3 },
  { cardName: 'Wizard',         count: 1 },
  { cardName: 'Stone Wall',     count: 4 },
  { cardName: 'Farm',     count: 2 },
  { cardName: 'Barracks',       count: 1 },
  { cardName: 'Sharpen Blades', count: 2 },
  { cardName: 'Fortify',        count: 1 },
]

export const STARTER_DECK: DeckEntry[] = [
  { cardName: 'Goblin',         count: 3 },
  { cardName: 'Archer',         count: 3 },
  { cardName: 'Barbarian',      count: 2 },
  { cardName: 'Knight',         count: 2 },
  { cardName: 'Stone Wall',     count: 2 },
  { cardName: 'Farm',     count: 1 },
  { cardName: 'Sharpen Blades', count: 1 },
]

export interface StarterPackOption {
  id: string
  name: string
  description: string
  cards: DeckEntry[]
}

/** The three starter packs offered after an act completes. */
export const STARTER_PACK_OPTIONS: StarterPackOption[] = [
  {
    id: 'swarm',
    name: 'SWARM',
    description: 'Flood the field with cheap units. Numbers are your armor.',
    cards: [
      { cardName: 'Goblin',         count: 4 },
      { cardName: 'Archer',         count: 3 },
      { cardName: 'Barbarian',      count: 2 },
      { cardName: 'Sharpen Blades', count: 1 },
    ],
  },
  {
    id: 'balanced',
    name: 'BALANCED',
    description: 'A reliable mix of offense, defense, and economy.',
    cards: [
      { cardName: 'Goblin',         count: 3 },
      { cardName: 'Archer',         count: 3 },
      { cardName: 'Barbarian',      count: 2 },
      { cardName: 'Knight',         count: 2 },
      { cardName: 'Stone Wall',     count: 2 },
      { cardName: 'Farm',     count: 1 },
      { cardName: 'Sharpen Blades', count: 1 },
    ],
  },
  {
    id: 'fortress',
    name: 'FORTRESS',
    description: 'Fortify your position. Let walls and farms grind them down.',
    cards: [
      { cardName: 'Goblin',     count: 2 },
      { cardName: 'Knight',     count: 2 },
      { cardName: 'Stone Wall', count: 4 },
      { cardName: 'Farm', count: 2 },
    ],
  },
]

// ─── Card stats ───────────────────────────────────────────

const STATS_KEY = 'jarv_card_stats'

export interface CardStats {
  played: number   // times the card was played from hand by the player
  died:   number   // times a player unit of this type was destroyed in battle
}

export function loadCardStats(): Record<string, CardStats> {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (raw) return JSON.parse(raw) as Record<string, CardStats>
  } catch { /* ignore */ }
  return {}
}

function saveCardStats(stats: Record<string, CardStats>): void {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)) }
  catch (e) { logError('saveCardStats failed', { error: String(e) }) }
}

export function recordCardPlayed(cardName: string): void {
  const stats = loadCardStats()
  const entry = stats[cardName] ?? { played: 0, died: 0 }
  stats[cardName] = { ...entry, played: entry.played + 1 }
  saveCardStats(stats)
}

/** `unitName` is the unit template name (e.g. "Goblin", "Wall", "Farm"). */
export function recordUnitDied(unitName: string): void {
  const stats = loadCardStats()
  const entry = stats[unitName] ?? { played: 0, died: 0 }
  stats[unitName] = { ...entry, died: entry.died + 1 }
  saveCardStats(stats)
}

export function getCardStats(name: string): CardStats {
  return loadCardStats()[name] ?? { played: 0, died: 0 }
}

// ─── Crystal storage ──────────────────────────────────────

export function loadCrystals(): number {
  try {
    const v = localStorage.getItem(CRYSTALS_KEY)
    if (v !== null) return Math.max(0, parseInt(v, 10) || 0)
  } catch { /* ignore */ }
  return 0
}

export function saveCrystals(n: number): void {
  try { localStorage.setItem(CRYSTALS_KEY, String(Math.max(0, n))) }
  catch (e) { logError('saveCrystals failed', { error: String(e) }) }
}

// ─── Mastery math ─────────────────────────────────────────
//
// Mastery level N requires a cumulative total of 5*(2^N - 1) extra copies consumed.
// Per-level costs:  Lv1=5, Lv2=10, Lv3=20, Lv4=40, Lv5=80, Lv6=160, …
// Formula: level = floor(log2(xp/5 + 1))

export function masteryLevel(xp: number): number {
  if (xp <= 0) return 0
  return Math.floor(Math.log2(xp / 5 + 1))
}

/** Total XP (extra copies) needed to reach `level` from 0. */
export function masteryXpForLevel(level: number): number {
  return level <= 0 ? 0 : 5 * ((1 << level) - 1)
}

/** Returns current level, XP within that level, and XP needed for the next level. */
export function masteryProgress(xp: number): { level: number; current: number; needed: number } {
  const level     = masteryLevel(xp)
  const levelStart = masteryXpForLevel(level)
  const levelEnd   = masteryXpForLevel(level + 1)
  return { level, current: xp - levelStart, needed: levelEnd - levelStart }
}

export function getMasteryXp(collection: CollectionEntry[], cardName: string): number {
  return collection.find(e => e.cardName === cardName)?.masteryXp ?? 0
}

// ─── Disenchant ───────────────────────────────────────────

function rarityOf(cardName: string): CardRarity {
  const card = getCardCatalog().find(c => c.name === cardName)
  return card?.rarity ?? 'common'
}

function extraCount(entry: CollectionEntry): number {
  return Math.max(0, entry.count - COPIES_MAX)
}

/**
 * Trim any deck entries whose count exceeds the current collection count for that card.
 * Call this after any disenchant/upgrade operation to keep the deck consistent.
 * Returns true if the deck was modified (and already saved).
 */
export function syncDeckToCollection(collection: CollectionEntry[]): boolean {
  const deck = loadDeck()
  const trimmed = deck.map(e => {
    const owned = getOwnedCount(collection, e.cardName)
    return owned < e.count ? { ...e, count: owned } : e
  }).filter(e => e.count > 0)
  const changed = trimmed.some((e, i) => e.count !== deck[i]?.count || trimmed.length !== deck.length)
  if (changed) saveDeck(trimmed)
  return changed
}

/** Disenchant all extras for a single card → gain crystals, count drops to COPIES_MAX. */
export function disenchantCard(
  collection: CollectionEntry[],
  cardName: string,
): { collection: CollectionEntry[]; gained: number } {
  const entry = collection.find(e => e.cardName === cardName)
  const extras = entry ? extraCount(entry) : 0
  if (extras === 0) return { collection, gained: 0 }
  const gained = DISENCHANT_VALUE[rarityOf(cardName)] * extras
  return {
    collection: collection.map(e =>
      e.cardName === cardName ? { ...e, count: COPIES_MAX } : e
    ),
    gained,
  }
}

/** Disenchant ALL extras across the entire collection at once. */
export function disenchantAllExtras(
  collection: CollectionEntry[],
): { collection: CollectionEntry[]; gained: number } {
  let gained = 0
  const updated = collection.map(e => {
    const extras = extraCount(e)
    if (extras === 0) return e
    gained += DISENCHANT_VALUE[rarityOf(e.cardName)] * extras
    return { ...e, count: COPIES_MAX }
  })
  return { collection: updated, gained }
}

// ─── Mastery consumption ──────────────────────────────────

/** Consume ALL extra copies of a card as mastery XP (instead of dismantling for crystals). */
export function masterAllExtras(
  collection: CollectionEntry[],
  cardName: string,
): CollectionEntry[] {
  return collection.map(e => {
    if (e.cardName !== cardName) return e
    const extras = extraCount(e)
    if (extras === 0) return e
    return { ...e, count: COPIES_MAX, masteryXp: (e.masteryXp ?? 0) + extras }
  })
}

// ─── Mastery stat bonus ───────────────────────────────────

/**
 * Apply mastery level bonuses to a card template before it enters the deck.
 * Mobile units: +1 ATK and +2 max HP per level.
 * Structures / walls: +10 max HP per level.
 */
function applyMasteryBonus(card: Card, lvl: number): Card {
  if (lvl === 0 || !card.unit) return card
  const u = { ...card.unit }
  if (u.moveSpeed > 0) {
    // Mobile units: +lvl ATK, +lvl*2 HP
    u.attack = u.attack + lvl
    u.maxHp  = u.maxHp  + lvl * 2
  } else {
    // Structures: +10% HP per mastery level
    u.maxHp = Math.round(u.maxHp * (1 + 0.1 * lvl))
    // Mastery 5 unlocks a type-specific bonus
    if (lvl >= 5) {
      if (u.isWall) {
        // Walls gain a self-repair aura (2 HP every 6 s)
        u.structureEffect = { type: 'repairAura', amount: 2, intervalMs: 6000 }
      } else if (u.structureEffect?.type === 'spawn') {
        // Spawners get 25% faster spawn rate
        const e = { ...(u.structureEffect as { type: 'spawn'; unitTemplate: import('./types').UnitTemplate; intervalMs: number }) }
        e.intervalMs = Math.round(e.intervalMs * 0.75)
        u.structureEffect = e
      } else if (u.structureEffect?.type === 'mana') {
        // Farms produce 1 extra mana
        const e = { ...(u.structureEffect as { type: 'mana'; amount: number }) }
        e.amount = e.amount + 1
        u.structureEffect = e
      }
    }
  }
  return { ...card, unit: u }
}

// ─── Collection CRUD ──────────────────────────────────────

export function loadCollection(): CollectionEntry[] {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY)
    if (raw) return migrateCollectionNames(JSON.parse(raw) as CollectionEntry[])
  } catch { /* ignore */ }
  saveCollection(STARTER_COLLECTION)
  return [...STARTER_COLLECTION.map(e => ({ ...e }))]
}

export function saveCollection(c: CollectionEntry[]): void {
  try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(c)) }
  catch (e) { logError('saveCollection failed', { count: c.length, error: String(e) }) }
}

export function addCardsToCollection(newCards: CollectionEntry[]): CollectionEntry[] {
  const collection = loadCollection()
  for (const entry of newCards) {
    const existing = collection.find(e => e.cardName === entry.cardName)
    if (existing) {
      existing.count += entry.count
    } else {
      collection.push({ ...entry })
    }
  }
  saveCollection(collection)
  return collection
}

export function getOwnedCount(collection: CollectionEntry[], cardName: string): number {
  return collection.find(e => e.cardName === cardName)?.count ?? 0
}

// ─── Deck CRUD ────────────────────────────────────────────

export function loadDeck(): DeckEntry[] {
  try {
    const raw = localStorage.getItem(DECK_KEY)
    if (raw) return migrateDeckNames(JSON.parse(raw) as DeckEntry[])
  } catch { /* ignore */ }
  saveDeck(STARTER_DECK)
  return [...STARTER_DECK.map(e => ({ ...e }))]
}

export function saveDeck(d: DeckEntry[]): void {
  try { localStorage.setItem(DECK_KEY, JSON.stringify(d)) }
  catch (e) { logError('saveDeck failed', { count: d.length, error: String(e) }) }
}

export function deckTotalCards(d: DeckEntry[]): number {
  return d.reduce((s, e) => s + e.count, 0)
}

export function isDeckValid(d: DeckEntry[]): boolean {
  const total = deckTotalCards(d)
  return total >= DECK_MIN && total <= DECK_MAX
}

// ─── Build Card[] from DeckEntry[] ───────────────────────

let _deckCardId = 0

export function buildDeckCards(entries: DeckEntry[], collection?: CollectionEntry[]): Card[] {
  const catalog = getCardCatalog()
  const result: Card[] = []
  for (const entry of entries) {
    const template = catalog.find(c => c.name === entry.cardName)
    if (!template) continue
    const xp  = collection ? getMasteryXp(collection, entry.cardName) : 0
    const lvl = masteryLevel(xp)
    const boosted = applyMasteryBonus(template, lvl)
    const withLevel: Card = boosted.unit
      ? { ...boosted, unit: { ...boosted.unit, masteryLevel: lvl } }
      : boosted
    for (let i = 0; i < entry.count; i++) {
      result.push({ ...withLevel, id: `deck-${entry.cardName}-${++_deckCardId}` })
    }
  }
  return result
}

// ─── Pack Generation ──────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Returns 5 card names in reveal order.
 * Guaranteed: 2 commons, 1 uncommon, 1 rare, 1 bonus (10% legendary / 20% rare / 70% uncommon).
 */
export function generatePack(): string[] {
  const catalog     = getCardCatalog()
  const commons     = catalog.filter(c => c.rarity === 'common')
  const uncommons   = catalog.filter(c => c.rarity === 'uncommon')
  const rares       = catalog.filter(c => c.rarity === 'rare')
  const legendaries = catalog.filter(c => c.rarity === 'legendary')

  const picks: string[] = [
    pickRandom(commons).name,
    pickRandom(commons).name,
    pickRandom(uncommons).name,
    pickRandom(rares).name,
  ]

  const r = Math.random()
  if (r < 0.10 && legendaries.length > 0) {
    picks.push(pickRandom(legendaries).name)
  } else if (r < 0.30 && rares.length > 0) {
    picks.push(pickRandom(rares).name)
  } else {
    picks.push(pickRandom(uncommons).name)
  }

  const rarityOrder: Record<string, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 }
  picks.sort((a, b) => {
    const ar = catalog.find(c => c.name === a)?.rarity ?? 'common'
    const br = catalog.find(c => c.name === b)?.rarity ?? 'common'
    return (rarityOrder[ar] ?? 0) - (rarityOrder[br] ?? 0)
  })

  return picks
}

// ─── Win Streak ───────────────────────────────────────────────────────────────

export function loadWinStreak(): number {
  try { return Math.max(0, parseInt(localStorage.getItem(WIN_STREAK_KEY) ?? '0', 10) || 0) } catch { return 0 }
}
export function incrementWinStreak(): number {
  const next = loadWinStreak() + 1
  try { localStorage.setItem(WIN_STREAK_KEY, String(next)) } catch { /* ignore */ }
  return next
}
export function resetWinStreak(): void {
  try { localStorage.setItem(WIN_STREAK_KEY, '0') } catch { /* ignore */ }
}
