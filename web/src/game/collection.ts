import { AugmentEffect, AugmentInstance, Card, CardRarity } from './types'
import { getCardCatalog } from './cards'
import { getAugmentCard, getAugmentCatalog, getAugmentSetDef, scaledAugmentEffect, ALL_AUGMENT_SLOTS } from './augments'
import { logError } from '../logger'
import { validateIntegrity, updateChecksum } from './integrity'

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

export interface SavedDeck {
  name: string
  deck: DeckEntry[]
  savedAt: number
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
const DECK_B_KEY      = 'jarv_deck_b'
const ACTIVE_SLOT_KEY = 'jarv_active_slot'
const CRYSTALS_KEY    = 'jarv_crystals'
const WIN_STREAK_KEY      = 'jarv_win_streak'
const BEST_STREAK_KEY     = 'jarv_best_streak'
const TOTAL_WINS_KEY      = 'jarv_total_wins'
const SAVED_DECKS_KEY     = 'jarv_saved_decks'
const AUGMENT_INSTANCES_KEY = 'jarv_augment_instances'
const AUGMENT_SOULS_KEY     = 'jarv_augment_souls'

export const AUGMENT_UPGRADE_COST = 500   // augment souls per upgrade

export const DECK_MIN  = 10
export const DECK_MAX  = 30
export const COPIES_MAX = 4

import { loadPlayerStats } from './playerStats'
export function getPlayerMaxDeckSize(): number { return loadPlayerStats().maxDeckSize }

import { CRYSTAL_PACK_COST, DISENCHANT_VALUE, AUGMENT_DISENCHANT_VALUE } from './economy'
export { CRYSTAL_PACK_COST, DISENCHANT_VALUE, AUGMENT_DISENCHANT_VALUE }

// ─── Starter data ─────────────────────────────────────────

export const STARTER_COLLECTION: CollectionEntry[] = [
  { cardName: 'Goblin',         count: 4 },
  { cardName: 'Archer',         count: 4 },
  { cardName: 'Barbarian',      count: 3 },
  { cardName: 'Knight',         count: 3 },
  { cardName: 'Wizard',         count: 1 },
  { cardName: 'Stone Wall',     count: 4 },
  { cardName: 'Lumber Camp', count: 2 },
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

// ─── Augment Souls ────────────────────────────────────────

export function loadAugmentSouls(): number {
  try {
    const v = localStorage.getItem(AUGMENT_SOULS_KEY)
    if (v !== null) return Math.max(0, parseInt(v, 10) || 0)
  } catch { /* ignore */ }
  return 0
}

export function saveAugmentSouls(n: number): void {
  try { localStorage.setItem(AUGMENT_SOULS_KEY, String(Math.max(0, n))) }
  catch (e) { logError('saveAugmentSouls failed', { error: String(e) }) }
}

/** Add `n` augment souls to the persistent total. Call at end of battle/TD session. */
export function incrementAugmentSouls(n: number): void {
  if (n <= 0) return
  saveAugmentSouls(loadAugmentSouls() + n)
}

// ─── Augment Instances ────────────────────────────────────

export function loadAugmentInstances(): AugmentInstance[] {
  try {
    const raw = localStorage.getItem(AUGMENT_INSTANCES_KEY)
    if (raw) return JSON.parse(raw) as AugmentInstance[]
  } catch { /* ignore */ }
  return []
}

export function saveAugmentInstances(instances: AugmentInstance[]): void {
  try { localStorage.setItem(AUGMENT_INSTANCES_KEY, JSON.stringify(instances)) }
  catch (e) { logError('saveAugmentInstances failed', { error: String(e) }) }
}

let _augInstanceCounter = Date.now()

/** Create and persist a new augment instance for the given augment card name. */
export function addAugmentInstance(cardId: string): AugmentInstance {
  const instance: AugmentInstance = {
    instanceId: `aug-inst-${++_augInstanceCounter}`,
    cardId,
    level: 0,
    equippedToCardName: null,
  }
  const instances = loadAugmentInstances()
  instances.push(instance)
  saveAugmentInstances(instances)
  return instance
}

/** Return all augment instances equipped to the given unit card name, keyed by slot. */
export function getEquippedAugments(cardName: string): Record<string, AugmentInstance> {
  const instances = loadAugmentInstances()
  const result: Record<string, AugmentInstance> = {}
  for (const inst of instances) {
    if (inst.equippedToCardName !== cardName) continue
    const card = getAugmentCard(inst.cardId)
    if (!card?.augmentSlot) continue
    result[card.augmentSlot] = inst
  }
  return result
}

/** Equip an augment instance to a unit card name. A slot can only hold one instance at a time. */
export function equipAugment(instanceId: string, cardName: string): void {
  const instances = loadAugmentInstances()
  const target = instances.find(i => i.instanceId === instanceId)
  if (!target) return
  const card = getAugmentCard(target.cardId)
  if (!card?.augmentSlot) return

  // Unequip any existing instance in the same slot on the same card
  for (const inst of instances) {
    if (inst.equippedToCardName !== cardName) continue
    const iCard = getAugmentCard(inst.cardId)
    if (iCard?.augmentSlot === card.augmentSlot) inst.equippedToCardName = null
  }

  target.equippedToCardName = cardName
  saveAugmentInstances(instances)
}

/** Unequip an augment instance from whichever unit it is on. */
export function unequipAugment(instanceId: string): void {
  const instances = loadAugmentInstances()
  const target = instances.find(i => i.instanceId === instanceId)
  if (!target) return
  target.equippedToCardName = null
  saveAugmentInstances(instances)
}

/** Break down an augment instance (equipped or not) into souls, keyed by its rarity.
 *  Returns the number of souls gained (0 if the instance/card could not be found). */
export function breakdownAugmentInstance(instanceId: string): number {
  const instances = loadAugmentInstances()
  const target = instances.find(i => i.instanceId === instanceId)
  if (!target) return 0
  const card = getAugmentCard(target.cardId)
  if (!card) return 0

  const gained = AUGMENT_DISENCHANT_VALUE[card.rarity]
  saveAugmentInstances(instances.filter(i => i.instanceId !== instanceId))
  incrementAugmentSouls(gained)
  return gained
}

/** Upgrade an augment instance by 1 level. Costs AUGMENT_UPGRADE_COST souls.
 *  Returns null on success, or an error string if insufficient souls. */
export function upgradeAugment(instanceId: string): string | null {
  const souls = loadAugmentSouls()
  if (souls < AUGMENT_UPGRADE_COST) {
    return `Not enough souls (need ${AUGMENT_UPGRADE_COST}, have ${souls})`
  }
  const instances = loadAugmentInstances()
  const target = instances.find(i => i.instanceId === instanceId)
  if (!target) return 'Augment not found'
  target.level += 1
  saveAugmentInstances(instances)
  saveAugmentSouls(souls - AUGMENT_UPGRADE_COST)
  return null
}

/** Upgrade a group of augment instances as a stack.
 *  Finds the minimum level across all instances, upgrades only those at that minimum.
 *  Cost = (count at minimum level) × AUGMENT_UPGRADE_COST souls.
 *  Returns null on success, or an error string on failure. */
export function upgradeAugmentStack(instanceIds: string[]): string | null {
  const souls = loadAugmentSouls()
  const instances = loadAugmentInstances()
  const targets = instanceIds.map(id => instances.find(i => i.instanceId === id)).filter(Boolean) as AugmentInstance[]
  if (targets.length === 0) return 'No instances found'

  const minLevel = Math.min(...targets.map(t => t.level))
  const toUpgrade = targets.filter(t => t.level === minLevel)
  const cost = toUpgrade.length * AUGMENT_UPGRADE_COST

  if (souls < cost) return `Not enough souls (need ${cost.toLocaleString()}, have ${souls.toLocaleString()})`

  for (const t of toUpgrade) t.level += 1
  saveAugmentInstances(instances)
  saveAugmentSouls(souls - cost)
  return null
}

/** Equip all instances in the given list to a unit card, one per slot.
 *  Any existing augment in the same slot on that card is unequipped first. */
export function equipAugmentSet(instanceIds: string[], cardName: string): void {
  const instances = loadAugmentInstances()
  const targets = instanceIds.map(id => instances.find(i => i.instanceId === id)).filter(Boolean) as AugmentInstance[]

  for (const target of targets) {
    const card = getAugmentCard(target.cardId)
    if (!card?.augmentSlot) continue

    for (const inst of instances) {
      if (inst.equippedToCardName !== cardName) continue
      const iCard = getAugmentCard(inst.cardId)
      if (iCard?.augmentSlot === card.augmentSlot) inst.equippedToCardName = null
    }

    target.equippedToCardName = cardName
  }

  saveAugmentInstances(instances)
}

/** Return the set bonus effect if all 7 slots of the same set are equipped to the given unit.
 *  Returns undefined if the set is incomplete. */
export function getSetBonus(cardName: string): { setName: string; effect: AugmentEffect; description: string } | undefined {
  const instances = loadAugmentInstances()
  const equipped = instances.filter(i => i.equippedToCardName === cardName)
  if (equipped.length < ALL_AUGMENT_SLOTS.length) return undefined

  // Collect set names for all equipped instances
  const setNames = equipped.map(i => getAugmentCard(i.cardId)?.setName).filter(Boolean) as string[]
  if (setNames.length < ALL_AUGMENT_SLOTS.length) return undefined

  // All must belong to the same set
  const first = setNames[0]
  if (!setNames.every(s => s === first)) return undefined

  const def = getAugmentSetDef(first)
  if (!def) return undefined
  return { setName: first, effect: def.setBonus, description: def.setBonusDescription }
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
    // Structures: +10% HP per mastery level (all types)
    u.maxHp = Math.round(u.maxHp * (1 + 0.1 * lvl))
    if (u.isWall) {
      // Lv5: walls gain a self-repair aura (2 HP every 6 s)
      if (lvl >= 5) u.structureEffect = { type: 'repairAura', amount: 2, intervalMs: 6000 }
    } else if (u.structureEffect) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = { ...u.structureEffect } as any
      if (e.type === 'spawn') {
        // −5% spawn interval per mastery level (cumulative)
        e.intervalMs = Math.round(e.intervalMs * Math.pow(0.95, lvl))
      } else if (e.type === 'mana') {
        // Lv5: produce 1 extra mana per turn
        if (lvl >= 5) e.amount = e.amount + 1
      } else if (e.type === 'healAura') {
        // +1 heal per mastery level; Lv5: 25% faster pulse
        e.amount = e.amount + lvl
        if (lvl >= 5) e.intervalMs = Math.round(e.intervalMs * 0.75)
      } else if (e.type === 'repairAura') {
        // +1 repair per mastery level; Lv5: 25% faster pulse
        e.amount = e.amount + lvl
        if (lvl >= 5) e.intervalMs = Math.round(e.intervalMs * 0.75)
      } else if (e.type === 'attackAura') {
        // +1 ATK aura per 2 mastery levels
        e.amount = e.amount + Math.floor(lvl / 2)
      } else if (e.type === 'manaSpeed') {
        // 4% faster mana regen per mastery level (speedMult floored at 0.1)
        e.speedMult = Math.max(0.1, +(e.speedMult - lvl * 0.04).toFixed(2))
      }
      u.structureEffect = e
    }
  }
  return { ...card, unit: u }
}

// ─── Collection CRUD ──────────────────────────────────────

export function loadCollection(): CollectionEntry[] {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY)
    if (raw) {
      validateIntegrity(COLLECTION_KEY, raw)
      return migrateCollectionNames(JSON.parse(raw) as CollectionEntry[])
    }
  } catch { /* ignore */ }
  saveCollection(STARTER_COLLECTION)
  return [...STARTER_COLLECTION.map(e => ({ ...e }))]
}

export function saveCollection(c: CollectionEntry[]): void {
  try {
    const data = JSON.stringify(c)
    localStorage.setItem(COLLECTION_KEY, data)
    updateChecksum(COLLECTION_KEY, data)
  } catch (e) { logError('saveCollection failed', { count: c.length, error: String(e) }) }
}

export function addCardsToCollection(newCards: CollectionEntry[]): CollectionEntry[] {
  const collection = loadCollection()
  const augNames = new Set(getAugmentCatalog().map(c => c.name))
  for (const entry of newCards) {
    if (augNames.has(entry.cardName)) {
      for (let i = 0; i < entry.count; i++) addAugmentInstance(entry.cardName)
    } else {
      const existing = collection.find(e => e.cardName === entry.cardName)
      if (existing) {
        existing.count += entry.count
      } else {
        collection.push({ ...entry })
      }
    }
  }
  saveCollection(collection)
  return collection
}

export function getOwnedCount(collection: CollectionEntry[], cardName: string): number {
  return collection.find(e => e.cardName === cardName)?.count ?? 0
}

export interface CollectionCompletion {
  distinctOwned: number
  catalogTotal: number
  pct: number
}

/** Distinct-cards-owned vs. the full catalogue — was only ever computed
 *  ad hoc (e.g. TitleScreen's footer stat); pulled out here so the
 *  Collection screen can surface the same number as real progress (#2178). */
export function getCollectionCompletion(collection: CollectionEntry[]): CollectionCompletion {
  const catalog = getCardCatalog()
  const distinctOwned = collection.filter(e => e.count > 0 && catalog.some(c => c.name === e.cardName)).length
  const catalogTotal = catalog.length
  const pct = catalogTotal > 0 ? Math.round((distinctOwned / catalogTotal) * 100) : 0
  return { distinctOwned, catalogTotal, pct }
}

// ─── Deck CRUD ────────────────────────────────────────────

export type DeckSlot = 'a' | 'b'

export function getActiveDeckSlot(): DeckSlot {
  try {
    const v = localStorage.getItem(ACTIVE_SLOT_KEY)
    if (v === 'b') return 'b'
  } catch { /* ignore */ }
  return 'a'
}

export function setActiveDeckSlot(slot: DeckSlot): void {
  try { localStorage.setItem(ACTIVE_SLOT_KEY, slot) } catch { /* ignore */ }
}

function deckStorageKey(): string {
  return getActiveDeckSlot() === 'b' ? DECK_B_KEY : DECK_KEY
}

/** Load a specific slot without changing the active slot. */
export function loadDeckSlot(slot: DeckSlot): DeckEntry[] {
  const key = slot === 'b' ? DECK_B_KEY : DECK_KEY
  try {
    const raw = localStorage.getItem(key)
    if (raw) return migrateDeckNames(JSON.parse(raw) as DeckEntry[])
  } catch { /* ignore */ }
  if (slot === 'a') return [...STARTER_DECK.map(e => ({ ...e }))]
  return []
}

export function loadDeck(): DeckEntry[] {
  try {
    const raw = localStorage.getItem(deckStorageKey())
    if (raw) return migrateDeckNames(JSON.parse(raw) as DeckEntry[])
  } catch { /* ignore */ }
  if (getActiveDeckSlot() === 'a') {
    saveDeck(STARTER_DECK)
    return [...STARTER_DECK.map(e => ({ ...e }))]
  }
  return []
}

export function saveDeck(d: DeckEntry[]): void {
  try { localStorage.setItem(deckStorageKey(), JSON.stringify(d)) }
  catch (e) { logError('saveDeck failed', { count: d.length, error: String(e) }) }
}

export function deckTotalCards(d: DeckEntry[]): number {
  return d.reduce((s, e) => s + e.count, 0)
}

export function isDeckValid(d: DeckEntry[]): boolean {
  const total = deckTotalCards(d)
  return total >= DECK_MIN && total <= getPlayerMaxDeckSize()
}

// ─── Saved Decks ──────────────────────────────────────────

export function loadSavedDecks(): SavedDeck[] {
  try {
    const raw = localStorage.getItem(SAVED_DECKS_KEY)
    if (raw) return JSON.parse(raw) as SavedDeck[]
  } catch { /* ignore */ }
  return []
}

function persistSavedDecks(decks: SavedDeck[]): void {
  try { localStorage.setItem(SAVED_DECKS_KEY, JSON.stringify(decks)) }
  catch (e) { logError('persistSavedDecks failed', { error: String(e) }) }
}

export function saveNamedDeck(name: string, deck: DeckEntry[]): void {
  const decks = loadSavedDecks()
  const idx = decks.findIndex(d => d.name === name)
  const entry: SavedDeck = { name, deck: [...deck], savedAt: Date.now() }
  if (idx >= 0) decks[idx] = entry
  else decks.unshift(entry)
  persistSavedDecks(decks)
}

export function deleteSavedDeck(name: string): void {
  persistSavedDecks(loadSavedDecks().filter(d => d.name !== name))
}

// ─── Deck Share Codes ─────────────────────────────────────
// Format: each entry encoded as "cardName|count", joined by ";", then base64.

export function encodeDeck(deck: DeckEntry[]): string {
  const raw = deck.map(e => `${e.cardName}|${e.count}`).join(';')
  return btoa(unescape(encodeURIComponent(raw)))
}

export function decodeDeck(code: string): DeckEntry[] | null {
  try {
    const raw = decodeURIComponent(escape(atob(code.trim())))
    const entries = raw.split(';').map(part => {
      const pipe = part.lastIndexOf('|')
      if (pipe < 0) return null
      const cardName = part.slice(0, pipe)
      const count = parseInt(part.slice(pipe + 1), 10)
      if (!cardName || isNaN(count) || count < 1) return null
      return { cardName, count } as DeckEntry
    })
    if (entries.some(e => e === null)) return null
    return entries as DeckEntry[]
  } catch {
    return null
  }
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

    // Apply mastery to the unit spawned by a spawn-type structure.
    // The spawned unit type may have its own mastery XP (looked up by name).
    let withSpawnMastery = boosted
    if (collection && boosted.unit?.structureEffect?.type === 'spawn') {
      const se = boosted.unit.structureEffect as { type: 'spawn'; unitTemplate: import('./types').UnitTemplate; intervalMs: number }
      if (!se.unitTemplate) continue
      const spawnXp = getMasteryXp(collection, se.unitTemplate.name)
      const spawnLvl = masteryLevel(spawnXp)
      let ut = { ...se.unitTemplate }
      if (spawnLvl > 0) {
        ut.attack  = ut.attack  + spawnLvl
        ut.maxHp   = ut.maxHp   + spawnLvl * 2
        ut.masteryLevel = spawnLvl
      }
      // Apply augment bonuses to the spawn template using the spawned unit's name
      const spawnProxy = { ...boosted, name: se.unitTemplate.name, cardType: 'unit' as const, unit: ut }
      const augmentedSpawn = applyAugmentBonuses(spawnProxy, se.unitTemplate.name)
      if (augmentedSpawn.unit) ut = augmentedSpawn.unit
      withSpawnMastery = { ...boosted, unit: { ...boosted.unit, structureEffect: { ...se, unitTemplate: ut } } }
    }

    const withLevel: Card = withSpawnMastery.unit
      ? { ...withSpawnMastery, unit: { ...withSpawnMastery.unit, masteryLevel: lvl } }
      : withSpawnMastery

    // Apply augment bonuses (only for unit cards with a unit template)
    const withAugments = applyAugmentBonuses(withLevel, entry.cardName)

    for (let i = 0; i < entry.count; i++) {
      result.push({ ...withAugments, id: `deck-${entry.cardName}-${++_deckCardId}` })
    }
  }
  return result
}

function applyAugmentBonuses(card: Card, cardName: string): Card {
  if (!card.unit || card.unit.moveSpeed === 0) return card   // structures don't get augments
  const equipped = getEquippedAugments(cardName)
  const slotKeys = Object.keys(equipped)
  if (slotKeys.length === 0) return card

  const u = { ...card.unit }
  let totalEffect: AugmentEffect = {}

  for (const instanceId of Object.values(equipped)) {
    const augCard = getAugmentCard(instanceId.cardId)
    if (!augCard?.augmentEffect) continue
    const scaled = scaledAugmentEffect(augCard.augmentEffect, instanceId.level)
    totalEffect = mergeAugmentEffects(totalEffect, scaled)
  }

  // Apply set bonus if all 7 slots are filled with the same set
  const setBonus = getSetBonus(cardName)
  if (setBonus) {
    totalEffect = mergeAugmentEffects(totalEffect, setBonus.effect)
  }

  if (totalEffect.attack      != null) u.attack      = Math.max(0, u.attack      + totalEffect.attack)
  if (totalEffect.attackRange != null) u.attackRange = Math.max(0, u.attackRange + totalEffect.attackRange)
  if (totalEffect.maxHp       != null) u.maxHp       = Math.max(1, u.maxHp       + totalEffect.maxHp)
  if (totalEffect.moveSpeed   != null) u.moveSpeed   = Math.max(1, u.moveSpeed   + totalEffect.moveSpeed)

  return { ...card, unit: u }
}

export function mergeAugmentEffects(a: AugmentEffect, b: AugmentEffect): AugmentEffect {
  const sum = (x: number | undefined, y: number | undefined): number | undefined => {
    const total = (x ?? 0) + (y ?? 0)
    return total !== 0 ? total : undefined
  }
  return {
    attack:      sum(a.attack,      b.attack),
    attackRange: sum(a.attackRange, b.attackRange),
    maxHp:       sum(a.maxHp,       b.maxHp),
    moveSpeed:   sum(a.moveSpeed,   b.moveSpeed),
  }
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

  // Add one augment card (same rarity weights as the bonus slot)
  const augCatalog = getAugmentCatalog()
  const augR = Math.random()
  const augRarity = augR < 0.10 ? 'rare' : augR < 0.30 ? 'uncommon' : 'common'
  const augPool = augCatalog.filter(c => c.rarity === augRarity)
  if (augPool.length > 0) picks.push(pickRandom(augPool).name)

  const rarityOrder: Record<string, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 }
  const allCards = [...catalog, ...augCatalog]
  picks.sort((a, b) => {
    const ar = allCards.find(c => c.name === a)?.rarity ?? 'common'
    const br = allCards.find(c => c.name === b)?.rarity ?? 'common'
    return (rarityOrder[ar] ?? 0) - (rarityOrder[br] ?? 0)
  })

  return picks
}

/**
 * Returns <count> card names in reveal order.
 * Filtered by rarity if specified, otherwise same distribution as generatePack().
 */
export function generateSeededPack(count: number, rarity?: 'uncommon' | 'rare' | 'legendary'): string[] {
  const catalog = getCardCatalog()
  const pool = rarity ? catalog.filter(c => c.rarity === rarity) : catalog
  if (pool.length === 0) return []
  const results: string[] = []
  for (let i = 0; i < count; i++) {
    results.push(pool[Math.floor(Math.random() * pool.length)].name)
  }

  const rarityOrder: Record<string, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 }
  results.sort((a, b) => {
    const ar = catalog.find(c => c.name === a)?.rarity ?? 'common'
    const br = catalog.find(c => c.name === b)?.rarity ?? 'common'
    return (rarityOrder[ar] ?? 0) - (rarityOrder[br] ?? 0)
  })

  return results
}


// TODO: Win steak has nothing to do with the collection, should be moved to a separate "progress" module or something.
// ─── Win Streak ───────────────────────────────────────────────────────────────

export function loadWinStreak(): number {
  try { return Math.max(0, parseInt(localStorage.getItem(WIN_STREAK_KEY) ?? '0', 10) || 0) } catch { return 0 }
}
export function loadBestStreak(): number {
  try { return Math.max(0, parseInt(localStorage.getItem(BEST_STREAK_KEY) ?? '0', 10) || 0) } catch { return 0 }
}
export function incrementWinStreak(): number {
  const next = loadWinStreak() + 1
  try { localStorage.setItem(WIN_STREAK_KEY, String(next)) } catch { /* ignore */ }
  if (next > loadBestStreak()) {
    try { localStorage.setItem(BEST_STREAK_KEY, String(next)) } catch { /* ignore */ }
  }
  return next
}
export function resetWinStreak(): void {
  try { localStorage.setItem(WIN_STREAK_KEY, '0') } catch { /* ignore */ }
}

export function loadTotalWins(): number {
  try { return Math.max(0, parseInt(localStorage.getItem(TOTAL_WINS_KEY) ?? '0', 10) || 0) } catch { return 0 }
}
export function incrementTotalWins(): number {
  const next = loadTotalWins() + 1
  try { localStorage.setItem(TOTAL_WINS_KEY, String(next)) } catch { /* ignore */ }
  return next
}
