import { describe, it, expect, beforeEach, vi } from 'vitest'

// crashSentinel needs window/document/localStorage at module load (via
// rollbar.ts) and call time — stub them before importing the module under test.
const rollbarSpy = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), configure: vi.fn() }

let store = new Map<string, string>()
let storageThrows = false
const localStorageStub = {
  getItem: (k: string) => { if (storageThrows) throw new Error('quota'); return store.get(k) ?? null },
  setItem: (k: string, v: string) => { if (storageThrows) throw new Error('quota'); store.set(k, v) },
  removeItem: (k: string) => { if (storageThrows) throw new Error('quota'); store.delete(k) },
}

const windowListeners = new Map<string, () => void>()
const documentListeners = new Map<string, () => void>()
vi.stubGlobal('window', {
  Rollbar: rollbarSpy,
  devicePixelRatio: 2,
  addEventListener: (type: string, fn: () => void) => windowListeners.set(type, fn),
})
vi.stubGlobal('document', {
  visibilityState: 'visible',
  addEventListener: (type: string, fn: () => void) => documentListeners.set(type, fn),
})
vi.stubGlobal('localStorage', localStorageStub)

const { initCrashSentinel, recordScreen, _resetCrashSentinelForTest } = await import('./crashSentinel')

const KEY = 'jarv_crash_sentinel'
const readRecord = () => JSON.parse(store.get(KEY)!)

describe('crashSentinel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    store = new Map()
    storageThrows = false
    windowListeners.clear()
    documentListeners.clear()
    rollbarSpy.warn.mockClear()
    _resetCrashSentinelForTest()
  })

  it('does not report on first boot (no previous record)', () => {
    initCrashSentinel()
    expect(rollbarSpy.warn).not.toHaveBeenCalled()
    expect(readRecord()).toMatchObject({ screen: 'boot', cleanExit: false })
  })

  it('reports an unclean exit with the last known screen', () => {
    store.set(KEY, JSON.stringify({
      ts: Date.now() - 30_000, screen: 'hubworld', location: 'ravenwatch',
      visibility: 'visible', cleanExit: false, largestCanvasMB: 185,
    }))
    initCrashSentinel()
    expect(rollbarSpy.warn).toHaveBeenCalledWith(
      '[sentinel] unclean exit — probable page kill',
      expect.objectContaining({
        lastScreen: 'hubworld',
        lastLocation: 'ravenwatch',
        visibility: 'visible',
        largestCanvasMB: 185,
        secondsAgo: 30,
      }),
    )
  })

  it('does not report after a clean exit', () => {
    store.set(KEY, JSON.stringify({
      ts: Date.now(), screen: 'hubworld', visibility: 'hidden', cleanExit: true,
    }))
    initCrashSentinel()
    expect(rollbarSpy.warn).not.toHaveBeenCalled()
  })

  it('marks the record clean on pagehide and dirty again on pageshow', () => {
    initCrashSentinel()
    windowListeners.get('pagehide')!()
    expect(readRecord().cleanExit).toBe(true)
    windowListeners.get('pageshow')!()
    expect(readRecord().cleanExit).toBe(false)
  })

  it('records screen transitions with WebGL stats', () => {
    initCrashSentinel()
    recordScreen('hubworld', 'ravenwatch')
    expect(readRecord()).toMatchObject({
      screen: 'hubworld',
      location: 'ravenwatch',
      cleanExit: false,
      liveContexts: expect.any(Number),
    })
  })

  it('survives a throwing localStorage', () => {
    storageThrows = true
    expect(() => {
      initCrashSentinel()
      recordScreen('hubworld')
    }).not.toThrow()
  })
})
