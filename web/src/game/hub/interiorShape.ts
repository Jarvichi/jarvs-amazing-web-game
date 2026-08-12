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
  /** Every bounding-box tile that isn't floor — the wall ring, generalized
   *  to also fill in a carved notch. For a plain rectangle (no carve) this
   *  reproduces the same ring a fixed four-edge loop would produce; for a
   *  carve, every removed cell (down to the notch's furthest tip, even one
   *  that reaches the box's outer edge) reads as solid wall/rock filling
   *  the gap, so there's never a cell that's neither floor nor wall. */
  wallSet: Set<string>
}

/**
 * Computes a room's floor and wall tile sets from its bounding box, minus
 * any `carve` rectangles subtracted from the interior. Every cell in the
 * box is exactly one of floor or wall — a carved-out region always renders
 * as solid wall/rock filling the notch, including cells at the very tip of
 * a notch that reaches the box's outer edge, which used to have no
 * remaining floor neighbor and rendered as a bare, textureless void.
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
      if (!floorSet.has(key)) wallSet.add(key)
    }
  }

  return { floorSet, wallSet }
}

/** For each interior column, the row of the wall tile that faces the room
 *  from the north — the tile directly above that column's topmost floor
 *  cell. Every column answers 0 for a plain rectangle; a carve biting into
 *  the top of a column steps its facing wall further down, so a themed back
 *  wall can follow the notch instead of being dropped for the whole row.
 *  Columns with no floor at all (carved away end to end) are omitted. */
export function topFacingWallRows(width: number, height: number, floorSet: Set<string>): Map<number, number> {
  const rows = new Map<number, number>()
  for (let tx = 1; tx < width - 1; tx++) {
    for (let ty = 1; ty < height - 1; ty++) {
      if (floorSet.has(`${tx},${ty}`)) { rows.set(tx, ty - 1); break }
    }
  }
  return rows
}
