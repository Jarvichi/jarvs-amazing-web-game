// ─── Inventory System ────────────────────────────────────────────────────────
//
// Single source of truth for ALL persistent player items. Everything the
// player owns lives in one localStorage key (ITEM_STORE_KEY) as a flat array
// of ItemEntry objects tagged by category.
//
// ┌────────────────────┬──────────────────────────────────────────────────────┐
// │ Category           │ Description                                          │
// ├────────────────────┼──────────────────────────────────────────────────────┤
// │ consumable         │ Battle-use items: Health Potion, Second Wind.        │
// │                    │ Drained into the active run on campaign start/resume.│
// │                    │ API: addConsumable / removeConsumable / getConsumables│
// ├────────────────────┼──────────────────────────────────────────────────────┤
// │ arcade-ticket      │ Persistent arcade currency. Stored as type           │
// │ (consumable subtype│ 'consumable' internally but explicitly excluded from │
// │  — see WARNING)    │ the run drain. API: addTickets / spendTickets /      │
// │                    │ getTickets                                           │
// ├────────────────────┼──────────────────────────────────────────────────────┤
// │ relic              │ Passive bonuses earned across runs. Unique (no dupes)│
// │                    │ API: addRelic / removeRelic / getRelics              │
// ├────────────────────┼──────────────────────────────────────────────────────┤
// │ item               │ Collectibles from daily logins & events. Allows      │
// │                    │ duplicates. API: addCollectible / removeCollectible / │
// │                    │ getCollectibles                                       │
// ├────────────────────┼──────────────────────────────────────────────────────┤
// │ hub-item           │ Hub-world economy items: held quest items, materials  │
// │                    │ (feed, eggs, fish, trade goods), unique tools (rod).  │
// │                    │ Catalog: data/hubItems.json. API: addHubItem /        │
// │                    │ removeHubItem / getHubItemCount / hasHubItem /        │
// │                    │ getHubItems                                           │
// └────────────────────┴──────────────────────────────────────────────────────┘
//
// ⚠️  WARNING — the battle-consumable drain
// ─────────────────────────────────────────────────────────────────────────────
// When a campaign run starts or is loaded, drainStashIntoRun() in questline.ts
// moves every battle consumable (type: 'consumable', id in ALL_CONSUMABLES)
// from this store into run.consumables, then removes it here. This is correct
// for Health Potion and Second Wind — they belong to the run.
//
// Arcade tickets share the same 'consumable' type tag but are a persistent
// currency and must never be drained. They are safe because drainStashIntoRun
// whitelists only ids present in ALL_CONSUMABLES, and 'arcade-ticket' is not
// in that list.
//
// Rules for adding new inventory items:
//   1. Battle consumables (used in battle, consumed per run): use addConsumable
//      and add the item id to consumables.json (ALL_CONSUMABLES).
//   2. Persistent currencies / non-battle consumables: add a dedicated section
//      below (like the Arcade Tickets section) with its own functions and ensure
//      the item id is ABSENT from ALL_CONSUMABLES so the drain never touches it.
//   3. Never call addItem / removeItem / loadItemStore from outside this file —
//      go through the typed category functions instead.
// ─────────────────────────────────────────────────────────────────────────────

import { logError } from '../logger'
import { validateIntegrity, updateChecksum } from './integrity'
import HUB_ITEMS_DATA from '../data/hubItems.json'

export type ItemType = 'consumable' | 'relic' | 'item' | 'hub-item'

/** Buckets the Hub Inventory UI groups hub-items into. */
export type HubItemCategory = 'quest' | 'pet-accessory' | 'material' | 'tool'

export interface ItemEntry {
  /** Consumable id, relic name, useless-item id, or hub-item id */
  id: string
  type: ItemType
  /** Stack size — only meaningful for consumables/hub-items; always 1 for relics/items */
  count: number
  /** ISO date string set when the item was first acquired (items only) */
  acquiredDate?: string
  /** Display fields for entries whose id is not in a static catalog
   *  (e.g. arcade tickets, broken relics with dynamic ids). */
  name?: string
  icon?: string
  desc?: string
  lore?: string
  /** Hub-items only: inventory grouping (see HubItemCategory). */
  category?: HubItemCategory
  /** Items only: true for meaningful narrative/quest rewards, shown on the Home
   *  Shelf as "Keepsakes" rather than grouped with daily-login/flavor junk. */
  isKeepsake?: boolean
}

export interface ItemDisplayFields {
  name?: string
  icon?: string
  desc?: string
  lore?: string
  category?: HubItemCategory
  isKeepsake?: boolean
}

const ITEM_STORE_KEY = 'jarv_item_store'

// Legacy keys migrated into the unified store on first load
const LEGACY_CONSUMABLE_KEY = 'jarv_consumable_stash'
const LEGACY_RELICS_KEY     = 'jarv_relics'
const LEGACY_INVENTORY_KEY  = 'jarv_inventory'

// ── Migration ──────────────────────────────────────────────────────────────────

function migrate(store: ItemEntry[]): ItemEntry[] {
  const ids = new Set(store.map(e => `${e.type}:${e.id}`))
  let changed = false

  // 1. Consumable stash: [{id, count}]
  try {
    const raw = localStorage.getItem(LEGACY_CONSUMABLE_KEY)
    if (raw) {
      const parsed: Array<{ id: string; count: number }> = JSON.parse(raw)
      for (const c of parsed) {
        const key = `consumable:${c.id}`
        if (!ids.has(key)) {
          store.push({ id: c.id, type: 'consumable', count: c.count })
          ids.add(key)
        } else {
          const entry = store.find(e => e.type === 'consumable' && e.id === c.id)
          if (entry) entry.count += c.count
        }
        changed = true
      }
      localStorage.removeItem(LEGACY_CONSUMABLE_KEY)
    }
  } catch { /* ignore corrupt legacy data */ }

  // 2. Relics: string[]
  try {
    const raw = localStorage.getItem(LEGACY_RELICS_KEY)
    if (raw) {
      const names: string[] = JSON.parse(raw)
      for (const name of names) {
        const key = `relic:${name}`
        if (!ids.has(key)) {
          store.push({ id: name, type: 'relic', count: 1 })
          ids.add(key)
          changed = true
        }
      }
      localStorage.removeItem(LEGACY_RELICS_KEY)
    }
  } catch { /* ignore */ }

  // 3. Inventory (useless items): [{id, name, icon, desc, lore, acquiredDate}]
  try {
    const raw = localStorage.getItem(LEGACY_INVENTORY_KEY)
    if (raw) {
      const items: Array<{ id: string; name: string; icon: string; desc: string; lore: string; acquiredDate: string }> = JSON.parse(raw)
      for (const item of items) {
        // Items are NOT de-duped here — the old store allowed duplicates.
        store.push({
          id: item.id,
          type: 'item',
          count: 1,
          acquiredDate: item.acquiredDate,
          name: item.name,
          icon: item.icon,
          desc: item.desc,
          lore: item.lore,
        })
        changed = true
      }
      localStorage.removeItem(LEGACY_INVENTORY_KEY)
    }
  } catch { /* ignore */ }

  return changed ? store : store
}

// ── Raw storage (internal) ─────────────────────────────────────────────────────
//
// loadItemStore / saveItemStore are the only functions that touch localStorage.
// All category functions below go through these two. Do not call them directly
// from outside this file — use the typed category functions instead.

export function loadItemStore(): ItemEntry[] {
  let store: ItemEntry[] = []
  try {
    const raw = localStorage.getItem(ITEM_STORE_KEY)
    if (raw) {
      validateIntegrity(ITEM_STORE_KEY, raw)
      store = JSON.parse(raw) as ItemEntry[]
    }
  } catch {
    store = []
  }

  const hasLegacy =
    localStorage.getItem(LEGACY_CONSUMABLE_KEY) !== null ||
    localStorage.getItem(LEGACY_RELICS_KEY) !== null ||
    localStorage.getItem(LEGACY_INVENTORY_KEY) !== null

  if (hasLegacy) {
    store = migrate(store)
    saveItemStore(store)
  }

  return store
}

export function saveItemStore(store: ItemEntry[]): void {
  try {
    const data = JSON.stringify(store)
    localStorage.setItem(ITEM_STORE_KEY, data)
    updateChecksum(ITEM_STORE_KEY, data)
  } catch (e) {
    logError('saveItemStore failed', { error: String(e) })
  }
}

// ── Shared helpers (internal) ──────────────────────────────────────────────────

/** @internal Use the typed category functions below instead. */
export function addItem(
  type: ItemType,
  id: string,
  count = 1,
  acquiredDate?: string,
  display?: ItemDisplayFields,
): void {
  const store = loadItemStore()
  if (type === 'consumable') {
    const existing = store.find(e => e.type === 'consumable' && e.id === id)
    if (existing) {
      existing.count += count
    } else {
      store.push({ id, type, count, ...display })
    }
  } else if (type === 'relic') {
    if (!store.some(e => e.type === 'relic' && e.id === id)) {
      store.push({ id, type, count: 1 })
    }
  } else {
    // 'item' — duplicates allowed (matches legacy behaviour)
    store.push({
      id,
      type,
      count: 1,
      acquiredDate: acquiredDate ?? new Date().toISOString().slice(0, 10),
      ...display,
    })
  }
  saveItemStore(store)
}

/** @internal Use the typed category functions below instead. */
export function removeItem(type: ItemType, id: string, count = 1): void {
  const store = loadItemStore()
  if (type === 'consumable') {
    const entry = store.find(e => e.type === 'consumable' && e.id === id)
    if (entry) {
      entry.count -= count
      if (entry.count <= 0) store.splice(store.indexOf(entry), 1)
    }
  } else {
    const idx = store.findIndex(e => e.type === type && e.id === id)
    if (idx !== -1) store.splice(idx, 1)
  }
  saveItemStore(store)
}

/** @internal Use the typed category functions below instead. */
export function getItemsOfType(type: ItemType): ItemEntry[] {
  return loadItemStore().filter(e => e.type === type)
}

// ── CONSUMABLES (battle-use items) ────────────────────────────────────────────
//
// Health Potion and Second Wind live here between shops and the next battle.
// On campaign start/resume, drainStashIntoRun() (questline.ts) moves them into
// run.consumables and clears them from this store.
//
// Only ids that appear in consumables.json (ALL_CONSUMABLES) are drained.
// See the WARNING at the top of this file before adding new consumable types.

/** Add `count` battle consumables to the stash (e.g. after a shop purchase). */
export function addConsumable(id: string, count = 1): void {
  addItem('consumable', id, count)
}

/**
 * Remove `count` battle consumables from the stash.
 * Silently does nothing if the item is not present or count is too low.
 */
export function removeConsumable(id: string, count = 1): void {
  removeItem('consumable', id, count)
}

/**
 * Return all battle consumables currently in the stash.
 * Excludes arcade tickets — use getTickets() for those.
 */
export function getConsumables(): Array<{ id: string; count: number }> {
  return loadItemStore()
    .filter(e => e.type === 'consumable' && e.id !== TICKET_ITEM_ID)
    .map(e => ({ id: e.id, count: e.count }))
}

// ── ARCADE TICKETS (persistent currency) ──────────────────────────────────────
//
// Arcade tickets are earned by playing mini games and spent in the prize shop.
// They are stored as type: 'consumable' with id: 'arcade-ticket' so they appear
// in the inventory consumables list.
//
// ⚠️ They must never be drained into a campaign run. This is enforced by
// drainStashIntoRun (questline.ts) filtering against ALL_CONSUMABLES, which
// does not include 'arcade-ticket'. Do not add 'arcade-ticket' to
// consumables.json or it will be swallowed by runs.
//
// Always use these three functions for ticket management — never call
// addConsumable / removeConsumable with the ticket id directly.

const TICKET_ITEM_ID = 'arcade-ticket'

/** Return the player's current arcade ticket balance. */
export function getTickets(): number {
  const entry = loadItemStore().find(e => e.type === 'consumable' && e.id === TICKET_ITEM_ID)
  return entry ? entry.count : 0
}

/** Award `n` tickets (must be > 0). */
export function addTickets(n: number): void {
  if (n <= 0) return
  const store = loadItemStore()
  const entry = store.find(e => e.type === 'consumable' && e.id === TICKET_ITEM_ID)
  if (entry) {
    entry.count += n
  } else {
    store.push({
      id:   TICKET_ITEM_ID,
      type: 'consumable',
      count: n,
      name: 'Arcade Ticket',
      icon: '🎫',
      desc: 'Earned at the arcade. Redeem for prizes!',
    })
  }
  saveItemStore(store)
}

/**
 * Deduct `n` tickets from the player's balance.
 * Returns `true` on success, `false` if the balance is insufficient (no change
 * is made in that case).
 */
export function spendTickets(n: number): boolean {
  const current = getTickets()
  if (current < n) return false
  const store = loadItemStore()
  const entry = store.find(e => e.type === 'consumable' && e.id === TICKET_ITEM_ID)
  if (entry) {
    entry.count -= n
    if (entry.count <= 0) store.splice(store.indexOf(entry), 1)
  }
  saveItemStore(store)
  return true
}

// ── CHRONICLE FRAGMENTS & EXOTIC RELIC SHARDS (persistent currencies) ─────────
//
// Chronicle Fragments are earned by completing the Weekly Narrative Challenge.
// Three fragments automatically combine into one Exotic Relic Shard (see
// grantWeeklyReward in weeklyChallenge.ts). Shards are held in the inventory;
// redeeming them is a future feature.
//
// ⚠️ Like arcade tickets, both are stored as type: 'consumable' so they appear
// in the inventory, but their ids must never be added to consumables.json or
// drainStashIntoRun (questline.ts) would swallow them into a campaign run.

const FRAGMENT_ITEM_ID = 'chronicle-fragment'
const SHARD_ITEM_ID    = 'exotic-relic-shard'

const FRAGMENT_DISPLAY: ItemDisplayFields = {
  name: 'Chronicle Fragment',
  icon: '📜',
  desc: 'A torn page of the Fracture Chronicle. Three fragments fuse into an Exotic Relic Shard.',
  lore: 'The Archive records everything — even what was deliberately erased.',
}

const SHARD_DISPLAY: ItemDisplayFields = {
  name: 'Exotic Relic Shard',
  icon: '💠',
  desc: 'A crystallised sliver of pre-Fracture power. One day, enough shards may become something exotic.',
  lore: 'It hums in the presence of the seam, like a key remembering its lock.',
}

function getCurrencyCount(id: string): number {
  const entry = loadItemStore().find(e => e.type === 'consumable' && e.id === id)
  return entry ? entry.count : 0
}

function addCurrency(id: string, n: number, display: ItemDisplayFields): void {
  if (n <= 0) return
  const store = loadItemStore()
  const entry = store.find(e => e.type === 'consumable' && e.id === id)
  if (entry) {
    entry.count += n
  } else {
    store.push({ id, type: 'consumable', count: n, ...display })
  }
  saveItemStore(store)
}

function removeCurrency(id: string, n: number): boolean {
  const current = getCurrencyCount(id)
  if (current < n) return false
  const store = loadItemStore()
  const entry = store.find(e => e.type === 'consumable' && e.id === id)
  if (entry) {
    entry.count -= n
    if (entry.count <= 0) store.splice(store.indexOf(entry), 1)
  }
  saveItemStore(store)
  return true
}

/** Current Chronicle Fragment balance. */
export function getChronicleFragments(): number {
  return getCurrencyCount(FRAGMENT_ITEM_ID)
}

/** Award `n` Chronicle Fragments (must be > 0). */
export function addChronicleFragments(n: number): void {
  addCurrency(FRAGMENT_ITEM_ID, n, FRAGMENT_DISPLAY)
}

/** Remove `n` fragments (when combining into a shard). Returns false if balance is too low. */
export function removeChronicleFragments(n: number): boolean {
  return removeCurrency(FRAGMENT_ITEM_ID, n)
}

/** Current Exotic Relic Shard balance. */
export function getExoticShards(): number {
  return getCurrencyCount(SHARD_ITEM_ID)
}

/** Award `n` Exotic Relic Shards (must be > 0). */
export function addExoticShards(n: number): void {
  addCurrency(SHARD_ITEM_ID, n, SHARD_DISPLAY)
}

// ── RELICS ────────────────────────────────────────────────────────────────────
//
// Relics are passive bonuses earned by completing acts. They persist across
// runs and are unique — adding the same relic twice is a no-op.
// Display data and broken-relic logic live in relics.ts.

const CODEX_RELICS_KEY = 'jarv_codex_relics'

function getCodexRelicSet(): Set<string> {
  try {
    const raw = localStorage.getItem(CODEX_RELICS_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch { return new Set() }
}

/** Return the names of all relics the player currently holds. */
export function getRelics(): string[] {
  return getItemsOfType('relic').map(e => e.id)
}

/**
 * Return the names of all relics the player has ever acquired.
 * This set only grows — broken/removed relics remain here so the Codex
 * can show them as unlocked permanently.
 */
export function getEverAcquiredRelics(): string[] {
  const ever = getCodexRelicSet()
  if (ever.size === 0) {
    // Migrate: seed from currently-held relics on first call after this change
    const current = getRelics()
    if (current.length > 0) {
      try { localStorage.setItem(CODEX_RELICS_KEY, JSON.stringify(current)) } catch { /* ignore */ }
      return current
    }
  }
  return [...ever]
}

/** Add a relic to the player's permanent collection (no-op if already owned). */
export function addRelic(name: string): void {
  addItem('relic', name)
  // Persist to codex set (survives relic removal/breaking)
  const ever = getCodexRelicSet()
  if (!ever.has(name)) {
    ever.add(name)
    try { localStorage.setItem(CODEX_RELICS_KEY, JSON.stringify([...ever])) } catch { /* ignore */ }
  }
}

/** Remove a relic from the player's permanent collection (e.g. when it breaks). */
export function removeRelic(name: string): void {
  removeItem('relic', name)
}

// ── COLLECTIBLE ITEMS ─────────────────────────────────────────────────────────
//
// "Useless" items collected from daily logins and random events. Unlike relics
// and consumables, duplicates are allowed — the player can own the same item
// multiple times (each acquisition is tracked separately).
//
// Display resolution (mapping raw entries to UselessItem display objects) lives
// in dailyLogin.ts (loadInventory), which handles catalog lookup, broken-relic
// fallbacks, and the 42-item easter egg.

/**
 * Add a collectible item to the inventory.
 * Provide display fields (name, icon, desc, lore) for items whose id is not in
 * the static catalog — these are stored inline so the item can always be
 * rendered even if the catalog changes.
 */
export function addCollectible(
  id: string,
  display?: ItemDisplayFields,
  acquiredDate?: string,
): void {
  addItem('item', id, 1, acquiredDate, display)
}

/** Remove the first matching collectible item (e.g. when sold in the shop). */
export function removeCollectible(id: string): void {
  removeItem('item', id)
}

/** Return raw item store entries for all collectibles. */
export function getCollectibles(): ItemEntry[] {
  return getItemsOfType('item')
}

// ── HUB ITEMS (hub-world economy: quest items, materials, tools) ──────────────
//
// Hub items power the hub-world item economy: physical quest items held while
// a fetch quest is in progress, materials bought from town shops or produced
// by world interactions (chicken feed, eggs, feathers, caught fish, trade
// goods), and unique tools (the fishing rod).
//
// They are stored under their own type tag ('hub-item'), so — like arcade
// tickets and chronicle fragments — they can never be swallowed by
// drainStashIntoRun (questline.ts), which only drains type: 'consumable'
// entries whose ids appear in ALL_CONSUMABLES.
//
// Display data comes from the web/src/data/hubItems.json catalog. Entries not
// in the catalog (per-quest items with ids like `quest:<questId>:<stepKey>`)
// carry their display fields inline, same as arcade tickets do. Catalog items
// flagged `unique: true` (e.g. the fishing rod) never stack — re-adding one
// the player already owns is a no-op.

interface HubItemCatalogEntry {
  id: string
  name: string
  icon: string
  desc: string
  category: string
  unique?: boolean
}

const HUB_ITEM_CATALOG = HUB_ITEMS_DATA as HubItemCatalogEntry[]

export function getHubItemCatalogEntry(id: string): HubItemCatalogEntry | undefined {
  return HUB_ITEM_CATALOG.find(e => e.id === id)
}

/**
 * Add `count` hub items. Catalog items resolve their display fields from
 * hubItems.json; non-catalog items (quest items) should pass `display`
 * inline. Unique catalog items never stack — adding an owned unique item is
 * a no-op.
 */
export function addHubItem(id: string, count = 1, display?: ItemDisplayFields): void {
  if (count <= 0) return
  const catalog = getHubItemCatalogEntry(id)
  const store = loadItemStore()
  const entry = store.find(e => e.type === 'hub-item' && e.id === id)
  if (entry) {
    if (catalog?.unique) return
    entry.count += count
  } else {
    const fields: ItemDisplayFields = catalog
      ? { name: catalog.name, icon: catalog.icon, desc: catalog.desc, category: catalog.category as HubItemCategory }
      : display ?? {}
    store.push({
      id,
      type: 'hub-item',
      count: catalog?.unique ? 1 : count,
      acquiredDate: new Date().toISOString().slice(0, 10),
      ...fields,
    })
  }
  saveItemStore(store)
}

/**
 * Remove `count` hub items. Returns `true` on success, `false` if the player
 * holds fewer than `count` (no change is made in that case).
 */
export function removeHubItem(id: string, count = 1): boolean {
  if (count <= 0) return true
  const store = loadItemStore()
  const entry = store.find(e => e.type === 'hub-item' && e.id === id)
  if (!entry || entry.count < count) return false
  entry.count -= count
  if (entry.count <= 0) store.splice(store.indexOf(entry), 1)
  saveItemStore(store)
  return true
}

/** How many of this hub item the player holds. */
export function getHubItemCount(id: string): number {
  const entry = loadItemStore().find(e => e.type === 'hub-item' && e.id === id)
  return entry ? entry.count : 0
}

/** Whether the player holds at least one of this hub item. */
export function hasHubItem(id: string): boolean {
  return getHubItemCount(id) > 0
}

/** Return raw item store entries for all hub items. */
export function getHubItems(): ItemEntry[] {
  return getItemsOfType('hub-item')
}
