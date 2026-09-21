import { describe, it, expect } from 'vitest'
import { isNative, nativePlatform } from './platform'

describe('platform', () => {
  it('reports web until the Capacitor project lands (#2093)', () => {
    expect(isNative()).toBe(false)
    expect(nativePlatform()).toBe('web')
  })
})
