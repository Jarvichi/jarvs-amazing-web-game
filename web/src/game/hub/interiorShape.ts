export interface CarveRect {
  tx: number
  ty: number
  w: number
  h: number
}

export interface InteriorShape {
  /** Walkable interior tiles (the room's inner 1..width-2 × 1..height-2 box,
   *  minus any carved-out cells). Does not include exit/door openings —
   *  callers add those back the same way they do for a plain rectangle. */
  floorSet: Set<string>
  /** Every tile that borders a floor tile (8-directionally) but isn't one
   *  itself — the wall ring, generalized to trace a carved perimeter. For a
   *  plain rectangle (no carve) this reproduces the same ring a fixed
   *  four-edge loop would produce. */
  wallSet: Set<string>
}

const NEIGHBORS_8: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0],          [1,  0],
  [-1,  1], [0,  1], [1,  1],
]

/**
 * Computes a room's floor and wall tile sets from its bounding box, minus
 * any `carve` rectangles subtracted from the interior. 8-directional (not
 * 4-directional) adjacency is required so the box's four true corner tiles
 * — only ever diagonally adjacent to an interior cell — still get a wall,
 * matching the plain-rectangle behavior exactly when `carve` is empty.
 *
 * A carved cell becomes a wall tile as long as some neighbor (even
 * diagonally) is still floor — which is the desired look: the bitten-out
 * area reads as solid rock/wall filling the notch, the same way the box's
 * outer ring always has been wall. Only a carve that reaches all the way
 * into the room's outermost floor ring (column 1, column width-2, row 1,
 * or row height-2) can leave a few cells at the very tip with no floor
 * neighbor left at all — neither floor nor wall. Those render as nothing
 * (the room's dark backdrop shows through), a minor cosmetic gap right at
 * the notch's tip rather than a defect — expected for a boundary notch
 * that genuinely reaches the room's edge (an L-shape), and invisible in
 * `dark: true` rooms. A carve that stays landlocked (not reaching any box
 * edge) never produces this, but then reads as an internal wall/pillar
 * obstacle rather than a boundary notch.
 */
export function computeInteriorShape(width: number, height: number, carve?: CarveRect[]): InteriorShape {
  const carvedSet = new Set<string>()
  if (carve) {
    for (const c of carve) {
      const x0 = Math.max(1, c.tx), x1 = Math.min(width - 2, c.tx + c.w - 1)
      const y0 = Math.max(1, c.ty), y1 = Math.min(height - 2, c.ty + c.h - 1)
      for (let tx = x0; tx <= x1; tx++)
        for (let ty = y0; ty <= y1; ty++)
          carvedSet.add(`${tx},${ty}`)
    }
  }

  const floorSet = new Set<string>()
  for (let tx = 1; tx < width - 1; tx++) {
    for (let ty = 1; ty < height - 1; ty++) {
      const key = `${tx},${ty}`
      if (!carvedSet.has(key)) floorSet.add(key)
    }
  }

  const wallSet = new Set<string>()
  for (let tx = 0; tx < width; tx++) {
    for (let ty = 0; ty < height; ty++) {
      const key = `${tx},${ty}`
      if (floorSet.has(key)) continue
      for (const [dx, dy] of NEIGHBORS_8) {
        if (floorSet.has(`${tx + dx},${ty + dy}`)) { wallSet.add(key); break }
      }
    }
  }

  return { floorSet, wallSet }
}

/** True when every tile of the room's top wall row (ty=0, columns
 *  1..width-2) is present in `wallSet` — i.e. an unbroken straight run. A
 *  carve that touches the top row anywhere breaks this, and callers should
 *  fall back to generic wall art (and skip the visual-only crown row above
 *  the room) for the whole row rather than theming part of it. */
export function hasUnbrokenTopWall(width: number, wallSet: Set<string>): boolean {
  for (let tx = 1; tx < width - 1; tx++) {
    if (!wallSet.has(`${tx},0`)) return false
  }
  return true
}
