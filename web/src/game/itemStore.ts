// ─── Unified Item Store ────────────────────────────────────────────────────────
// Single source of truth for all persistent player items: consumables, relics,
// and useless collectibles. Each entry carries a `type` tag so consumers know
// what kind of item they are dealing with.
//
// Migration: on first load the store checks for the three legacy keys and folds
// them in, then deletes the old keys. Existing player data is never lost.

import { logError } from '../logger'

export type ItemType = 'consumable' | 'relic' | 'item'

export interface ItemEntry {
  /** Consumable id, relic name, or useless-item id */
  id: string
  type: ItemType
  /** Stack size — only meaningful for consumables; always 1 for relics/items */
  count: number
  /** ISO date string set when the item was first acquired (items only) */
  acquiredDate?: string
}

const ITEM_STORE_KEY = 'jarv_item_store'

// Legacy keys that will be migrated into the unified store on first load
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
        // Items are NOT de-duped here — the old store allowed duplicates
        store.push({ id: item.id, type: 'item', count: 1, acquiredDate: item.acquiredDate })
        changed = true
      }
      localStorage.removeItem(LEGACY_INVENTORY_KEY)
    }
  } catch { /* ignore */ }

  return changed ? store : store
}

// ── Core CRUD ──────────────────────────────────────────────────────────────────

export function loadItemStore(): ItemEntry[] {
  let store: ItemEntry[] = []
  try {
    const raw = localStorage.getItem(ITEM_STORE_KEY)
    store = raw ? (JSON.parse(raw) as ItemEntry[]) : []
  } catch {
    store = []
  }

  // Run migration if any legacy keys exist
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
    localStorage.setItem(ITEM_STORE_KEY, JSON.stringify(store))
  } catch (e) {
    logError('saveItemStore failed', { error: String(e) })
  }
}

/** Add `count` units of an item. For relics/items count is always 1. */
export function addItem(type: ItemType, id: string, count = 1, acquiredDate?: string): void {
  const store = loadItemStore()
  if (type === 'consumable') {
    const existing = store.find(e => e.type === 'consumable' && e.id === id)
    if (existing) {
      existing.count += count
    } else {
      store.push({ id, type, count })
    }
  } else if (type === 'relic') {
    if (!store.some(e => e.type === 'relic' && e.id === id)) {
      store.push({ id, type, count: 1 })
    }
  } else {
    // 'item' — duplicates are allowed (matches legacy behaviour)
    store.push({ id, type, count: 1, acquiredDate: acquiredDate ?? new Date().toISOString().slice(0, 10) })
  }
  saveItemStore(store)
}

/**
 * Remove `count` units of an item.
 * - Consumables: decrement count; remove entry when it reaches 0.
 * - Relics / items: remove the first matching entry.
 */
export function removeItem(type: ItemType, id: string, count = 1): void {
  const store = loadItemStore()
  if (type === 'consumable') {
    const entry = store.find(e => e.type === 'consumable' && e.id === id)
    if (entry) {
      entry.count -= count
      if (entry.count <= 0) {
        const idx = store.indexOf(entry)
        store.splice(idx, 1)
      }
    }
  } else {
    const idx = store.findIndex(e => e.type === type && e.id === id)
    if (idx !== -1) store.splice(idx, 1)
  }
  saveItemStore(store)
}

/** Return all entries matching the given type. */
export function getItemsOfType(type: ItemType): ItemEntry[] {
  return loadItemStore().filter(e => e.type === type)
}
