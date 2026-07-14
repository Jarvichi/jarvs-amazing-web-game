import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createContextLossController, type ContextLossEvent } from './pixiContextLossController'

describe('pixiContextLossController', () => {
  let hidden = false
  const teardown = vi.fn()
  const rebuild = vi.fn()
  const notify = vi.fn()
  const events = () => notify.mock.calls.map(call => call[0] as ContextLossEvent)

  const makeController = () => createContextLossController({
    maxAttempts: 3,
    isHidden: () => hidden,
    teardown,
    rebuild,
    notify,
  })

  beforeEach(() => {
    hidden = false
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
})
