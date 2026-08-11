import { describe, it, expect } from 'vitest'
import { edgeArrowPlacement, isOnScreen, minimapTransform, type ViewportRect } from './hubMinimapMath'

describe('minimapTransform', () => {
  it('maps the world corners onto the drawn rect corners', () => {
    // Ravenwatch's map on the real 100x100 minimap canvas.
    const t = minimapTransform(2400, 2240, 100, 100)
    expect(t.toMmX(0)).toBeCloseTo(t.offX)
    expect(t.toMmY(0)).toBeCloseTo(t.offY)
    expect(t.toMmX(2400)).toBeCloseTo(t.offX + t.drawW)
    expect(t.toMmY(2240)).toBeCloseTo(t.offY + t.drawH)
  })

  it('letterboxes with one uniform scale, centred in the slack axis', () => {
    const t = minimapTransform(2400, 2240, 100, 100)
    expect(t.drawW).toBeCloseTo(100)          // wider axis fills the canvas
    expect(t.drawH).toBeLessThan(100)         // shorter axis is letterboxed
    expect(t.offX).toBeCloseTo(0)
    expect(t.offY).toBeCloseTo((100 - t.drawH) / 2)
    // Same scale both ways — no aspect distortion.
    expect(t.drawW / 2400).toBeCloseTo(t.drawH / 2240)
  })

  it('honours padding', () => {
    const t = minimapTransform(100, 100, 100, 100, 10)
    expect(t.drawW).toBeCloseTo(80)
    expect(t.offX).toBeCloseTo(10)
  })
})

describe('isOnScreen', () => {
  const view: ViewportRect = { vx: 100, vy: 100, vw: 400, vh: 600 }

  it('accepts points inside the window and rejects points outside', () => {
    expect(isOnScreen({ x: 300, y: 400 }, view)).toBe(true)
    expect(isOnScreen({ x: 99, y: 400 }, view)).toBe(false)
    expect(isOnScreen({ x: 300, y: 701 }, view)).toBe(false)
  })
})

describe('edgeArrowPlacement', () => {
  // The arrow must sit on the straight line from the viewport centre to the
  // objective. Expressed in screen pixels, the offset from centre is
  // ((fx - 0.5) * vw, (fy - 0.5) * vh) — that vector has to stay parallel to
  // (target - centre), which is exactly what the old square-box projection broke
  // on non-square viewports.
  const onTheRay = (target: { x: number; y: number }, view: ViewportRect) => {
    const { fx, fy, angle } = edgeArrowPlacement(target, view)
    const dx = target.x - (view.vx + view.vw / 2)
    const dy = target.y - (view.vy + view.vh / 2)
    const ex = (fx - 0.5) * view.vw
    const ey = (fy - 0.5) * view.vh
    // Cross product of the two vectors is zero when they are parallel.
    expect(dx * ey - dy * ex).toBeCloseTo(0, 6)
    // ...and pointing the same way, not backwards.
    expect(dx * ex + dy * ey).toBeGreaterThan(0)
    // The glyph's rotation must agree with where it was placed.
    expect(Math.atan2(ey, ex)).toBeCloseTo(angle, 6)
  }

  const portrait: ViewportRect = { vx: 0, vy: 0, vw: 390, vh: 640 }
  const landscape: ViewportRect = { vx: 0, vy: 0, vw: 1440, vh: 720 }

  it('stays on the ray to the objective on a tall phone viewport', () => {
    for (const target of [
      { x: 2000, y: 500 },    // far east, slightly below centre
      { x: 195, y: -800 },    // due north
      { x: -600, y: 900 },    // south-west
      { x: 1200, y: 1500 },   // south-east, shallow angle
    ]) onTheRay(target, portrait)
  })

  it('stays on the ray to the objective on a wide desktop viewport', () => {
    for (const target of [
      { x: 3000, y: 400 },
      { x: 720, y: -900 },
      { x: -400, y: 1100 },
    ]) onTheRay(target, landscape)
  })

  it('keeps the arrow inside the viewport, touching the inset edge', () => {
    const { fx, fy } = edgeArrowPlacement({ x: 5000, y: 300 }, portrait)
    expect(fx).toBeGreaterThan(0)
    expect(fx).toBeLessThan(1)
    expect(fy).toBeGreaterThan(0)
    expect(fy).toBeLessThan(1)
    // Far to the east ⇒ pinned against the right edge at the 0.9 inset.
    expect(fx).toBeCloseTo(0.5 + 0.45)
  })

  it('respects the viewport offset when deriving the centre', () => {
    const shifted: ViewportRect = { vx: 1000, vy: 2000, vw: 390, vh: 640 }
    // Directly north of the shifted centre ⇒ straight up, no horizontal drift.
    const { fx, fy, angle } = edgeArrowPlacement({ x: 1195, y: 0 }, shifted)
    expect(fx).toBeCloseTo(0.5)
    expect(fy).toBeCloseTo(0.5 - 0.45)
    expect(angle).toBeCloseTo(-Math.PI / 2)
  })

  it('returns the centre when the objective is exactly at the centre', () => {
    const { fx, fy } = edgeArrowPlacement({ x: 195, y: 320 }, portrait)
    expect(fx).toBeCloseTo(0.5)
    expect(fy).toBeCloseTo(0.5)
  })
})
