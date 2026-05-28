// A* pathfinder over the hub world street tile graph.

type Tile = [number, number]

const DIRS: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]]

function key(tx: number, ty: number): string { return `${tx},${ty}` }

/**
 * Finds the shortest path from `start` to `end` using A* over a set of
 * walkable tiles. Returns an array of [tx,ty] pairs from start to end
 * (inclusive). Returns [start] when no path exists.
 */
export function findPath(start: Tile, end: Tile, walkable: Set<string>): Tile[] {
  const startKey = key(...start)
  const endKey   = key(...end)
  if (startKey === endKey) return [start]
  if (!walkable.has(endKey)) return [start]

  const g    = new Map<string, number>([[startKey, 0]])
  const prev = new Map<string, string>()
  const pos  = new Map<string, Tile>([[startKey, start]])
  const open = new Set<string>([startKey])
  const closed = new Set<string>()

  const h = (t: Tile) => Math.abs(t[0] - end[0]) + Math.abs(t[1] - end[1])
  const f = (k: string) => (g.get(k) ?? Infinity) + h(pos.get(k)!)

  while (open.size > 0) {
    let current = ''
    let bestF   = Infinity
    for (const k of open) { const fk = f(k); if (fk < bestF) { bestF = fk; current = k } }

    if (current === endKey) {
      const path: Tile[] = []
      let c: string | undefined = current
      while (c) { path.unshift(pos.get(c)!); c = prev.get(c) }
      return path
    }

    open.delete(current)
    closed.add(current)
    const [cx, cy] = pos.get(current)!
    const gCur = g.get(current)!

    for (const [dx, dy] of DIRS) {
      const nk = key(cx + dx, cy + dy)
      if (!walkable.has(nk) || closed.has(nk)) continue
      const ng = gCur + 1
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng)
        prev.set(nk, current)
        pos.set(nk, [cx + dx, cy + dy])
        open.add(nk)
      }
    }
  }

  return [start]
}

/**
 * Finds the nearest walkable tile to a pixel position using BFS.
 * If the tile under `(px,py)` is already walkable it is returned immediately.
 */
export function nearestWalkable(
  px: number,
  py: number,
  walkable: Set<string>,
  tileSize: number,
): Tile {
  const tx0 = Math.floor(px / tileSize)
  const ty0 = Math.floor(py / tileSize)
  if (walkable.has(key(tx0, ty0))) return [tx0, ty0]

  const visited = new Set<string>([key(tx0, ty0)])
  const queue: Tile[] = [[tx0, ty0]]

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy
      const nk = key(nx, ny)
      if (visited.has(nk)) continue
      visited.add(nk)
      if (walkable.has(nk)) return [nx, ny]
      queue.push([nx, ny])
    }
  }

  return [tx0, ty0]
}
