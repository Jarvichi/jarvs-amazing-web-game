// Hub World NPC definitions — quest-givers and card-unit spawn positions.

export interface QuestGiverNpc {
  id:       string
  name:     string
  sprite:   string   // filename slug (looked up via /sprites/{sprite}.svg)
  tx:       number
  ty:       number
  dialogue: string
  /** If set, tapping navigates to this screen instead of showing the dialogue panel. */
  screen?:  string
}

// Fixed-position quest-giver NPCs (tappable, placeholder dialogue).
export const QUEST_GIVER_NPCS: QuestGiverNpc[] = [
  {
    id:       'elder',
    name:     'The Elder',
    sprite:   'hub-npc-elder',
    tx:       19,
    ty:       12,
    dialogue: 'The roads beyond the outer walls grow darker by the day. Tread carefully, wanderer.',
  },
  {
    id:       'merchant',
    name:     'Vex the Merchant',
    sprite:   'hub-npc-merchant',
    tx:       22,
    ty:       24,
    dialogue: "Business has been slow since the Fracture. Come back when the trade routes are safe again.",
  },
  {
    id:       'scholar',
    name:     'Archivist Naia',
    sprite:   'hub-npc-scholar',
    tx:       56,
    ty:        9,
    dialogue: 'I have been cataloguing the Fracture shards. The answers are within your reach — if you dare.',
  },

  // ── Shopkeepers ──────────────────────────────────────────────────────────────
  {
    id:      'card-shopkeeper',
    name:    'Gildwyn',
    sprite:  'hub-npc-card-shop',
    tx:       6,
    ty:       7,
    dialogue: '',
    screen:   'shop-cards',
  },
  {
    id:      'augment-shopkeeper',
    name:    'Mira the Enchantress',
    sprite:  'hub-npc-augment-shop',
    tx:      14,
    ty:       7,
    dialogue: '',
    screen:   'shop-augments',
  },
  {
    id:      'supplies-shopkeeper',
    name:    'Bramble',
    sprite:  'hub-npc-supplies',
    tx:       7,
    ty:      18,
    dialogue: '',
    screen:   'shop-supplies',
  },
  {
    id:      'trader',
    name:    'The Junk Trader',
    sprite:  'hub-npc-trader',
    tx:      11,
    ty:      24,
    dialogue: '',
    screen:   'shop-supplies',
  },
  {
    id:      'fisherman',
    name:    'Old Greyfish',
    sprite:  'hub-npc-fisherman',
    tx:       3,
    ty:      35,
    dialogue: "Been sitting at this pond since before the Fracture. The water's gone quiet lately — something's stirring beneath.",
  },
]

// Preset positions for card-unit NPC spawning — all on street tiles, spread across the map.
// Courtyard tiles (tx≈33-41, ty≈21-28) are always in the initial mobile viewport so NPCs
// are visible immediately without scrolling.
export const NPC_SPAWN_TILES: [number, number][] = [
  // ── Courtyard — always visible on mobile ─────────────────────────────────
  [35, 23],   // courtyard NW
  [39, 23],   // courtyard NE
  [35, 26],   // courtyard SW
  [39, 26],   // courtyard SE
  // ── Rest of the map ───────────────────────────────────────────────────────
  [19,  8],   // NW alley upper
  [19, 15],   // NW alley mid
  [10, 24],   // Market Lane west
  [60, 24],   // Arcade east
  [56, 11],   // NE alley mid
  [37,  7],   // North corridor
  [37, 40],   // South corridor
  [15, 35],   // SW cross-spur
  [ 5, 35],   // SW spur far end
  [65,  9],   // NE spur far east
]
