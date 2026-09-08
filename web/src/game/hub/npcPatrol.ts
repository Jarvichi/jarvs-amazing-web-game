// ─── NPC patrols ──────────────────────────────────────────────────────────────
//
// A patrolling NPC drifts around a beat instead of standing on one tile forever.
// Built for the three puzzle NPCs — the well keeper, the cellarer and the
// stowhand — who exist to point at a piece of town scenery (a well, a barrel, a
// crate) that opens a mini-game.
//
// They used to stand still within two tiles of the thing they talk about, and a
// speech bubble is ~5 tiles wide and drawn over the world, so their bubble sat
// on top of the very object it was pointing at for as long as the player stood
// there. A keeper who walks a beat still says their piece when they pass the
// scenery, and the rest of the time the object is plainly visible.
//
// Pure: no PIXI, no storage, no React. The canvas owns the walking; this only
// decides where the next step goes and whether the NPC is close enough to the
// thing they are meant to be talking about.

export interface Tile { tx: number; ty: number }

/** How long an NPC loiters before drifting to the next tile on its beat. */
export const PATROL_DWELL_MIN_MS = 3500
export const PATROL_DWELL_MAX_MS = 9000

/**
 * Tiles immediately around the landmark are excluded from the beat. Standing
 * *on* the scenery is the whole problem this patrol exists to solve, so the
 * NPC is allowed to walk past it but never to stop dead in front of it.
 */
export const PATROL_LANDMARK_CLEARANCE = 1

/** Chebyshev distance, matching how the hub measures proximity everywhere. */
export function tileDistance(a: Tile, b: Tile): number {
  return Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty))
}

export type Rng = () => number

/**
 * Pick the next tile on an NPC's beat: a walkable tile within `radius` of the
 * anchor, never the tile it is already on, and never inside the landmark's
 * clearance ring.
 *
 * Returns null when nothing qualifies — a beat hemmed in by walls, or a town
 * where the anchor sits in a doorway. The caller's answer to null is to stay
 * put and try again after the next dwell, so a cramped beat degrades to the old
 * standing-still behaviour rather than to a broken NPC.
 */
export function pickPatrolTile(
  anchor:   Tile,
  radius:   number,
  current:  Tile,
  walkable: Set<string>,
  landmark: Tile | null,
  rng:      Rng,
): Tile | null {
  const options: Tile[] = []
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const tile = { tx: anchor.tx + dx, ty: anchor.ty + dy }
      if (tile.tx < 0 || tile.ty < 0) continue
      if (tile.tx === current.tx && tile.ty === current.ty) continue
      if (!walkable.has(`${tile.tx},${tile.ty}`)) continue
      if (landmark && tileDistance(tile, landmark) <= PATROL_LANDMARK_CLEARANCE) continue
      options.push(tile)
    }
  }
  if (options.length === 0) return null
  return options[Math.floor(rng() * options.length)]
}

/** A dwell length in the range above, so a street of patrollers doesn't step in
 *  lockstep. */
export function nextDwellMs(rng: Rng): number {
  return PATROL_DWELL_MIN_MS + rng() * (PATROL_DWELL_MAX_MS - PATROL_DWELL_MIN_MS)
}

/**
 * Whether a patroller is close enough to the landmark to be talking about it.
 *
 * This is what replaced "the keeper is always standing there": their line is
 * theirs to say when their walk brings them past the well/barrel/crate, and
 * silence the rest of the time. Kept slightly wider than the clearance ring so
 * the line has a chance to land before they have drifted off again.
 */
export const PATROL_SPEAK_RADIUS = 3

export function isAtLandmark(npc: Tile, landmark: Tile, within = PATROL_SPEAK_RADIUS): boolean {
  return tileDistance(npc, landmark) <= within
}
