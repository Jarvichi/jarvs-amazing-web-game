import * as PIXI from 'pixi.js'
import { spriteSlug } from '../game/sprites'
import { resolveTileRef } from '../data/tiles/tileIndex'

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

/**
 * Draw a health bar into a Graphics object at (x, y) with the given pixel width.
 * Call g.clear() before drawing all bars if you want to redraw each frame.
 */
export function drawHpBar(
  g: PIXI.Graphics,
  x: number, y: number,
  barWidth: number,
  hpFrac: number,
): void {
  const f   = Math.max(0, Math.min(1, hpFrac))
  const col = f > 0.5 ? 0x44cc44 : f > 0.25 ? 0xddbb00 : 0xcc2222
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
 * Load an arbitrary pixel sub-rectangle from a cached tileset PNG.
 * Useful for reusing a fragment of an existing tile (e.g. a corner crop) as a decal.
 */
export async function loadTileSubRect(url: string, x: number, y: number, w: number, h: number): Promise<PIXI.Texture> {
  const sheet = await _load(url)
  return new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(x, y, w, h) })
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
