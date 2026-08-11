/**
 * Pure coordinate maths for the hub minimap and its off-screen objective arrow.
 * Kept out of the component so it can be tested without a canvas or a DOM.
 */

/** Visible world window, in world pixels. */
export interface ViewportRect {
  vx: number
  vy: number
  vw: number
  vh: number
}

export interface MinimapTransform {
  /** World pixels → minimap pixels. */
  scale: number
  /** Size of the drawn map rect inside the minimap canvas. */
  drawW: number
  drawH: number
  /** Top-left of the drawn map rect inside the minimap canvas. */
  offX: number
  offY: number
  toMmX: (wx: number) => number
  toMmY: (wy: number) => number
}

/**
 * Scale-to-fit (letterboxed) mapping from world pixels onto a mmW × mmH minimap
 * canvas: one uniform scale for both axes, the map centred in whichever axis has
 * slack. `pad` insets the drawable area on all four sides.
 */
export function minimapTransform(
  mapW: number,
  mapH: number,
  mmW: number,
  mmH: number,
  pad = 0,
): MinimapTransform {
  const innerW = mmW - pad * 2
  const innerH = mmH - pad * 2
  const scale = Math.min(innerW / mapW, innerH / mapH)
  const drawW = mapW * scale
  const drawH = mapH * scale
  const offX = pad + (innerW - drawW) / 2
  const offY = pad + (innerH - drawH) / 2
  return {
    scale, drawW, drawH, offX, offY,
    toMmX: (wx: number) => offX + wx * scale,
    toMmY: (wy: number) => offY + wy * scale,
  }
}

/** True when the world point is inside the visible window. */
export function isOnScreen(target: { x: number; y: number }, view: ViewportRect): boolean {
  return target.x >= view.vx && target.x <= view.vx + view.vw
      && target.y >= view.vy && target.y <= view.vy + view.vh
}

export interface EdgeArrowPlacement {
  /** Position as a fraction of the viewport (0..1 from its top-left corner). */
  fx: number
  fy: number
  /** Bearing from the viewport centre to the target, in radians. */
  angle: number
}

/**
 * Where to park the off-screen objective arrow: on the ray from the viewport
 * centre to the target, pushed out until it meets the edge of the viewport
 * shrunk by `inset`.
 *
 * The projection has to happen against the viewport's real pixel dimensions.
 * Projecting onto a *square* box and then applying the result as percentages of
 * a non-square element (what this used to do) skews the arrow off the ray — the
 * glyph points one way while sitting somewhere else, which is glaring on a tall
 * phone viewport and only exact along the axes and the diagonals.
 */
export function edgeArrowPlacement(
  target: { x: number; y: number },
  view: ViewportRect,
  inset = 0.9,
): EdgeArrowPlacement {
  const cx = view.vx + view.vw / 2
  const cy = view.vy + view.vh / 2
  const dx = target.x - cx
  const dy = target.y - cy
  const angle = Math.atan2(dy, dx)
  if (dx === 0 && dy === 0) return { fx: 0.5, fy: 0.5, angle }
  // Distance along the ray at which it crosses each inset edge; the nearer one wins.
  const tx = dx === 0 ? Infinity : (view.vw / 2) * inset / Math.abs(dx)
  const ty = dy === 0 ? Infinity : (view.vh / 2) * inset / Math.abs(dy)
  const t = Math.min(tx, ty)
  return {
    fx: 0.5 + (dx * t) / view.vw,
    fy: 0.5 + (dy * t) / view.vh,
    angle,
  }
}
