// ─── City road-wear geometry ─────────────────────────────────────────────────
// Pure maths behind the road-wear layer, extracted so the PixiJS draw stays a
// thin caller and the numbers are testable without a renderer.
//
// This reproduces what the old per-cell inline SVG did. Each cell carried an
// `<svg viewBox="0 0 100 100" preserveAspectRatio="none" overflow="visible">`,
// so a viewBox unit was 1% of the cell in each axis independently, and strips
// were free to spill past the cell edge into the CSS grid gap. Both properties
// are reproduced below: `roadStrips` scales x and y by separate factors, and
// the returned rects may extend outside their cell.

/** Strip width, in viewBox units (% of cell). */
const ROAD_W = 20
/** How far each strip runs past the cell boundary, to bridge the CSS grid gap. */
const ROAD_EXT = 12
/**
 * Strips straddle the cell's bottom / right boundary rather than sitting inside
 * it, so they land in the grid gap between cells: a quarter of the width sits
 * before the boundary, the rest after.
 */
const HALF = (ROAD_W / 2) / 2

/** Matches `.city-road-layer { inset: 4px }` — itself matching `.city-grid`'s border. */
export const ROAD_LAYER_INSET = 4
/** Matches the `gap: 6px` shared by `.city-road-layer` and `.city-grid`. */
export const ROAD_LAYER_GAP = 6

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * Pixel rect of one cell of the road layer, in the coordinate space of
 * `.city-zoom-wrapper` (the canvas covers it at `inset: 0`).
 *
 * `layerW`/`layerH` are the wrapper's full size; the inset is applied here.
 */
export function roadCellRect(
  index: number,
  cols: number, rows: number,
  layerW: number, layerH: number,
): Rect {
  const availW = layerW - ROAD_LAYER_INSET * 2
  const availH = layerH - ROAD_LAYER_INSET * 2
  const cellW = (availW - ROAD_LAYER_GAP * (cols - 1)) / cols
  const cellH = (availH - ROAD_LAYER_GAP * (rows - 1)) / rows
  const col = index % cols
  const row = Math.floor(index / cols)
  return {
    x: ROAD_LAYER_INSET + col * (cellW + ROAD_LAYER_GAP),
    y: ROAD_LAYER_INSET + row * (cellH + ROAD_LAYER_GAP),
    w: cellW,
    h: cellH,
  }
}

/**
 * The four wear values that meet at a cell, read off the shared edge arrays.
 * `h[i]` is wear between cell i and i+1; `v[i]` between cell i and i+cols.
 * Edges of the grid have no neighbour, so they contribute no wear.
 */
export function cellWear(
  index: number,
  cols: number, rows: number,
  h: number[], v: number[],
): { left: number; right: number; top: number; bottom: number } {
  const col = index % cols
  const row = Math.floor(index / cols)
  return {
    left:   col === 0        ? 0 : (h[index - 1]    ?? 0),
    right:  col === cols - 1 ? 0 : (h[index]        ?? 0),
    top:    row === 0        ? 0 : (v[index - cols] ?? 0),
    bottom: row === rows - 1 ? 0 : (v[index]        ?? 0),
  }
}

/**
 * Road colour for a wear level: dirt track darkens to a worn pale path as wear
 * climbs, and grows more opaque with it. `highlight` is the brighter patch
 * where a horizontal and a vertical strip cross.
 *
 * Split into a numeric colour + alpha for PixiJS. Alpha keeps the 2-decimal
 * rounding the old `rgba()` string had, so output matches the SVG exactly.
 */
export function pathFillParts(wear: number, highlight = false): { color: number; alpha: number } {
  const t = Math.min(1, wear / 100)
  const r = Math.round(140 + (170 - 140) * t)
  const g = Math.round(100 + (155 - 100) * t)
  const b = Math.round(40  + (110 - 40)  * t)
  const alpha = highlight
    ? Number((0.55 + t * 0.35).toFixed(2))
    : Number((0.25 + t * 0.45).toFixed(2))
  return { color: (r << 16) | (g << 8) | b, alpha }
}

export interface RoadStrip extends Rect { color: number; alpha: number }

/**
 * The filled rects for one cell's roads, in wrapper pixel space.
 *
 * Strips are drawn on the cell's bottom and right boundaries whichever
 * neighbour the wear came from — that asymmetry is deliberate and matches the
 * original SVG, since each boundary is shared and would otherwise be painted
 * twice.
 */
export function roadStrips(
  wear: { left: number; right: number; top: number; bottom: number },
  rect: Rect,
): RoadStrip[] {
  const hasH = wear.left > 0 || wear.right > 0
  const hasV = wear.top  > 0 || wear.bottom > 0
  if (!hasH && !hasV) return []

  const wearH = Math.max(wear.left, wear.right)
  const wearV = Math.max(wear.top,  wear.bottom)

  // viewBox → pixels: each axis scales independently (preserveAspectRatio="none").
  const sx = rect.w / 100
  const sy = rect.h / 100
  const at = (vx: number, vy: number, vw: number, vh: number): Rect => ({
    x: rect.x + vx * sx,
    y: rect.y + vy * sy,
    w: vw * sx,
    h: vh * sy,
  })

  const boundary = 100 - HALF  // 95 — strip starts just before the cell edge
  const strips: RoadStrip[] = []

  if (hasH) {
    strips.push({ ...at(-ROAD_EXT, boundary, 100 + ROAD_EXT * 2, ROAD_W), ...pathFillParts(wearH) })
  }
  if (hasV) {
    strips.push({ ...at(boundary, -ROAD_EXT, ROAD_W, 100 + ROAD_EXT * 2), ...pathFillParts(wearV) })
  }
  // Brighter square where the two strips overlap, so junctions read as junctions.
  if (hasH && hasV) {
    strips.push({
      ...at(boundary, boundary, ROAD_W, ROAD_W),
      ...pathFillParts(Math.max(wearH, wearV), true),
    })
  }
  return strips
}
