import * as PIXI from 'pixi.js'
import { ENV_TILES, PATH, TILE_SIZE, PATH_TILE } from '../data/tiles/tileIndex'
import { loadTileTexture } from './pixiHelpers'

// ── 8-neighbor tile lookup tables ─────────────────────────────────────────────
// Normalized 8-bit key: bit0=N, bit1=NE(only if N&&E), bit2=E, bit3=SE(only if S&&E),
//                       bit4=S, bit5=SW(only if S&&W), bit6=W, bit7=NW(only if N&&W)
// Diagonals bits are pre-zeroed when adjacent cardinals aren't both set, so any
// combination that reaches here is already canonical. 256 entries → ~47 tile IDs.
export function buildTileLookup(canal: boolean): number[] {
  const t = new Array<number>(256)
  for (let mask = 0; mask < 256; mask++) {
    const N  = !!(mask &   1)
    const NE = !!(mask &   2)
    const E  = !!(mask &   4)
    const SE = !!(mask &   8)
    const S  = !!(mask &  16)
    const SW = !!(mask &  32)
    const W  = !!(mask &  64)
    const NW = !!(mask & 128)

    if (N && E && S && W) {
      if (canal) {
        const missing = (!NE ? 1 : 0) + (!SE ? 1 : 0) + (!SW ? 1 : 0) + (!NW ? 1 : 0)
        if (missing === 0)        t[mask] = PATH.allSidesNoGrass
        else if (missing === 1 && !NE) t[mask] = PATH.grassCornerTR
        else if (missing === 1 && !SE) t[mask] = PATH.grassCornerBR
        else if (missing === 1 && !SW) t[mask] = PATH.grassCornerBL
        else if (missing === 1 && !NW) t[mask] = PATH.grassCornerTL
        else                      t[mask] = PATH.allSidesNoGrass
      } else {
        t[mask] = PATH.allSidesNoGrass
      }
    } else if (N && E && S)      t[mask] = PATH.tJuncRight
    else if (E && S && W)        t[mask] = PATH.edgeTop
    else if (N && S && W)        t[mask] = PATH.tJuncLeft2
    else if (N && E && W)        t[mask] = PATH.edgeBottom
    else if (N && S)             t[mask] = PATH.vertical
    else if (E && W)             t[mask] = PATH.horizontal
    else if (N && E)             t[mask] = NE ? PATH.quadTopRight    : (canal ? PATH.grassCornerBL : PATH.turnTopRight)
    else if (N && W)             t[mask] = NW ? PATH.quadTopLeft     : (canal ? PATH.grassCornerBR : PATH.turnTopLeft)
    else if (S && E)             t[mask] = SE ? PATH.quadBottomRight : (canal ? PATH.grassCornerTL : PATH.turnBottomRight)
    else if (S && W)             t[mask] = SW ? PATH.quadBottomLeft  : (canal ? PATH.grassCornerTR : PATH.turnBottomLeft)
    else if (N)                  t[mask] = PATH.topOnly
    else if (E)                  t[mask] = PATH.rightOnly
    else if (S)                  t[mask] = PATH.bottomOnly
    else if (W)                  t[mask] = PATH.leftOnly
    else                         t[mask] = PATH.isolated
  }
  return t
}

export const PATH_TILE_LOOKUP  = buildTileLookup(false)
export const CANAL_TILE_LOOKUP = buildTileLookup(true)

/**
 * Renders path tiles into `container` for a pre-computed set of tile positions.
 * `pathSet` contains `"tx,ty"` strings; the environment determines tile file and
 * whether the canal (wide-path) lookup table is used.
 */
export async function renderPathTiles(
  container: PIXI.Container,
  pathSet: Set<string>,
  environment?: string,
  tileFileOverride?: string,
  useCanal?: boolean,
): Promise<void> {
  const T = TILE_SIZE
  const pathFile = tileFileOverride ?? ENV_TILES[environment ?? '']?.pathFile ?? PATH_TILE.grass1Dirt1
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  const tileUrl = `${base}${pathFile.slice(1)}`
  const pathWidth = tileFileOverride ? 1 : (ENV_TILES[environment ?? '']?.pathWidth ?? 1)
  const lookup = (useCanal || pathWidth > 1) ? CANAL_TILE_LOOKUP : PATH_TILE_LOOKUP

  const key = (tx: number, ty: number) => `${tx},${ty}`
  const has = (tx: number, ty: number) => pathSet.has(key(tx, ty))

  const tileVariant = (tx: number, ty: number): number => {
    const N = has(tx, ty - 1), E = has(tx + 1, ty), S = has(tx, ty + 1), W = has(tx - 1, ty)
    const mask =
      (N                          ?   1 : 0) |
      (N && E && has(tx+1, ty-1)  ?   2 : 0) |
      (E                          ?   4 : 0) |
      (S && E && has(tx+1, ty+1)  ?   8 : 0) |
      (S                          ?  16 : 0) |
      (S && W && has(tx-1, ty+1)  ?  32 : 0) |
      (W                          ?  64 : 0) |
      (N && W && has(tx-1, ty-1)  ? 128 : 0)
    return lookup[mask]
  }

  const byVariant = new Map<number, Array<{ tx: number; ty: number }>>()
  for (const k of pathSet) {
    const [tx, ty] = k.split(',').map(Number)
    const v = tileVariant(tx, ty)
    if (!byVariant.has(v)) byVariant.set(v, [])
    byVariant.get(v)!.push({ tx, ty })
  }

  await Promise.all(
    Array.from(byVariant.entries()).map(async ([v, tiles]) => {
      const tex = await loadTileTexture(tileUrl, v, 8)
      if (container.destroyed) return
      for (const { tx, ty } of tiles) {
        const s = new PIXI.Sprite(tex)
        s.position.set(tx * T, ty * T)
        container.addChild(s)
      }
    })
  )
}
