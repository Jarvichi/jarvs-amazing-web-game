// ─── /chase: the road ───────────────────────────────────────────────────────
//
// A classic "pseudo-3D" road: the track is a loop of short straight segments,
// each carrying a curve amount (how far the road bends while crossing it) and
// a height. Rendering walks the segments from the camera outward, projecting
// each one's near and far edge onto the screen and accumulating the curve, so
// straight polygons add up to smooth bends and hills.
//
// Positions along the road (`z`) are absolute distances that grow forever;
// segment lookups wrap them onto the loop. Sideways positions (`x`) are
// normalised so the road's edges sit at -1 and +1.
//
// Forks: the road splits into two branches that run side by side and join up
// again. `fork` on a segment (0..1) is how far apart the branches are.

export const SEG_LEN = 200
/** Half the road's width, in world units. x = ±1 is the road edge. */
export const ROAD_W = 2000
export const CAM_HEIGHT = 1000
export const FOV = 100
export const CAM_DEPTH = 1 / Math.tan((FOV / 2) * Math.PI / 180)
/** How far ahead of the camera the player's car sits. */
export const PLAYER_Z = CAM_HEIGHT * CAM_DEPTH
/** Segments drawn ahead of the camera. */
export const DRAW_DIST = 150

/** Distance of each branch's centre from the middle when fully split. */
export const FORK_OFFSET = 1.1
/** Segments over which a fork opens, stays open, then closes. */
export const FORK_OPEN = 40
export const FORK_HOLD = 60
export const FORK_CLOSE = 40

export type PropKind =
  | 'palm' | 'lamp' | 'sign' | 'tower' | 'block' | 'cactus' | 'rock' | 'pine' | 'bush' | 'billboard' | 'chevron' | 'neon'

export interface Prop {
  kind: PropKind
  /** Normalised x; beyond ±1 is roadside. */
  x: number
}

export interface Segment {
  index: number
  curve: number
  /** World height at the segment's near and far edge. */
  y0: number
  y1: number
  /** How far the road is split into two branches here (0 = one road). */
  fork: number
  /** Index into Track.forks while inside a fork. */
  forkId: number
  props: Prop[]
}

export interface Fork {
  /** First and last segment index of the fork. */
  start: number
  end: number
  /** The branch the target takes. */
  side: 'left' | 'right'
}

export interface Track {
  segs: Segment[]
  forks: Fork[]
  /** Loop length in world units. */
  length: number
}

/**
 * A track piece: ease in, hold, ease out of a curve and/or a hill, or a fork
 * (whose branches run straight and flat).
 */
export type Piece =
  | { enter: number; hold: number; leave: number; curve?: number; hill?: number }
  | { fork: 'left' | 'right' }

const easeIn = (a: number, b: number, p: number) => a + (b - a) * p * p
const easeInOut = (a: number, b: number, p: number) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5)

export function buildTrack(pieces: Piece[]): Track {
  const segs: Segment[] = []
  const forks: Fork[] = []
  const lastY = () => (segs.length ? segs[segs.length - 1].y1 : 0)
  const push = (curve: number, y: number, fork = 0, forkId = -1) => {
    segs.push({ index: segs.length, curve, y0: lastY(), y1: y, fork, forkId, props: [] })
  }

  for (const p of pieces) {
    if ('fork' in p) {
      const id = forks.length
      const start = segs.length
      const y = lastY()
      for (let i = 0; i < FORK_OPEN; i++) push(0, y, easeInOut(0, 1, (i + 1) / FORK_OPEN), id)
      for (let i = 0; i < FORK_HOLD; i++) push(0, y, 1, id)
      for (let i = 0; i < FORK_CLOSE; i++) push(0, y, easeInOut(1, 0, (i + 1) / FORK_CLOSE), id)
      forks.push({ start, end: segs.length - 1, side: p.fork })
      continue
    }
    const { enter, hold, leave, curve = 0, hill = 0 } = p
    const startY = lastY()
    const endY = startY + hill * SEG_LEN
    const total = enter + hold + leave
    let n = 0
    for (let i = 0; i < enter; i++, n++) push(easeIn(0, curve, i / enter), easeInOut(startY, endY, (n + 1) / total))
    for (let i = 0; i < hold; i++, n++) push(curve, easeInOut(startY, endY, (n + 1) / total))
    for (let i = 0; i < leave; i++, n++) push(easeInOut(curve, 0, i / leave), easeInOut(startY, endY, (n + 1) / total))
  }

  // Close the loop: ease the height back down to where the track started.
  const drop = lastY()
  if (drop !== 0) {
    const n = Math.max(20, Math.ceil(Math.abs(drop) / SEG_LEN))
    const y = lastY()
    for (let i = 0; i < n; i++) push(0, easeInOut(y, 0, (i + 1) / n))
  }
  return { segs, forks, length: segs.length * SEG_LEN }
}

export function segmentAt(track: Track, z: number): Segment {
  const n = track.segs.length
  const i = Math.floor(z / SEG_LEN) % n
  return track.segs[i < 0 ? i + n : i]
}

/** Road height at `z`, interpolated along its segment. */
export function heightAt(track: Track, z: number): number {
  const seg = segmentAt(track, z)
  const p = (((z % SEG_LEN) + SEG_LEN) % SEG_LEN) / SEG_LEN
  return seg.y0 + (seg.y1 - seg.y0) * p
}

/** How far apart the branches are at `z` (0 outside forks). */
export function splitAt(track: Track, z: number): number {
  return segmentAt(track, z).fork
}

/** Half-width of each branch at a given split (a single road is 1). */
export const branchHalfWidth = (split: number) => 1 - 0.3 * split

/** Centres of the two branches at a given split. */
export const branchCentre = (split: number, side: 'left' | 'right') => (side === 'left' ? -1 : 1) * split * FORK_OFFSET

/** Is normalised `x` on tarmac, given the local split? */
export function onRoad(x: number, split: number): boolean {
  if (split <= 0) return Math.abs(x) <= 1
  const hw = branchHalfWidth(split)
  return Math.abs(x - branchCentre(split, 'left')) <= hw || Math.abs(x - branchCentre(split, 'right')) <= hw
}

/** The branch nearest to `x`. */
export const sideOf = (x: number): 'left' | 'right' => (x < 0 ? 'left' : 'right')

/**
 * Lane centres. A single road has three lanes; while split, lanes 0 and 1
 * run on the left branch and lane 2 on the right, sliding across smoothly as
 * the fork opens.
 */
export function laneX(lane: number, split: number): number {
  if (split <= 0) return (lane - 1) * (2 / 3)
  const hw = branchHalfWidth(split)
  const single = (lane - 1) * (2 / 3)
  let forked: number
  if (lane === 2) forked = branchCentre(split, 'right')
  else forked = branchCentre(split, 'left') + (lane === 0 ? -hw / 2 : hw / 2)
  return single + (forked - single) * Math.min(1, split * 1.5)
}

/** Is `z` inside a fork, and which? */
export function forkAt(track: Track, z: number): Fork | null {
  const seg = segmentAt(track, z)
  return seg.forkId >= 0 ? track.forks[seg.forkId] : null
}

export interface Projected {
  /** Screen position of the road centre line. */
  x: number
  y: number
  /** Screen half-width of the road. */
  w: number
  /** Screen pixels per world unit. */
  scale: number
}

/**
 * Perspective-project a world point for a camera at (camX, camY, camZ) onto a
 * `width`×`height` screen.
 */
export function project(
  worldX: number, worldY: number, worldZ: number,
  camX: number, camY: number, camZ: number,
  width: number, height: number,
): Projected {
  const dz = Math.max(1, worldZ - camZ)
  const s = CAM_DEPTH / dz
  return {
    x: Math.round(width / 2 + s * (worldX - camX) * width / 2),
    y: Math.round(height / 2 - s * (worldY - camY) * height / 2),
    w: Math.round(s * ROAD_W * width / 2),
    scale: s * width / 2,
  }
}
