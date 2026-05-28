// Hub World town map layout — areas, streets, buildings, interaction points.
// All coordinates are in tile units (1 tile = 32 px) unless noted.

export const MAP_W = 2400
export const MAP_H = 1600

export interface HubArea {
  id: string
  name: string
  x: number   // pixels
  y: number
  w: number
  h: number
}

export interface HubInteractionPoint {
  tx: number
  ty: number
  label: string
}

const T = 32

// Named zones — hit-tested on pointer move (first match wins).
export const HUB_AREAS: HubArea[] = [
  { id: 'courtyard', name: 'The Courtyard',          x: 33 * T, y: 21 * T, w: 9 * T,  h: 8 * T  },
  { id: 'barracks',  name: 'The Barracks Gate',      x: 36 * T, y:  0,     w: 3 * T,  h: 21 * T },
  { id: 'dock',      name: "The Fisherman's Dock",   x: 36 * T, y: 29 * T, w: 3 * T,  h: 21 * T },
  { id: 'market',    name: 'Market Lane',             x:  0,     y: 23 * T, w: 33 * T, h: 3 * T  },
  { id: 'arcade',    name: 'The Arcade Quarter',      x: 42 * T, y: 23 * T, w: 33 * T, h: 3 * T  },
  { id: 'scholars',  name: "The Scholar's Hall",      x: 42 * T, y:  0,     w: 33 * T, h: 23 * T },
]

// Generate tile positions for a filled rectangular region (inclusive).
function tileRect(tx1: number, ty1: number, tx2: number, ty2: number): [number, number][] {
  const out: [number, number][] = []
  for (let tx = tx1; tx <= tx2; tx++)
    for (let ty = ty1; ty <= ty2; ty++)
      out.push([tx, ty])
  return out
}

// All path-tile positions that form the town's streets and alleyways.
export const HUB_STREET_TILES: [number, number][] = [
  // Main horizontal thoroughfare
  ...tileRect(0, 23, 74, 25),
  // Main vertical thoroughfare
  ...tileRect(36, 0, 38, 49),
  // Central courtyard opening (widens the crossing into a plaza)
  ...tileRect(33, 21, 41, 28),
  // NE alley — Barracks Gate ↔ Scholar's Hall
  ...tileRect(55, 5, 57, 23),
  // NE cross-spur — Scholar's Hall internal street
  ...tileRect(55, 8, 74, 10),
  // SW alley — Market Lane ↔ Fisherman's Dock
  ...tileRect(14, 26, 16, 45),
  // SW cross-spur — Dock district internal street
  ...tileRect(0, 35, 16, 37),
  // NW alley — Market Lane internal alley
  ...tileRect(18, 5, 20, 23),
  // NW cross-spur — Market Lane internal street
  ...tileRect(0, 12, 20, 14),
]

// Building tile positions — rendered with wall tiles via renderPathTiles.
// Laid out to leave gaps alongside every street defined in HUB_STREET_TILES.
export const HUB_BUILDING_TILES: [number, number][] = [
  // ── NW quadrant — Market district ───────────────────────────────────────────
  ...tileRect( 1,  1, 16, 10),   // Grand Market Hall
  ...tileRect( 1, 15, 16, 21),   // Market Stalls
  ...tileRect(21,  1, 31, 19),   // Merchant Quarter

  // ── NE quadrant — Scholar's district ────────────────────────────────────────
  ...tileRect(41,  1, 53,  6),   // Library
  ...tileRect(58,  1, 72,  6),   // Scholar's Hall
  ...tileRect(41, 11, 53, 19),   // Archives
  ...tileRect(58, 11, 72, 19),   // Observatory

  // ── SW quadrant — Dock district ──────────────────────────────────────────────
  ...tileRect( 1, 27, 12, 33),   // Warehouse A
  ...tileRect( 1, 38, 12, 47),   // Fishing Hut
  ...tileRect(17, 27, 32, 33),   // Dock Hall
  ...tileRect(17, 38, 32, 47),   // Harbor Market

  // ── SE quadrant — Arcade district ────────────────────────────────────────────
  ...tileRect(42, 27, 53, 34),   // Arcade Hall
  ...tileRect(42, 38, 53, 47),   // Casino
  ...tileRect(58, 27, 72, 34),   // Showroom
  ...tileRect(58, 38, 72, 47),   // Gallery
]

// Interaction-point ellipses at district entrances (visual only for now).
export const HUB_INTERACTION_POINTS: HubInteractionPoint[] = [
  { tx: 37, ty: 18, label: 'Barracks Gate' },
  { tx: 37, ty: 30, label: "Fisherman's Dock" },
  { tx: 28, ty: 24, label: 'Market Lane' },
  { tx: 46, ty: 24, label: 'Arcade Quarter' },
  { tx: 56, ty: 20, label: "Scholar's Hall" },
]
