// ─── Held quest items ─────────────────────────────────────────────────────────
//
// Fetch-quest collect steps with `itemName`/`itemIcon` place a physical item
// in the player's hub-item inventory (itemStore.ts) as each pickup is
// collected, and clear it again when the quest is turned in or abandoned.
// Items are keyed per quest step so different quests' items never collide.

/** Hub-item id for a held quest item: `quest:<questId>:<stepKey>`. */
export function questItemId(questId: string, stepKey: string): string {
  return `quest:${questId}:${stepKey}`
}

/** Whether a hub-item id belongs to a held quest item. */
export function isQuestItemId(id: string): boolean {
  return id.startsWith('quest:')
}

/** The quest id embedded in a held-quest-item id, or null. */
export function questIdFromItemId(id: string): string | null {
  if (!isQuestItemId(id)) return null
  const parts = id.split(':')
  return parts.length >= 3 ? parts[1] : null
}
