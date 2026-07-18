import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createContextLossController, type ContextLossEvent } from './pixiContextLossController'

describe('pixiContextLossController', () => {
  let hidden = false
  const teardown = vi.fn()
  const rebuild = vi.fn()
  const notify = vi.fn()
  const events = () => notify.mock.calls.map(call => call[0] as ContextLossEvent)

  // Manual retry-timer harness: scheduled callbacks are captured and fired
  // explicitly with fireRetries(), and cancellations are observed.
  let scheduled: Array<{ fn: () => void; delayMs: number; cancelled: boolean }> = []
  const scheduleRetry = (fn: () => void, delayMs: number) => {
    const entry = { fn, delayMs, cancelled: false }
    scheduled.push(entry)
    return () => { entry.cancelled = true }
  }
  const fireRetries = () => {
    const pending = scheduled.filter(s => !s.cancelled)
    scheduled = []
    pending.forEach(s => s.fn())
  }

  const makeController = () => createContextLossController({
    maxAttempts: 3,
    isHidden: () => hidden,
    teardown,
    rebuild,
    notify,
    scheduleRetry,
  })

  beforeEach(() => {
    hidden = false
    scheduled = []
    teardown.mockClear()
    rebuild.mockClear()
    notify.mockClear()
  })

  it('rebuilds immediately when the context is lost while visible', () => {
    const c = makeController()
    c.onContextLost()
    expect(teardown).toHaveBeenCalledTimes(1)
    expect(rebuild).toHaveBeenCalledTimes(1)
    expect(c.attempts()).toBe(1)
    expect(events()).toEqual(['contextlost', 'rebuild-started'])
  })

  it('defers the rebuild when the context is lost while hidden', () => {
    hidden = true
    const c = makeController()
    c.onContextLost()
    expect(teardown).toHaveBeenCalledTimes(1)  // GPU memory is still freed immediately
    expect(rebuild).not.toHaveBeenCalled()
    expect(c.hasPendingRebuild()).toBe(true)
    expect(c.attempts()).toBe(0)
    expect(events()).toEqual(['contextlost', 'rebuild-deferred'])
  })

  it('does not burn attempts on repeated losses while hidden', () => {
    hidden = true
    const c = makeController()
    for (let i = 0; i < 10; i++) c.onContextLost()
    expect(c.attempts()).toBe(0)
    expect(rebuild).not.toHaveBeenCalled()
  })

  it('runs a deferred rebuild exactly once on becoming visible', () => {
    hidden = true
    const c = makeController()
    c.onContextLost()
    hidden = false
    c.onVisible(() => true)
    expect(rebuild).toHaveBeenCalledTimes(1)
    expect(c.hasPendingRebuild()).toBe(false)
    expect(c.attempts()).toBe(1)
    c.onVisible(() => false)
    expect(rebuild).toHaveBeenCalledTimes(1)
  })

  it('detects a silent context loss on resume and rebuilds', () => {
    const c = makeController()
    c.onVisible(() => true)
    expect(events()).toEqual(['silent-context-loss', 'rebuild-started'])
    expect(teardown).toHaveBeenCalledTimes(1)
    expect(rebuild).toHaveBeenCalledTimes(1)
  })

  it('does nothing on resume when the context is healthy', () => {
    const c = makeController()
    c.onVisible(() => false)
    expect(notify).not.toHaveBeenCalled()
    expect(teardown).not.toHaveBeenCalled()
    expect(rebuild).not.toHaveBeenCalled()
  })

  it('re-arms the attempt budget after each successful rebuild', () => {
    const c = makeController()
    for (let i = 0; i < 5; i++) {
      c.onContextLost()
      c.onRebuildSucceeded()
    }
    expect(c.attempts()).toBe(0)
    expect(events()).not.toContain('rebuild-given-up')
    expect(rebuild).toHaveBeenCalledTimes(5)
  })

  it('gives up after exceeding the cap without an intervening success', () => {
    const c = makeController()
    c.onContextLost()
    c.onContextLost()
    c.onContextLost()
    expect(rebuild).toHaveBeenCalledTimes(3)
    c.onContextLost()
    expect(rebuild).toHaveBeenCalledTimes(3)
    expect(events().filter(e => e === 'rebuild-given-up')).toEqual(['rebuild-given-up'])
    expect(teardown).toHaveBeenCalledTimes(4)
  })

  it('gives up on a silent-loss loop too', () => {
    const c = makeController()
    for (let i = 0; i < 4; i++) c.onVisible(() => true)
    expect(rebuild).toHaveBeenCalledTimes(3)
    expect(events()).toContain('rebuild-given-up')
  })

  it('re-arms the budget on the next foreground resume after giving up', () => {
    const c = makeController()
    for (let i = 0; i < 4; i++) c.onContextLost()
    expect(events()).toContain('rebuild-given-up')
    expect(rebuild).toHaveBeenCalledTimes(3)

    // Player backgrounds the tab and comes back later — pressure has passed.
    c.onVisible(() => true)
    expect(events()).toContain('budget-rearmed')
    expect(rebuild).toHaveBeenCalledTimes(4)
    expect(c.attempts()).toBe(1)
  })

  it('schedules a backoff retry when init fails while visible', () => {
    const c = makeController()
    c.onInitFailed()
    expect(events()).toEqual(['retry-scheduled'])
    expect(notify.mock.calls[0][1].delayMs).toBe(1000)
    expect(rebuild).not.toHaveBeenCalled()

    fireRetries()
    expect(rebuild).toHaveBeenCalledTimes(1)
    expect(events()).toEqual(['retry-scheduled', 'rebuild-started'])
  })

  it('backs off exponentially on repeated init failures and gives up at the cap', () => {
    const c = makeController()
    const delays: number[] = []
    for (let i = 0; i < 4; i++) {
      c.onInitFailed()
      const last = notify.mock.calls[notify.mock.calls.length - 1]
      if (last[0] === 'retry-scheduled') delays.push(last[1].delayMs)
      fireRetries()
    }
    // Delay caps at 4s; the 4th retry is the one that fires into give-up.
    expect(delays).toEqual([1000, 2000, 4000, 4000])
    expect(rebuild).toHaveBeenCalledTimes(3)
    expect(events()).toContain('rebuild-given-up')
    // After give-up, further init failures stay quiet until a resume re-arms.
    notify.mockClear()
    c.onInitFailed()
    expect(notify).not.toHaveBeenCalled()
  })

  it('defers an init failure to resume when hidden', () => {
    hidden = true
    const c = makeController()
    c.onInitFailed()
    expect(events()).toEqual(['rebuild-deferred'])
    expect(scheduled).toHaveLength(0)
    expect(c.hasPendingRebuild()).toBe(true)

    hidden = false
    c.onVisible(() => true)
    expect(rebuild).toHaveBeenCalledTimes(1)
  })

  it('defers a scheduled retry that fires after the tab was hidden', () => {
    const c = makeController()
    c.onInitFailed()
    hidden = true
    fireRetries()
    expect(rebuild).not.toHaveBeenCalled()
    expect(c.hasPendingRebuild()).toBe(true)

    hidden = false
    c.onVisible(() => true)
    expect(rebuild).toHaveBeenCalledTimes(1)
  })

  it('cancels a scheduled retry when a resume rebuild supersedes it', () => {
    const c = makeController()
    c.onInitFailed()
    // Tab hidden+shown before the timer fires; probe reports the canvas missing.
    c.onVisible(() => true)
    expect(rebuild).toHaveBeenCalledTimes(1)
    expect(scheduled[0].cancelled).toBe(true)
    fireRetries()
    expect(rebuild).toHaveBeenCalledTimes(1)  // no double rebuild
  })

  it('manualRetry resets the budget and rebuilds immediately', () => {
    const c = makeController()
    for (let i = 0; i < 4; i++) c.onContextLost()
    expect(events()).toContain('rebuild-given-up')
    rebuild.mockClear()

    c.manualRetry()
    expect(rebuild).toHaveBeenCalledTimes(1)
    expect(c.attempts()).toBe(1)
  })

  it('dispose cancels a scheduled retry', () => {
    const c = makeController()
    c.onInitFailed()
    c.dispose()
    fireRetries()
    expect(rebuild).not.toHaveBeenCalled()
  })
})
