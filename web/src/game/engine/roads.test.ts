/**
 * Unit tests for computeRoadWaypoints (engine/roads.ts) — the pure path-computation
 * helper behind road-following movement (see engine/units.ts).
 */
import { describe, it, expect } from 'vitest'
import { computeRoadWaypoints } from './roads'
import { RoadDef } from './terrain'

describe('computeRoadWaypoints', () => {
  it('returns undefined when no roads are authored', () => {
    expect(computeRoadWaypoints(50, 0, 500, undefined)).toBeUndefined()
    expect(computeRoadWaypoints(50, 0, 500, [])).toBeUndefined()
  })

  it('skips degenerate (single-point) roads', () => {
    const roads: RoadDef[] = [{ points: [{ x: 100, y: 0 }] }]
    expect(computeRoadWaypoints(50, 0, 500, roads)).toBeUndefined()
  })

  it('spawn exactly on a vertex drops the redundant zero-length leading waypoint and walks the rest forward toward the goal', () => {
    const roads: RoadDef[] = [{ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }] }]
    const wps = computeRoadWaypoints(100, 0, 500, roads)
    // The first waypoint would otherwise be (100,0) — identical to the spawn point, which
    // would make the caller's target-distance zero and stall movement forever — so it's
    // dropped, leaving only the real remaining step(s).
    expect(wps).toEqual([{ x: 200, y: 0 }])
  })

  it('projects an off-segment spawn perpendicular onto the segment, clamped to its ends', () => {
    const roads: RoadDef[] = [{ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }]
    // Spawn is above the midpoint of the segment — nearest point is (50, 0), not extrapolated.
    const wps = computeRoadWaypoints(50, 30, 500, roads)!
    expect(wps[0].x).toBeCloseTo(50)
    expect(wps[0].y).toBeCloseTo(0)

    // Spawn is beyond the segment's end (x=150) — nearest point clamps to the endpoint (100,0),
    // not an extrapolated point past it.
    const wpsBeyond = computeRoadWaypoints(150, 30, 500, roads)!
    expect(wpsBeyond[0].x).toBeCloseTo(100)
    expect(wpsBeyond[0].y).toBeCloseTo(0)
  })

  it('picks the walk direction toward whichever endpoint is closer to goalX', () => {
    const roads: RoadDef[] = [{ points: [{ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 300, y: 0 }] }]

    // Opponent-owned unit walking toward the player base (goalX=0): endpoint x=100 is closer to
    // 0 than x=300 is, so direction is backward (toward decreasing index) from the spawn point.
    // The spawn-coincident leading waypoint (200,0) is dropped for the same reason as above.
    const wpsToPlayerBase = computeRoadWaypoints(200, 0, 0, roads)
    expect(wpsToPlayerBase).toEqual([{ x: 100, y: 0 }])

    // Player-owned unit walking toward the opponent base (goalX=500): endpoint x=300 is closer,
    // so direction is forward (toward increasing index).
    const wpsToOpponentBase = computeRoadWaypoints(200, 0, 500, roads)
    expect(wpsToOpponentBase).toEqual([{ x: 300, y: 0 }])
  })

  it('drops the leading waypoint when the spawn point already sits on the road, so movement never stalls at distance zero', () => {
    const roads: RoadDef[] = [{ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }] }]
    // Spawn exactly at x=100 — a target equal to the unit's own position would make
    // moveUnits's distance-to-target zero and stall it forever, so this waypoint is elided.
    const wps = computeRoadWaypoints(100, 0, 500, roads)
    expect(wps).toEqual([{ x: 200, y: 0 }])
  })

  it('a road that stops short of the goal simply ends there (no extrapolation past authored points)', () => {
    const roads: RoadDef[] = [{ points: [{ x: 150, y: 0 }, { x: 350, y: 0 }] }]
    const wps = computeRoadWaypoints(150, 0, 500, roads)
    // Spawn coincides with the road's own start point, so that leading waypoint is dropped too.
    expect(wps).toEqual([{ x: 350, y: 0 }])
  })

  it('keeps the leading projected point when the spawn is off the road (real distance to close)', () => {
    const roads: RoadDef[] = [{ points: [{ x: 150, y: 0 }, { x: 350, y: 0 }] }]
    const wps = computeRoadWaypoints(150, 30, 500, roads)
    expect(wps).toEqual([{ x: 150, y: 0 }, { x: 350, y: 0 }])
  })

  it('picks the globally nearest segment across multiple roads', () => {
    const farRoad: RoadDef = { points: [{ x: 0, y: 60 }, { x: 100, y: 60 }] }
    const nearRoad: RoadDef = { points: [{ x: 0, y: 5 }, { x: 100, y: 5 }] }
    const wps = computeRoadWaypoints(50, 0, 500, [farRoad, nearRoad])!
    expect(wps[0].y).toBeCloseTo(5)
  })
})
