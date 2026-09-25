import { describe, it, expect, vi } from 'vitest'
import { buildLabel, entryScript, preventZoom } from './page'

describe('buildLabel', () => {
  it('shows a short commit and the build date', () => {
    expect(buildLabel('0cc72166a1b2c3d4', '2026-09-24T06:40:00.000Z')).toBe('V0CC7216 2026-09-24')
  })

  it('says so for local builds', () => {
    expect(buildLabel(undefined, '2026-09-24T06:40:00.000Z')).toBe('DEV BUILD')
  })
})

describe('entryScript', () => {
  it('finds the hashed entry script in a built page', () => {
    const html = '<head><script type="module" crossorigin src="/assets/shmup-AbC123.js"></script></head>'
    expect(entryScript(html)).toBe('/assets/shmup-AbC123.js')
  })

  it('handles attributes in either order and absolute URLs', () => {
    expect(entryScript('<script src="https://jawg.uk/assets/retro-9z.js" type="module"></script>')).toBe('/assets/retro-9z.js')
  })

  it('tells two deploys apart', () => {
    const a = entryScript('<script type="module" src="/assets/shmup-aaa.js"></script>')
    const b = entryScript('<script type="module" src="/assets/shmup-bbb.js"></script>')
    expect(a).not.toBe(b)
  })

  it('returns null when there is no module script', () => {
    expect(entryScript('<p>nothing here</p>')).toBeNull()
  })
})

describe('preventZoom', () => {
  function setup() {
    const listeners: Record<string, (e: unknown) => void> = {}
    vi.stubGlobal('document', { addEventListener: (type: string, fn: (e: unknown) => void) => { listeners[type] = fn } })
    preventZoom()
    vi.unstubAllGlobals()
    const touchend = (target: { closest: (s: string) => unknown }, cancelable = true) => {
      const e = { cancelable, target, preventDefault: vi.fn() }
      listeners.touchend(e)
      return e.preventDefault.mock.calls.length > 0
    }
    return { listeners, touchend }
  }
  const canvas = { closest: () => null }
  const link = { closest: (s: string) => (s.includes('a') ? {} : null) }

  it('cancels taps on the game so a double tap cannot zoom', () => {
    expect(setup().touchend(canvas)).toBe(true)
  })

  it('leaves links alone so they still follow', () => {
    expect(setup().touchend(link)).toBe(false)
  })

  it('does not touch events the browser will not let it cancel (mid-scroll)', () => {
    expect(setup().touchend(canvas, false)).toBe(false)
  })

  it('also cancels dblclick', () => {
    const e = { preventDefault: vi.fn() }
    setup().listeners.dblclick(e)
    expect(e.preventDefault).toHaveBeenCalled()
  })
})
