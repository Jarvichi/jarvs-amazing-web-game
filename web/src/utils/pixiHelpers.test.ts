import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub Pixi so the loader can be exercised in the node test env — only Assets.load
// is reached by the code under test.
const loadMock = vi.fn()
vi.mock('pixi.js', () => ({ Assets: { load: (url: string) => loadMock(url) } }))

const { loadAnimFramesOrStatic, drawHpBar } = await import('./pixiHelpers')

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

/** Minimal stand-in for PIXI.Graphics — drawHpBar only chains rect().fill(). */
function fakeGraphics() {
  const fills: number[] = []
  const g = {
    fills,
    rect: () => g,
    fill: (col: number) => { fills.push(col); return g },
  }
  return g
}

/** Fill color of the bar itself (the first fill is the dark backing rect). */
function fillColor(hpFrac: number, owner?: 'player' | 'opponent'): number | undefined {
  const g = fakeGraphics()
  drawHpBar(g as never, 0, 0, 30, hpFrac, owner)
  return g.fills[1]
}

describe('drawHpBar', () => {
  // Enemy bars used to share the player's green at full health, making the two
  // sides indistinguishable on the battlefield.
  it('keeps player and opponent bars in different hues at every damage level', () => {
    for (const frac of [1, 0.4, 0.1]) {
      expect(fillColor(frac, 'player')).not.toBe(fillColor(frac, 'opponent'))
    }
  })

  it('darkens within the owner hue as HP drops', () => {
    for (const owner of ['player', 'opponent'] as const) {
      const [healthy, hurt, critical] = [1, 0.4, 0.1].map(f => fillColor(f, owner)!)
      expect(healthy).toBeGreaterThan(hurt)
      expect(hurt).toBeGreaterThan(critical)
    }
  })

  it('falls back to the neutral ramp when no owner is given', () => {
    expect(fillColor(1)).toBe(0x44cc44)
    expect(fillColor(0.4)).toBe(0xddbb00)
    expect(fillColor(0.1)).toBe(0xcc2222)
  })

  it('draws only the backing rect at zero HP', () => {
    const g = fakeGraphics()
    drawHpBar(g as never, 0, 0, 30, 0, 'opponent')
    expect(g.fills).toEqual([0x111111])
  })
})
