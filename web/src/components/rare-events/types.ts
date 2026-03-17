export type RareEventKind =
  | 'blackjack'
  | 'fakeCrash'
  | 'wrongNumber'
  | 'narrator'
  | 'liarsDice'
  | 'gambler'

export interface RareEventEffect {
  damage?:           number   // damage dealt to opponent base
  selfDamage?:       number   // damage dealt to player base
  crystals?:         number   // crystals gained (positive) or lost (negative)
  killEnemyUnits?:   number   // remove N random mobile enemy units from the field
  logMessage?:       string   // message appended to the battle log
  grantAllCards?:    boolean  // add 1 copy of every catalog card to collection
  resetGame?:        boolean  // wipe all progress and reload
  addInventoryItem?: { id: string; name: string; icon: string; desc: string; lore?: string }
}

export const RARE_EVENT_CHANCE = 0.001  // 1 in 1000 games

export const ALL_RARE_EVENTS: RareEventKind[] = [
  'blackjack',
  'fakeCrash',
  'wrongNumber',
  'narrator',
  'liarsDice',
  'gambler',
]
