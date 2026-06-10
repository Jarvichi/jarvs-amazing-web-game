import { describe, it, expect, beforeEach, vi } from 'vitest'

// pixiTelemetry (via rollbar.ts) reads window.Rollbar at module load — stub
// the browser globals before importing the module under test.
const rollbarSpy = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), configure: vi.fn() }
vi.stubGlobal('window', { Rollbar: rollbarSpy, devicePixelRatio: 3 })
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })

const { estimateCanvasMB, getGlStats, noteContextCreated, noteContextDestroyed, _resetGlStatsForTest } =
  await import('./pixiTelemetry')

describe('estimateCanvasMB', () => {
  it('estimates the Ravenwatch map at dpr 3 as ~185 MB', () => {
    expect(estimateCanvasMB(2400, 2240, 3)).toBeCloseTo(184.6, 0)
  })

  it('estimates the Ravenwatch map at the capped resolution as ~64 MB', () => {
    expect(estimateCanvasMB(2400, 2240, 1.766)).toBeCloseTo(64, 0)
  })

  it('estimates a small battle canvas as well under the info threshold', () => {
    expect(estimateCanvasMB(400, 700, 2)).toBeLessThan(48)
  })
})

describe('context counters', () => {
  beforeEach(() => {
    _resetGlStatsForTest()
    rollbarSpy.info.mockClear()
    rollbarSpy.warn.mockClear()
  })

  it('pairs created/destroyed and never goes negative', () => {
    const info = { width: 400, height: 700, resolution: 2 }
    noteContextCreated(info)
    expect(getGlStats().liveContexts).toBe(1)
    noteContextDestroyed(info)
    noteContextDestroyed(info)  // double-destroy must not underflow
    const stats = getGlStats()
    expect(stats.liveContexts).toBe(0)
    expect(stats.liveCanvasMB).toBe(0)
    expect(stats.contextsCreatedTotal).toBe(1)
    expect(stats.contextsDestroyedTotal).toBe(2)
  })

  it('tracks the largest canvas seen', () => {
    noteContextCreated({ width: 400, height: 700, resolution: 2 })
    noteContextCreated({ width: 2400, height: 2240, resolution: 3 })
    noteContextDestroyed({ width: 2400, height: 2240, resolution: 3 })
    expect(getGlStats().largestCanvasMB).toBe(185)
  })

  it('stays silent for small single canvases', () => {
    noteContextCreated({ width: 400, height: 700, resolution: 2 })
    expect(rollbarSpy.info).not.toHaveBeenCalled()
    expect(rollbarSpy.warn).not.toHaveBeenCalled()
  })

  it('warns on a high-memory canvas', () => {
    noteContextCreated({ width: 2400, height: 2240, resolution: 3 })
    expect(rollbarSpy.warn).toHaveBeenCalledWith(
      '[pixi] high GPU canvas memory',
      expect.objectContaining({ estimatedMB: 185, liveContexts: 1 }),
    )
  })

  it('reports when a second live context appears', () => {
    noteContextCreated({ width: 400, height: 700, resolution: 2 })
    noteContextCreated({ width: 400, height: 700, resolution: 2 })
    expect(rollbarSpy.info).toHaveBeenCalledWith(
      '[pixi] webgl context created',
      expect.objectContaining({ liveContexts: 2 }),
    )
  })
})
