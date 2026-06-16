import { BASE_CHIP_TILES } from "./baseChipIndex"
import { EXTENDED_TILE_DEFS } from "./extendedTileDefs"
import { EXTENDED_TILESETS } from "./extendedTilesets"
export type { ExtendedTileDef } from "./extendedTileDefs"
export { EXTENDED_TILE_DEFS } from "./extendedTileDefs"
export type { ExtendedTilesetConfig } from "./extendedTilesets"
export { EXTENDED_TILESETS } from "./extendedTilesets"

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


// ---- Decor - used as borders for inaccessible terrain, and for scenery items (trees, rocks, hills) in the world map. ----
// each tile has a single centered item, with a part repeated item in denoted corners. When an item is denoted as being in a corner e.g. NW. adjacent tiles will need to complete the item with a NE, SW and SE variant. For example, a tree with a top-left corner item would need the following tiles to complete the tree across adjacent tiles: NW (top-left), NE (top-right), SW (bottom-left), SE (bottom-right).
// Always goes NW NE SE SW order when denoting corners, to match the bitmask order used for path tiles. This makes it easier to determine which decor tile to use based on adjacent decor items, similar to how path tiles are determined by adjacent paths.
export const SCENERY = {
                        // NW NE SE SW
  single: 0,            // 0  0  0  0
  singleAndNW:23,       // 1  0  0  0 
  singleAndNE:21,       // 0  1  0  0
  singleAndSE:5,        // 0  0  1  0
  singleAndSW:7,        // 0  0  0  1
  singleAndNWNE:22,     // 1  1  0  0
  singleAndNWSE:44,     // 1  0  1  0
  singleAndNWSW:15,     // 1  0  0  1
  singleAndNESE:13,     // 0  1  1  0
  singleAndNESW:45,     // 0  1  0  1
  singleAndSESW:6,      // 0  0  1  1
  singleAndNWNESW:28,   // 1  1  0  1
  singleAndNWNESE:29,   // 1  1  1  0
  singleAndNWSESW:36,   // 1  0  1  1
  singleAndNESESW:37,   // 0  1  1  1
  singleAndNWNESESW:14, // 1  1  1  1
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

// World Scale Scenery Tiles (web/public/nodemap/32x32/environment/) ───────────────────────────────

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
  borderFile?: string     // optional 8-col scenery sheet for path borders (e.g. forest trees)
  solidColor?: number     // when set, fill background with this solid hex color instead of tiles
  bgTileId?: number       // tile in pathFile to repeat as textured background fill
  pathWidth?: number      // path tile width (odd; default 1); >1 expands perpendicular to path direction
  decorFile?: string      // decor scatter sheet (same 8-col format)
  decorTileIds?: number[] // tile ids to randomly scatter as decor
}

export const ENV_TILES: Record<string, EnvTileDef> = {
  forest:   { ground: BASE_GROUND.lightGrass,  pathFile: PATH_TILE.dirt1,  decorFile: PATH_TILE.flower1,  decorTileIds: [] },
  farmland: { ground: BASE_GROUND.mediumGrass, pathFile: PATH_TILE.grass1Dirt1  },
  ruins:    { ground: BASE_GROUND.dyingGrass,   pathFile: PATH_TILE.dirt1 },
  ashen:    { ground: BASE_GROUND.dyingGrass,  pathFile: PATH_TILE.dirt4 ,  decorFile:  TILESET_IMAGE.baseChip,  decorTileIds: [BASE_CHIP_TILES.deadBush, BASE_CHIP_TILES.smallStump, BASE_CHIP_TILES.smallRock, BASE_CHIP_TILES.cropDead, BASE_CHIP_TILES.deadSmallGrass] },
  sand:     { ground: BASE_GROUND.sand,        pathFile: PATH_TILE.dirt1  },
  frost:    { ground: BASE_GROUND.lightGrass,  solidColor: 0xEEEEFF, pathFile: PATH_TILE.dirt1 },
  volcano:  { ground: BASE_GROUND.darkDirt,    pathFile: PATH_TILE.dirt4        },
  citadel:  { ground: BASE_GROUND.darkGrass,   pathFile: PATH_TILE.wall2        },
  coast:    { ground: BASE_GROUND.sand,        pathFile: PATH_TILE.water2,       pathWidth: 3 },
  reef:     { ground: BASE_GROUND.sand,        pathFile: PATH_TILE.water1,       pathWidth: 3 },
  sky:      { ground: BASE_GROUND.lightGrass,  solidColor: 0x000000, pathFile: PATH_TILE.dirt4 },
  fungal:   { ground: BASE_GROUND.darkGrass,   pathFile: PATH_TILE.grass1Grass3 },
  vault:    { ground: BASE_GROUND.darkGrass,   pathFile: PATH_TILE.wall1        },
  camp:     { ground: BASE_GROUND.mediumGrass, pathFile: PATH_TILE.grass1Dirt1  },
}

export interface TileRef {
  file: string     // path starting with '/', relative to /public
  id: number       // local tile index within the sheet
  columns: number  // number of columns in the sheet
}

// ── Multi-file tile support ───────────────────────────────────────────────────
// Resolution order:
//   1. globalId < 10000  → baseChip spritesheet
//   2. Found in EXTENDED_TILE_DEFS → individual-file tile (e.g. crystals)
//   3. Found in EXTENDED_TILESETS range → sequential range tile (localId = globalId - globalIdStart)
export function resolveTileRef(globalId: number): TileRef {
  if (globalId < 10000) {
    return { file: TILESET_IMAGE.baseChip, id: globalId, columns: TILESET_COLUMNS.baseChip }
  }
  const def = EXTENDED_TILE_DEFS.find(d => d.globalId === globalId)
  if (def) return { file: def.file, id: def.localId, columns: def.columns }
  const ts = EXTENDED_TILESETS.find(t => globalId >= t.globalIdStart && globalId < t.globalIdStart + t.tilecount)
  if (ts) return { file: ts.image, id: globalId - ts.globalIdStart, columns: ts.columns }
  throw new Error(`Unknown extended tile ID: ${globalId}`)
}
