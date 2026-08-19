import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// haptics.ts reads/writes localStorage — stub it the same way towerDefence's
// save tests do, since this project's node test environment has no DOM globals.
let store = new Map<string, string>()
const localStorageStub = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) },
}
vi.stubGlobal('localStorage', localStorageStub)

const { isHapticsSupported, isHapticsEnabled, setHapticsEnabled, hapticCardPlay, hapticWin } = await import('./haptics')

describe('haptics', () => {
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', localStorageStub)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('localStorage', localStorageStub)
  })

  it('defaults to enabled when nothing is stored', () => {
    expect(isHapticsEnabled()).toBe(true)
  })

  it('setHapticsEnabled persists the preference', () => {
    setHapticsEnabled(false)
    expect(isHapticsEnabled()).toBe(false)
    setHapticsEnabled(true)
    expect(isHapticsEnabled()).toBe(true)
  })

  it('calls navigator.vibrate when supported and enabled', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })
    setHapticsEnabled(true)
    hapticCardPlay()
    expect(vibrate).toHaveBeenCalledWith(10)
  })

  it('does not call navigator.vibrate when disabled', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })
    setHapticsEnabled(false)
    hapticWin()
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('is unsupported when navigator.vibrate is missing (iOS Safari)', () => {
    vi.stubGlobal('navigator', {})
    expect(isHapticsSupported()).toBe(false)
  })

  it('does not throw when unsupported and enabled', () => {
    vi.stubGlobal('navigator', {})
    setHapticsEnabled(true)
    expect(() => hapticCardPlay()).not.toThrow()
  })
})
