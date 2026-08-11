import { getCardCatalog } from '../game/cards'
import { generateMerchantCards, ALL_CONSUMABLES } from '../game/questline'
import { loadInventory, ALL_ITEMS } from '../game/dailyLogin'
import { cardMerchantItem, type MerchantItem } from '../components/campaign/MerchantScreen'
import brokenRelicsData from '../data/broken-relics.json'

export const BROKEN_RELIC_ITEMS: Record<string, { name: string; icon: string; desc: string }> =
  Object.fromEntries((brokenRelicsData as { relicName: string; name: string; icon: string; desc: string }[])
    .map(r => [r.relicName, { name: r.name, icon: r.icon, desc: r.desc }]))

/** Build merchant item list: 3 cards + ~1-in-5 chance of 1 unowned inventory 'Curiosity' at 10–20 crystals. */
export function buildMerchantItems(): MerchantItem[] {
  const catalog   = getCardCatalog()
  const cardNames = generateMerchantCards()
  const items: MerchantItem[] = cardNames.map(name => {
    const card = catalog.find(c => c.name === name)!
    return cardMerchantItem(card)
  })
  if (Math.random() < 0.2) {
    const owned = new Set(loadInventory().map(i => i.id))
    const available = ALL_ITEMS.filter(i => !owned.has(i.id))
    if (available.length > 0) {
      const inv   = available[Math.floor(Math.random() * available.length)]
      const price = 10 + Math.floor(Math.random() * 11)   // 10–20 crystals
      items.push({ kind: 'item', inventoryItem: { id: inv.id, name: inv.name, icon: inv.icon, desc: inv.desc, lore: inv.lore ?? '', acquiredDate: '' }, price })
    }
  }
  // Always add consumables to the merchant
  for (const c of ALL_CONSUMABLES) {
    items.push({ kind: 'consumable', def: c, price: c.price })
  }
  return items
}
