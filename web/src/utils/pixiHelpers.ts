import * as PIXI from 'pixi.js'
import { spriteSlug } from '../game/sprites'
import { resolveTileRef, currentAnimFrame, TileAnim } from '../data/tiles/tileIndex'

// ── Texture cache ─────────────────────────────────────────────────────────────
// Keyed by full URL so the same texture is never loaded twice across components.

const _cache = new Map<string, Promise<PIXI.Texture>>()

function _load(url: string): Promise<PIXI.Texture> {
  if (!_cache.has(url)) {
    const p = PIXI.Assets.load(url) as Promise<PIXI.Texture>
    p.catch(() => _cache.delete(url))
    _cache.set(url, p)
  }
  return _cache.get(url)!
}

/** Load a static sprite texture by unit/building name. */
export function loadSpriteTexture(name: string): Promise<PIXI.Texture> {
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  const url = `${base}sprites/${spriteSlug(name)}.svg`
  return _load(url)
}

/** Load all animation frame textures for a unit (slug-1.svg … slug-N.svg). */
export async function loadAnimFrames(name: string, frameCount: number): Promise<PIXI.Texture[]> {
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  const slug = spriteSlug(name)
  return Promise.all(
    Array.from({ length: frameCount }, (_, i) =>
      _load(`${base}sprites/${slug}-${i + 1}.svg`),
    ),
  )
}

// Slugs already found to have no `{slug}-N.svg` frames, so repeat callers go
// straight to the static sprite instead of re-issuing 404s every sync.
const _noAnimFrames = new Set<string>()

/**
 * Load a unit's walk frames, falling back to its single static `{slug}.svg`
 * when the per-frame files don't exist (e.g. Warlord / Commander, which only
 * ship a static sprite). This mirrors AnimatedSpriteImg's onError fallback in
 * SpriteImg.tsx — without it a frame-less unit renders as nothing at all.
 * Rejects only when the static sprite is missing too.
 */
export async function loadAnimFramesOrStatic(name: string, frameCount: number): Promise<PIXI.Texture[]> {
  const slug = spriteSlug(name)
  if (!_noAnimFrames.has(slug)) {
    try {
      return await loadAnimFrames(name, frameCount)
    } catch {
      _noAnimFrames.add(slug)
    }
  }
  return [await loadSpriteTexture(name)]
}

/**
 * Animate a group of sprites that all share one tile-sheet texture source and
 * show the same combo tile at a different animation frame (e.g. a water path
 * tile). `baseRow`/`baseCol` locate that combo tile within one frame-block;
 * frames are additional copies of the same grid laid out to the right of it.
 * Stops automatically once every sprite is destroyed.
 */
export function animateTileSprites(
  sprites: PIXI.Sprite[],
  source: PIXI.Texture['source'],
  anim: TileAnim,
  baseRow: number,
  baseCol: number,
): void {
  const s = 32
  const totalCols = anim.columns * anim.frameCount
  let lastFrame = -1
  const tick = () => {
    if (sprites.every(sp => sp.destroyed)) {
      PIXI.Ticker.shared.remove(tick)
      return
    }
    const frame = currentAnimFrame(anim)
    if (frame === lastFrame) return
    lastFrame = frame
    const x = (baseCol + frame * anim.columns) * s
    const y = baseRow * s
    const tex = new PIXI.Texture({ source, frame: new PIXI.Rectangle(x, y, s, s) })
    for (const sp of sprites) {
      if (!sp.destroyed) sp.texture = tex
    }
  }
  PIXI.Ticker.shared.add(tick)
}

/**
 * HP bar fill ramps, as [healthy, hurt, critical].
 *
 * Friendly units read green and hostile units read red, restoring the owner tint
 * the DOM battlefield had (`.lane-unit--player/--opponent .lane-unit-hp-fill`)
 * before the Pixi migration flattened every bar onto one fraction ramp — which
 * left full-health enemies looking identical to your own units. Shades darken as
 * HP drops so injury still reads without either side straying into the other's
 * hue. `neutral` is the pre-existing owner-agnostic ramp, kept for callers that
 * have no side to show.
 */
const HP_BAR_RAMP: Record<'player' | 'opponent' | 'neutral', readonly [number, number, number]> = {
  player:   [0x33ff33, 0x28cc28, 0x1f9e1f],
  opponent: [0xff4444, 0xd12f2f, 0xa32020],
  neutral:  [0x44cc44, 0xddbb00, 0xcc2222],
}

/**
 * Draw a health bar into a Graphics object at (x, y) with the given pixel width.
 * Call g.clear() before drawing all bars if you want to redraw each frame.
 * Pass `owner` to tint the fill by side; omit it for the neutral ramp.
 */
export function drawHpBar(
  g: PIXI.Graphics,
  x: number, y: number,
  barWidth: number,
  hpFrac: number,
  owner?: 'player' | 'opponent',
): void {
  const f = Math.max(0, Math.min(1, hpFrac))
  const [healthy, hurt, critical] = HP_BAR_RAMP[owner ?? 'neutral']
  const col = f > 0.5 ? healthy : f > 0.25 ? hurt : critical
  g.rect(x, y, barWidth, 3).fill(0x111111)
  if (f > 0) g.rect(x, y, Math.round(barWidth * f), 3).fill(col)
}

/**
 * Create a PIXI.Container that acts as an interactive button cell.
 * The onClick callback receives the event when the user clicks/taps.
 */
export function makeClickable(
  container: PIXI.Container,
  onClick: (e: PIXI.FederatedPointerEvent) => void,
): void {
  container.eventMode = 'static'
  container.cursor    = 'pointer'
  container.on('pointerdown', onClick)
}

/**
 * Load a texture directly from an arbitrary URL (with caching).
 * Use this for sprite URLs that aren't derived from a unit name.
 */
export function loadTextureUrl(url: string): Promise<PIXI.Texture> {
  return _load(url)
}

/**
 * Load a single 32×32 tile from a tileset PNG by tile ID.
 * The sheet is cached so repeated calls for the same URL are free.
 */
export async function loadTileTexture(url: string, tileId: number, columns: number): Promise<PIXI.Texture> {
  const sheet = await _load(url)
  const s = 32
  const frame = new PIXI.Rectangle((tileId % columns) * s, Math.floor(tileId / columns) * s, s, s)
  return new PIXI.Texture({ source: sheet.source, frame })
}

/**
 * Load a tile by global tile ID, resolving the correct source file automatically.
 * Supports both legacy baseChip IDs (0–9999) and extended tiles (10000+).
 */
export async function loadTileRef(globalId: number): Promise<PIXI.Texture> {
  const ref = resolveTileRef(globalId)
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  return loadTileTexture(`${base}${ref.file.slice(1)}`, ref.id, ref.columns)
}

/**
 * Tween a Container's (x, y) position to the target over durationMs milliseconds.
 * Uses an ease-in-out curve. Returns a Promise that resolves when the tween completes.
 */
export function tweenTo(
  obj: PIXI.Container,
  targetX: number,
  targetY: number,
  durationMs: number,
  app: PIXI.Application,
): Promise<void> {
  return new Promise(resolve => {
    const startX = obj.x, startY = obj.y
    let elapsed = 0
    const tick = (ticker: PIXI.Ticker) => {
      elapsed += ticker.deltaMS
      const t = Math.min(elapsed / durationMs, 1)
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      obj.x = startX + (targetX - startX) * e
      obj.y = startY + (targetY - startY) * e
      if (t >= 1) { app.ticker.remove(tick); resolve() }
    }
    app.ticker.add(tick)
  })
}

/**
 * Tween a Container along a polyline, easing the journey as a whole rather than
 * each leg — chaining tweenTo() calls instead would decelerate into every bend
 * and accelerate out of it. Distance is distributed by segment length, so the
 * object holds a steady pace around corners. Resolves when the walk completes.
 */
export function tweenAlongPath(
  obj: PIXI.Container,
  points: Array<{ x: number; y: number }>,
  durationMs: number,
  app: PIXI.Application,
): Promise<void> {
  if (points.length < 2) return Promise.resolve()

  const segLen: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    segLen.push(d)
    total += d
  }
  if (total === 0) return Promise.resolve()

  return new Promise(resolve => {
    let elapsed = 0
    const tick = (ticker: PIXI.Ticker) => {
      elapsed += ticker.deltaMS
      const t = Math.min(elapsed / durationMs, 1)
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

      let d = e * total
      let i = 0
      while (i < segLen.length - 1 && d > segLen[i]) { d -= segLen[i]; i++ }
      const a = points[i], b = points[i + 1]
      const f = segLen[i] === 0 ? 0 : d / segLen[i]
      obj.x = a.x + (b.x - a.x) * f
      obj.y = a.y + (b.y - a.y) * f

      if (t >= 1) { app.ticker.remove(tick); resolve() }
    }
    app.ticker.add(tick)
  })
}
