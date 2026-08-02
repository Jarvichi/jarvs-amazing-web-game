// Pure grid-layout geometry for the campaign node map. Deliberately free of
// PixiJS (and of NodeMapRederer.tsx, which imports it) so it stays importable
// from plain node-environment tests.
import { TILE_SIZE } from '../../../data/tiles/tileIndex'
import type { QuestNode } from '../../../game/questline'

export interface PixelPoint { x: number; y: number }
export interface TileCorner { tx: number; ty: number }

export const COL_WIDTH      = 128
export const ROW_HEIGHT     = 96
export const AVATAR_PADDING = 80
export const CONN_W         = 32

// Everything the map draws on the ground — roads, node markers, the avatar — is
// snapped to the centre of a 32px tile. Without this a row whose rowCols parity
// differs from maxRowCols gets a half-row offset, landing the node centre on a
// tile *boundary* while the road tiles under it are laid at floor(y / TILE_SIZE)
// — a visible 16px gap between the node and its own path. Flooring (rather than
// rounding) picks the same tile the road already occupies, so the roads stay put
// and the nodes move onto them.
export function snapToTile(v: number): number {
  return Math.floor(v / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2
}

// The single source of truth for where a grid-mode node sits. Node markers, road
// tiles and connector beziers all read from this, so they cannot drift apart.
export function nodeCenter(
  rowIndex: number, col: number, rowCols: number, maxRowCols: number,
): { x: number; y: number } {
  const vrow = (maxRowCols - rowCols) / 2 + col
  return {
    x: snapToTile(AVATAR_PADDING + rowIndex * (COL_WIDTH + CONN_W) + COL_WIDTH / 2),
    y: snapToTile((vrow + 0.5) * ROW_HEIGHT),
  }
}

export function startPos(mapHeight: number): { x: number; y: number } {
  return { x: AVATAR_PADDING / 2, y: snapToTile(mapHeight / 2) }
}

// ── Road geometry ─────────────────────────────────────────────────────────────
// Roads are laid as axis-aligned runs of tiles between "corners". Everything
// that needs to know where a road physically goes — the tile renderer, the fog
// reveal, and the avatar's walk route — derives it from these, so none of them
// can drift out of sync with the art.

// The single-bend elbow between two points: horizontal at a's row, vertical
// at the midpoint column, horizontal at b's row — as 4 corner tile coords.
export function elbowCorners(a: PixelPoint, b: PixelPoint, T: number): TileCorner[] {
  const aTx = Math.floor(a.x / T), aTy = Math.floor(a.y / T)
  const bTx = Math.floor(b.x / T), bTy = Math.floor(b.y / T)
  const midTx = Math.floor((a.x + b.x) / 2 / T)
  return [{ tx: aTx, ty: aTy }, { tx: midTx, ty: aTy }, { tx: midTx, ty: bTy }, { tx: bTx, ty: bTy }]
}

// Full corner-tile list for an edge, optionally steered through hand-authored
// waypoints (see QuestNode.connectionWaypoints). With no waypoints this is
// exactly elbowCorners(node, target, T) — a single bend.
export function edgeCorners(
  node: PixelPoint, target: PixelPoint, waypoints: PixelPoint[] | undefined, T: number,
): TileCorner[] {
  const pts = [node, ...(waypoints ?? []), target]
  const corners: TileCorner[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = elbowCorners(pts[i], pts[i + 1], T)
    corners.push(...(i === 0 ? seg : seg.slice(1))) // dedupe the shared join corner
  }
  return corners
}

// Corner tiles → a pixel polyline tracing the road they describe. Interior
// bends snap to their tile center (matching the drawn tile); the two endpoints
// stay at their real pixel position so the line starts and ends dead on the
// node. Sharing this with the walk routes means the avatar physically follows
// the road art rather than an independently-derived approximation of it.
export function cornerPolyline(corners: TileCorner[], from: PixelPoint, to: PixelPoint): PixelPoint[] {
  const last = corners.length - 1
  return corners.map((c, i) => ({
    x: i === 0 ? from.x : i === last ? to.x : c.tx * TILE_SIZE + TILE_SIZE / 2,
    y: i === 0 ? from.y : i === last ? to.y : c.ty * TILE_SIZE + TILE_SIZE / 2,
  }))
}

// Fills every tile along a corner-to-corner path, where each consecutive
// pair shares either a row (ty) or a column (tx) — guaranteed by elbowCorners.
export function fillCornerPath(
  pathSet: Set<string>, key: (tx: number, ty: number) => string, corners: TileCorner[],
): void {
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i], b = corners[i + 1]
    if (a.ty === b.ty) {
      for (let tx = Math.min(a.tx, b.tx); tx <= Math.max(a.tx, b.tx); tx++) pathSet.add(key(tx, a.ty))
    } else {
      for (let ty = Math.min(a.ty, b.ty); ty <= Math.max(a.ty, b.ty); ty++) pathSet.add(key(a.tx, ty))
    }
  }
}

// ── Travel routing ────────────────────────────────────────────────────────────

// Undirected adjacency over node connections — the data lists an edge on one
// endpoint only, but roads are drawn (and walked) in both directions.
function buildAdjacency(nodes: Record<string, QuestNode>): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set())
    adj.get(a)!.add(b)
  }
  for (const node of Object.values(nodes)) {
    for (const connId of (node.connections ?? node.childIds ?? [])) {
      if (!nodes[connId]) continue
      link(node.id, connId)
      link(connId, node.id)
    }
  }
  return adj
}

// Shortest chain of connected nodes between two ids, so world-map travel walks
// the roads through the towns in between instead of cutting across country.
// Returns null when the two are not connected at all.
export function connectionRoute(
  nodes: Record<string, QuestNode>, fromId: string, toId: string,
): QuestNode[] | null {
  if (fromId === toId || !nodes[fromId] || !nodes[toId]) return null
  const adj = buildAdjacency(nodes)
  const prev = new Map<string, string>()
  const seen = new Set([fromId])
  const queue = [fromId]
  while (queue.length) {
    const id = queue.shift()!
    if (id === toId) break
    for (const next of adj.get(id) ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      prev.set(next, id)
      queue.push(next)
    }
  }
  if (!seen.has(toId)) return null
  const chain: QuestNode[] = []
  for (let id: string | undefined = toId; id !== undefined; id = prev.get(id)) chain.unshift(nodes[id])
  return chain
}

// Waypoints are authored on one endpoint of an edge; walking the other way
// needs them in reverse.
export function edgeWaypoints(a: QuestNode, b: QuestNode): PixelPoint[] | undefined {
  return a.connectionWaypoints?.[b.id] ?? b.connectionWaypoints?.[a.id]?.slice().reverse()
}

// The full pixel route the avatar walks from `from` to node `toId`, following
// the drawn roads through every town in between.
export function worldWalkRoute(
  nodes: Record<string, QuestNode>, fromId: string, toId: string, from: PixelPoint,
): PixelPoint[] {
  const target = nodes[toId]
  const to = { x: target.x!, y: target.y! }
  const chain = connectionRoute(nodes, fromId, toId)
  if (!chain) return cornerPolyline(edgeCorners(from, to, undefined, TILE_SIZE), from, to)

  const route: PixelPoint[] = []
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i], b = chain[i + 1]
    const ap = i === 0 ? from : { x: a.x!, y: a.y! }
    const bp = { x: b.x!, y: b.y! }
    const leg = cornerPolyline(edgeCorners(ap, bp, edgeWaypoints(a, b), TILE_SIZE), ap, bp)
    route.push(...(i === 0 ? leg : leg.slice(1))) // dedupe the shared join point
  }
  return route
}
