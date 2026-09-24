import { describe, it, expect } from 'vitest'
import { buildLabel, entryScript } from './page'

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
