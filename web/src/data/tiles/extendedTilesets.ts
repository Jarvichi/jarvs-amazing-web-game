// Config-driven registry of extended tilesets.
// To add a new tileset: append one entry here. No other code changes needed.
// The TileBrowser will show it, and resolveTileRef handles all IDs in the range.
//
// Global ID scheme (sequential): globalId = globalIdStart + localTileIndex
// Browse a tileset → name a tile → export → paste the "name: globalId" line directly
// into baseChipIndex.ts.
//
// Global ID ranges:
//   0–9999      BaseChip spritesheet (handled separately)
//   10000–10999 Crystal tiles — individual PNGs (see extendedTileDefs.ts)
//   11000–19999 pictsquare2021.png
//   20000–24999 icons.png
//   25000–25999 addwork.png (misc scenery/decor work sheet)
//   26000–26999 doors/Door1_pipo.png
//   27000–27999 doors/Door2_pipo.png
//   28000–28999 doors/Door3_pipo.png

export interface ExtendedTilesetConfig {
  name: string
  image: string         // path relative to /public
  columns: number
  tilecount: number
  globalIdStart: number
  tileWidth?: number    // defaults to 32
  tileHeight?: number   // defaults to 32
}

export const EXTENDED_TILESETS: ExtendedTilesetConfig[] = [
  {
    name: 'pictsquare2021',
    image: '/world/pictsquare2021.png',
    columns: 61,
    tilecount: 3050,
    globalIdStart: 11000,
  },
  {
    name: 'icons',
    image: '/world/icon/icons.png',
    columns: 16,
    tilecount: 512,
    globalIdStart: 20000,
  },
  {
    name: 'addwork',
    image: '/world/addwork.png',
    columns: 12,
    tilecount: 768,
    globalIdStart: 25000,
  },
  {
    name: 'door1',
    image: '/world/doors/Door1_pipo.png',
    columns: 6,
    tilecount: 72,
    globalIdStart: 26000,
  },
  {
    name: 'door2',
    image: '/world/doors/Door2_pipo.png',
    columns: 6,
    tilecount: 72,
    globalIdStart: 27000,
  },
  {
    name: 'door3',
    image: '/world/doors/Door3_pipo.png',
    columns: 12,
    tilecount: 144,
    globalIdStart: 28000,
  },
]
