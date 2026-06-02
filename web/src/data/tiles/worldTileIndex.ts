import { EnvTileDef, BASE_GROUND, PATH_TILE } from './tileIndex'

// ── World-scale path tile files (web/public/nodemap/32x32/environment/) ───────
// Same 8-col × 47-variant TYPE3 format as the town-scale [A]_type3 sheets.
export const WORLD_PATH_TILE = {
  grass1Dirt1:  '/nodemap/32x32/environment/grass1_dirt1.png',
  grass1Dirt2:  '/nodemap/32x32/environment/grass1_dirt2.png',
  grass1Grass2: '/nodemap/32x32/environment/grass1_grass2.png',
  grass1Water1: '/nodemap/32x32/environment/grass1_water1.png',
  gravel1:      '/nodemap/32x32/environment/gravel1.png',
} as const

// ── World-scale scenery tile files (web/public/nodemap/32x32/scenery/) ───────
// 8-col × 47-variant TYPE3 format — used as border fills on battlefield/map edges.
export const WORLD_SCENERY_TILE = {
  forest1:    '/nodemap/32x32/scenery/forest1.png',
  hills1:     '/nodemap/32x32/scenery/hills1.png',
  mountains1: '/nodemap/32x32/scenery/mountains1.png',
  rocks1:     '/nodemap/32x32/scenery/rocks1.png',
} as const

// ── World-scale decor sheet (web/public/nodemap/32x32/decor.png) ─────────────
// Tiles 0–7 are ground fills. Named decor starts at tile 8.
// Additional entries (towns, castles, mountains, volcanoes…) to be added after
// reviewing the NM_Decor Storybook story.
export const WORLD_DECOR_FILE = '/nodemap/32x32/decor.png'

export const WORLD_DECOR = {
  terrain: 0, 
  singleTree:      8,
  groupOfTrees:    9,
  bigTree:        10,
  rock:           11,
  pileOfRocks:    12,
  hole:            13,
  pond:            14,
  dustDevil:       15,
  woodenBridgeHTop:  16,
  woodenBridgeVTop:  17,
  stoneBridgeHTop:   18,
  stoneBridgeVTop:   19,
  waterWhirlpool: 20,
  sandSinkhole: 21,
  hillsCaveEntrance: 22,
  mountainsCaveEntrance: 23,
  woodenBridgeHBottom: 24,
  woodenBridgeVBottom: 25,
  stoneBridgeHBottom: 26,
  stoneBridgeVBottom: 27,
  signpost: 28,
  graveStone: 29,
  hillsMineEntrance: 30,
  mountainsMineEntrance: 31,
  mountainTopLeft: 32,
  mountainTopRight: 33,
  mountainCluster1To2Left: 34,
  mountainCluster1To2Right: 35,
  volcanoCraterTopLeft: 36,
  volcanoCraterTopRight: 37,
  volcanoLavaPoolTopLeft: 38,
  volcanoLavaPoolTopRight: 39,
  mountainBottomLeft: 40,
  mountainBottomRight: 41,
  mountainCluster2To1Left: 42,
  mountainCluster2To1Right: 43,
  volcanoCraterBottomLeft: 44,
  volcanoCraterBottomRight: 45,
  volcanoLavaPoolBottomLeft: 44,
  volcanoLavaPoolBottomRight: 45,
  volcanoCaveBottomLeft: 46,
  volcanoCaveBottomRight: 47,
  house: 48,
  villageLeft: 49,
  villageRight: 50,
  squareCastleTopLeft: 51,
  squareCastleTopRight: 52,
  fantasyCastleTopLeft: 53,
  fantasyCastleTopRight: 54,
  hiveCaveEntrance: 55,
  farm: 56,
  walledTownLeft: 57,
  walledTownRight: 58,
  squareCastleBottomLeft: 59,
  squareCastleBottomRight: 60,
  fantasyCastleBottomLeft: 61,
  fantasyCastleBottomRight: 62,    
} as const

// ── Terrain obstacle → decor tile mapping (ruins only) ────────────────────────
// Maps environment name + TerrainType 'ruin' to WORLD_DECOR tile IDs.
// Multiple IDs → pick one deterministically via idNum % length.
export const TERRAIN_DECOR_MAP: Record<string, Partial<Record<string, number[]>>> = {
  _default: {
    ruin: [WORLD_DECOR.graveStone, WORLD_DECOR.signpost],
  },
  ashen:   { ruin: [WORLD_DECOR.graveStone] },
  volcano: { ruin: [WORLD_DECOR.volcanoCaveBottomLeft] },
  citadel: { ruin: [WORLD_DECOR.house] },
  sand:    { ruin: [WORLD_DECOR.signpost] },
}

// ── Terrain obstacle → TYPE3 patch tileset (for battlefield rendering) ────────
// Maps environment name + TerrainType to a WORLD_SCENERY_TILE or WORLD_PATH_TILE
// file. renderPathTiles uses 8-bit adjacency bitmask to create organic shapes.
// Ruin type is intentionally absent — ruins use a single TERRAIN_DECOR_MAP tile.
export const TERRAIN_PATCH_MAP: Record<string, Partial<Record<string, string>>> = {
  _default: {
    tree:  WORLD_SCENERY_TILE.forest1,
    rock:  WORLD_SCENERY_TILE.rocks1,
    water: WORLD_PATH_TILE.grass1Water1,
  },
  ashen:   { tree: WORLD_SCENERY_TILE.rocks1 },
  volcano: { rock: WORLD_SCENERY_TILE.mountains1 },
  frost:   { rock: WORLD_SCENERY_TILE.mountains1 },
  farmland: { rock: WORLD_SCENERY_TILE.hills1 },
  coast:   { rock: WORLD_SCENERY_TILE.hills1 },
}

// ── Per-environment tile config for world-scale (campaign) rendering ──────────
// Mirrors ENV_TILES in tileIndex.ts; used by NodeMap.tsx via envDef override.
// ground IDs still reference BASE_GROUND (BaseChip sheet) for background fills.
export const WORLD_ENV_TILES: Record<string, EnvTileDef> = {
  forest:   { ground: BASE_GROUND.lightGrass,  pathFile: WORLD_PATH_TILE.grass1Dirt1,  borderFile: WORLD_SCENERY_TILE.forest1,    decorFile: WORLD_DECOR_FILE, decorTileIds: [WORLD_DECOR.singleTree, WORLD_DECOR.groupOfTrees] },
  farmland: { ground: BASE_GROUND.mediumGrass, pathFile: WORLD_PATH_TILE.grass1Dirt1,  borderFile: WORLD_SCENERY_TILE.hills1,     decorFile: WORLD_DECOR_FILE, decorTileIds: [WORLD_DECOR.singleTree, WORLD_DECOR.groupOfTrees] },
  ruins:    { ground: BASE_GROUND.darkGrass,   pathFile: WORLD_PATH_TILE.grass1Grass2, borderFile: WORLD_SCENERY_TILE.rocks1 },
  ashen:    { ground: BASE_GROUND.dyingGrass,  pathFile: WORLD_PATH_TILE.grass1Dirt2,  borderFile: WORLD_SCENERY_TILE.rocks1 },
  sand:     { ground: BASE_GROUND.sand,        pathFile: WORLD_PATH_TILE.grass1Dirt2,  borderFile: WORLD_SCENERY_TILE.rocks1 },
  frost:    { ground: BASE_GROUND.lightGrass,  solidColor: 0xDDFDFD, pathFile: WORLD_PATH_TILE.grass1Grass2, borderFile: WORLD_SCENERY_TILE.mountains1 },
  volcano:  { ground: BASE_GROUND.darkDirt,    pathFile: WORLD_PATH_TILE.gravel1,      borderFile: WORLD_SCENERY_TILE.mountains1 },
  citadel:  { ground: BASE_GROUND.darkGrass,   pathFile: WORLD_PATH_TILE.gravel1,      borderFile: WORLD_SCENERY_TILE.rocks1 },
  coast:    { ground: BASE_GROUND.sand,        pathFile: WORLD_PATH_TILE.grass1Water1, borderFile: WORLD_SCENERY_TILE.hills1,     pathWidth: 3 },
  reef:     { ground: BASE_GROUND.sand,        pathFile: WORLD_PATH_TILE.grass1Water1, borderFile: WORLD_SCENERY_TILE.hills1,     pathWidth: 3 },
  sky:      { ground: BASE_GROUND.lightGrass,  solidColor: 0x000000, pathFile: PATH_TILE.dirt1 },
  fungal:   { ground: BASE_GROUND.darkGrass,   pathFile: WORLD_PATH_TILE.grass1Grass2, borderFile: WORLD_SCENERY_TILE.forest1 },
  vault:    { ground: BASE_GROUND.darkGrass,   pathFile: WORLD_PATH_TILE.gravel1,      borderFile: WORLD_SCENERY_TILE.rocks1 },
  camp:     { ground: BASE_GROUND.mediumGrass, pathFile: WORLD_PATH_TILE.grass1Dirt1,  borderFile: WORLD_SCENERY_TILE.forest1 },
}
