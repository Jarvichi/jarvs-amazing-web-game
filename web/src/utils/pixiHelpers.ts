import * as PIXI from 'pixi.js'
import { spriteSlug } from '../game/sprites'

// ── Texture cache ─────────────────────────────────────────────────────────────
// Keyed by full URL so the same texture is never loaded twice across components.

const _cache = new Map<string, Promise<PIXI.Texture>>()

function _load(url: string): Promise<PIXI.Texture> {
  if (!_cache.has(url)) _cache.set(url, PIXI.Assets.load(url) as Promise<PIXI.Texture>)
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
