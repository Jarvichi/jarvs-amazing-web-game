import { describe, it, expect, vi } from 'vitest'

// pixi.js reads navigator/window at module load (absent in Node 20 CI).
vi.stubGlobal('window', { devicePixelRatio: 2 })
vi.stubGlobal('navigator', { userAgent: 'node' })

const PIXI = await import('pixi.js')
const { createChunkCuller } = await import('./chunkCull')

function tileAt(x: number, y: number, size = 32): InstanceType<typeof PIXI.Graphics> {
  const g = new PIXI.Graphics()
  g.rect(0, 0, size, size).fill(0xffffff)
  g.x = x
  g.y = y
  return g
}

describe('createChunkCuller', () => {
  it('adopts children into grid chunks and leaves only chunk containers on the layer', () => {
    const layer = new PIXI.Container()
    layer.addChild(tileAt(0, 0), tileAt(64, 64), tileAt(600, 0), tileAt(600, 600))
    const culler = createChunkCuller([layer], { chunkPx: 512 })
    culler.rechunk()
    // (0,0)+(64,64) share chunk 0,0; (600,0) → 1,0; (600,600) → 1,1
    expect(culler.stats().chunks).toBe(3)
    expect(layer.children).toHaveLength(3)
  })

  it('culls chunks outside the view and keeps those inside', () => {
    const layer = new PIXI.Container()
    const near = tileAt(0, 0)
    const far = tileAt(2000, 2000)
    layer.addChild(near, far)
    const culler = createChunkCuller([layer], { chunkPx: 512 })
    culler.update(0, 0, 0, 400, 700)
    expect(near.parent!.visible).toBe(true)
    expect(far.parent!.visible).toBe(false)
    expect(culler.stats()).toEqual({ chunks: 2, visibleChunks: 1 })

    // Move the view onto the far chunk
    culler.update(0, 1900, 1900, 400, 700)
    expect(near.parent!.visible).toBe(false)
    expect(far.parent!.visible).toBe(true)
  })

  it('adopts late-added children on the next periodic sweep', () => {
    const layer = new PIXI.Container()
    const culler = createChunkCuller([layer], { chunkPx: 512, rechunkMs: 1000 })
    culler.update(0, 0, 0, 400, 700)  // first update always sweeps
    const late = tileAt(1500, 0)
    layer.addChild(late)
    culler.update(100, 0, 0, 400, 700)  // 100ms — not yet swept, still at layer level
    expect(late.parent).toBe(layer)
    expect(late.visible).toBe(true)     // un-adopted children render normally
    culler.update(1000, 0, 0, 400, 700)
    expect(late.parent).not.toBe(layer)
    expect(late.parent!.visible).toBe(false)  // off-view once adopted
  })

  it('never culls a chunk containing an oversized child', () => {
    const layer = new PIXI.Container()
    const mapWide = new PIXI.Graphics()
    mapWide.rect(0, 0, 2400, 2240).fill(0x00ff00)  // anchored at chunk 0,0 but spans the map
    layer.addChild(mapWide)
    const culler = createChunkCuller([layer], { chunkPx: 512 })
    culler.update(0, 1800, 1800, 400, 700)  // view far from the child's origin
    expect(mapWide.parent!.visible).toBe(true)
  })

  it('accounts for child scale when measuring bounds', () => {
    const layer = new PIXI.Container()
    const scaled = tileAt(480, 0)
    scaled.scale.set(4)  // 32px rect → 128px, reaching x=608 into the next chunk's area
    layer.addChild(scaled)
    const culler = createChunkCuller([layer], { chunkPx: 512 })
    culler.update(0, 560, 0, 400, 700)  // view starts past the unscaled extent
    expect(scaled.parent!.visible).toBe(true)
  })
})
