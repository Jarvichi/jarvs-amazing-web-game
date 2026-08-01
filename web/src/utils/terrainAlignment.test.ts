import { describe, it, expect } from 'vitest'
import { anchorTile, patchTileRadius } from './terrainLayer'
import { planTerrainPatches } from './terrainPatchPlan'
import { buildObstacleTileMap, gameToTile, GRID_REF_HEIGHT, GRID_REF_WIDTH } from '../game/engine/terrainGrid'
import { generateTerrain } from '../game/engine/terrain'
import type { TerrainObstacle } from '../game/engine/terrain'

// The battlefield debug overlay exists to answer one question: is a tile that
// blocks a unit the same tile the player can see a rock on? These pin that the
// answer is yes — that the tiles buildTerrainDecorGfx PLANS to draw are exactly
// the tiles terrainGrid BLOCKS, for the same terrain.

const TILE_SIZE = 32
/** Lane heights across the device range; T is derived from each (see tileScale
 *  in components/battle/BattlefieldCanvas.tsx). */
const LANE_HEIGHTS = [318, 446, 529, 569, 654, 766, 886]

/** The tile set buildTerrainDecorGfx draws for `terrain` on a lane of height h. */
function drawnTiles(terrain: TerrainObstacle[], env: string, h: number): Set<string> {
  const tileScale = h / GRID_REF_HEIGHT
  const T = TILE_SIZE * tileScale
  const plan = planTerrainPatches(
    terrain,
    obs => anchorTile(obs.x, obs.y, h * (GRID_REF_WIDTH / GRID_REF_HEIGHT), h, T, tileScale),
    obs => patchTileRadius(obs.radius, h, T, tileScale),
    env,
  )
  const tiles = new Set<string>()
  for (const group of plan.groups) for (const t of group.tiles) tiles.add(t)
  for (const d of plan.decor) tiles.add(`${d.tcx},${d.tcy}`)
  return tiles
}

describe('drawn terrain tiles are the blocked terrain tiles', () => {
  const authored: TerrainObstacle[] = [
    { id: 'r1', type: 'rock', x: 380, y: -60, radius: 26 },
    { id: 'r2', type: 'rock', x: 380, y: 60, radius: 26 },
    // y = 0 is the case that used to break: on the reference grid this lands on
    // an exact half-tile boundary, so the engine rounded it up to one column
    // while the lane canvas's integer pixel width rounded it down to another.
    { id: 'w1', type: 'water', x: 250, y: 0, radius: 28 },
    { id: 't1', type: 'tree', x: 130, y: -50, radius: 24 },
    { id: 't2', type: 'tree', x: 130, y: 50, radius: 24 },
    { id: 'u1', type: 'ruin', x: 300, y: 0, radius: 24 },
  ]

  it.each(LANE_HEIGHTS)('authored terrain lines up at lane height %ipx', h => {
    expect([...drawnTiles(authored, 'forest', h)].sort())
      .toEqual([...buildObstacleTileMap(authored).keys()].sort())
  })

  it('procedural scatter lines up too', () => {
    for (let i = 0; i < 60; i++) {
      const terrain = generateTerrain(`align-${i}`, 'forest')
      expect([...drawnTiles(terrain, 'forest', 569)].sort())
        .toEqual([...buildObstacleTileMap(terrain).keys()].sort())
    }
  })

  it('an obstacle on the lane centre line anchors to the same column either way', () => {
    // The specific half-tile tie that made every centre-line obstacle's art sit
    // a whole column away from its blocking disc.
    for (const h of LANE_HEIGHTS) {
      const T = TILE_SIZE * (h / GRID_REF_HEIGHT)
      const w = Math.round(h * (GRID_REF_WIDTH / GRID_REF_HEIGHT)) // lanes are whole pixels
      expect(anchorTile(250, 0, w, h, T, h / GRID_REF_HEIGHT)).toEqual(gameToTile(250, 0))
    }
  })
})
