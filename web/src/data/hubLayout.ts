// Hub World town map layout — areas, streets, buildings, nodes.
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

export interface HubNode {
  id: string
  label: string
  tx: number
  ty: number
  screen: string   // App Screen string to navigate to on interaction
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
  { id: 'pond',      name: 'Greyfish Pond',           x:  1 * T, y: 33 * T, w: 9 * T,  h: 5 * T  },
  { id: 'casino',    name: 'The Lucky Draw',          x: 58 * T, y: 27 * T, w: 15 * T, h: 8 * T  },
]

// Tappable location nodes — all placed on street tiles.
export const HUB_NODES: HubNode[] = [
  { id: 'campaign',     label: 'Campaign',      tx: 37, ty: 16, screen: 'title'          },
  { id: 'quickbattle',  label: 'Quick Battle',  tx: 37, ty: 32, screen: 'quickbattle'    },
  { id: 'minigames',    label: 'Mini-Games',    tx: 50, ty: 24, screen: 'minigames'      },
  { id: 'card-shop',    label: 'Card Shop',     tx:  6, ty: 12, screen: 'shop-cards'    },
  { id: 'augment-shop', label: 'Augments',      tx: 14, ty: 12, screen: 'shop-augments' },
  { id: 'supply-shop',  label: 'Supplies',      tx:  8, ty: 24, screen: 'shop-supplies' },
  { id: 'codex',        label: 'Codex',         tx: 56, ty: 15, screen: 'codex'          },
  { id: 'commander',    label: 'Commander',     tx: 37, ty: 24, screen: 'commander'      },
  { id: 'achievements', label: 'Achievements',  tx: 56, ty: 19, screen: 'hall-of-achievements' },
  { id: 'home',         label: 'Home',          tx: 19, ty: 18, screen: 'home-shelf'     },
  { id: 'fishing',      label: 'Fishing Hole',  tx:  5, ty: 35, screen: 'hub-fishing'    },
  { id: 'casino',       label: 'Lucky Draw',    tx: 64, ty: 24, screen: 'casino'          },
]

// Generate tile positions for a filled rectangular region (inclusive).
function tileRect(tx1: number, ty1: number, tx2: number, ty2: number): [number, number][] {
  const out: [number, number][] = []
  for (let tx = tx1; tx <= tx2; tx++)
    for (let ty = ty1; ty <= ty2; ty++)
      out.push([tx, ty])
  return out
}

// All path-tile positions forming the town's streets and alleyways.
export const HUB_STREET_TILES: [number, number][] = [
  // Main horizontal thoroughfare
  ...tileRect(0, 23, 74, 25),
  // Main vertical thoroughfare
  ...tileRect(36, 0, 38, 49),
  // Central courtyard opening
  ...tileRect(33, 21, 41, 28),
  // NE alley — Barracks Gate ↔ Scholar's Hall
  ...tileRect(55, 5, 57, 23),
  // NE cross-spur — Scholar's Hall internal street
  ...tileRect(55, 8, 74, 10),
  // SW alley — Market Lane ↔ Fisherman's Dock
  ...tileRect(14, 26, 16, 45),
  // SW cross-spur — Dock district internal street
  ...tileRect(0, 35, 16, 36),
  // NW alley — Market Lane internal alley
  ...tileRect(18, 2, 19, 23),
  // NW alley — Market Lane outer alley
  ...tileRect(18, 2, 38, 3),
  // NW cross-spur — Market Lane internal street
  ...tileRect(0, 12, 20, 13),

  // Building entrances — rendered with wall tiles via renderPathTiles.
  ...tileRect(6, 11, 7, 11),
  ...tileRect(7, 22, 10, 22),
]

// Building tile positions — rendered with wall tiles via renderPathTiles.
export const HUB_BUILDING_TILES: [number, number][] = [
  // ── NW quadrant — Market district ───────────────────────────────────────────
  ...tileRect( 1,  1, 16, 10),
  ...tileRect( 1, 15, 16, 21),
  ...tileRect(21,  5, 31, 19),
  // ── NE quadrant — Scholar's district ────────────────────────────────────────
  ...tileRect(41,  1, 53,  6),
  ...tileRect(58,  1, 72,  6),
  ...tileRect(41, 11, 53, 19),
  ...tileRect(58, 11, 72, 19),
  // ── SW quadrant — Dock district ──────────────────────────────────────────────
  ...tileRect( 1, 27, 12, 33),
  ...tileRect( 1, 38, 12, 47),
  ...tileRect(17, 27, 32, 33),
  ...tileRect(17, 38, 32, 47),
  // ── SE quadrant — Arcade district ────────────────────────────────────────────
  ...tileRect(42, 27, 53, 34),
  ...tileRect(42, 38, 53, 47),
  ...tileRect(58, 27, 72, 34),
  ...tileRect(58, 38, 72, 47),
]

// Starting tile for the player avatar (courtyard center).
export const AVATAR_START: [number, number] = [37, 24]
