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
  // Tiles 24–45: corner-grass variations (mostly filled, grass only in one corner)
  grassCornerBR:    28,  // grass bottom-right corner
  grassCornerBL:    29,  // grass bottom-left corner
  grassCornerTR:    36,  // grass top-right corner
  grassCornerTL:    37,  // grass top-left corner
} as const

// ── [A]Grass_pipo — path set base tile IDs (SampleMap big sheet, used by TileBrowser) ──
export const GRASS_PATH = {
  wornDirt:      0,
  darkDirt:      48,
  sand:          96,
  gravel:        144,
  darkGrass:     192,
  lightGrass:    240,
  deadGrass:     288,
  edgeGrass:     336,
  edgeDarkGrass: 384,
  edgeLightGrass: 432,
  edgeDeadGrass: 480,
} as const

// ── [A]_type3 — per-combination path tile files ───────────────────────────────
// Each file is a complete 8×6 tileset (tiles 0–46 used, tile 47 is blank).
// Variant index maps directly — no base offset needed.
export const PATH_TILE = {
  grass1Dirt1:  '/world/[A]_type3/[A]Grass1-Dirt1_pipo.png',
  grass1Dirt2:  '/world/[A]_type3/[A]Grass1-Dirt2_pipo.png',
  grass1Dirt3:  '/world/[A]_type3/[A]Grass1-Dirt3_pipo.png',
  grass1Dirt4:  '/world/[A]_type3/[A]Grass1-Dirt4_pipo.png',
  grass1Grass2: '/world/[A]_type3/[A]Grass1-Grass2_pipo.png',
  grass1Grass3: '/world/[A]_type3/[A]Grass1-Grass3_pipo.png',
  grass1Grass4: '/world/[A]_type3/[A]Grass1-Grass4_pipo.png',
  dirt1:        '/world/[A]_type3/[A]Dirt1_pipo.png',
  dirt1Dirt4:   '/world/[A]_type3/[A]Dirt1-Dirt4_pipo.png',
  dirt4:        '/world/[A]_type3/[A]Dirt4_pipo.png',
  wall1:        '/world/[A]_type3/[A]Wall-Up1_pipo.png',
  wall2:        '/world/[A]_type3/[A]Wall-Up2_pipo.png',
  water1:       '/world/[A]_type3/[A]Water1_pipo.png',
  water2:       '/world/[A]_type3/[A]Water2_pipo.png',
  water3:       '/world/[A]_type3/[A]Water3_pipo.png',
  water4:       '/world/[A]_type3/[A]Water4_pipo.png',
  water5:       '/world/[A]_type3/[A]Water5_pipo.png',
  water6:       '/world/[A]_type3/[A]Water6_pipo.png',
  water7:       '/world/[A]_type3/[A]Water7_pipo.png',
  flower1:      '/world/[A]_type3/[A]Flower_pipo.png',
  longGrass:    '/world/[A]_type3/[A]LongGrass_pipo.png',
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

// ── Per-environment tile config ───────────────────────────────────────────────
export interface EnvTileDef {
  ground: number          // BaseChip tile id — solid colour fallback fill
  pathFile: string        // per-combination 8-col transition sheet
  bgTileId?: number       // tile in pathFile to repeat as textured background fill
  pathWidth?: number      // path tile width (odd; default 1); >1 expands perpendicular to path direction
  decorFile?: string      // decor scatter sheet (same 8-col format)
  decorTileIds?: number[] // tile ids to randomly scatter as decor
}

export const ENV_TILES: Record<string, EnvTileDef> = {
  forest:   { ground: BASE_GROUND.lightGrass,  pathFile: PATH_TILE.grass1Dirt1,  decorFile: PATH_TILE.flower1,  decorTileIds: [PATH.allSidesNoGrass] },
  farmland: { ground: BASE_GROUND.mediumGrass, pathFile: PATH_TILE.grass1Dirt1  },
  ruins:    { ground: BASE_GROUND.darkGrass,   pathFile: PATH_TILE.grass1Grass3 },
  ashen:    { ground: BASE_GROUND.dyingGrass,  pathFile: PATH_TILE.grass1Grass4 },
  sand:     { ground: BASE_GROUND.sand,        pathFile: PATH_TILE.grass1Dirt2  },
  frost:    { ground: BASE_GROUND.lightGrass,  pathFile: PATH_TILE.grass1Grass2 },
  volcano:  { ground: BASE_GROUND.darkDirt,    pathFile: PATH_TILE.dirt4        },
  citadel:  { ground: BASE_GROUND.darkGrass,   pathFile: PATH_TILE.wall2        },
  coast:    { ground: BASE_GROUND.sand,        pathFile: PATH_TILE.water2,       pathWidth: 3 },
  reef:     { ground: BASE_GROUND.sand,        pathFile: PATH_TILE.water1,       pathWidth: 3 },
  sky:      { ground: BASE_GROUND.lightGrass,  pathFile: PATH_TILE.grass1Grass2 },
  fungal:   { ground: BASE_GROUND.darkGrass,   pathFile: PATH_TILE.grass1Grass3 },
  vault:    { ground: BASE_GROUND.darkGrass,   pathFile: PATH_TILE.wall1        },
  camp:     { ground: BASE_GROUND.mediumGrass, pathFile: PATH_TILE.grass1Dirt1  },
}
