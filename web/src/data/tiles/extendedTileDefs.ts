
// Single source of truth for all extended tile IDs (global IDs ≥ 10000).
// To add a new extended tile: append one entry here. No other files need editing.
//
// Global ID ranges:
//   10000–10039  Crystal tiles — individual 32×32 PNGs from /nodemap/32x32/
//   11000+       Pictsquare2021 named tiles — multi-column sprite sheet

export interface ExtendedTileDef {
  name:     string   // camelCase key used in BASE_CHIP_TILES
  globalId: number   // unique global tile ID (≥ 10000)
  file:     string   // path relative to /public
  localId:  number   // tile index within the sprite sheet (0-based)
  columns:  number   // number of columns in the sprite sheet
}

export const EXTENDED_TILE_DEFS: ExtendedTileDef[] = [
  // ── Crystal tiles (10000–10039) — individual 32×32 PNGs, 1 column each ──
  { name: 'black_crystal1',        globalId: 10000, file: '/nodemap/32x32/Black_crystal1.png',        localId: 0, columns: 1 },
  { name: 'black_crystal2',        globalId: 10001, file: '/nodemap/32x32/Black_crystal2.png',        localId: 0, columns: 1 },
  { name: 'black_crystal3',        globalId: 10002, file: '/nodemap/32x32/Black_crystal3.png',        localId: 0, columns: 1 },
  { name: 'black_crystal4',        globalId: 10003, file: '/nodemap/32x32/Black_crystal4.png',        localId: 0, columns: 1 },
  { name: 'blue_crystal1',         globalId: 10004, file: '/nodemap/32x32/Blue_crystal1.png',         localId: 0, columns: 1 },
  { name: 'blue_crystal2',         globalId: 10005, file: '/nodemap/32x32/Blue_crystal2.png',         localId: 0, columns: 1 },
  { name: 'blue_crystal3',         globalId: 10006, file: '/nodemap/32x32/Blue_crystal3.png',         localId: 0, columns: 1 },
  { name: 'blue_crystal4',         globalId: 10007, file: '/nodemap/32x32/Blue_crystal4.png',         localId: 0, columns: 1 },
  { name: 'dark_red_crystal1',     globalId: 10008, file: '/nodemap/32x32/Dark_red_ crystal1.png',    localId: 0, columns: 1 },
  { name: 'dark_red_crystal2',     globalId: 10009, file: '/nodemap/32x32/Dark_red_ crystal2.png',    localId: 0, columns: 1 },
  { name: 'dark_red_crystal3',     globalId: 10010, file: '/nodemap/32x32/Dark_red_ crystal3.png',    localId: 0, columns: 1 },
  { name: 'dark_red_crystal4',     globalId: 10011, file: '/nodemap/32x32/Dark_red_ crystal4.png',    localId: 0, columns: 1 },
  { name: 'green_crystal1',        globalId: 10012, file: '/nodemap/32x32/Green_crystal1.png',        localId: 0, columns: 1 },
  { name: 'green_crystal2',        globalId: 10013, file: '/nodemap/32x32/Green_crystal2.png',        localId: 0, columns: 1 },
  { name: 'green_crystal3',        globalId: 10014, file: '/nodemap/32x32/Green_crystal3.png',        localId: 0, columns: 1 },
  { name: 'green_crystal4',        globalId: 10015, file: '/nodemap/32x32/Green_crystal4.png',        localId: 0, columns: 1 },
  { name: 'pink_crystal1',         globalId: 10016, file: '/nodemap/32x32/Pink_crystal1.png',         localId: 0, columns: 1 },
  { name: 'pink_crystal2',         globalId: 10017, file: '/nodemap/32x32/Pink_crystal2.png',         localId: 0, columns: 1 },
  { name: 'pink_crystal3',         globalId: 10018, file: '/nodemap/32x32/Pink_crystal3.png',         localId: 0, columns: 1 },
  { name: 'pink_crystal4',         globalId: 10019, file: '/nodemap/32x32/Pink_crystal4.png',         localId: 0, columns: 1 },
  { name: 'red_crystal1',          globalId: 10020, file: '/nodemap/32x32/Red_crystal1.png',          localId: 0, columns: 1 },
  { name: 'red_crystal2',          globalId: 10021, file: '/nodemap/32x32/Red_crystal2.png',          localId: 0, columns: 1 },
  { name: 'red_crystal3',          globalId: 10022, file: '/nodemap/32x32/Red_crystal3.png',          localId: 0, columns: 1 },
  { name: 'red_crystal4',          globalId: 10023, file: '/nodemap/32x32/Red_crystal4.png',          localId: 0, columns: 1 },
  { name: 'violet_crystal1',       globalId: 10024, file: '/nodemap/32x32/Violet_crystal1.png',       localId: 0, columns: 1 },
  { name: 'violet_crystal2',       globalId: 10025, file: '/nodemap/32x32/Violet_crystal2.png',       localId: 0, columns: 1 },
  { name: 'violet_crystal3',       globalId: 10026, file: '/nodemap/32x32/Violet_crystal3.png',       localId: 0, columns: 1 },
  { name: 'violet_crystal4',       globalId: 10027, file: '/nodemap/32x32/Violet_crystal4.png',       localId: 0, columns: 1 },
  { name: 'white_crystal1',        globalId: 10028, file: '/nodemap/32x32/White_crystal1.png',        localId: 0, columns: 1 },
  { name: 'white_crystal2',        globalId: 10029, file: '/nodemap/32x32/White_crystal2.png',        localId: 0, columns: 1 },
  { name: 'white_crystal3',        globalId: 10030, file: '/nodemap/32x32/White_crystal3.png',        localId: 0, columns: 1 },
  { name: 'white_crystal4',        globalId: 10031, file: '/nodemap/32x32/White_crystal4.png',        localId: 0, columns: 1 },
  { name: 'yellow_green_crystal1', globalId: 10032, file: '/nodemap/32x32/Yellow-green_crystal1.png', localId: 0, columns: 1 },
  { name: 'yellow_green_crystal2', globalId: 10033, file: '/nodemap/32x32/Yellow-green_crystal2.png', localId: 0, columns: 1 },
  { name: 'yellow_green_crystal3', globalId: 10034, file: '/nodemap/32x32/Yellow-green_crystal3.png', localId: 0, columns: 1 },
  { name: 'yellow_green_crystal4', globalId: 10035, file: '/nodemap/32x32/Yellow-green_crystal4.png', localId: 0, columns: 1 },
  { name: 'yellow_crystal1',       globalId: 10036, file: '/nodemap/32x32/Yellow_crystal1.png',       localId: 0, columns: 1 },
  { name: 'yellow_crystal2',       globalId: 10037, file: '/nodemap/32x32/Yellow_crystal2.png',       localId: 0, columns: 1 },
  { name: 'yellow_crystal3',       globalId: 10038, file: '/nodemap/32x32/Yellow_crystal3.png',       localId: 0, columns: 1 },
  { name: 'yellow_crystal4',       globalId: 10039, file: '/nodemap/32x32/Yellow_crystal4.png',       localId: 0, columns: 1 },

  // ── Pictsquare2021 named tiles (11000+) — 61-column sprite sheet ──
  { name: 'wantedSign', globalId: 11000, file: '/world/pictsquare2021.png', localId: 1, columns: 61 },
  { name: 'palaceStepsLeft', globalId: 11001, file: '/world/pictsquare2021.png', localId: 244, columns: 61 },
  { name: 'palaceStepsMidLeft', globalId: 11002, file: '/world/pictsquare2021.png', localId: 245, columns: 61 },
  { name: 'palaceStepsMid', globalId: 11003, file: '/world/pictsquare2021.png', localId: 246, columns: 61 },
  { name: 'palaceStepsMidRight', globalId: 11004, file: '/world/pictsquare2021.png', localId: 247, columns: 61 },
  { name: 'palaceStepsRight', globalId: 11005, file: '/world/pictsquare2021.png', localId: 248, columns: 61 },
  { name: 'palaceStepsBotLeft', globalId: 11006, file: '/world/pictsquare2021.png', localId: 305, columns: 61 },
  { name: 'palaceStepsBotMidLeft', globalId: 11007, file: '/world/pictsquare2021.png', localId: 306, columns: 61 },
  { name: 'palaceStepsBotMid', globalId: 11008, file: '/world/pictsquare2021.png', localId: 307, columns: 61 },
  { name: 'palaceStepsBotMidRight', globalId: 11009, file: '/world/pictsquare2021.png', localId: 308, columns: 61 },
  { name: 'palaceStepsBotRight', globalId: 11010, file: '/world/pictsquare2021.png', localId: 309, columns: 61 },

  // Add to EXTENDED_TILE_DEFS in extendedTileDefs.ts:
  { name: 'trayOfDrinks', globalId: 11011, file: '/world/pictsquare2021.png', localId: 1068, columns: 61 },
  { name: 'pumpkin1Lit', globalId: 11012, file: '/world/pictsquare2021.png', localId: 2497, columns: 61 },
  { name: 'goldFish', globalId: 11013, file: '/world/pictsquare2021.png', localId: 2762, columns: 61 },

]
