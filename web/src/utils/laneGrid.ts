import { TILE_SIZE } from '../data/tiles/tileIndex'
import { gameToTile, GRID_REF_HEIGHT } from '../game/engine/terrainGrid'

// ─── Lane coordinate + tile math ──────────────────────────────────────────
//
// Deliberately free of pixi.js so it can be imported by anything, including
// node-side tests: utils/terrainLayer.ts (which re-exports the two coordinate
// helpers for its existing callers) pulls in pixi, and pixi touches `navigator`
// at import time, which does not exist in Node 20.

// Divisor controlling how obstacle radius (game units) maps to tile-ring radius (tiles).
// Tuned against the realistic range of obstacle radius (20-32) and lane CSS height (~318-842px)
// so clusters show real size variety instead of always rounding to a single uniform "plus" shape.
export const TILE_RADIUS_SCALE = 220

/**
 * Battlefield lane coordinate mapping: game units (x: 0–500 forward base→base,
 * y: -80..80 lateral) → canvas pixels, and back. buildRoadGfx/buildTerrainDecorGfx
 * derive their tile coordinates from gameToPixel below; the battlefield editor uses
 * pixelToGame to turn a pointer click into a game-unit waypoint/obstacle position —
 * sharing this single definition keeps the two forever in lockstep.
 */
export function gameToPixel(x: number, y: number, w: number, h: number): { px: number; py: number } {
  return { px: (0.5 + (y / 80) * 0.36) * w, py: (1 - x / 500) * h }
}

export function pixelToGame(px: number, py: number, w: number, h: number): { x: number; y: number } {
  return { x: 500 * (1 - py / h), y: 80 * ((px / w - 0.5) / 0.36) }
}

/**
 * The tile index a game position anchors to, for art that snaps to the tile grid.
 *
 * Callers drawing the battlefield lane pass a tileScale (h / GRID_REF_HEIGHT),
 * and for them the index comes straight from the engine's reference grid rather
 * than being re-derived from measured canvas pixels. A lane canvas is an
 * integer-pixel approximation of that grid — its width rounds to a whole pixel —
 * so rounding px/T on it flips the index for anything sitting exactly on a
 * half-tile boundary. The lane's centre line (game y = 0, the most common
 * authored y there is) sits precisely there: the engine computes 8.5 and rounds
 * up, a 366px-wide lane computes 8.493 and rounds down, and the obstacle's art
 * lands a whole tile away from the disc that actually blocks units. Asking the
 * engine removes the second computation rather than trying to match it.
 *
 * Canvases that are not the lane (no tileScale — the hub, the node map, the
 * scenery preview) have no engine grid to agree with, and keep resolving
 * against their own pixels, which is the only thing that means anything there.
 */
export function anchorTile(
  x: number, y: number, w: number, h: number, T: number, tileScale: number,
): { tcx: number; tcy: number } {
  if (tileScale !== 1) return gameToTile(x, y)
  const { px, py } = gameToPixel(x, y, w, h)
  return { tcx: Math.round(px / T), tcy: Math.round(py / T) }
}

/** Tile radius an obstacle's patch is drawn at — the same disc
 *  game/engine/terrainGrid.ts blocks. Lane callers resolve it against the
 *  reference grid for the reason anchorTile does. */
export function patchTileRadius(radius: number, h: number, T: number, tileScale: number): number {
  const scale = tileScale === 1 ? h / T : GRID_REF_HEIGHT / TILE_SIZE
  return Math.max(1, Math.round(radius * scale / TILE_RADIUS_SCALE))
}
