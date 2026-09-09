import { describe, it, expect } from 'vitest'
import {
  pickPatrolTile, nextDwellMs, isAtLandmark, tileDistance,
  PATROL_DWELL_MIN_MS, PATROL_DWELL_MAX_MS, PATROL_LANDMARK_CLEARANCE, PATROL_SPEAK_RADIUS,
  type Tile,
} from './npcPatrol'

/** A fully walkable square, which is what most town streets look like locally. */
function openGround(size = 20): Set<string> {
  const s = new Set<string>()
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) s.add(`${x},${y}`)
  return s
}

const seeded = (seed: number) => {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000 }
}

describe('pickPatrolTile', () => {
  const anchor: Tile = { tx: 10, ty: 10 }
  const landmark: Tile = { tx: 11, ty: 10 }

  it('stays inside the beat radius', () => {
    const rng = seeded(1)
    for (let i = 0; i < 200; i++) {
      const tile = pickPatrolTile(anchor, 4, { tx: 10, ty: 10 }, openGround(), landmark, rng)
      expect(tile).not.toBeNull()
      expect(tileDistance(tile!, anchor)).toBeLessThanOrEqual(4)
    }
  })

  it('never stops on the landmark or the ring around it', () => {
    // The whole point of the patrol: a keeper parked on the well is a speech
    // bubble parked on the well.
    const rng = seeded(2)
    for (let i = 0; i < 300; i++) {
      const tile = pickPatrolTile(anchor, 4, { tx: 10, ty: 10 }, openGround(), landmark, rng)
      expect(tileDistance(tile!, landmark)).toBeGreaterThan(PATROL_LANDMARK_CLEARANCE)
    }
  })

  it('never picks the tile the NPC is already standing on', () => {
    const rng = seeded(3)
    const current = { tx: 9, ty: 9 }
    for (let i = 0; i < 100; i++) {
      const tile = pickPatrolTile(anchor, 3, current, openGround(), landmark, rng)
      expect(`${tile!.tx},${tile!.ty}`).not.toBe(`${current.tx},${current.ty}`)
    }
  })

  it('only picks walkable tiles', () => {
    const walkable = new Set(['10,11', '10,12', '9,11'])
    const rng = seeded(4)
    for (let i = 0; i < 50; i++) {
      const tile = pickPatrolTile(anchor, 4, { tx: 10, ty: 10 }, walkable, landmark, rng)
      expect(walkable.has(`${tile!.tx},${tile!.ty}`)).toBe(true)
    }
  })

  it('roams rather than ping-ponging between two tiles', () => {
    const rng = seeded(5)
    const seen = new Set<string>()
    let current = { tx: 10, ty: 10 }
    for (let i = 0; i < 40; i++) {
      const tile = pickPatrolTile(anchor, 4, current, openGround(), landmark, rng)!
      seen.add(`${tile.tx},${tile.ty}`)
      current = tile
    }
    expect(seen.size).toBeGreaterThan(8)
  })

  it('does pass close enough to the landmark to be able to speak', () => {
    // A beat that never comes within speaking range would silence the hint
    // entirely, which is worse than the bubble it replaced.
    const rng = seeded(6)
    let near = 0
    let current = { tx: 10, ty: 10 }
    for (let i = 0; i < 200; i++) {
      current = pickPatrolTile(anchor, 4, current, openGround(), landmark, rng)!
      if (isAtLandmark(current, landmark)) near++
    }
    expect(near).toBeGreaterThan(20)
  })

  it('returns null when the beat is walled in, rather than throwing', () => {
    // A cramped beat degrades to standing still, which is the old behaviour —
    // never a crash and never a walk into a wall.
    const tile = pickPatrolTile(anchor, 2, { tx: 10, ty: 10 }, new Set(), landmark, seeded(7))
    expect(tile).toBeNull()
  })

  it('never leaves the map at a beat that overhangs the edge', () => {
    const rng = seeded(8)
    for (let i = 0; i < 100; i++) {
      const tile = pickPatrolTile({ tx: 1, ty: 1 }, 4, { tx: 1, ty: 1 }, openGround(), null, rng)
      expect(tile!.tx).toBeGreaterThanOrEqual(0)
      expect(tile!.ty).toBeGreaterThanOrEqual(0)
    }
  })

  it('works with no landmark at all', () => {
    const tile = pickPatrolTile(anchor, 3, { tx: 10, ty: 10 }, openGround(), null, seeded(9))
    expect(tile).not.toBeNull()
  })
})

describe('nextDwellMs', () => {
  it('stays inside the configured range', () => {
    const rng = seeded(11)
    for (let i = 0; i < 100; i++) {
      const ms = nextDwellMs(rng)
      expect(ms).toBeGreaterThanOrEqual(PATROL_DWELL_MIN_MS)
      expect(ms).toBeLessThanOrEqual(PATROL_DWELL_MAX_MS)
    }
  })

  it('varies, so a street of patrollers does not step in lockstep', () => {
    const rng = seeded(12)
    const values = new Set(Array.from({ length: 20 }, () => Math.round(nextDwellMs(rng))))
    expect(values.size).toBeGreaterThan(10)
  })
})

describe('isAtLandmark', () => {
  it('speaks within the speak radius and is silent beyond it', () => {
    const well = { tx: 10, ty: 10 }
    expect(isAtLandmark({ tx: 10, ty: 10 }, well)).toBe(true)
    expect(isAtLandmark({ tx: 10 + PATROL_SPEAK_RADIUS, ty: 10 }, well)).toBe(true)
    expect(isAtLandmark({ tx: 10 + PATROL_SPEAK_RADIUS + 1, ty: 10 }, well)).toBe(false)
  })

  it('is wider than the clearance ring, so a patroller can always reach speaking range', () => {
    expect(PATROL_SPEAK_RADIUS).toBeGreaterThan(PATROL_LANDMARK_CLEARANCE)
  })
})
