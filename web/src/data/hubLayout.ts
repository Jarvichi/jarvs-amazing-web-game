// Hub World town map layout — areas, streets, buildings, interaction points.
// All coordinates use pixel space (1 tile = 32 px) unless noted.

export const MAP_W = 2400
export const MAP_H = 1600
const T = 32

export interface HubArea {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
}

export interface HubBuilding {
  x: number
  y: number
  w: number
  h: number
}

export interface HubInteractionPoint {
  tx: number
  ty: number
  label: string
}

// Named zones — hit-tested on pointer move (first match wins).
export const HUB_AREAS: HubArea[] = [
  { id: 'courtyard', name: 'The Courtyard',          x: 33 * T, y: 21 * T, w: 9 * T,  h: 8 * T  },
  { id: 'barracks',  name: 'The Barracks Gate',      x: 36 * T, y:  0,     w: 3 * T,  h: 21 * T },
  { id: 'dock',      name: "The Fisherman's Dock",   x: 36 * T, y: 29 * T, w: 3 * T,  h: 21 * T },
  { id: 'market',    name: 'Market Lane',             x:  0,     y: 23 * T, w: 33 * T, h: 3 * T  },
  { id: 'arcade',    name: 'The Arcade Quarter',      x: 42 * T, y: 23 * T, w: 33 * T, h: 3 * T  },
  { id: 'scholars',  name: "The Scholar's Hall",      x: 42 * T, y:  0,     w: 33 * T, h: 23 * T },
]

// Generate tile positions for a rectangular street block (inclusive).
function streetRect(tx1: number, ty1: number, tx2: number, ty2: number): [number, number][] {
  const out: [number, number][] = []
  for (let tx = tx1; tx <= tx2; tx++)
    for (let ty = ty1; ty <= ty2; ty++)
      out.push([tx, ty])
  return out
}

// All path-tile positions that form the town's streets and alleyways.
// Duplicates are harmless — callers should deduplicate via Set if needed.
export const HUB_STREET_TILES: [number, number][] = [
  // Main horizontal thoroughfare
  ...streetRect(0, 23, 74, 25),
  // Main vertical thoroughfare
  ...streetRect(36, 0, 38, 49),
  // Central courtyard opening (widens the crossing into a plaza)
  ...streetRect(33, 21, 41, 28),
  // NE alley — Barracks Gate ↔ Scholar's Hall
  ...streetRect(55, 5, 57, 23),
  // NE cross-spur — Scholar's Hall internal street
  ...streetRect(55, 8, 74, 10),
  // SW alley — Arcade Quarter ↔ Fisherman's Dock
  ...streetRect(14, 26, 16, 45),
  // SW cross-spur — Dock district internal street
  ...streetRect(0, 35, 16, 37),
  // NW alley — Market Lane internal alley
  ...streetRect(18, 5, 20, 23),
  // NW cross-spur — Market Lane internal street
  ...streetRect(0, 12, 20, 14),
]

// Dark filled blocks representing buildings (inaccessible regions).
// Positions chosen to avoid all street tile columns/rows defined above.
export const HUB_BUILDINGS: HubBuilding[] = [
  // ── NW quadrant — Market district ───────────────────────────────────────────
  { x:  1 * T, y:  1 * T, w: 16 * T, h: 10 * T },   // Grand Market Hall
  { x:  1 * T, y: 15 * T, w: 16 * T, h:  7 * T },   // Market Stalls
  { x: 21 * T, y:  1 * T, w: 11 * T, h: 19 * T },   // Merchant Quarter

  // ── NE quadrant — Scholar's district ────────────────────────────────────────
  { x: 41 * T, y:  1 * T, w: 13 * T, h:  6 * T },   // Library
  { x: 58 * T, y:  1 * T, w: 15 * T, h:  6 * T },   // Scholar's Hall
  { x: 41 * T, y: 11 * T, w: 13 * T, h:  9 * T },   // Archives
  { x: 58 * T, y: 11 * T, w: 15 * T, h:  9 * T },   // Observatory

  // ── SW quadrant — Dock district ──────────────────────────────────────────────
  { x:  1 * T, y: 27 * T, w: 12 * T, h:  7 * T },   // Warehouse A
  { x:  1 * T, y: 38 * T, w: 12 * T, h: 10 * T },   // Fishing Hut
  { x: 17 * T, y: 27 * T, w: 18 * T, h:  7 * T },   // Dock Hall
  { x: 17 * T, y: 38 * T, w: 18 * T, h: 10 * T },   // Harbor Market

  // ── SE quadrant — Arcade district ────────────────────────────────────────────
  { x: 41 * T, y: 27 * T, w: 13 * T, h:  8 * T },   // Arcade Hall
  { x: 41 * T, y: 38 * T, w: 13 * T, h: 10 * T },   // Casino
  { x: 58 * T, y: 27 * T, w: 15 * T, h:  8 * T },   // Showroom
  { x: 58 * T, y: 38 * T, w: 15 * T, h: 10 * T },   // Gallery
]

// Interaction-point ellipses at district entrances (visual only for now).
export const HUB_INTERACTION_POINTS: HubInteractionPoint[] = [
  { tx: 37, ty: 18, label: 'Barracks Gate' },
  { tx: 37, ty: 30, label: "Fisherman's Dock" },
  { tx: 28, ty: 24, label: 'Market Lane' },
  { tx: 46, ty: 24, label: 'Arcade Quarter' },
  { tx: 56, ty: 20, label: "Scholar's Hall" },
]
