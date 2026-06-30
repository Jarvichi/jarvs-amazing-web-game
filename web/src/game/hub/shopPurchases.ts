// ─── Hub Shop Purchases ─────────────────────────────────────────────────────
//
// Tracks which shop-item slots have already been bought in the current
// shopSchedule.ts stock slot (3-hour window), so a tapped item shows "already
// bought" instead of selling infinitely. Keying by slot means old entries
// simply stop matching once the slot rotates — no expiry bookkeeping needed.

import { getShopSlotKey } from '../shopSchedule'

const KEY = 'jarv_hub_shop_purchases'

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch { return new Set() }
}

function save(keys: Set<string>): void {
  try { localStorage.setItem(KEY, JSON.stringify([...keys])) } catch { /* ignore */ }
}

function slotKeyFor(itemSlotId: string, at?: Date): string {
  return `${itemSlotId}:${getShopSlotKey(at)}`
}

export function hasBoughtToday(itemSlotId: string, at?: Date): boolean {
  return load().has(slotKeyFor(itemSlotId, at))
}

export function markBoughtToday(itemSlotId: string, at?: Date): void {
  const keys = load()
  keys.add(slotKeyFor(itemSlotId, at))
  save(keys)
}
