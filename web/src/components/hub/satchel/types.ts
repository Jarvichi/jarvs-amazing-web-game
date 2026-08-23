/** The five top-level sections of the hub Satchel sheet (#hub-menu-redesign).
 *
 *  Replaces the old seven-tab `HubTabId`. The mapping is:
 *    quests        → 'quests'   (now global, not town-scoped)
 *    inventory     → 'satchel'  (absorbs pet accessories)
 *    directory     → 'town'     (merged with upgrades)
 *    upgrades      → 'town'
 *    journal       → 'codex'    (merged with the trade journal)
 *    trade-journal → 'codex'
 *    pet           → opens the pet sheet directly, not a section
 */
export type SatchelSectionId = 'today' | 'satchel' | 'quests' | 'town' | 'codex'

export interface SatchelNavItem {
  id: SatchelSectionId
  icon: string
  label: string
  /** Draws an attention dot on the nav item (e.g. something new to look at). */
  badge?: boolean
}

/** Nav order is fixed: the dashboard first, then what you hold, owe, and know. */
export const SATCHEL_NAV: SatchelNavItem[] = [
  { id: 'today',   icon: '✦',  label: 'Today' },
  { id: 'satchel', icon: '🎒', label: 'Satchel' },
  { id: 'quests',  icon: '📜', label: 'Quests' },
  { id: 'town',    icon: '🏘', label: 'Town' },
  { id: 'codex',   icon: '📖', label: 'Codex' },
]
