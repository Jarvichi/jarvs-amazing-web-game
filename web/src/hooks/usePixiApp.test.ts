import { describe, it, expect, vi } from 'vitest'

// usePixiApp imports rollbar, which reads window.Rollbar at module load.
vi.stubGlobal('window', { Rollbar: undefined, devicePixelRatio: 3 })
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })

const { computeCappedResolution, RENDERER_PIXEL_BUDGET } = await import('./usePixiApp')

describe('computeCappedResolution', () => {
  it('clamps dpr 3 to 2 for typical town maps', () => {
    expect(computeCappedResolution(1200, 900, 3)).toBe(2)
  })

  it('caps the Ravenwatch map (2400×2240) below dpr 2 via the pixel budget', () => {
    const res = computeCappedResolution(2400, 2240, 3)
    expect(res).toBeCloseTo(1.766, 2)
    // Resulting drawing buffer must fit the budget
    expect(2400 * res * 2240 * res).toBeLessThanOrEqual(RENDERER_PIXEL_BUDGET + 1)
  })

  it('never upscales a dpr-1 device', () => {
    expect(computeCappedResolution(2400, 2240, 1)).toBe(1)
  })

  it('leaves small canvases at full dpr (up to the clamp)', () => {
    expect(computeCappedResolution(400, 700, 2)).toBe(2)
  })

  it('falls back to 1 for a zero/NaN dpr', () => {
    expect(computeCappedResolution(800, 600, 0)).toBe(1)
    expect(computeCappedResolution(800, 600, NaN)).toBe(1)
  })

  it('respects a custom budget', () => {
    expect(computeCappedResolution(1000, 1000, 3, 1000 * 1000)).toBe(1)
  })
})
