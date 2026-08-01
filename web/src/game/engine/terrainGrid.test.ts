import { describe, it, expect } from 'vitest'
import {
  gameToTile, gameToContainingTile, tileToGame, buildObstacleTileMap, buildRoadTileMap,
  isTilePassable, checkReachability, checkAllProfilesReachable, laneTileBounds,
  GRID_REF_WIDTH, GRID_REF_HEIGHT,
} from './terrainGrid'
import { LANE_ASPECT_RATIO } from '../types'
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

describe('a collision tile is the same pixels as a drawn tile', () => {
  // The reason the lane is letterboxed to a fixed shape (LANE_ASPECT_RATIO, see
  // components/battle/Battlefield.tsx). Terrain art draws SQUARE tiles sized off
  // the lane's height — TILE_SIZE * h/GRID_REF_HEIGHT, the tileScale in
  // BattlefieldCanvas.tsx — while a collision tile spans TILE_SIZE * w/GRID_REF_WIDTH.
  // Those are only equal when the lane's own w/h is GRID_REF_WIDTH/GRID_REF_HEIGHT.
  // While the lane's shape was free to drift (fixed-px HUD bands over a fixed-ratio
  // frame), collision tiles were up to 1.55x wider than the rock actually drawn.
  const TILE = 32

  it('the reference grid is the shape the lane is letterboxed to', () => {
    expect(GRID_REF_WIDTH / GRID_REF_HEIGHT).toBeCloseTo(LANE_ASPECT_RATIO, 10)
  })

  it('collision tile width equals drawn tile size at every lane size', () => {
    for (const h of [318, 446, 567, 654, 766, 886]) {
      const w = h * LANE_ASPECT_RATIO
      const drawnTileSize = TILE * (h / GRID_REF_HEIGHT) // tileScale in BattlefieldCanvas.tsx
      expect(TILE * (w / GRID_REF_WIDTH)).toBeCloseTo(drawnTileSize, 10)
      expect(TILE * (h / GRID_REF_HEIGHT)).toBeCloseTo(drawnTileSize, 10)
    }
  })

  it('a point resolves to the same tile index through either grid', () => {
    // Rendering converts game -> live canvas px with the lane's real w/h
    // (utils/terrainLayer.ts's gameToPixel) and snaps by the drawn tile size;
    // collision converts against the reference grid and snaps by TILE_SIZE.
    // Same index, or an obstacle's art and its blocking disc are a tile apart.
    const h = 567
    const w = h * LANE_ASPECT_RATIO
    const drawnTileSize = TILE * (h / GRID_REF_HEIGHT)
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * 500
      const y = Math.random() * 160 - 80
      const livePx = (0.5 + (y / 80) * 0.36) * w
      const livePy = (1 - x / 500) * h
      expect(gameToTile(x, y)).toEqual({
        tcx: Math.round(livePx / drawnTileSize),
        tcy: Math.round(livePy / drawnTileSize),
      })
      expect(gameToContainingTile(x, y)).toEqual({
        tcx: Math.floor(livePx / drawnTileSize),
        tcy: Math.floor(livePy / drawnTileSize),
      })
    }
  })
})

describe('tile containment matches the band a tile is drawn over', () => {
  // A tile sprite is drawn top-left at c*TILE_SIZE, so tile c covers
  // [c*T, (c+1)*T). Resolving a position by rounding instead put every
  // containment test half a tile off the art — units stopped short of a rock on
  // one side and walked into it on the other.
  const TILE = 32
  const GRID_REF_H = 845
  const GRID_REF_W = Math.round(GRID_REF_H * (544 / 845)) // LANE_ASPECT_RATIO
  const gameToPx = (x: number, y: number) => ({
    px: (0.5 + (y / 80) * 0.36) * GRID_REF_W,
    py: (1 - x / 500) * GRID_REF_H,
  })

  it('a point always lies inside the pixel band of its containing tile', () => {
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * 500
      const y = Math.random() * 160 - 80
      const { tcx, tcy } = gameToContainingTile(x, y)
      const { px, py } = gameToPx(x, y)
      expect(px).toBeGreaterThanOrEqual(tcx * TILE)
      expect(px).toBeLessThan((tcx + 1) * TILE)
      expect(py).toBeGreaterThanOrEqual(tcy * TILE)
      expect(py).toBeLessThan((tcy + 1) * TILE)
    }
  })

  it('tileToGame returns a centre its own tile contains', () => {
    // The flow field steers units at tileToGame's result and then re-checks the
    // step with containment, so a corner would sit where four tiles meet.
    const { tcxLo, tcxHi, tcyLo, tcyHi } = laneTileBounds()
    for (let tcx = tcxLo; tcx <= tcxHi; tcx++) {
      for (let tcy = tcyLo; tcy <= tcyHi; tcy++) {
        const { x, y } = tileToGame(tcx, tcy)
        expect(gameToContainingTile(x, y)).toEqual({ tcx, tcy })
      }
    }
  })

  it('keeps anchoring on rounding, so art and collision pick the same tile', () => {
    // utils/terrainLayer.ts chooses an obstacle's patch tile with Math.round;
    // gameToTile must keep matching it, or an obstacle's art and its blocking
    // disc land a whole tile apart.
    for (let i = 0; i < 2000; i++) {
      const x = 90 + Math.random() * 320
      const y = Math.random() * 160 - 80
      const { px, py } = gameToPx(x, y)
      expect(gameToTile(x, y)).toEqual({ tcx: Math.round(px / TILE), tcy: Math.round(py / TILE) })
    }
  })

  it('the lane covers every column a unit can stand in, including the edges', () => {
    const { tcxLo, tcxHi } = laneTileBounds()
    for (const y of [-80, -40, 0, 40, 80]) {
      const { tcx } = gameToContainingTile(250, y)
      expect(tcx).toBeGreaterThanOrEqual(tcxLo)
      expect(tcx).toBeLessThanOrEqual(tcxHi)
    }
  })
})
