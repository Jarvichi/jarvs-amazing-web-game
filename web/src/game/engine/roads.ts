import { RoadDef } from './terrain'

export interface RoadPoint { x: number; y: number }

// A point closer than this to its neighbour is treated as a duplicate and dropped —
// avoids a zero-length first step when the spawn projects exactly onto a waypoint.
const DEDUPE_EPS = 0.01

/**
 * Nearest point on segment [a,b] to point p, clamped to the segment (never
 * extrapolated beyond a or b).
 */
function closestPointOnSegment(
  px: number, py: number,
  a: RoadPoint, b: RoadPoint,
): { point: RoadPoint; t: number; dist: number } {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const lenSq = abx * abx + aby * aby
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * abx + (py - a.y) * aby) / lenSq))
  const point = { x: a.x + t * abx, y: a.y + t * aby }
  const dist = Math.hypot(px - point.x, py - point.y)
  return { point, t, dist }
}

/**
 * Given a unit's spawn position and the x of the base it's marching toward, find the
 * nearest authored road and build an ordered waypoint queue: the closest point on that
 * road (so the unit walks straight onto it first), followed by the road's remaining
 * points in whichever direction makes progress toward `goalX`.
 *
 * Returns undefined when no usable road exists (no roads authored, or every road has
 * fewer than 2 points) — callers should fall back to the default straight-to-base target.
 */
export function computeRoadWaypoints(
  spawnX: number, spawnY: number,
  goalX: number,
  roads: RoadDef[] | undefined,
): RoadPoint[] | undefined {
  if (!roads || roads.length === 0) return undefined

  let best: { points: RoadPoint[]; segmentIndex: number; point: RoadPoint; t: number; dist: number } | undefined

  for (const road of roads) {
    const points = road.points
    if (!points || points.length < 2) continue
    for (let i = 0; i < points.length - 1; i++) {
      const { point, t, dist } = closestPointOnSegment(spawnX, spawnY, points[i], points[i + 1])
      if (!best || dist < best.dist) best = { points, segmentIndex: i, point, t, dist }
    }
  }
  if (!best) return undefined

  const { points, segmentIndex, point, t } = best
  const last = points.length - 1
  const forward = Math.abs(points[last].x - goalX) <= Math.abs(points[0].x - goalX)

  const waypoints: RoadPoint[] = [point]
  if (forward) {
    // proj lies between points[segmentIndex] and points[segmentIndex+1]; if it landed
    // exactly on the far end (t===1), don't duplicate that point in the tail.
    const tailStart = t >= 1 - DEDUPE_EPS ? segmentIndex + 2 : segmentIndex + 1
    for (let i = tailStart; i <= last; i++) waypoints.push(points[i])
  } else {
    const tailStart = t <= DEDUPE_EPS ? segmentIndex - 1 : segmentIndex
    for (let i = tailStart; i >= 0; i--) waypoints.push(points[i])
  }

  // If the spawn point itself already sits on the road (a very common case — units
  // spawn right at the base, which authors will often anchor a road to), the leading
  // waypoint is a zero-length step. Drop it when there's a real point after it to walk
  // toward, so the unit doesn't get stuck: a target equal to a unit's current position
  // makes moveUnits's distance-based step a no-op every tick, forever.
  if (waypoints.length > 1 && Math.hypot(spawnX - waypoints[0].x, spawnY - waypoints[0].y) <= DEDUPE_EPS) {
    waypoints.shift()
  }
  return waypoints
}
