/**
 * Pure screen-space geometry for keeping a canvas-drawn speech bubble clear of
 * a fixed DOM overlay (the corner minimap). Kept out of HubTownCanvas so it's
 * testable without a canvas, a DOM, or PixiJS.
 */

export interface Rect {
  left:   number
  top:    number
  right:  number
  bottom: number
}

/**
 * How far left `bubble` needs to shift to clear `exclude` horizontally, with
 * `margin` px of breathing room — 0 if they don't overlap at all. Never
 * returns more than `maxShift`, so a caller can cap the nudge at "still on
 * screen" and a bubble can't be pushed off the left edge to dodge the box.
 */
export function leftShiftToClear(bubble: Rect, exclude: Rect, margin: number, maxShift: number): number {
  const overlapsVertically   = bubble.top   < exclude.bottom && bubble.bottom > exclude.top
  const overlapsHorizontally = bubble.right > exclude.left   && bubble.left   < exclude.right
  if (!overlapsVertically || !overlapsHorizontally) return 0

  const penetration = bubble.right - exclude.left + margin
  return Math.max(0, Math.min(penetration, maxShift))
}
