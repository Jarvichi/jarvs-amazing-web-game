// Hub World NPC definitions — quest-givers and card-unit spawn positions.

export interface QuestGiverNpc {
  id:       string
  name:     string
  sprite:   string   // filename slug (looked up via /sprites/{sprite}.svg)
  tx:       number
  ty:       number
  dialogue: string
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
]

// Preset positions for card-unit NPC spawning — all on street tiles, spread across the map.
export const NPC_SPAWN_TILES: [number, number][] = [
  [19,  8],   // NW alley upper
  [19, 15],   // NW alley mid
  [ 8, 24],   // Market Lane west
  [60, 24],   // Arcade east
  [56, 11],   // NE alley mid
  [37,  7],   // North corridor
  [37, 40],   // South corridor
  [15, 35],   // SW cross-spur
  [ 5, 35],   // SW spur far end
  [65,  9],   // NE spur far east
]
