import { describe, it, expect } from 'vitest'
import { computeInteriorShape, hasUnbrokenTopWall } from './interiorShape'
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
        expect(hasUnbrokenTopWall(room.width, floorSet)).toBe(true)
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
    expect(hasUnbrokenTopWall(10, floorSet)).toBe(false)

    for (let tx = 0; tx < 10; tx++)
      for (let ty = 0; ty < 8; ty++) {
        const key = `${tx},${ty}`
        expect(floorSet.has(key) || wallSet.has(key), `(${tx},${ty}) is void`).toBe(true)
      }

    // Floor continues normally below the notch and on the untouched side.
    expect(floorSet.has('8,3')).toBe(true)
    expect(floorSet.has('1,1')).toBe(true)
  })

  it('carve is a no-op outside the floor domain (border ring, out of bounds)', () => {
    const withCarve = computeInteriorShape(10, 8, [{ tx: -5, ty: -5, w: 3, h: 3 }])
    const without = computeInteriorShape(10, 8)
    expect(setEqual(withCarve.floorSet, without.floorSet)).toBe(true)
    expect(setEqual(withCarve.wallSet, without.wallSet)).toBe(true)
  })
})
