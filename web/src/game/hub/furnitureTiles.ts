// Maps furniture catalog ids (furniture.ts) to the interior tile(s) that
// represent them in the walkable player-quarters room (HubTownCanvas.tsx).
// Offsets are relative to the piece's anchor (x, y) from homeLayout.ts.
//
// Multi-tile entries render real multi-tile art at the correct sub-offsets
// (matching how the ravenwatch "home" interior already places bookshelf/rug
// tiles). Single-tile entries render one sprite at the anchor only — a
// footprint wider/taller than 1x1 is not stretched to fill every cell, since
// renderDecorItems doesn't support scaling a decor sprite across tiles.
//
// Rotation is intentionally not visually applied here (only affects the
// DECORATE grid's placement/collision logic) — correctly rotating a
// multi-tile composition means swapping which sub-tile art goes in which
// cell, not just an image transform, and isn't worth the complexity for the
// stand-in tiles used below (round-table, potted-fern, armchair,
// framed-portrait, travel-chest, hearth-stove, reading-lamp reuse existing
// tiles that aren't a perfect visual match for their catalog item).

import { BASE_CHIP_TILES } from '../../data/tiles/baseChipIndex'

export interface FurnitureTileOffset {
  dx: number
  dy: number
  /** Resolved numeric chip id, matching HUB_INTERIORS' already-resolved decor.tileId. */
  tileId: number
}

interface RawOffset { dx: number; dy: number; tileId: string }

const FURNITURE_TILES_RAW: Record<string, RawOffset[]> = {
  'cozy-rug': [
    { dx: 0, dy: 0, tileId: 'rugTopLeft' },
    { dx: 1, dy: 0, tileId: 'rugTopRight' },
    { dx: 0, dy: 1, tileId: 'rugBottomLeft' },
    { dx: 1, dy: 1, tileId: 'rugBottomRight' },
  ],
  'reading-lamp':     [{ dx: 0, dy: 0, tileId: 'floorLantern' }],
  'oak-bookshelf': [
    { dx: 0, dy: 0, tileId: 'bookshelfTop' },
    { dx: 0, dy: 1, tileId: 'bookshelfBottom' },
  ],
  'round-table':      [{ dx: 0, dy: 0, tileId: 'roundTable' }],
  'potted-fern':      [{ dx: 0, dy: 0, tileId: 'potOfFlowers' }],
  'armchair':         [{ dx: 0, dy: 0, tileId: 'stool' }],
  'four-poster-bed': [
    { dx: 0, dy: 0, tileId: 'royalBedTopLeft' },
    { dx: 1, dy: 0, tileId: 'royalBedTopRight' },
    { dx: 0, dy: 1, tileId: 'royalBedBottonLeft' },
    { dx: 1, dy: 1, tileId: 'royalBedBottomRight' },
  ],
  'framed-portrait':  [{ dx: 0, dy: 0, tileId: 'paintingLandscapeTop' }],
  'travel-chest':     [{ dx: 0, dy: 0, tileId: 'chest' }],
  'hearth-stove':     [{ dx: 0, dy: 0, tileId: 'stoneOven' }],
  'candle-stand':     [{ dx: 0, dy: 0, tileId: 'candlestickUnlit' }],
  'wall-clock':       [{ dx: 0, dy: 0, tileId: 'wallClock' }],
}

const CHIP_TILES = BASE_CHIP_TILES as Record<string, number>

export function getFurnitureTileOffsets(itemId: string): FurnitureTileOffset[] {
  const raw = FURNITURE_TILES_RAW[itemId] ?? []
  return raw.map(o => ({ dx: o.dx, dy: o.dy, tileId: CHIP_TILES[o.tileId] ?? 0 }))
}
