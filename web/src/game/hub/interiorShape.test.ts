import { describe, it, expect } from 'vitest'
import { computeInteriorShape, topFacingWallRows, computeWallRenderSet, facadePaintPositions } from './interiorShape'
import { getHubWorldData } from '../../data/hub/hubWorldFactory'

// Reference oracle: the plain-rectangle floor/wall formula HubTownCanvas.tsx
// used before computeInteriorShape existed, copied verbatim. computeInteriorShape
// must reproduce this exactly for every existing interior (carve absent) —
// a regression guard against the generalized algorithm silently changing
// behavior for the 238 already-authored rooms.
function oldFloorSet(width: number, height: number): Set<string> {
  const s = new Set<string>()
  for (let tx = 1; tx < width - 1; tx++)
    for (let ty = 1; ty < height - 1; ty++)
      s.add(`${tx},${ty}`)
  return s
}
function oldWallSet(width: number, height: number): Set<string> {
  const s = new Set<string>()
  for (let tx = 0; tx < width; tx++) {
    s.add(`${tx},0`)
    s.add(`${tx},${height - 1}`)
  }
  for (let ty = 1; ty < height - 1; ty++) {
    s.add(`0,${ty}`)
    s.add(`${width - 1},${ty}`)
  }
  return s
}

function setEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const k of a) if (!b.has(k)) return false
  return true
}

const { locationRegistry } = await getHubWorldData()

describe('computeInteriorShape — plain rectangle regression', () => {
  for (const [townKey, { locationData }] of Object.entries(locationRegistry)) {
    for (const [id, room] of Object.entries(locationData.HUB_INTERIORS)) {
      it(`${townKey}/${id}: matches the old rectangle formula`, () => {
        const { floorSet, wallSet } = computeInteriorShape(room.width, room.height)
        expect(setEqual(floorSet, oldFloorSet(room.width, room.height))).toBe(true)
        expect(setEqual(wallSet, oldWallSet(room.width, room.height))).toBe(true)
        // Every column faces from row 0 — equivalent to the old "top row is
        // unbroken" check, so themed back-wall output is unchanged for all
        // already-authored (uncarved) rooms.
        const facing = topFacingWallRows(room.width, room.height, floorSet)
        expect(facing.size).toBe(Math.max(0, room.width - 2))
        expect([...facing.values()].every(ty => ty === 0)).toBe(true)
        // The "+1 row" wall-render duplicate never paints over real floor —
        // trivially true for every uncarved rectangle (a side wall's north
        // neighbor is always another wall cell or the true border), but
        // asserted generically here as a regression guard.
        const rendered = computeWallRenderSet(room.width, room.height, floorSet, wallSet)
        for (const key of rendered) expect(floorSet.has(key)).toBe(false)
        // The themed facade never paints over a back-wall door's tile —
        // regression guard for a real, previously-shipped bug that sealed
        // the door shut on every themed room with a back exit (35 of the
        // 238 interiors, discovered via a live bug report on one of them).
        const backExitTiles: [number, number][] = (room.exits ?? [])
          .filter(e => e.direction === 'back')
          .map(e => [e.tx, e.ty])
        const facade = facadePaintPositions(room.width, room.height, floorSet, backExitTiles)
        for (const [bx, by] of backExitTiles) expect(facade.get(bx)).not.toBe(by)
      })
    }
  }
})

describe('computeInteriorShape — carved shapes', () => {
  it('carves a fully-walled "pillar" hole out of the middle of the floor with no voids', () => {
    // 10×8 room, a 2×2 bite in the middle of the top floor row — inset one
    // tile clear of every box edge, so it should be a clean walled pocket.
    const { floorSet, wallSet } = computeInteriorShape(10, 8, [{ tx: 4, ty: 1, w: 2, h: 2 }])

    for (const key of ['4,1', '5,1', '4,2', '5,2']) {
      expect(floorSet.has(key)).toBe(false)
      expect(wallSet.has(key)).toBe(true)
    }
    expect(floorSet.has('3,1')).toBe(true)
    expect(floorSet.has('6,1')).toBe(true)
    expect(floorSet.has('3,3')).toBe(true)
    expect(floorSet.has('6,3')).toBe(true)

    for (let tx = 0; tx < 10; tx++)
      for (let ty = 0; ty < 8; ty++) {
        const key = `${tx},${ty}`
        expect(floorSet.has(key) || wallSet.has(key), `(${tx},${ty}) is void`).toBe(true)
      }
  })

  it('a carve reaching the box outer floor ring leaves no voids — the tip fills in as wall', () => {
    // Notch bites into the left-edge floor column (tx=1, adjacent to the
    // tx=0 wall column) — the corner and part of that wall column used to
    // lose every floor neighbor and render as a bare void; now every
    // bounding-box cell that isn't floor is wall, so the whole notch reads
    // as solid rock, including its tip.
    const { floorSet, wallSet } = computeInteriorShape(10, 8, [{ tx: 1, ty: 1, w: 2, h: 3 }])
    for (const key of ['0,0', '0,1', '0,2', '1,0', '1,1', '1,2']) {
      expect(floorSet.has(key)).toBe(false)
      expect(wallSet.has(key)).toBe(true)
    }
  })

  it('an edge-touching corner notch (the shipped worked-example shape) traces a real L-boundary and breaks the top wall row, with zero voids', () => {
    // Same shape authored on ravenwatch-hollow-tunnel-east: a corner bite
    // that actually reaches the room's right/top boundary. The whole
    // bitten area — including its tip, which used to have no remaining
    // floor neighbor and render as a bare void — now reads as solid
    // wall/rock filling the notch.
    const { floorSet, wallSet } = computeInteriorShape(10, 8, [{ tx: 6, ty: 0, w: 4, h: 3 }])

    expect(floorSet.has('6,1')).toBe(false)
    for (const key of ['6,0', '6,1', '6,2', '7,0', '7,1', '8,0', '8,1', '9,0', '9,1']) {
      expect(wallSet.has(key)).toBe(true)
    }
    // The themed back wall steps down around the notch instead of being
    // dropped: columns left of the carve still face from row 0, the carved
    // columns face from row 2 (their topmost remaining floor is ty=3).
    expect([...topFacingWallRows(10, 8, floorSet).entries()].sort((a, b) => a[0] - b[0]))
      .toEqual([[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 2], [7, 2], [8, 2]])

    for (let tx = 0; tx < 10; tx++)
      for (let ty = 0; ty < 8; ty++) {
        const key = `${tx},${ty}`
        expect(floorSet.has(key) || wallSet.has(key), `(${tx},${ty}) is void`).toBe(true)
      }

    // Floor continues normally below the notch and on the untouched side.
    expect(floorSet.has('8,3')).toBe(true)
    expect(floorSet.has('1,1')).toBe(true)
  })

  it('a landlocked carve steps only the columns it covers', () => {
    const { floorSet } = computeInteriorShape(10, 8, [{ tx: 4, ty: 1, w: 2, h: 2 }])
    const facing = topFacingWallRows(10, 8, floorSet)
    expect(facing.get(4)).toBe(2)
    expect(facing.get(5)).toBe(2)
    for (const tx of [1, 2, 3, 6, 7, 8]) expect(facing.get(tx)).toBe(0)
  })

  it('computeWallRenderSet never paints the "+1 row" duplicate over a thick carved wall band\'s north-facing floor', () => {
    // 10×10 room, rows 5-6 carved out across most of the width — a wall
    // band 2 tiles thick (not the room's true top/bottom border), with
    // real floor immediately north of it at row 4. Reproduces the shape
    // of the bug reported on ravenwatch-sunless-depths: standing on real,
    // walkable floor that reads as solid wall because a wall sprite got
    // drawn on top of it.
    const { floorSet, wallSet } = computeInteriorShape(10, 10, [{ tx: 1, ty: 5, w: 7, h: 2 }])
    expect(floorSet.has('3,4')).toBe(true)  // real floor just north of the band
    expect(wallSet.has('3,5')).toBe(true)   // top row of the 2-thick carved band

    const rendered = computeWallRenderSet(10, 10, floorSet, wallSet)
    for (const key of rendered) expect(floorSet.has(key)).toBe(false)
    // The naive "always duplicate one row up" version this replaced would
    // have added '3,4' (and the rest of row 4 under the carve) here.
    expect(rendered.has('3,4')).toBe(false)
  })

  it('carve is a no-op outside the floor domain (border ring, out of bounds)', () => {
    const withCarve = computeInteriorShape(10, 8, [{ tx: -5, ty: -5, w: 3, h: 3 }])
    const without = computeInteriorShape(10, 8)
    expect(setEqual(withCarve.floorSet, without.floorSet)).toBe(true)
    expect(setEqual(withCarve.wallSet, without.wallSet)).toBe(true)
  })
})

describe('facadePaintPositions', () => {
  it("excludes a back-wall door's column, unlike topFacingWallRows alone (Gildwyn's Card Emporium's real shape)", () => {
    // 13×9 plain rectangle, back door at (6,0) — the exact shape and door
    // position shipped on ravenwatch/card-shop. Reported live: the themed
    // facade painted a solid wall tile over the door, sealing it shut even
    // though the generic wall2 pass correctly left a gap there.
    const { floorSet } = computeInteriorShape(13, 9)
    const unfiltered = topFacingWallRows(13, 9, floorSet)
    expect(unfiltered.get(6)).toBe(0) // the bug: the door's own column gets a facade tile

    const filtered = facadePaintPositions(13, 9, floorSet, [[6, 0]])
    expect(filtered.has(6)).toBe(false)
    // Every other column is untouched.
    for (let tx = 1; tx <= 11; tx++) {
      if (tx === 6) continue
      expect(filtered.get(tx)).toBe(unfiltered.get(tx))
    }
    expect(filtered.size).toBe(unfiltered.size - 1)
  })

  it('is a no-op when there is no back-wall door', () => {
    const { floorSet } = computeInteriorShape(10, 8)
    const unfiltered = topFacingWallRows(10, 8, floorSet)
    const filtered = facadePaintPositions(10, 8, floorSet, [])
    expect(filtered).toEqual(unfiltered)
  })
})
