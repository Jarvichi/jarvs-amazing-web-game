import { describe, it, expect } from 'vitest'
import { computeInteriorShape, topFacingWallRows } from './interiorShape'
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

  it('carve is a no-op outside the floor domain (border ring, out of bounds)', () => {
    const withCarve = computeInteriorShape(10, 8, [{ tx: -5, ty: -5, w: 3, h: 3 }])
    const without = computeInteriorShape(10, 8)
    expect(setEqual(withCarve.floorSet, without.floorSet)).toBe(true)
    expect(setEqual(withCarve.wallSet, without.wallSet)).toBe(true)
  })
})
