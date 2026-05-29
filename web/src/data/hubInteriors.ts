// Hub World building interiors — door positions and interior layouts.

export interface HubDoor {
  buildingId: string
  tx: number
  ty: number
}

export interface InteriorDecor {
  tx: number
  ty: number
  type: 'table' | 'shelf' | 'barrel' | 'chest' | 'desk' | 'bed' | 'counter' | 'fireplace'
  color?: number
}

export interface HubInterior {
  id: string
  name: string
  width: number
  height: number
  decor: InteriorDecor[]
  floorTileId?: number  // BASE_CHIP_TILES id for interior floor; defaults to woodFloor (288)
}

// Exterior door tiles — walking onto these triggers an interior transition.
export const HUB_DOORS: HubDoor[] = [
  { buildingId: 'card-shop',     tx:  6, ty: 11 },
  { buildingId: 'augment-shop',  tx: 14, ty: 11 },
  { buildingId: 'supply-shop',   tx:  8, ty: 14 },
  { buildingId: 'scholars-hall', tx: 56, ty: 11 },
  { buildingId: 'home',          tx: 21, ty: 20 },
  { buildingId: 'trader-den',    tx: 11, ty: 26 },
]

// BASE_CHIP_TILES floor tile IDs (from baseChipIndex.ts)
const FLOOR = {
  wood:       288,
  stone:      289,
  cobble:     290,
  parquet:    304,
  darkWood:   296,
  darkStone:  297,
  checkered:  292,
} as const

export const HUB_INTERIORS: Record<string, HubInterior> = {
  'card-shop': {
    id: 'card-shop',
    name: "Gildwyn's Card Emporium",
    width: 12,
    height: 9,
    floorTileId: FLOOR.wood,
    decor: [
      { tx: 2, ty: 2, type: 'shelf' },
      { tx: 3, ty: 2, type: 'shelf' },
      { tx: 8, ty: 2, type: 'shelf' },
      { tx: 9, ty: 2, type: 'shelf' },
      { tx: 5, ty: 4, type: 'counter' },
      { tx: 6, ty: 4, type: 'counter' },
      { tx: 3, ty: 6, type: 'table' },
      { tx: 8, ty: 6, type: 'chest' },
    ],
  },
  'augment-shop': {
    id: 'augment-shop',
    name: "Mira's Enchantment Studio",
    width: 12,
    height: 9,
    floorTileId: FLOOR.darkStone,
    decor: [
      { tx: 2, ty: 2, type: 'desk', color: 0x6633aa },
      { tx: 5, ty: 3, type: 'table', color: 0x4422cc },
      { tx: 9, ty: 2, type: 'shelf' },
      { tx: 9, ty: 3, type: 'shelf' },
      { tx: 2, ty: 6, type: 'barrel' },
      { tx: 8, ty: 6, type: 'chest', color: 0xaa44cc },
    ],
  },
  'supply-shop': {
    id: 'supply-shop',
    name: "Bramble's Supplies",
    width: 12,
    height: 9,
    floorTileId: FLOOR.cobble,
    decor: [
      { tx: 2, ty: 2, type: 'barrel' },
      { tx: 3, ty: 2, type: 'barrel' },
      { tx: 4, ty: 2, type: 'barrel' },
      { tx: 8, ty: 2, type: 'chest' },
      { tx: 9, ty: 2, type: 'chest' },
      { tx: 5, ty: 5, type: 'table' },
      { tx: 2, ty: 6, type: 'shelf' },
      { tx: 9, ty: 6, type: 'shelf' },
    ],
  },
  'scholars-hall': {
    id: 'scholars-hall',
    name: "The Scholar's Hall",
    width: 14,
    height: 10,
    floorTileId: FLOOR.checkered,
    decor: [
      { tx: 2, ty: 2, type: 'shelf' },
      { tx: 3, ty: 2, type: 'shelf' },
      { tx: 4, ty: 2, type: 'shelf' },
      { tx: 9, ty: 2, type: 'shelf' },
      { tx: 10, ty: 2, type: 'shelf' },
      { tx: 11, ty: 2, type: 'shelf' },
      { tx: 5, ty: 5, type: 'desk' },
      { tx: 7, ty: 5, type: 'desk' },
      { tx: 3, ty: 7, type: 'table' },
      { tx: 10, ty: 7, type: 'chest' },
    ],
  },
  'home': {
    id: 'home',
    name: 'Your Quarters',
    width: 12,
    height: 9,
    floorTileId: FLOOR.parquet,
    decor: [
      { tx: 2, ty: 2, type: 'bed' },
      { tx: 9, ty: 2, type: 'fireplace', color: 0xcc4400 },
      { tx: 5, ty: 4, type: 'table' },
      { tx: 6, ty: 4, type: 'table' },
      { tx: 2, ty: 6, type: 'chest' },
      { tx: 9, ty: 6, type: 'shelf' },
    ],
  },
  'trader-den': {
    id: 'trader-den',
    name: "The Junk Trader's Den",
    width: 12,
    height: 9,
    floorTileId: FLOOR.darkWood,
    decor: [
      { tx: 2, ty: 2, type: 'barrel' },
      { tx: 3, ty: 2, type: 'barrel' },
      { tx: 4, ty: 2, type: 'barrel' },
      { tx: 8, ty: 2, type: 'chest' },
      { tx: 9, ty: 2, type: 'chest' },
      { tx: 10, ty: 2, type: 'chest' },
      { tx: 5, ty: 5, type: 'counter' },
      { tx: 6, ty: 5, type: 'counter' },
    ],
  },
}
