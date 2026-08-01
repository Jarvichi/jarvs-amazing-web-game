import { describe, it, expect } from 'vitest'
import {
  gameToTile, buildObstacleTileMap, buildRoadTileMap, isTilePassable,
  checkReachability, checkAllProfilesReachable,
} from './terrainGrid'
import type { TerrainObstacle, RoadDef } from './terrain'

describe('buildObstacleTileMap', () => {
  it('covers the obstacle centre tile with its type and default zIndex 0', () => {
    const map = buildObstacleTileMap([{ id: 't1', type: 'rock', x: 250, y: 0, radius: 20 }])
    const center = gameToTile(250, 0)
    const tile = map.get(`${center.tcx},${center.tcy}`)
    expect(tile).toEqual({ type: 'rock', zIndex: 0 })
  })

  it('a higher-zIndex obstacle wins a contested tile over a lower one', () => {
    const map = buildObstacleTileMap([
      { id: 't1', type: 'rock', x: 250, y: 0, radius: 20, zIndex: 0 },
      { id: 't2', type: 'water', x: 250, y: 0, radius: 20, zIndex: 5 },
    ])
    const center = gameToTile(250, 0)
    expect(map.get(`${center.tcx},${center.tcy}`)?.type).toBe('water')
  })
})

describe('buildRoadTileMap', () => {
  it('covers tiles along the road centerline with its zIndex (default 1)', () => {
    const road: RoadDef = { points: [{ x: 10, y: 0 }, { x: 490, y: 0 }] }
    const map = buildRoadTileMap([road])
    const mid = gameToTile(250, 0)
    expect(map.get(`${mid.tcx},${mid.tcy}`)).toBe(1)
  })
})

describe('isTilePassable', () => {
  it('a tile with no obstacle is always passable', () => {
    expect(isTilePassable(new Map(), new Map(), 0, 0, 'ground', false)).toBe(true)
  })

  it('rock blocks ground but not burrowing', () => {
    const obstacleTiles = new Map([['0,0', { type: 'rock' as const, zIndex: 0 }]])
    expect(isTilePassable(obstacleTiles, new Map(), 0, 0, 'ground', false)).toBe(false)
    expect(isTilePassable(obstacleTiles, new Map(), 0, 0, 'burrowing', false)).toBe(true)
  })

  it('water blocks ground and burrowing unless ground unit swims', () => {
    const obstacleTiles = new Map([['0,0', { type: 'water' as const, zIndex: 0 }]])
    expect(isTilePassable(obstacleTiles, new Map(), 0, 0, 'ground', false)).toBe(false)
    expect(isTilePassable(obstacleTiles, new Map(), 0, 0, 'ground', true)).toBe(true)
    expect(isTilePassable(obstacleTiles, new Map(), 0, 0, 'burrowing', false)).toBe(false)
  })

  it('a higher-zIndex road bridges a blocking obstacle', () => {
    const obstacleTiles = new Map([['0,0', { type: 'water' as const, zIndex: 0 }]])
    const roadTiles = new Map([['0,0', 1]])
    expect(isTilePassable(obstacleTiles, roadTiles, 0, 0, 'ground', false)).toBe(true)
  })

  it('a road with equal or lower zIndex does not bridge', () => {
    const obstacleTiles = new Map([['0,0', { type: 'water' as const, zIndex: 2 }]])
    const roadTiles = new Map([['0,0', 2]])
    expect(isTilePassable(obstacleTiles, roadTiles, 0, 0, 'ground', false)).toBe(false)
  })
})

describe('checkReachability / checkAllProfilesReachable', () => {
  it('a small obstacle that does not span the whole lane is easily bypassed', () => {
    const terrain: TerrainObstacle[] = [{ id: 't1', type: 'rock', x: 250, y: 0, radius: 20 }]
    const report = checkAllProfilesReachable(terrain, [])
    expect(report.ground.reachable).toBe(true)
    expect(report.flying.reachable).toBe(true)
    expect(report.burrowing.reachable).toBe(true)
  })

  it('a lane-spanning rock wall blocks ground but not burrowing/flying', () => {
    const terrain: TerrainObstacle[] = [{ id: 't1', type: 'rock', x: 250, y: 0, radius: 250 }]
    expect(checkReachability(terrain, [], 'ground', false).reachable).toBe(false)
    expect(checkReachability(terrain, [], 'burrowing', false).reachable).toBe(true)
    expect(checkReachability(terrain, [], 'flying', false).reachable).toBe(true)
  })

  it('a lane-spanning water wall blocks ground and burrowing unless swim/flying', () => {
    const terrain: TerrainObstacle[] = [{ id: 't1', type: 'water', x: 250, y: 0, radius: 250 }]
    expect(checkReachability(terrain, [], 'ground', false).reachable).toBe(false)
    expect(checkReachability(terrain, [], 'ground', true).reachable).toBe(true)
    expect(checkReachability(terrain, [], 'burrowing', false).reachable).toBe(false)
    expect(checkReachability(terrain, [], 'flying', false).reachable).toBe(true)
  })

  it('a bridging road re-opens a lane-spanning water wall for ground units', () => {
    const terrain: TerrainObstacle[] = [{ id: 't1', type: 'water', x: 250, y: 0, radius: 250 }]
    const roads: RoadDef[] = [{ points: [{ x: 5, y: 0 }, { x: 495, y: 0 }] }] // default zIndex 1 > obstacle default 0
    expect(checkReachability(terrain, roads, 'ground', false).reachable).toBe(true)
  })

  it('a road with an explicitly lower zIndex than the obstacle does not bridge it', () => {
    const terrain: TerrainObstacle[] = [{ id: 't1', type: 'water', x: 250, y: 0, radius: 250, zIndex: 5 }]
    const roads: RoadDef[] = [{ points: [{ x: 5, y: 0 }, { x: 495, y: 0 }], zIndex: 1 }]
    expect(checkReachability(terrain, roads, 'ground', false).reachable).toBe(false)
  })
})

describe('obstacle tile footprint matches what is drawn', () => {
  // utils/terrainPatchPlan.ts gives ruins no patch tileset in any environment —
  // they render as a single WORLD_DECOR icon on their centre tile. Blocking the
  // patch-sized disc anyway walled off up to 29 tiles behind a one-tile icon.
  it('a ruin blocks only the tile its icon occupies, at any radius', () => {
    for (const radius of [18, 22, 26, 28, 32]) {
      const map = buildObstacleTileMap([{ id: 't1', type: 'ruin', x: 250, y: 0, radius }])
      expect(map.size).toBe(1)
      const centre = gameToTile(250, 0)
      expect(map.get(`${centre.tcx},${centre.tcy}`)?.type).toBe('ruin')
    }
  })

  it('patch-drawing types still block the full disc they autotile', () => {
    // rock/tree/water fill the same disc they block, so their footprint must
    // keep scaling with radius rather than collapsing to a single tile.
    for (const type of ['rock', 'tree', 'water'] as const) {
      const small = buildObstacleTileMap([{ id: 't1', type, x: 250, y: 0, radius: 18 }]).size
      const large = buildObstacleTileMap([{ id: 't1', type, x: 250, y: 0, radius: 28 }]).size
      expect(small).toBeGreaterThan(1)
      expect(large).toBeGreaterThan(small)
    }
  })
})
