import { describe, it, expect } from 'vitest'
import { nodeCenter, snapToTile, elbowCorners, edgeCorners, cornerPolyline,
  fillCornerPath, worldWalkRoute, type PixelPoint } from './nodeLayout'
import type { QuestNode } from '../../../game/questline'
import { TILE_SIZE } from '../../../data/tiles/tileIndex'

// Node markers, road tiles and connector beziers are all placed off nodeCenter.
// Road tiles are laid at floor(y / TILE_SIZE), so a node centre that is not on a
// tile centre renders up to half a tile away from its own path — which is what
// used to happen to every row whose rowCols parity differed from maxRowCols.
const onTileCentre = (v: number) => ((v % TILE_SIZE) + TILE_SIZE) % TILE_SIZE === TILE_SIZE / 2

describe('snapToTile', () => {
  it('maps any point to the centre of the tile containing it', () => {
    expect(snapToTile(0)).toBe(16)
    expect(snapToTile(16)).toBe(16)
    expect(snapToTile(31)).toBe(16)
    expect(snapToTile(32)).toBe(48)
    expect(snapToTile(96)).toBe(112)
  })
})

describe('nodeCenter', () => {
  it('lands on a tile centre for rows matching maxRowCols parity', () => {
    for (const col of [0, 1, 2, 3]) {
      const { x, y } = nodeCenter(2, col, 4, 4)
      expect(onTileCentre(x)).toBe(true)
      expect(onTileCentre(y)).toBe(true)
    }
  })

  // The regression: rowCols 3 inside maxRowCols 4 offsets the row by half a
  // cell, which used to put node centres on a tile boundary 16px off the road.
  it('lands on a tile centre for parity-mismatched rows', () => {
    for (const col of [0, 1, 2]) {
      const { x, y } = nodeCenter(1, col, 3, 4)
      expect(onTileCentre(x)).toBe(true)
      expect(onTileCentre(y)).toBe(true)
    }
  })

  it('covers every row shape the shipped acts use', () => {
    for (let maxRowCols = 1; maxRowCols <= 6; maxRowCols++) {
      for (let rowCols = 1; rowCols <= maxRowCols; rowCols++) {
        for (let col = 0; col < rowCols; col++) {
          for (const ri of [0, 1, 5]) {
            const { x, y } = nodeCenter(ri, col, rowCols, maxRowCols)
            expect(onTileCentre(x)).toBe(true)
            expect(onTileCentre(y)).toBe(true)
          }
        }
      }
    }
  })

  it('keeps distinct columns on distinct tiles', () => {
    const a = nodeCenter(0, 0, 4, 4).y
    const b = nodeCenter(0, 1, 4, 4).y
    expect(a).not.toBe(b)
  })
})

// ── Walk routing ──────────────────────────────────────────────────────────────
// The avatar used to tween straight to the target node, cutting across terrain.
// It now follows the road, which only holds if its route stays on tiles the
// road renderer actually laid — that is what these assert.

const tileKey = (x: number, y: number) =>
  `${Math.floor(x / TILE_SIZE)},${Math.floor(y / TILE_SIZE)}`

// Every tile the road renderer would lay for a single edge.
function roadTilesFor(a: PixelPoint, b: PixelPoint, waypoints?: PixelPoint[]): Set<string> {
  const tiles = new Set<string>()
  fillCornerPath(tiles, (tx, ty) => `${tx},${ty}`, edgeCorners(a, b, waypoints, TILE_SIZE))
  return tiles
}

// Walking a polyline only stays on the road if the tiles it passes through are
// road tiles — sampling densely catches a leg that cuts a corner between them.
function sampledTiles(route: PixelPoint[]): string[] {
  const out: string[] = []
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i]
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)))
    for (let s = 0; s <= steps; s++)
      out.push(tileKey(a.x + (b.x - a.x) * (s / steps), a.y + (b.y - a.y) * (s / steps)))
  }
  return out
}

describe('grid walk route', () => {
  it('bends through the elbow rather than going straight to the node', () => {
    const from = nodeCenter(0, 0, 4, 4)
    const to   = nodeCenter(1, 3, 4, 4)
    const route = cornerPolyline(elbowCorners(from, to, TILE_SIZE), from, to)

    expect(route.length).toBeGreaterThan(2)          // not a single straight leg
    expect(route[0]).toEqual(from)
    expect(route[route.length - 1]).toEqual(to)
    // The turn happens at the midpoint column, holding each node's row first.
    expect(route[1].y).toBe(from.y)
    expect(route[route.length - 2].y).toBe(to.y)
  })

  it('stays on road tiles the whole way', () => {
    const road = roadTilesFor(nodeCenter(0, 0, 4, 4), nodeCenter(1, 3, 4, 4))
    const from = nodeCenter(0, 0, 4, 4), to = nodeCenter(1, 3, 4, 4)
    const route = cornerPolyline(elbowCorners(from, to, TILE_SIZE), from, to)
    for (const tile of sampledTiles(route)) expect(road.has(tile)).toBe(true)
  })

  it('stays on road tiles for every row-to-row pairing', () => {
    for (let fromCol = 0; fromCol < 4; fromCol++) {
      for (let toCol = 0; toCol < 3; toCol++) {
        const from = nodeCenter(0, fromCol, 4, 4)
        const to   = nodeCenter(1, toCol, 3, 4)   // parity-mismatched target row
        const road = roadTilesFor(from, to)
        const route = cornerPolyline(elbowCorners(from, to, TILE_SIZE), from, to)
        for (const tile of sampledTiles(route)) expect(road.has(tile)).toBe(true)
      }
    }
  })
})

describe('world walk route', () => {
  const nodes: Record<string, QuestNode> = {
    a: { id: 'a', x: 100, y: 100, connections: ['b'] } as QuestNode,
    b: { id: 'b', x: 400, y: 300, connections: ['c'] } as QuestNode,
    c: { id: 'c', x: 700, y: 100 } as QuestNode,
  }

  it('routes through intermediate towns instead of cutting across country', () => {
    const from = { x: 100, y: 100 }
    const route = worldWalkRoute(nodes, 'a', 'c', from)
    // It must actually pass through b rather than heading straight for c.
    expect(route.some(p => p.x === 400 && p.y === 300)).toBe(true)
    expect(route[route.length - 1]).toEqual({ x: 700, y: 100 })
  })

  it('stays on the roads drawn for each leg it crosses', () => {
    const road = new Set([
      ...roadTilesFor({ x: 100, y: 100 }, { x: 400, y: 300 }),
      ...roadTilesFor({ x: 400, y: 300 }, { x: 700, y: 100 }),
    ])
    for (const tile of sampledTiles(worldWalkRoute(nodes, 'a', 'c', { x: 100, y: 100 })))
      expect(road.has(tile)).toBe(true)
  })

  it('follows an edge in reverse using the waypoints authored on the far end', () => {
    const wp = [{ x: 250, y: 100 }]
    const withWp: Record<string, QuestNode> = {
      ...nodes,
      b: { ...nodes.b, connectionWaypoints: { a: wp } } as QuestNode,
    }
    // Authored a→b as b's waypoints; walking a→b must reverse them, and the
    // route must sit on the road drawn for that same bend.
    const road = roadTilesFor({ x: 100, y: 100 }, { x: 400, y: 300 }, [...wp].reverse())
    for (const tile of sampledTiles(worldWalkRoute(withWp, 'a', 'b', { x: 100, y: 100 })))
      expect(road.has(tile)).toBe(true)
  })

  it('falls back to a direct elbow when two towns are not connected', () => {
    const isolated: Record<string, QuestNode> = {
      a: { id: 'a', x: 100, y: 100 } as QuestNode,
      z: { id: 'z', x: 600, y: 400 } as QuestNode,
    }
    const route = worldWalkRoute(isolated, 'a', 'z', { x: 100, y: 100 })
    expect(route[route.length - 1]).toEqual({ x: 600, y: 400 })
  })
})
