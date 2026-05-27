export const TILE_SIZE = 32

// ── [Base]BaseChip_pipo — ground fill tiles ───────────────────────────────────
// Tile IDs 0–7 are the 8 base ground textures used to fill the map background.
export const BASE_GROUND = {
  mediumGrass: 0,
  darkGrass:   1,
  lightGrass:  2,
  dyingGrass:  3,
  lightDirt:   4,
  darkDirt:    5,
  sand:        6,
  gravel:      7,
} as const

// ── [A]Grass_pipo — path tile offsets ────────────────────────────────────────
// Each set has 47 path tiles (indices 0–46) followed by 1 blank tile.
// Add a set's base tile ID to one of these offsets to get the final tile ID.
//
// Exits are named by compass direction: t=top, b=bottom, l=left, r=right.
// "quad" tiles show path only in one corner (grass fills the other 3 quadrants).
// Tiles 24–45 are corner-grass variations (subtle) — to be indexed later.
export const PATH = {
  isolated:         0,   // no exits
  rightOnly:        1,   // r
  horizontal:       2,   // l + r  (straight)
  leftOnly:         3,   // l
  bottomOnly:       4,   // b
  quadBottomRight:  5,   // b + r  (grass top + left)
  edgeTop:          6,   // l + b + r  (grass border along top edge)
  quadBottomLeft:   7,   // l + b  (grass top + right)
  turnBottomRight:  8,   // b + r  (road curves)
  turnBottomLeft:   9,   // l + b
  tJuncLeft:        10,  // b + r + t  (grass left only)
  tJuncTop:         11,  // l + b + r  (proper T-junction)
  vertical:         12,  // t + b  (straight)
  tJuncRight:       13,  // t + r + b  (grass left only... wait: "t,r,b")
  allSidesNoGrass:  14,  // all exits, fully filled (no grass corners)
  tJuncLeft2:       15,  // t + l + b  (grass right only)
  turnTopRight:     16,  // t + r
  turnTopLeft:      17,  // t + l
  tJuncBottom:      18,  // l + t + r  (proper T-junction)
  tJuncRight2:      19,  // l + t + b
  topOnly:          20,  // t
  quadTopRight:     21,  // t + r  (grass bottom + left)
  edgeBottom:       22,  // l + t + r  (grass border along bottom edge)
  quadTopLeft:      23,  // l + t  (grass bottom + right)
  allSides:         46,  // l + r + t + b (with grass corners — use near grass)
} as const

// ── [A]Grass_pipo — path set base tile IDs ───────────────────────────────────
// Each entry is the starting tile ID for that path texture within the sheet.
// All sets use medium-grass as the surrounding terrain.
export const GRASS_PATH = {
  wornDirt:  0,
  darkDirt:  48,
  sand:      96,
  gravel:    144,
  darkGrass: 192,
  lightGrass: 240,
  deadGrass: 288,
  // sets at 336, 384, 432, 480 — to be identified
} as const

// ── Tileset image paths (relative to /public) ─────────────────────────────────
export const TILESET_IMAGE = {
  baseChip:   '/world/SampleMap/[Base]BaseChip_pipo.png',
  grass:      '/world/SampleMap/[A]Grass_pipo.png',
  dirt:       '/world/SampleMap/[A]Dirt_pipo.png',
  flower:     '/world/SampleMap/[A]Flower_pipo.png',
  wallUp:     '/world/SampleMap/[A]Wall-Up_pipo.png',
  water:      '/world/SampleMap/[A]Water_pipo.png',
  waterFall:  '/world/SampleMap/[A]WaterFall_pipo.png',
  lightShadow: '/world/SampleMap/LightShadow_pipo.png',
} as const

export const TILESET_COLUMNS: Record<keyof typeof TILESET_IMAGE, number> = {
  baseChip:    8,
  grass:       8,
  dirt:        8,
  flower:      8,
  wallUp:      8,
  water:       64,
  waterFall:   32,
  lightShadow: 8,
}

// ── Helper: tile frame rectangle ──────────────────────────────────────────────
// Returns the pixel rect for tile `id` within a tileset of `cols` columns.
export function tileFrame(id: number, cols: number): { x: number; y: number; w: number; h: number } {
  return {
    x: (id % cols) * TILE_SIZE,
    y: Math.floor(id / cols) * TILE_SIZE,
    w: TILE_SIZE,
    h: TILE_SIZE,
  }
}

// ── Per-environment defaults ───────────────────────────────────────────────────
export const ENV_TILES: Record<string, { ground: number; pathSet: number }> = {
  forest:   { ground: BASE_GROUND.mediumGrass, pathSet: GRASS_PATH.wornDirt  },
  farmland: { ground: BASE_GROUND.mediumGrass, pathSet: GRASS_PATH.wornDirt  },
  ruins:    { ground: BASE_GROUND.darkGrass,   pathSet: GRASS_PATH.darkGrass },
  ashen:    { ground: BASE_GROUND.dyingGrass,  pathSet: GRASS_PATH.deadGrass },
  sand:     { ground: BASE_GROUND.sand,        pathSet: GRASS_PATH.sand      },
  frost:    { ground: BASE_GROUND.lightGrass,  pathSet: GRASS_PATH.lightGrass },
  volcano:  { ground: BASE_GROUND.darkDirt,    pathSet: GRASS_PATH.darkDirt  },
}
