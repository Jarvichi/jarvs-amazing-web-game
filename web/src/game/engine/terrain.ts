// ─── Terrain Types ────────────────────────────────────────

export type TerrainType = 'rock' | 'tree' | 'water' | 'ruin'

/**
 * Per-type avoidance ellipse multipliers (applied to obs.radius).
 * fx = forward axis (game x, maps to screen vertical).
 * fy = lateral axis (game y, maps to screen horizontal).
 * Derived from each SVG's width/height ratios so the avoidance shape
 * matches the visual: pine trees are tall+narrow, water pools are wide, etc.
 */
export const TERRAIN_AVOID_SHAPE: Record<TerrainType, { fx: number; fy: number }> = {
  rock:  { fx: 1.1, fy: 0.9 },  // mountain peaks: slightly taller than wide
  tree:  { fx: 1.3, fy: 0.5 },  // pine/fruit/blob trees: tall, narrow trunk
  water: { fx: 0.6, fy: 1.5 },  // pond: wide and flat
  ruin:  { fx: 1.0, fy: 0.9 },  // ruins/farmhouse/watchtower: roughly square
}

export interface TerrainObstacle {
  id: string
  type: TerrainType
  x: number      // forward axis (same coords as units); kept 80–420
  y: number      // lateral axis; –75 to 75
  radius: number // base avoidance radius in game units, 12–22
}

/**
 * Act/node-authored road path for the battlefield, rendered visually only —
 * does not affect unit movement/avoidance (see game/engine/units.ts).
 */
export interface RoadDef {
  /** Waypoints in game-unit coords — same space as TerrainObstacle: x 0–500 (forward, base→base), y -80..80 (lateral). */
  points: Array<{ x: number; y: number }>
  /** Tile-count width of the road band. Default 2. */
  width?: number
  /** Optional tileset override (defaults to envDef.pathFile). */
  tileFile?: string
}

// ─── Terrain Generation ───────────────────────────────────
//
// Scatter rocks, trees, water, and ruins across the mid-field.
// Two Y edge corridors are guaranteed clear so units always have
// walkable paths from base to base.

export const TERRAIN_CLEAR_Y = [-70, 70] as const  // edge corridors units route around
const TERRAIN_CLEAR_HALF = 12                  // half-width of each corridor (px)

/** Tiny seeded PRNG (mulberry32) — deterministic given the same seed. */
function makeRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (Math.imul(s ^ (s >>> 15), s | 1) ^ ((s ^ (Math.imul(s ^ (s >>> 7), s | 61))) >>> 14)) >>> 0
    return s / 4294967296
  }
}

/** Hash a string to a uint32 for use as a terrain seed. */
function hashStr(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  }
  return h >>> 0
}

/**
 * Generate terrain for a battle.
 * @param seed        Optional string seed (node ID). When provided, the layout is deterministic.
 * @param environment Act environment — biases which obstacle types appear.
 */
export function generateTerrain(seed?: string, environment?: string): TerrainObstacle[] {
  const rng = seed ? makeRng(hashStr(seed)) : Math.random.bind(Math)

  const TYPES: TerrainType[] =
    environment === 'forest'  ? ['tree', 'tree', 'tree', 'rock', 'water']
    : environment === 'citadel' ? ['rock', 'rock', 'ruin', 'ruin', 'water']
    : environment === 'ashen'   ? ['ruin', 'ruin', 'rock', 'rock', 'tree']
    : ['rock', 'tree', 'water', 'ruin']

  const obstacles: TerrainObstacle[] = []
  const count = 4 + Math.floor(rng() * 5)  // 4–8 obstacles per battle
  let id = 0
  let tries = 0

  while (obstacles.length < count && tries++ < 150) {
    const x      = 90  + rng() * 320        // 90–410, away from spawn zones
    const y      = (rng() * 150) - 75       // –75 to 75
    const radius = 20  + rng() * 12         // 20–32 px
    const type   = TYPES[Math.floor(rng() * TYPES.length)]

    if (TERRAIN_CLEAR_Y.some(cy => Math.abs(y - cy) < TERRAIN_CLEAR_HALF + radius)) continue
    if (obstacles.some(o => Math.hypot(x - o.x, y - o.y) < radius + o.radius + 10)) continue

    obstacles.push({ id: `t${++id}`, type, x, y, radius })
  }

  return obstacles
}
