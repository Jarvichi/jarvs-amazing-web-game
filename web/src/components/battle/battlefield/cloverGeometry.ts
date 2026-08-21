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

// textPath draws glyphs on a fixed side of the baseline relative to travel direction
// (the same rule every browser follows), so reversing direction — which is what makes
// bottom-petal text read upright instead of upside-down — also flips WHICH side the
// glyphs render on: forward-direction (sweep=1) petals get glyphs on the outward
// (rim) side of the baseline, reversed-direction (sweep=0) petals get them on the
// inward (center) side. Left uncompensated, that's a second, subtler bug on top of
// the upside-down one: reversed-direction labels sit visibly closer to center than
// forward ones (measured ~34 vs ~39 units from CLOVER_CENTER at the original shared
// radius). Nudging the baseline radius out for reversed petals only puts their glyph
// centers back in line with the forward ones' — same measurement, iterated until it
// matched, since the exact offset depends on font metrics, not something to derive.
const CLOVER_LABEL_R_REVERSED = CLOVER_LABEL_R + 5

/**
 * One SVG arc `d` string from `fromDeg` to `toDeg`, both measured clockwise from
 * 3 o'clock (0deg = right, 90deg = bottom, 180deg = left, 270deg = top — standard
 * screen/SVG convention, y grows downward).
 *
 * For two points that are 90deg apart on a shared circle, there are actually TWO
 * circles of that same radius through both points (one centered here, one its mirror
 * across the chord) — a hardcoded sweep-flag picks the right one only for angle pairs
 * that happen to increase the "short way". Deriving sweep from the actual signed
 * short-way direction between fromDeg/toDeg keeps the arc concentric with
 * CLOVER_CENTER (i.e. following the petal's own rim) for EITHER direction, so callers
 * are free to pick from/to purely for reading direction without silently drawing the
 * wrong-centered arc. (An earlier hardcoded-sweep=1 version passed this exact bug for
 * months of debugging as a text-orientation issue — it was also a position bug.)
 */
export function arcPath(fromDeg: number, toDeg: number): string {
  const rad = (d: number) => (d * Math.PI) / 180
  const shortDelta = (((toDeg - fromDeg) % 360) + 540) % 360 - 180
  const sweep = shortDelta > 0 ? 1 : 0
  const r = sweep === 1 ? CLOVER_LABEL_R : CLOVER_LABEL_R_REVERSED
  const x1 = CLOVER_CENTER + r * Math.cos(rad(fromDeg))
  const y1 = CLOVER_CENTER + r * Math.sin(rad(fromDeg))
  const x2 = CLOVER_CENTER + r * Math.cos(rad(toDeg))
  const y2 = CLOVER_CENTER + r * Math.sin(rad(toDeg))
  return `M ${x1} ${y1} A ${r} ${r} 0 0 ${sweep} ${x2} ${y2}`
}

// One arc range per petal, same index order as CORNER_CLASS_4/2. textPath orients
// glyphs to the path's direction of travel, and for text to read upright (glyph tops
// pointing away from the circle's center, not toward it) the top and bottom halves
// need OPPOSITE winding: top petals' arcs run with increasing angle, left to right
// over the top (180->270->360); bottom petals' arcs run with decreasing angle, right
// to left under the bottom (180->90 / 90->360, i.e. reversed from the top pair).
// Verified at high zoom via screenshot — a same-direction (uniform clockwise) version
// was tried first and is wrong: it reads upside-down on both bottom petals.
export const ARC_RANGE_4: [number, number][] = [
  [180, 270], // tl
  [270, 360], // tr
  [180, 90],  // bl
  [90, 360],  // br
]
export const ARC_RANGE_2: [number, number][] = [
  [90, 270],  // l (bottom -> top, the long way round through left)
  [270, 90],  // r reversed: (top -> bottom, through right) so text reads upright
]

// Radius for a small per-petal icon, sitting in the wedge between the shared center
// and the label arc (CLOVER_LABEL_R/_REVERSED, 38-43) — inside the label, clear of it.
const CLOVER_ICON_R = 20

/**
 * transform="" for a small icon centered on a petal's own angular bisector, rotated
 * to match that petal's label-text tilt. Reuses the exact sweep/direction math from
 * arcPath (see its comment) rather than a separate derivation — an icon rotated to
 * "look like it belongs to this petal's text" needs the same forward-vs-reversed
 * distinction the label itself needed, and getting that from one shared calculation
 * keeps them from drifting apart if the arc geometry ever changes.
 *
 * 4-petal geometry only (ARC_RANGE_4's pairs are always 90deg apart, so "bisector" is
 * unambiguous) — not used for the 2-petal case, where each arc spans a full 180deg and
 * "the short way" isn't well-defined the same way.
 */
export function petalIconTransform(fromDeg: number, toDeg: number, size: number): string {
  const rad = (d: number) => (d * Math.PI) / 180
  const shortDelta = (((toDeg - fromDeg) % 360) + 540) % 360 - 180
  const sweep = shortDelta > 0 ? 1 : 0
  const bisector = fromDeg + shortDelta / 2
  const rotation = sweep === 1 ? bisector + 90 : bisector - 90
  const cx = CLOVER_CENTER + CLOVER_ICON_R * Math.cos(rad(bisector))
  const cy = CLOVER_CENTER + CLOVER_ICON_R * Math.sin(rad(bisector))
  const half = size / 2
  return `translate(${cx - half} ${cy - half}) scale(${size / 24}) rotate(${rotation} 12 12)`
}
