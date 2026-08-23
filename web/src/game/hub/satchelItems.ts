import type { HubQuestDef } from '../../data/hub/questDefs'
import { getHubItems, getHubItemCount, getHubItemCatalogEntry } from '../itemStore'
import { getQuestState } from './quests'
import { questItemId } from './questItems'
import { getKnownBuyers, getKnownSellers, type BuyerEntry, type SellerEntry } from './tradeJournal'

export type SatchelCategory = 'quest' | 'material' | 'tool'

export interface SatchelItem {
  /** Hub-item store id. Quest items are keyed per quest step. */
  id: string
  name: string
  icon: string
  category: SatchelCategory
  /** How many are held. */
  count: number
  /** Quest items only: which quest wants it, and how many it needs. */
  need?: { questId: string; questTitle: string; required: number }
}

/** True once a quest item is held in the quantity its step asks for. */
export function isSatisfied(item: SatchelItem): boolean {
  return item.need != null && item.count >= item.need.required
}

/** Items an active quest is asking you to gather, across every town's quests. */
export function questItems(allQuestDefs: HubQuestDef[]): SatchelItem[] {
  const rows: SatchelItem[] = []
  for (const quest of allQuestDefs) {
    if (getQuestState(quest.id).status !== 'active') continue
    for (const step of quest.steps) {
      if (step.type !== 'collect' || !step.itemName) continue
      rows.push({
        id: questItemId(quest.id, step.key),
        name: step.itemName,
        icon: step.itemIcon ?? '📦',
        category: 'quest',
        count: getHubItemCount(questItemId(quest.id, step.key)),
        need: { questId: quest.id, questTitle: quest.title, required: step.required },
      })
    }
  }
  return rows
}

/** Everything else in the bag — materials and tools, from the item store. */
export function carriedItems(): SatchelItem[] {
  return getHubItems()
    .filter(entry => entry.category === 'tool' || entry.category === 'material')
    .map(entry => ({
      id: entry.id,
      name: entry.name ?? getHubItemCatalogEntry(entry.id)?.name ?? entry.id,
      icon: entry.icon ?? getHubItemCatalogEntry(entry.id)?.icon ?? '📦',
      category: entry.category === 'tool' ? 'tool' as const : 'material' as const,
      count: entry.count,
    }))
    // Tools before materials, then alphabetical — a stable order, so a tile
    // doesn't move under the player's thumb when a stack count changes.
    .sort((a, b) =>
      a.category !== b.category
        ? (a.category === 'tool' ? -1 : 1)
        : a.name.localeCompare(b.name))
}

export interface ItemDetail {
  item: SatchelItem
  /** Trade-journal entries for this item, matched on its catalog id. */
  sellers: SellerEntry[]
  buyers: BuyerEntry[]
}

/**
 * What the player actually wants to know when they tap an item: what it is
 * for, and who deals in it. The trade journal already records who sells and
 * buys what — it was just filed in a different tab from the item itself.
 */
export function itemDetail(item: SatchelItem): ItemDetail {
  return {
    item,
    sellers: getKnownSellers().filter(s => s.itemId === item.id),
    buyers:  getKnownBuyers().filter(b => b.itemId === item.id),
  }
}
