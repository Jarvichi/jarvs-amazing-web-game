// Pure grid-layout geometry for the campaign node map. Deliberately free of
// PixiJS (and of NodeMapRederer.tsx, which imports it) so it stays importable
// from plain node-environment tests.
import { TILE_SIZE } from '../../../data/tiles/tileIndex'

export const COL_WIDTH      = 128
export const ROW_HEIGHT     = 96
export const AVATAR_PADDING = 80
export const CONN_W         = 32

// Everything the map draws on the ground — roads, node markers, the avatar — is
// snapped to the centre of a 32px tile. Without this a row whose rowCols parity
// differs from maxRowCols gets a half-row offset, landing the node centre on a
// tile *boundary* while the road tiles under it are laid at floor(y / TILE_SIZE)
// — a visible 16px gap between the node and its own path. Flooring (rather than
// rounding) picks the same tile the road already occupies, so the roads stay put
// and the nodes move onto them.
export function snapToTile(v: number): number {
  return Math.floor(v / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2
}

// The single source of truth for where a grid-mode node sits. Node markers, road
// tiles and connector beziers all read from this, so they cannot drift apart.
export function nodeCenter(
  rowIndex: number, col: number, rowCols: number, maxRowCols: number,
): { x: number; y: number } {
  const vrow = (maxRowCols - rowCols) / 2 + col
  return {
    x: snapToTile(AVATAR_PADDING + rowIndex * (COL_WIDTH + CONN_W) + COL_WIDTH / 2),
    y: snapToTile((vrow + 0.5) * ROW_HEIGHT),
  }
}

export function startPos(mapHeight: number): { x: number; y: number } {
  return { x: AVATAR_PADDING / 2, y: snapToTile(mapHeight / 2) }
}
