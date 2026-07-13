import { loadInventory } from '../dailyLogin'
import { getRelicDef, loadEarnedRelics } from '../relics'

// Lets shelf items (relics, keepsakes, odds & ends — anything SHELF-tab-visible)
// be placed in the DECORATE grid as 1x1 display pieces alongside purchased
// furniture. They're already owned by virtue of being on the shelf, so there's
// nothing to buy here — homeLayout.ts just needs a way to resolve and validate
// these ids alongside real furniture.json ids.

const ITEM_PREFIX  = 'shelf-item:'
const RELIC_PREFIX = 'shelf-relic:'

export function shelfItemDisplayId(itemId: string): string {
  return `${ITEM_PREFIX}${itemId}`
}

export function shelfRelicDisplayId(relicName: string): string {
  return `${RELIC_PREFIX}${relicName}`
}

export function isShelfDecorId(id: string): boolean {
  return id.startsWith(ITEM_PREFIX) || id.startsWith(RELIC_PREFIX)
}

export interface ShelfDecorDef {
  id: string
  name: string
  icon: string
}

/** Resolves a shelf-decor placement id back to its display info — undefined if
 *  it's not a shelf-decor id, or the underlying item/relic is no longer owned
 *  (e.g. sold or traded away since it was placed). */
export function getShelfDecorDef(id: string): ShelfDecorDef | undefined {
  if (id.startsWith(ITEM_PREFIX)) {
    const itemId = id.slice(ITEM_PREFIX.length)
    const item = loadInventory().find(i => i.id === itemId)
    return item ? { id, name: item.name, icon: item.icon } : undefined
  }
  if (id.startsWith(RELIC_PREFIX)) {
    const name = id.slice(RELIC_PREFIX.length)
    if (!loadEarnedRelics().includes(name)) return undefined
    const def = getRelicDef(name)
    return def ? { id, name: def.name, icon: def.icon } : undefined
  }
  return undefined
}

/** True if this shelf-decor id currently resolves to something the player still owns. */
export function ownsShelfDecor(id: string): boolean {
  return getShelfDecorDef(id) !== undefined
}
