// Hub World building interiors — door positions and interior layouts.
import { BASE_CHIP_TILES } from './tiles/baseChipIndex'

export interface HubDoor {
  buildingId: string
  tx: number
  ty: number
}

export interface InteriorDecor {
  tx: number
  ty: number
  tileId: number
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

export const HUB_INTERIORS: Record<string, HubInterior> = {
  'card-shop': {
    id: 'card-shop',
    name: "Gildwyn's Card Emporium",
    width: 12,
    height: 9,
    floorTileId: BASE_CHIP_TILES.woodFloor,
    decor: [
      { tx: 2, ty: 2, tileId: BASE_CHIP_TILES.bookshelfTop },
      { tx: 3, ty: 2, tileId: BASE_CHIP_TILES.bookshelfTop },
      { tx: 2, ty: 3, tileId: BASE_CHIP_TILES.bookshelfBottom },
      { tx: 3, ty: 3, tileId: BASE_CHIP_TILES.bookshelfBottom },
      { tx: 8, ty: 2, tileId: BASE_CHIP_TILES.bookshelfTop },
      { tx: 9, ty: 2, tileId: BASE_CHIP_TILES.bookshelfTop },
      { tx: 8, ty: 3, tileId: BASE_CHIP_TILES.bookshelfBottom },
      { tx: 9, ty: 3, tileId: BASE_CHIP_TILES.bookshelfBottom },
      { tx: 5, ty: 4, tileId: BASE_CHIP_TILES.counterTop },
      { tx: 6, ty: 4, tileId: BASE_CHIP_TILES.counterTop },
      { tx: 3, ty: 6, tileId: BASE_CHIP_TILES.roundTable },
      { tx: 8, ty: 6, tileId: BASE_CHIP_TILES.chest },
    ],
  },
  'augment-shop': {
    id: 'augment-shop',
    name: "Mira's Enchantment Studio",
    width: 12,
    height: 9,
    floorTileId: BASE_CHIP_TILES.darkStoneFloor,
    decor: [
      { tx: 2, ty: 2, tileId: BASE_CHIP_TILES.deskTop },
      { tx: 5, ty: 3, tileId: BASE_CHIP_TILES.roundTable },
      { tx: 9, ty: 2, tileId: BASE_CHIP_TILES.bookshelfTop },
      { tx: 9, ty: 3, tileId: BASE_CHIP_TILES.bookshelfBottom },
      { tx: 3, ty: 5, tileId: BASE_CHIP_TILES.candlestick },
      { tx: 7, ty: 5, tileId: BASE_CHIP_TILES.candlestick },
      { tx: 2, ty: 6, tileId: BASE_CHIP_TILES.barrel },
      { tx: 8, ty: 6, tileId: BASE_CHIP_TILES.chest },
    ],
  },
  'supply-shop': {
    id: 'supply-shop',
    name: "Bramble's Supplies",
    width: 12,
    height: 9,
    floorTileId: BASE_CHIP_TILES.cobblestoneFloor,
    decor: [
      { tx: 2, ty: 2, tileId: BASE_CHIP_TILES.barrel },
      { tx: 3, ty: 2, tileId: BASE_CHIP_TILES.barrel },
      { tx: 4, ty: 2, tileId: BASE_CHIP_TILES.barrel },
      { tx: 8, ty: 2, tileId: BASE_CHIP_TILES.chest },
      { tx: 9, ty: 2, tileId: BASE_CHIP_TILES.chest },
      { tx: 10, ty: 2, tileId: BASE_CHIP_TILES.crate },
      { tx: 5, ty: 5, tileId: BASE_CHIP_TILES.roundTable },
      { tx: 2, ty: 6, tileId: BASE_CHIP_TILES.bookshelfTop },
      { tx: 2, ty: 7, tileId: BASE_CHIP_TILES.bookshelfBottom },
      { tx: 9, ty: 6, tileId: BASE_CHIP_TILES.bookshelfTop },
      { tx: 9, ty: 7, tileId: BASE_CHIP_TILES.bookshelfBottom },
    ],
  },
  'scholars-hall': {
    id: 'scholars-hall',
    name: "The Scholar's Hall",
    width: 14,
    height: 10,
    floorTileId: BASE_CHIP_TILES.checkeredFloor,
    decor: [
      { tx: 2, ty: 2, tileId: BASE_CHIP_TILES.bookshelfTop },
      { tx: 3, ty: 2, tileId: BASE_CHIP_TILES.bookshelfTop },
      { tx: 4, ty: 2, tileId: BASE_CHIP_TILES.bookshelfTop },
      { tx: 2, ty: 3, tileId: BASE_CHIP_TILES.bookshelfBottom },
      { tx: 3, ty: 3, tileId: BASE_CHIP_TILES.bookshelfBottom },
      { tx: 4, ty: 3, tileId: BASE_CHIP_TILES.bookshelfBottom },
      { tx: 9, ty: 2, tileId: BASE_CHIP_TILES.bookshelfTop },
      { tx: 10, ty: 2, tileId: BASE_CHIP_TILES.bookshelfTop },
      { tx: 11, ty: 2, tileId: BASE_CHIP_TILES.bookshelfTop },
      { tx: 9, ty: 3, tileId: BASE_CHIP_TILES.bookshelfBottom },
      { tx: 10, ty: 3, tileId: BASE_CHIP_TILES.bookshelfBottom },
      { tx: 11, ty: 3, tileId: BASE_CHIP_TILES.bookshelfBottom },
      { tx: 5, ty: 5, tileId: BASE_CHIP_TILES.deskTop },
      { tx: 7, ty: 5, tileId: BASE_CHIP_TILES.deskTop },
      { tx: 5, ty: 6, tileId: BASE_CHIP_TILES.chairFacingUp },
      { tx: 7, ty: 6, tileId: BASE_CHIP_TILES.chairFacingUp },
      { tx: 3, ty: 7, tileId: BASE_CHIP_TILES.roundTable },
      { tx: 10, ty: 7, tileId: BASE_CHIP_TILES.chest },
    ],
  },
  'home': {
    id: 'home',
    name: 'Your Quarters',
    width: 12,
    height: 9,
    floorTileId: BASE_CHIP_TILES.parquetFloor,
    decor: [
      { tx: 2, ty: 2, tileId: BASE_CHIP_TILES.bedTopLeft },
      { tx: 3, ty: 2, tileId: BASE_CHIP_TILES.bedTopRight },
      { tx: 2, ty: 3, tileId: BASE_CHIP_TILES.bedBottonLeft },
      { tx: 3, ty: 3, tileId: BASE_CHIP_TILES.bedBottomRight },
      { tx: 9, ty: 2, tileId: BASE_CHIP_TILES.fireplaceTop },
      { tx: 9, ty: 3, tileId: BASE_CHIP_TILES.fireplaceBottom },
      { tx: 5, ty: 4, tileId: BASE_CHIP_TILES.roundTable },
      { tx: 6, ty: 4, tileId: BASE_CHIP_TILES.roundTable },
      { tx: 5, ty: 5, tileId: BASE_CHIP_TILES.chairFacingDown },
      { tx: 6, ty: 5, tileId: BASE_CHIP_TILES.chairFacingDown },
      { tx: 2, ty: 6, tileId: BASE_CHIP_TILES.chest },
      { tx: 9, ty: 6, tileId: BASE_CHIP_TILES.bookshelfTop },
      { tx: 9, ty: 7, tileId: BASE_CHIP_TILES.bookshelfBottom },
    ],
  },
  'trader-den': {
    id: 'trader-den',
    name: "The Junk Trader's Den",
    width: 12,
    height: 9,
    floorTileId: BASE_CHIP_TILES.darkWoodFloor,
    decor: [
      { tx: 2, ty: 2, tileId: BASE_CHIP_TILES.barrel },
      { tx: 3, ty: 2, tileId: BASE_CHIP_TILES.barrel },
      { tx: 4, ty: 2, tileId: BASE_CHIP_TILES.barrel },
      { tx: 8, ty: 2, tileId: BASE_CHIP_TILES.chest },
      { tx: 9, ty: 2, tileId: BASE_CHIP_TILES.chest },
      { tx: 10, ty: 2, tileId: BASE_CHIP_TILES.openCrate },
      { tx: 5, ty: 5, tileId: BASE_CHIP_TILES.counterTop },
      { tx: 6, ty: 5, tileId: BASE_CHIP_TILES.counterTop },
      { tx: 2, ty: 6, tileId: BASE_CHIP_TILES.sack },
      { tx: 3, ty: 6, tileId: BASE_CHIP_TILES.pileOfSacks },
    ],
  },
}
