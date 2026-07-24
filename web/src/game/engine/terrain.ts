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

/**
 * Act/node-authored blocking terrain drawn as a path rather than placed one
 * circle at a time — a line of trees, a river, a mountain ridge. Expands (via
 * expandTerrainPathsToObstacles below) into a chain of overlapping
 * TerrainObstacle circles along the waypoints, so it gets full unit avoidance
 * and the exact same per-type rendering (ring autotile for rock/tree/water,
 * icon for ruin — see buildTerrainDecorGfx in utils/terrainLayer.ts) as
 * individually hand-placed obstacles, for free.
 */
export interface TerrainPathDef {
  type: TerrainType
  /** Waypoints in game-unit coords — same space as TerrainObstacle: x 0–500 (forward, base→base), y -80..80 (lateral). */
  points: Array<{ x: number; y: number }>
  /** Avoidance radius of each chained obstacle (game units). Also controls chain spacing — consecutive circles are spaced at `radius` apart so the chain has continuous coverage. Default 20. */
  radius?: number
}

/**
 * Expands TerrainPathDef waypoint chains into TerrainObstacle circles spaced
 * `radius` apart along each path's polyline, so a drawn path is just sugar
 * for "a lot of hand-placed obstacles in a row" — reuses 100% of the existing
 * avoidance (TERRAIN_AVOID_SHAPE) and rendering (buildTerrainDecorGfx) code,
 * no new terrain-shape logic needed anywhere else in the engine/renderer.
 * IDs are plain digit strings (pathIndex*1000 + n) so they stay compatible
 * with buildTerrainDecorGfx's `parseInt(obs.id.replace('t', ''))` tile-variant
 * picker (a no-op replace on a string with no 't' in it).
 */
export function expandTerrainPathsToObstacles(paths: TerrainPathDef[]): TerrainObstacle[] {
  const obstacles: TerrainObstacle[] = []
  paths.forEach((path, pathIndex) => {
    if (path.points.length === 0) return
    const radius = path.radius ?? 20
    let n = 0
    const place = (x: number, y: number) => {
      obstacles.push({ id: String(pathIndex * 1000 + n++), type: path.type, x, y, radius })
    }
    place(path.points[0].x, path.points[0].y)
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1]
      const b = path.points[i]
      const dist = Math.hypot(b.x - a.x, b.y - a.y)
      const steps = Math.max(1, Math.round(dist / radius))
      for (let s = 1; s <= steps; s++) {
        place(a.x + (b.x - a.x) * (s / steps), a.y + (b.y - a.y) * (s / steps))
      }
    }
  })
  return obstacles
}

/**
 * Act/node-authored decor placement — a single WORLD_DECOR sprite (see
 * data/tiles/worldTileIndex.ts) placed at a fixed point. Purely visual: does
 * NOT affect unit avoidance (unlike TerrainObstacle) and is not an autotiled
 * patch (unlike scenery/border tiles). When an act/node defines a non-empty
 * `decor` array, it replaces buildDecorGfx's procedural scatter for that
 * act/node (see terrainLayer.ts).
 */
export interface BattlefieldDecorItem {
  id: string
  /** Index into WORLD_DECOR (data/tiles/worldTileIndex.ts). */
  tileId: number
  x: number // forward axis, same coords/range as TerrainObstacle (0–500)
  y: number // lateral axis, same coords/range as TerrainObstacle (-80..80)
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
