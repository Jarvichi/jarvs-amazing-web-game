// ─── Hub Shop Stock ─────────────────────────────────────────────────────────
//
// Resolves the physical, tappable for-sale items placed inside the 3 Ravenwatch
// shop interiors (card-shop, augment-shop, supply-shop). Cards/augments reuse
// shopSchedule.ts's real date-seeded deal generators directly, so a shop's
// in-world items always match what ShopScreen.tsx sells once you walk in.
// Supplies has no date-seeded equivalent in shopSchedule.ts (ShopScreen shows
// the full fixed ALL_CONSUMABLES catalog there) — a small rotating subset is
// picked here with the same seeded-rng mechanism so all 3 shops feel alike.

import { getDailyShopCards, getDailyShopAugment, getShopSlotKey, makeSeededRng, dateHash } from '../shopSchedule'
import { ALL_CONSUMABLES } from '../questline'

export type ShopBuildingId = 'card-shop' | 'augment-shop' | 'supply-shop'

export type ShopStockGrant =
  | { kind: 'card'; cardName: string }
  | { kind: 'augment'; augmentName: string }
  | { kind: 'consumable'; id: string }

export interface ShopStockItem {
  itemName: string
  price: number
  grant: ShopStockGrant
}

const SUPPLY_STOCK_COUNT = 3

function getSupplyStock(at?: Date): ShopStockItem[] {
  const slotKey = getShopSlotKey(at)
  const rng     = makeSeededRng(dateHash(slotKey) ^ 0x5a1e5009)
  const pool    = [...ALL_CONSUMABLES]
  const picks: ShopStockItem[] = []
  const used = new Set<number>()
  while (picks.length < SUPPLY_STOCK_COUNT && picks.length < pool.length) {
    const idx = Math.floor(rng() * pool.length)
    if (used.has(idx)) continue
    used.add(idx)
    const item = pool[idx]
    picks.push({ itemName: item.name, price: item.price, grant: { kind: 'consumable', id: item.id } })
  }
  return picks
}

/** Today's (current 3-hour slot's) for-sale items for one of the 3 hub shops. */
export function getTodaysShopItems(buildingId: ShopBuildingId, at?: Date): ShopStockItem[] {
  switch (buildingId) {
    case 'card-shop':
      return getDailyShopCards(at)
        .filter(d => d.cardName !== '')
        .map(d => ({ itemName: d.cardName, price: d.price, grant: { kind: 'card', cardName: d.cardName } }))
    case 'augment-shop': {
      const deal = getDailyShopAugment(at)
      return deal.augmentName === ''
        ? []
        : [{ itemName: deal.augmentName, price: deal.price, grant: { kind: 'augment', augmentName: deal.augmentName } }]
    }
    case 'supply-shop':
      return getSupplyStock(at)
  }
}
