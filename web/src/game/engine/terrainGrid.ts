import type { TerrainObstacle, RoadDef, TerrainType } from './terrain'
import { generateTerrain } from './terrain'
import { LANE_WIDTH } from '../types'
import { LANE_MIN_Y, LANE_MAX_Y } from './helpers'

// ─── Reference tile grid ──────────────────────────────────────────────────
//
// Gameplay-critical blocking must be deterministic across every client
// regardless of screen size, so this grid is computed against a FIXED
// reference resolution rather than the actual on-screen canvas (which
// utils/terrainLayer.ts's rendering-side gameToPixel/pixelToGame use, sized
// to whatever the player's viewport happens to be). Any (w,h) pair on
// BATTLEFIELD_ASPECT_RATIO produces an identical grid in game-unit space —
// this only picks a concrete tile density, not a different result.
//
// The two coordinate-conversion formulas below are intentionally duplicated
// from utils/terrainLayer.ts's gameToPixel/pixelToGame (not imported) — that
// file pulls in pixi.js, which game/engine code must stay free of. Keep
// these in sync with that file if the lane's coordinate mapping ever changes.

const BATTLEFIELD_ASPECT_RATIO = 9 / 19.5 // mirrors game/types.ts's constant of the same name
const TILE_SIZE = 32 // mirrors data/tiles/tileIndex.ts's TILE_SIZE

export const GRID_REF_WIDTH = 390
export const GRID_REF_HEIGHT = Math.round(GRID_REF_WIDTH / BATTLEFIELD_ASPECT_RATIO)

function gameToPixel(x: number, y: number): { px: number; py: number } {
  return { px: (0.5 + (y / 80) * 0.36) * GRID_REF_WIDTH, py: (1 - x / 500) * GRID_REF_HEIGHT }
}

export interface TileKey { tcx: number; tcy: number }

/** Converts a game-unit position into the reference tile grid's cell coords. */
export function gameToTile(x: number, y: number): TileKey {
  const { px, py } = gameToPixel(x, y)
  return { tcx: Math.round(px / TILE_SIZE), tcy: Math.round(py / TILE_SIZE) }
}

function tileKeyStr(tcx: number, tcy: number): string {
  return `${tcx},${tcy}`
}

function tilesInDisc(center: TileKey, tileRadius: number): TileKey[] {
  const out: TileKey[] = []
  for (let dr = -tileRadius; dr <= tileRadius; dr++) {
    for (let dc = -tileRadius; dc <= tileRadius; dc++) {
      if (dr * dr + dc * dc > tileRadius * tileRadius) continue
      out.push({ tcx: center.tcx + dc, tcy: center.tcy + dr })
    }
  }
  return out
}

/** Exact `width`-tile-wide square window around a centerline point — mirrors
 *  utils/terrainLayer.ts's buildRoadGfx road-width model (width=N is always
 *  exactly N tiles across, not an approximate circular radius), so a road's
 *  gameplay bridge footprint matches what's actually drawn on screen. */
function tilesInSquare(center: TileKey, width: number): TileKey[] {
  const lo = Math.max(0, Math.floor((width - 1) / 2))
  const hi = Math.max(0, width - 1 - lo)
  const out: TileKey[] = []
  for (let dr = -lo; dr <= hi; dr++) {
    for (let dc = -lo; dc <= hi; dc++) {
      out.push({ tcx: center.tcx + dc, tcy: center.tcy + dr })
    }
  }
  return out
}

// ─── Obstacle / road tile coverage ─────────────────────────────────────────
//
// Dedicated, simpler cousin of utils/terrainPatchPlan.ts's tile math: no
// tileset-grouping, no centre-icon reservation, no first-obstacle-wins
// ownership — gameplay just needs "which obstacle type (if any), at what
// zIndex, covers this tile" and "which road, at what zIndex, covers this
// tile", combined by isTilePassable below. Reusing terrainPatchPlan.ts
// directly would couple gameplay to rendering-only semantics (see the
// module doc comment there); this stays deliberately separate.

export interface ObstacleTile { type: TerrainType; zIndex: number }

/**
 * How many tile rings out from its centre an obstacle blocks.
 *
 * Mirrors the tile-radius formula utils/terrainLayer.ts's buildTerrainDecorGfx
 * uses, evaluated against the fixed reference resolution rather than the actual
 * canvas — but only for the types that actually draw that disc.
 *
 * Ruins do not. They have no patch tileset in any environment, so
 * utils/terrainPatchPlan.ts draws them as a single WORLD_DECOR icon on their
 * centre tile and skips the patch loop entirely. Applying the patch formula to
 * them blocked up to 29 tiles behind a one-tile icon — a mushroom or gravestone
 * that reads as scenery while walling off a third of the lane. Ruins block the
 * tile their icon sits on, which is the whole of what they draw.
 */
function obstacleTileRadius(type: TerrainType, radius: number): number {
  if (type === 'ruin') return 0
  const TILE_RADIUS_SCALE = 220 // mirrors utils/terrainLayer.ts's constant of the same name
  return Math.max(1, Math.round(radius * GRID_REF_HEIGHT / (TILE_RADIUS_SCALE * TILE_SIZE)))
}

export function buildObstacleTileMap(terrain: TerrainObstacle[]): Map<string, ObstacleTile> {
  const map = new Map<string, ObstacleTile>()
  for (const obs of terrain) {
    const center = gameToTile(obs.x, obs.y)
    const tileRadius = obstacleTileRadius(obs.type, obs.radius)
    const z = obs.zIndex ?? 0
    for (const { tcx, tcy } of tilesInDisc(center, tileRadius)) {
      const key = tileKeyStr(tcx, tcy)
      const existing = map.get(key)
      if (!existing || z > existing.zIndex) map.set(key, { type: obs.type, zIndex: z })
    }
  }
  return map
}

export function buildRoadTileMap(roads: RoadDef[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const road of roads) {
    if (road.points.length < 2) continue
    const z = road.zIndex ?? 1
    const width = road.width ?? 2

    // Rasterize the centerline tile-by-tile between consecutive waypoints,
    // same stepping approach as utils/terrainLayer.ts's buildRoadGfx —
    // including the cardinal "elbow" insertion at diagonal steps, kept in
    // sync so a road's tile coverage never has a gap here that isn't also
    // absent there.
    const centerline: TileKey[] = []
    let prev = gameToTile(road.points[0].x, road.points[0].y)
    centerline.push(prev)
    for (let i = 1; i < road.points.length; i++) {
      const cur = gameToTile(road.points[i].x, road.points[i].y)
      const dx = cur.tcx - prev.tcx
      const dy = cur.tcy - prev.tcy
      const steps = Math.max(Math.abs(dx), Math.abs(dy))
      let stepPrevTx = prev.tcx
      let stepPrevTy = prev.tcy
      for (let s = 1; s <= steps; s++) {
        const tcx = Math.round(prev.tcx + (dx * s) / steps)
        const tcy = Math.round(prev.tcy + (dy * s) / steps)
        if (tcx !== stepPrevTx && tcy !== stepPrevTy) {
          centerline.push({ tcx, tcy: stepPrevTy })
        }
        centerline.push({ tcx, tcy })
        stepPrevTx = tcx
        stepPrevTy = tcy
      }
      prev = cur
    }

    for (const center of centerline) {
      for (const { tcx, tcy } of tilesInSquare(center, width)) {
        const key = tileKeyStr(tcx, tcy)
        const existing = map.get(key)
        if (existing === undefined || z > existing) map.set(key, z)
      }
    }
  }
  return map
}

// ─── Movement-profile passability ──────────────────────────────────────────

export type MovementProfile = 'ground' | 'flying' | 'burrowing'

/**
 * Blocking matrix: rock/tree/ruin block ground units but never burrowing
 * (or flying, handled separately — see isTilePassable); water blocks ground
 * units unless they swim, and always blocks burrowing. Flying is handled
 * before this is ever consulted (it bypasses every obstacle unconditionally,
 * mirroring the existing `!unit.flying` gates in engine/units.ts).
 */
function blocksProfile(type: TerrainType, profile: 'ground' | 'burrowing', swims: boolean): boolean {
  if (type === 'water') return profile === 'burrowing' ? true : !swims
  return profile !== 'burrowing' // rock/tree/ruin: blocks ground, never burrowing
}

export function isTilePassable(
  obstacleTiles: Map<string, ObstacleTile>,
  roadTiles: Map<string, number>,
  tcx: number,
  tcy: number,
  profile: MovementProfile,
  swims: boolean,
): boolean {
  if (profile === 'flying') return true
  const key = tileKeyStr(tcx, tcy)
  const obs = obstacleTiles.get(key)
  if (!obs) return true
  if (!blocksProfile(obs.type, profile, swims)) return true
  const roadZ = roadTiles.get(key)
  return roadZ !== undefined && roadZ > obs.zIndex // a higher-zIndex road bridges it
}

// ─── Flow-field pathfinding ─────────────────────────────────
//
// Hard tile blocking (see moveUnits in ./units.ts) only does local collision
// response: try the full move, then x-only, then y-only. That slides along a
// wall fine, but a unit walking straight at an obstacle has no lateral
// component to slide on — every candidate lands in the same blocked tile, so it
// stalls there forever. Soft avoidance used to supply that lateral nudge, but
// it's deliberately switched off wherever hard blocking is on.
//
// So blocked units need an actual route, not a nudge. Terrain and roads are
// fixed for the whole battle, which makes a flow field the right tool: one BFS
// from the goal edge labels every reachable tile with its distance, and any
// unit can then follow the downhill gradient around arbitrarily-shaped
// obstacles. It's built once per (profile, swims, goal) and cached on the
// GameState, so steering costs a map lookup per blocked unit per tick.

/** Tile key -> BFS step distance to the goal edge. Absent = unreachable. */
export type FlowField = Map<string, number>

/** Tile-grid bounds of the playable lane, shared by reachability, flow fields
 *  and the battlefield passability overlay. */
export function laneTileBounds() {
  const minTile = gameToTile(0, LANE_MIN_Y)
  const maxTile = gameToTile(LANE_WIDTH, LANE_MAX_Y)
  return {
    tcxLo: Math.min(minTile.tcx, maxTile.tcx),
    tcxHi: Math.max(minTile.tcx, maxTile.tcx),
    tcyLo: Math.min(minTile.tcy, maxTile.tcy),
    tcyHi: Math.max(minTile.tcy, maxTile.tcy),
  }
}

/**
 * Labels every tile a unit of this movement profile can reach with its
 * 8-connected step distance to `goalX`'s tile row (0 = the opponent base edge,
 * LANE_WIDTH = the player base edge). Diagonals count for the same reason
 * checkReachability uses them: units move continuously, not tile-locked.
 */
export function buildFlowField(
  obstacleTiles: Map<string, ObstacleTile>,
  roadTiles: Map<string, number>,
  profile: MovementProfile,
  swims: boolean,
  goalX: number,
): FlowField {
  const field: FlowField = new Map()
  const { tcxLo, tcxHi, tcyLo, tcyHi } = laneTileBounds()
  const passable = (tcx: number, tcy: number) =>
    tcx >= tcxLo && tcx <= tcxHi && tcy >= tcyLo && tcy <= tcyHi &&
    isTilePassable(obstacleTiles, roadTiles, tcx, tcy, profile, swims)

  const goalTcy = gameToTile(goalX, 0).tcy
  const queue: TileKey[] = []
  for (let tcx = tcxLo; tcx <= tcxHi; tcx++) {
    if (!passable(tcx, goalTcy)) continue
    field.set(tileKeyStr(tcx, goalTcy), 0)
    queue.push({ tcx, tcy: goalTcy })
  }

  const deltas = [-1, 0, 1]
  let qi = 0
  while (qi < queue.length) {
    const { tcx, tcy } = queue[qi++]
    const dist = field.get(tileKeyStr(tcx, tcy))!
    for (const dtx of deltas) {
      for (const dty of deltas) {
        if (dtx === 0 && dty === 0) continue
        const ntx = tcx + dtx
        const nty = tcy + dty
        if (!passable(ntx, nty)) continue
        const key = tileKeyStr(ntx, nty)
        if (field.has(key)) continue
        field.set(key, dist + 1)
        queue.push({ tcx: ntx, tcy: nty })
      }
    }
  }
  return field
}

/**
 * One step downhill on the flow field — a neighbouring tile strictly closer to
 * the goal. Returns null when nothing adjacent improves (already at the goal, or
 * sealed in).
 *
 * `preferTcx` breaks the choice toward a lateral column the caller favours.
 * Without it every unit reads the same field and therefore takes the same route,
 * so an entire army funnels around terrain on one side while the other flank
 * goes unused. Candidates are still restricted to tiles that strictly reduce the
 * remaining distance, so honouring a preference can't cause a unit to loop or
 * stall — it only chooses between routes that all make real progress.
 */
export function flowFieldStep(
  field: FlowField, tcx: number, tcy: number, preferTcx?: number,
): TileKey | null {
  const here = field.get(tileKeyStr(tcx, tcy))
  // Standing somewhere unreachable (e.g. spawned inside terrain): accept any
  // neighbour on the field rather than refusing to move at all.
  const limit = here ?? Infinity
  let best: TileKey | null = null
  let bestPref = Infinity
  let bestDist = Infinity
  const deltas = [-1, 0, 1]
  for (const dtx of deltas) {
    for (const dty of deltas) {
      if (dtx === 0 && dty === 0) continue
      const ntx = tcx + dtx
      const nty = tcy + dty
      const dist = field.get(tileKeyStr(ntx, nty))
      if (dist === undefined || dist >= limit) continue
      const pref = preferTcx === undefined ? 0 : Math.abs(ntx - preferTcx)
      if (pref < bestPref || (pref === bestPref && dist < bestDist)) {
        best = { tcx: ntx, tcy: nty }
        bestPref = pref
        bestDist = dist
      }
    }
  }
  return best
}

/** Centre of a tile, in game units — the point a unit steers toward. */
export function tileToGame(tcx: number, tcy: number): { x: number; y: number } {
  const px = tcx * TILE_SIZE
  const py = tcy * TILE_SIZE
  return { x: 500 * (1 - py / GRID_REF_HEIGHT), y: 80 * ((px / GRID_REF_WIDTH - 0.5) / 0.36) }
}

// ─── Reachability ───────────────────────────────────────────────────────────

export interface ReachabilityResult {
  reachable: boolean
}

/**
 * 8-connected flood-fill (diagonals count — units move continuously, not
 * tile-locked, so a diagonal-only gap between two blocking tiles is still
 * traversable in reality) from the x=0 edge column to the x=LANE_WIDTH edge
 * column, across the full lateral range. "Reachable" means the lane isn't
 * fully sealed off by a blocking wall for this movement profile — it does
 * NOT guarantee every lateral y is individually reachable, only that some
 * path exists end to end.
 */
export function checkReachability(
  terrain: TerrainObstacle[],
  roads: RoadDef[],
  profile: MovementProfile,
  swims: boolean,
): ReachabilityResult {
  if (profile === 'flying') return { reachable: true }

  const obstacleTiles = buildObstacleTileMap(terrain)
  const roadTiles = buildRoadTileMap(roads)

  // Forward axis (game x) maps to pixel y (gameToPixel's `py`), so tile ROWS
  // (tcy) correspond to forward position, and tile COLUMNS (tcx) correspond
  // to lateral position — x=0 (player base) is the LARGEST tcy, x=LANE_WIDTH
  // (opponent base) the smallest, since py = (1 - x/500) * height.
  const minTile = gameToTile(0, LANE_MIN_Y)
  const maxTile = gameToTile(LANE_WIDTH, LANE_MAX_Y)
  const tcxLo = Math.min(minTile.tcx, maxTile.tcx)
  const tcxHi = Math.max(minTile.tcx, maxTile.tcx)
  const tcyLo = Math.min(minTile.tcy, maxTile.tcy)
  const tcyHi = Math.max(minTile.tcy, maxTile.tcy)

  const passable = (tcx: number, tcy: number) =>
    tcx >= tcxLo && tcx <= tcxHi && tcy >= tcyLo && tcy <= tcyHi &&
    isTilePassable(obstacleTiles, roadTiles, tcx, tcy, profile, swims)

  // BFS from every passable tile in the x=0 (player base) row, across the
  // full lateral range, to any tile in the x=LANE_WIDTH (opponent base) row.
  const startTcy = gameToTile(0, 0).tcy
  const goalTcy = gameToTile(LANE_WIDTH, 0).tcy

  const visited = new Set<string>()
  const queue: TileKey[] = []
  for (let tcx = tcxLo; tcx <= tcxHi; tcx++) {
    if (passable(tcx, startTcy)) {
      const key = tileKeyStr(tcx, startTcy)
      if (!visited.has(key)) { visited.add(key); queue.push({ tcx, tcy: startTcy }) }
    }
  }

  const deltas = [-1, 0, 1]
  let qi = 0
  while (qi < queue.length) {
    const { tcx, tcy } = queue[qi++]
    if (tcy === goalTcy) return { reachable: true }
    for (const dtx of deltas) {
      for (const dty of deltas) {
        if (dtx === 0 && dty === 0) continue
        const ntx = tcx + dtx
        const nty = tcy + dty
        if (!passable(ntx, nty)) continue
        const key = tileKeyStr(ntx, nty)
        if (visited.has(key)) continue
        visited.add(key)
        queue.push({ tcx: ntx, tcy: nty })
      }
    }
  }
  return { reachable: false }
}

export interface ReachabilityReport {
  ground: ReachabilityResult
  flying: ReachabilityResult
  burrowing: ReachabilityResult
}

/**
 * Checks all three movement profiles. `swim`-tagged ground units aren't given
 * a separate check: removing a blocker (water, for swimmers) can only ever
 * ADD reachable paths relative to plain ground, so ground-reachable implies
 * swim-ground-reachable too.
 */
export function checkAllProfilesReachable(terrain: TerrainObstacle[], roads: RoadDef[]): ReachabilityReport {
  return {
    ground: checkReachability(terrain, roads, 'ground', false),
    flying: checkReachability(terrain, roads, 'flying', false),
    burrowing: checkReachability(terrain, roads, 'burrowing', false),
  }
}

/**
 * Procedural counterpart to the battlefield editor's "validate on save" step.
 *
 * Authored terrain opts into hard tile-based blocking via a `terrainValidated`
 * flag the editor only sets once checkAllProfilesReachable() confirms the lane
 * isn't sealed. A procedural scatter has no authored layout for anyone to have
 * vetted, so it could never carry that flag and stayed on legacy soft avoidance
 * — which is why units walked straight through rocks/trees/water in Quick Play
 * and every other battle without hand-placed terrain.
 *
 * This enforces the same guarantee at generation time. generateTerrain's tuning
 * (see TERRAIN_CLEAR_HALF / TERRAIN_MAX_RADIUS there) already leaves most
 * scatters traversable; for the rest, drop the widest obstacle — the one
 * rasterizing to the most tile columns, so the likeliest culprit — and
 * re-check. This always terminates: an empty field is trivially passable. The
 * result is therefore safe to hard-block unconditionally.
 *
 * Lives here rather than alongside generateTerrain so that ./terrain stays a
 * leaf module — importing this one from there would close a runtime import
 * cycle via game/types.
 */
export function generatePassableTerrain(
  seed?: string,
  environment?: string,
  roads: RoadDef[] = [],
): TerrainObstacle[] {
  const obstacles = generateTerrain(seed, environment)
  const passable = () => {
    const report = checkAllProfilesReachable(obstacles, roads)
    return report.ground.reachable && report.burrowing.reachable
  }
  while (obstacles.length > 0 && !passable()) {
    let widest = 0
    for (let i = 1; i < obstacles.length; i++) {
      if (obstacles[i].radius > obstacles[widest].radius) widest = i
    }
    obstacles.splice(widest, 1)
  }
  return obstacles
}
