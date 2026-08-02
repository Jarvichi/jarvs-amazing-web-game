import { TERRAIN_PATCH_MAP } from '../data/tiles/worldTileIndex'
import type { TerrainObstacle, TerrainType } from '../game/engine/terrain'

/** One opening torn through a 'cloud' surface — the disc an obstacle blocks. */
export interface SkyHole {
  /** Centre tile, from the caller's projection. */
  tcx: number
  tcy: number
  /** Blocked radius in tiles. 0 means the centre tile alone. */
  tileRadius: number
}

/**
 * Turns battlefield terrain obstacles into the openings a 'cloud' surface
 * environment (see EnvTileDef.surface) tears through its cloud floor —
 * utils/skyLayer.ts's drawCloudHoles draws the result.
 *
 * Unlike planTerrainPatches there is no per-type tileset to split on: up in the
 * clouds every obstacle is the same absence of floor, so all four types come
 * back in one list and overlapping obstacles merge into a single opening when
 * drawn. Ruins are included — they have no patch tileset anywhere, so
 * planTerrainPatches renders them as a lone icon, but a hole is not an icon.
 *
 * Discs, not tiles: the cloud floor has no grid to align to, so skyLayer draws
 * each hole as a round shape rather than a run of squares. The centre and radius
 * still come from the caller's tile projection, which is what keeps the art on
 * the same disc game/engine/terrainGrid.ts blocks.
 *
 * Ruins get tileRadius 0, mirroring the explicit ruin case in that module's
 * obstacleTileRadius: their centre tile is the only one they block, and a hole
 * drawn wider than that is a gap units walk straight across.
 *
 * Pixi-free, like planTerrainPatches, so the geometry stays unit-testable in Node.
 *
 * @param toTile        obstacle → its centre tile coords (canvas projection)
 * @param tileRadiusOf  obstacle → disc radius in tiles
 */
export function planSkyHoles(
  terrain: TerrainObstacle[],
  toTile: (obs: TerrainObstacle) => { tcx: number; tcy: number },
  tileRadiusOf: (obs: TerrainObstacle) => number,
): SkyHole[] {
  return terrain.map(obs => ({
    ...toTile(obs),
    tileRadius: obs.type === 'ruin' ? 0 : tileRadiusOf(obs),
  }))
}

/**
 * A set of tiles that autotile together as one shape. Obstacles sharing a
 * tileset are unioned into a single group so touching patches render as one
 * continuous body (one outer shoreline / tree line) instead of each obstacle
 * drawing its own edge against its neighbour — the same grouping buildRoadGfx
 * applies to roads.
 */
export interface TerrainPatchGroup {
  patchFile: string
  /** true → renderPathTiles (water); false → renderSceneryPatch (tree/rock). */
  isPathTiles: boolean
  tiles: Set<string>
}

/** A single WORLD_DECOR icon placed at an obstacle's centre tile. */
export interface TerrainPatchDecor {
  type: TerrainType
  /** Numeric part of the obstacle id — picks the tile variant (idNum % tileIds.length). */
  idNum: number
  tcx: number
  tcy: number
}

export interface TerrainPatchPlan {
  groups: TerrainPatchGroup[]
  decor: TerrainPatchDecor[]
}

/** Ruins have no patch tileset — they're the icon alone. Every patch-bearing
 *  type (water, rock, tree) fills its own centre tile like the rest of the
 *  patch, so merged clusters read as one solid mass with no icon-in-a-hole. */
function hasCentreDecor(type: TerrainType): boolean {
  return type === 'ruin'
}

/**
 * Turns battlefield terrain obstacles into autotile-ready tile sets, without
 * touching PixiJS — buildTerrainDecorGfx (utils/terrainLayer.ts) renders the
 * result, and this stays pure so the tiling rules are unit-testable.
 *
 * Obstacles are walked in array order and claim ring cells first-come, so
 * patches drawn from *different* tilesets carve cleanly around each other
 * rather than overwriting one another into an illegible blob. Cells within the
 * same tileset group simply union — that union is what makes overlapping water
 * read as one lake.
 *
 * @param toTile        obstacle → its centre tile coords (canvas projection)
 * @param tileRadiusOf  obstacle → disc radius in tiles
 * @param env           act environment, selecting the per-type tileset
 */
export function planTerrainPatches(
  terrain: TerrainObstacle[],
  toTile: (obs: TerrainObstacle) => { tcx: number; tcy: number },
  tileRadiusOf: (obs: TerrainObstacle) => number,
  env: string,
): TerrainPatchPlan {
  const envPatchMap = TERRAIN_PATCH_MAP[env] ?? {}
  const patchFileOf = (type: TerrainType) => envPatchMap[type] ?? TERRAIN_PATCH_MAP._default?.[type]

  // Centre cells of decor-bearing obstacles (ruins) are reserved up front so no
  // ring — not even a neighbouring one from the same group — can swallow the
  // cell the icon sits on. Water/rock/tree have no centre icon, so their
  // centres stay fillable, same as the rest of their patch.
  const reservedCentres = new Set<string>()
  for (const obs of terrain) {
    if (!hasCentreDecor(obs.type)) continue
    const { tcx, tcy } = toTile(obs)
    reservedCentres.add(`${tcx},${tcy}`)
  }

  const groups = new Map<string, TerrainPatchGroup>()
  const cellOwner = new Map<string, string>()
  const decor: TerrainPatchDecor[] = []

  for (const obs of terrain) {
    const { tcx, tcy } = toTile(obs)
    const idNum = parseInt(obs.id.replace('t', ''), 10)
    const patchFile = patchFileOf(obs.type)

    if (patchFile) {
      const isPathTiles = obs.type === 'water'
      const groupKey = `${isPathTiles}|${patchFile}`
      let group = groups.get(groupKey)
      if (!group) {
        group = { patchFile, isPathTiles, tiles: new Set() }
        groups.set(groupKey, group)
      }

      const tileRadius = tileRadiusOf(obs)
      for (let dr = -tileRadius; dr <= tileRadius; dr++) {
        for (let dc = -tileRadius; dc <= tileRadius; dc++) {
          if (dr * dr + dc * dc > tileRadius * tileRadius) continue
          const key = `${tcx + dc},${tcy + dr}`
          if (reservedCentres.has(key)) continue
          const owner = cellOwner.get(key)
          if (owner !== undefined && owner !== groupKey) continue
          cellOwner.set(key, groupKey)
          group.tiles.add(key)
        }
      }
    }

    // Ruins have no patch tileset — they are the icon alone.
    if (patchFile ? hasCentreDecor(obs.type) : obs.type === 'ruin') {
      decor.push({ type: obs.type, idNum, tcx, tcy })
    }
  }

  return { groups: Array.from(groups.values()), decor }
}
