// Shared geometry for the clover-shaped radial pickers (StanceBar, SpeedClover): a
// 2x2 (or 1x2) grid of cells, each rounded ONLY on its true outer corner, renders as
// petals meeting at a shared center point. Curved labels trace an arc concentric with
// that same center, at a radius inside the petals' own rounded rim.

// Which outer corner each grid cell rounds, by its index in a 4-option list — this is
// what turns 4 plain grid squares into 4 petals meeting at a shared center. Index
// 0/1/2/3 = reading order (top-left, top-right, bottom-left, bottom-right).
export const CORNER_CLASS_4 = [
  'stance-petal--tl',
  'stance-petal--tr',
  'stance-petal--bl',
  'stance-petal--br',
]
// Two options render as left/right halves instead of quadrants.
export const CORNER_CLASS_2 = ['stance-petal--l', 'stance-petal--r']

// Label curve geometry for the expanded clover. Plain horizontal text ignores the
// petal's own curve entirely — cramped at the sharp center point, wasted space out at
// the rounded rim. Curving each label along an arc concentric with that rim uses the
// petal's actual shape instead of fighting it.
export const CLOVER_VIEWBOX = 108     // must match .stance-clover--expanded's size
export const CLOVER_CENTER  = CLOVER_VIEWBOX / 2
export const CLOVER_LABEL_R = 38      // inside the true ~52px petal rim, clear of the border

/**
 * One SVG arc `d` string from `fromDeg` to `toDeg`, both measured clockwise from
 * 3 o'clock (0deg = right, 90deg = bottom, 180deg = left, 270deg = top — standard
 * screen/SVG convention, y grows downward).
 */
export function arcPath(fromDeg: number, toDeg: number): string {
  const rad = (d: number) => (d * Math.PI) / 180
  const x1 = CLOVER_CENTER + CLOVER_LABEL_R * Math.cos(rad(fromDeg))
  const y1 = CLOVER_CENTER + CLOVER_LABEL_R * Math.sin(rad(fromDeg))
  const x2 = CLOVER_CENTER + CLOVER_LABEL_R * Math.cos(rad(toDeg))
  const y2 = CLOVER_CENTER + CLOVER_LABEL_R * Math.sin(rad(toDeg))
  return `M ${x1} ${y1} A ${CLOVER_LABEL_R} ${CLOVER_LABEL_R} 0 0 1 ${x2} ${y2}`
}

// One arc range per petal, same index order as CORNER_CLASS_4/2. textPath orients
// glyphs to the path's direction of travel; all four labels read upright when every
// petal's arc sweeps the SAME direction (increasing angle / clockwise) as one
// continuous 360deg cycle around the circle: tl(180->270), tr(270->360), br(360->90),
// bl(90->180) — each entry picks straight back up where the previous one ended.
// (An earlier version alternated direction per top/bottom hemisphere on the theory
// that upright text needs opposite winding above and below center; that was wrong —
// confirmed by screenshot, not just re-derived.)
export const ARC_RANGE_4: [number, number][] = [
  [180, 270], // tl
  [270, 360], // tr
  [90, 180],  // bl
  [360, 90],  // br
]
export const ARC_RANGE_2: [number, number][] = [
  [90, 270],  // l (bottom -> top, the long way round through left)
  [270, 90],  // r reversed: (top -> bottom, through right) so text reads upright
]
