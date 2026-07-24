import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub Pixi so the loader can be exercised in the node test env — only Assets.load
// is reached by the code under test.
const loadMock = vi.fn()
vi.mock('pixi.js', () => ({ Assets: { load: (url: string) => loadMock(url) } }))

const { loadAnimFramesOrStatic } = await import('./pixiHelpers')

/** Resolves `{slug}.svg` only; every `{slug}-N.svg` frame 404s. */
function staticOnly(...slugs: string[]) {
  return (url: string) => {
    const hit = slugs.some(s => url.endsWith(`/${s}.svg`))
    return hit ? Promise.resolve({ url }) : Promise.reject(new Error(`404 ${url}`))
  }
}

describe('loadAnimFramesOrStatic', () => {
  beforeEach(() => { loadMock.mockReset() })

  it('returns the walk frames when they exist', async () => {
    loadMock.mockImplementation((url: string) => Promise.resolve({ url }))
    const frames = await loadAnimFramesOrStatic('Goblin', 3)
    expect(frames.map(f => (f as unknown as { url: string }).url)).toEqual([
      '/sprites/goblin-1.svg', '/sprites/goblin-2.svg', '/sprites/goblin-3.svg',
    ])
  })

  // The opponent commander is the Warlord, which ships only a static sprite. Before
  // this fallback the rejected frame load left it with no sprite on the battlefield.
  it('falls back to the static sprite when frame files are missing', async () => {
    loadMock.mockImplementation(staticOnly('warlord'))
    const frames = await loadAnimFramesOrStatic('Warlord', 3)
    expect(frames).toHaveLength(1)
    expect((frames[0] as unknown as { url: string }).url).toBe('/sprites/warlord.svg')
  })

  it('does not re-request frame files for a slug already known to lack them', async () => {
    loadMock.mockImplementation(staticOnly('commander'))
    await loadAnimFramesOrStatic('Commander', 3)
    loadMock.mockClear()
    await loadAnimFramesOrStatic('Commander', 3)
    expect(loadMock.mock.calls.every(([url]) => url === '/sprites/commander.svg')).toBe(true)
  })

  it('rejects when neither the frames nor the static sprite exist', async () => {
    loadMock.mockImplementation(() => Promise.reject(new Error('404')))
    await expect(loadAnimFramesOrStatic('No Such Unit', 3)).rejects.toThrow()
  })
})
