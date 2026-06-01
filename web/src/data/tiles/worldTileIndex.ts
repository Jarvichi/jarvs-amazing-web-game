import { EnvTileDef, BASE_GROUND } from './tileIndex'

// ── World-scale path tile files (web/public/nodemap/32x32/environment/) ───────
// Same 8-col × 47-variant TYPE3 format as the town-scale [A]_type3 sheets.
export const WORLD_PATH_TILE = {
  forest1:      '/nodemap/32x32/environment/forest1.png',
  grass1Dirt1:  '/nodemap/32x32/environment/grass1_dirt1.png',
  grass1Dirt2:  '/nodemap/32x32/environment/grass1_dirt2.png',
  grass1Grass2: '/nodemap/32x32/environment/grass1_grass2.png',
  grass1Water1: '/nodemap/32x32/environment/grass1_water1.png',
  gravel1:      '/nodemap/32x32/environment/gravel1.png',
  hills1:       '/nodemap/32x32/environment/hills1.png',
  mountains1:   '/nodemap/32x32/environment/mountains1.png',
  rocks1:       '/nodemap/32x32/environment/rocks1.png',
} as const

// ── World-scale decor sheet (web/public/nodemap/32x32/decor.png) ─────────────
// Tiles 0–7 are ground fills. Named decor starts at tile 8.
// Additional entries (towns, castles, mountains, volcanoes…) to be added after
// reviewing the NM_Decor Storybook story.
export const WORLD_DECOR_FILE = '/nodemap/32x32/decor.png'

export const WORLD_DECOR = {
  singleTree:      8,
  groupOfTrees:    9,
  woodenBridgeH:  16,
  woodenBridgeV:  17,
  stoneBridgeH:   18,
  stoneBridgeV:   19,
  waterWhirlpool: 20,
} as const

// ── Per-environment tile config for world-scale (campaign) rendering ──────────
// Mirrors ENV_TILES in tileIndex.ts; used by NodeMap.tsx via envDef override.
// ground IDs still reference BASE_GROUND (BaseChip sheet) for background fills.
export const WORLD_ENV_TILES: Record<string, EnvTileDef> = {
  forest:   { ground: BASE_GROUND.lightGrass,  pathFile: WORLD_PATH_TILE.forest1,      decorFile: WORLD_DECOR_FILE, decorTileIds: [WORLD_DECOR.singleTree, WORLD_DECOR.groupOfTrees] },
  farmland: { ground: BASE_GROUND.mediumGrass, pathFile: WORLD_PATH_TILE.grass1Dirt1 },
  ruins:    { ground: BASE_GROUND.darkGrass,   pathFile: WORLD_PATH_TILE.grass1Grass2 },
  ashen:    { ground: BASE_GROUND.dyingGrass,  pathFile: WORLD_PATH_TILE.grass1Dirt2 },
  sand:     { ground: BASE_GROUND.sand,        pathFile: WORLD_PATH_TILE.grass1Dirt2 },
  frost:    { ground: BASE_GROUND.lightGrass,  pathFile: WORLD_PATH_TILE.grass1Grass2 },
  volcano:  { ground: BASE_GROUND.darkDirt,    pathFile: WORLD_PATH_TILE.mountains1 },
  citadel:  { ground: BASE_GROUND.darkGrass,   pathFile: WORLD_PATH_TILE.gravel1 },
  coast:    { ground: BASE_GROUND.sand,        pathFile: WORLD_PATH_TILE.grass1Water1,  pathWidth: 3 },
  reef:     { ground: BASE_GROUND.sand,        pathFile: WORLD_PATH_TILE.grass1Water1,  pathWidth: 3 },
  sky:      { ground: BASE_GROUND.lightGrass,  solidColor: 0x000000, pathFile: WORLD_PATH_TILE.grass1Grass2 },
  fungal:   { ground: BASE_GROUND.darkGrass,   pathFile: WORLD_PATH_TILE.grass1Grass2 },
  vault:    { ground: BASE_GROUND.darkGrass,   pathFile: WORLD_PATH_TILE.gravel1 },
  camp:     { ground: BASE_GROUND.mediumGrass, pathFile: WORLD_PATH_TILE.grass1Dirt1 },
}
