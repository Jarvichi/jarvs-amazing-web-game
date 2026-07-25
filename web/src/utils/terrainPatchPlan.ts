import { TERRAIN_PATCH_MAP } from '../data/tiles/worldTileIndex'
import type { TerrainObstacle, TerrainType } from '../game/engine/terrain'

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

/** Water fills its centre tile; every other type reserves it for a decor sprite. */
function hasCentreDecor(type: TerrainType): boolean {
  return type !== 'water'
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

  // Centre cells of decor-bearing obstacles are reserved up front so no ring —
  // not even a neighbouring one from the same group — can swallow the cell the
  // icon sits on. Water has no centre icon, so its centre stays fillable.
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
