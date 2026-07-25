import { describe, it, expect } from 'vitest'
import { planTerrainPatches } from './terrainPatchPlan'
import type { TerrainObstacle, TerrainType } from '../game/engine/terrain'

/** Obstacle whose game coords double as tile coords via the toTile stub below. */
function obs(id: string, type: TerrainType, x: number, y: number): TerrainObstacle {
  return { id, type, x, y, radius: 20 }
}

const toTile = (o: TerrainObstacle) => ({ tcx: o.x, tcy: o.y })
const radius2 = () => 2

describe('planTerrainPatches', () => {
  it('merges overlapping water into one group with no interior shoreline', () => {
    const { groups } = planTerrainPatches(
      [obs('t1', 'water', 10, 10), obs('t2', 'water', 13, 10)],
      toTile, radius2, 'forest',
    )

    expect(groups).toHaveLength(1)
    const { tiles } = groups[0]
    expect(groups[0].isPathTiles).toBe(true)

    // The seam column between the two discs is fully surrounded, so the
    // autotiler sees interior water there rather than two facing shorelines.
    for (const [tx, ty] of [[11, 10], [12, 10]]) {
      expect(tiles.has(`${tx},${ty}`)).toBe(true)
      expect(tiles.has(`${tx},${ty - 1}`)).toBe(true)
      expect(tiles.has(`${tx},${ty + 1}`)).toBe(true)
      expect(tiles.has(`${tx - 1},${ty}`)).toBe(true)
      expect(tiles.has(`${tx + 1},${ty}`)).toBe(true)
    }
  })

  it('fills water centre cells and places no centre icon there', () => {
    const { groups, decor } = planTerrainPatches(
      [obs('t1', 'water', 10, 10), obs('t2', 'water', 13, 10)],
      toTile, radius2, 'forest',
    )

    expect(groups[0].tiles.has('10,10')).toBe(true)
    expect(groups[0].tiles.has('13,10')).toBe(true)
    expect(decor).toHaveLength(0)
  })

  it('keeps mismatched tilesets in separate, non-overlapping groups', () => {
    const { groups, decor } = planTerrainPatches(
      [obs('t1', 'water', 10, 10), obs('t2', 'tree', 12, 10)],
      toTile, radius2, 'forest',
    )

    expect(groups).toHaveLength(2)
    const [water, tree] = groups
    for (const key of water.tiles) expect(tree.tiles.has(key)).toBe(false)

    // The tree's centre cell is reserved for its sprite — in neither tile set.
    expect(tree.tiles.has('12,10')).toBe(false)
    expect(water.tiles.has('12,10')).toBe(false)
    expect(decor).toEqual([{ type: 'tree', idNum: 2, tcx: 12, tcy: 10 }])
  })

  it('emits an icon-only entry for ruins, which have no patch tileset', () => {
    const { groups, decor } = planTerrainPatches([obs('t7', 'ruin', 4, 4)], toTile, radius2, 'forest')

    expect(groups).toHaveLength(0)
    expect(decor).toEqual([{ type: 'ruin', idNum: 7, tcx: 4, tcy: 4 }])
  })
})
