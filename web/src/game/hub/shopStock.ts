// ─── Hub Shop Stock ─────────────────────────────────────────────────────────
//
// Resolves the physical, tappable for-sale items placed inside the 3 Ravenwatch
// shop interiors (card-shop, augment-shop, supply-shop). Cards/augments reuse
// shopSchedule.ts's real date-seeded deal generators directly, so a shop's
// in-world items always match what ShopScreen.tsx sells once you walk in.
// Supplies has no date-seeded equivalent in shopSchedule.ts (ShopScreen shows
// the full fixed ALL_CONSUMABLES catalog there) — a small rotating subset is
// picked here with the same seeded-rng mechanism so all 3 shops feel alike.

import { getDailyShopCards, getDailyShopAugment, getShopSlotKey, makeSeededRng, dateHash, ShopCardFilter } from '../shopSchedule'
import { CardRarity } from '../types'
import { ALL_CONSUMABLES } from '../questline'
import { getPetAccessoryDef } from '../../data/petAccessories'

/** Widened to a plain string: new traders register under any building id, not just Ravenwatch's 3. */
export type ShopBuildingId = string

export type ShopTraderKind = 'card' | 'augment' | 'consumable' | 'accessory'

export interface ShopTraderConfig {
  kind: ShopTraderKind
  /** 'card' traders only: restricts/reshapes the card pool (e.g. cardType/rarity filters). */
  cardFilter?: ShopCardFilter
  /** 'augment' traders only: restricts the augment pool to these rarities. */
  augmentRarities?: CardRarity[]
  /** 'consumable' traders only: how many items to stock. Defaults to 3. */
  slotCount?: number
}

/** One row per trader building. New specialist traders register here. */
export const SHOP_TRADER_REGISTRY: Record<string, ShopTraderConfig> = {
  'card-shop':    { kind: 'card' },
  'augment-shop': { kind: 'augment' },
  'supply-shop':  { kind: 'consumable' },

  // Tier 1 specialist traders (see epic #1814)
  'undertaker':   { kind: 'card', cardFilter: { rarity: 'common' } },     // gravemoor — Merchant Mora, Bargain Peddler
  'market-barn':  { kind: 'card', cardFilter: { rarity: 'uncommon' } },   // appleford — Trader Posy, Curio Dealer
  'market-hall':  { kind: 'card', cardFilter: { cardType: 'upgrade' } },  // millhaven — Trader Nessa, Spellwright

  // Tier 2 specialist traders (see epic #1814)
  'tool-shop':            { kind: 'card', cardFilter: { cardType: 'structure' } },            // gearford — Engineer Torvald, Structural Engineer
  'gear-shop':            { kind: 'card', cardFilter: { cardType: 'unit' } },                 // gearford — Sergeant Coldiron, Warmonger
  'chandlers':            { kind: 'card', cardFilter: { rarity: 'rare' } },                   // saltmereport — Chandler Beaumont, Relic Hunter
  'market-shed':          { kind: 'card', cardFilter: { rarity: 'common' } },                 // harrowfield — Pedlar Quill, Bargain Peddler
  'bonepile-curio':       { kind: 'card', cardFilter: { rarities: ['epic', 'legendary'] } },  // hollowmere — Snægg the Collector, Vaultkeeper
  'quartermasters-store': { kind: 'card', cardFilter: { cardType: 'unit' } },                 // ironholdkeep — Quartermaster Sella, Warmonger

  // Tier 3 specialist traders (see epic #1814)
  'grand-bank':      { kind: 'card', cardFilter: { rarities: ['epic', 'legendary'] } },  // capitalcity — Banker Sterling, Vaultkeeper
  'jeweller':        { kind: 'card', cardFilter: { rarity: 'uncommon' } },               // capitalcity — Jeweller Isolde, Curio Dealer
  'treasury-annex':  { kind: 'card', cardFilter: { rarities: ['epic', 'legendary'] } },  // royalpalace — Master of Coin Aldric, Vaultkeeper
  'spellwright-den': { kind: 'card', cardFilter: { cardType: 'upgrade' } },              // dreadspirecitadel — Ashka the Grimoire-Peddler, Spellwright

  // Pet accessories (see #1845 follow-up)
  'tailor':          { kind: 'accessory' },  // capitalcity — Tailor Pell
}

export type ShopStockGrant =
  | { kind: 'card'; cardName: string }
  | { kind: 'augment'; augmentName: string }
  | { kind: 'consumable'; id: string }
  | { kind: 'accessory'; id: string }

export interface ShopStockItem {
  itemName: string
  price: number
  grant: ShopStockGrant
}

const DEFAULT_SUPPLY_STOCK_COUNT = 3

function getSupplyStock(at: Date | undefined, count: number): ShopStockItem[] {
  const slotKey = getShopSlotKey(at)
  const rng     = makeSeededRng(dateHash(slotKey) ^ 0x5a1e5009)
  const pool    = [...ALL_CONSUMABLES]
  const picks: ShopStockItem[] = []
  const used = new Set<number>()
  while (picks.length < count && picks.length < pool.length) {
    const idx = Math.floor(rng() * pool.length)
    if (used.has(idx)) continue
    used.add(idx)
    const item = pool[idx]
    picks.push({ itemName: item.name, price: item.price, grant: { kind: 'consumable', id: item.id } })
  }
  return picks
}

// Fixed (not date-rotating) accessory catalog for the Tailor Pell shop — the
// base accessories not already covered by a quest or a bounty reward, plus
// every bespoke colour variant (see #1861), which are cosmetic-only extras
// with no narrative reward tied to them.
const ACCESSORY_SHOP_IDS = [
  'top-hat', 'top-hat-navy', 'top-hat-brown',
  'blue-coat', 'blue-coat-red', 'blue-coat-green',
  'leather-collar-black', 'leather-collar-red',
  'red-bow-pink', 'red-bow-purple',
  'black-bowtie-navy', 'black-bowtie-burgundy',
  'brown-boots-black', 'brown-boots-grey',
]

function getAccessoryStock(): ShopStockItem[] {
  return ACCESSORY_SHOP_IDS.map(id => {
    const def = getPetAccessoryDef(id)!
    return { itemName: def.name, price: def.price, grant: { kind: 'accessory', id } }
  })
}

/** Today's (current 3-hour slot's) for-sale items for a registered hub trader. */
export function getTodaysShopItems(buildingId: string, at?: Date): ShopStockItem[] {
  const config = SHOP_TRADER_REGISTRY[buildingId]
  if (!config) return []

  switch (config.kind) {
    case 'card':
      return getDailyShopCards(at, config.cardFilter)
        .filter(d => d.cardName !== '')
        .map(d => ({ itemName: d.cardName, price: d.price, grant: { kind: 'card', cardName: d.cardName } }))
    case 'augment': {
      const deal = getDailyShopAugment(at, config.augmentRarities)
      return deal.augmentName === ''
        ? []
        : [{ itemName: deal.augmentName, price: deal.price, grant: { kind: 'augment', augmentName: deal.augmentName } }]
    }
    case 'consumable':
      return getSupplyStock(at, config.slotCount ?? DEFAULT_SUPPLY_STOCK_COUNT)
    case 'accessory':
      return getAccessoryStock()
  }
}
