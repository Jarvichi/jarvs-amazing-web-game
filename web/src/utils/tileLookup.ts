import * as PIXI from 'pixi.js'
import { ENV_TILES, PATH, TILE_SIZE, PATH_TILE, EnvTileDef } from '../data/tiles/tileIndex'
import { loadTileTexture, loadTileSubRect } from './pixiHelpers'

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

    // canal mode used to substitute PATH.grassCornerXX tiles here for single-corner
    // notches/elbows, but those tile indices only contain a fragment of an unrelated
    // 2x2 decorative ring motif rather than real corner-notch art — canal and
    // non-canal now resolve identically for these shapes.
    if (N && E && S && W)        t[mask] = PATH.allSidesNoGrass
    else if (N && E && S)      t[mask] = PATH.tJuncRight
    else if (E && S && W)        t[mask] = PATH.edgeTop
    else if (N && S && W)        t[mask] = PATH.tJuncLeft2
    else if (N && E && W)        t[mask] = PATH.edgeBottom
    else if (N && S)             t[mask] = PATH.vertical
    else if (E && W)             t[mask] = PATH.horizontal
    else if (N && E)             t[mask] = NE ? PATH.quadTopRight    : PATH.turnTopRight
    else if (N && W)             t[mask] = NW ? PATH.quadTopLeft     : PATH.turnTopLeft
    else if (S && E)             t[mask] = SE ? PATH.quadBottomRight : PATH.turnBottomRight
    else if (S && W)             t[mask] = SW ? PATH.quadBottomLeft  : PATH.turnBottomLeft
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

// ── Concave-corner shoreline accent ───────────────────────────────────────────
// No tile in the water sheets contains genuine single-diagonal-corner-missing
// (concave inside-corner) shoreline art — every "fully surrounded by water" mask
// resolves to the flat PATH.allSidesNoGrass tile regardless of which diagonal
// neighbors are missing. To avoid a borderless hole at those corners, a small
// crop of PATH.turnBottomRight's own NW corner (a confirmed-clean shoreline curve)
// is overlaid, mirrored per missing-diagonal direction, on top of the flat tile.
type Corner = 'NW' | 'NE' | 'SW' | 'SE'
const CORNER_ACCENT_SIZE = 14
const CORNER_FLIP: Record<Corner, [number, number]> = {
  NW: [1, 1], NE: [-1, 1], SW: [1, -1], SE: [-1, -1],
}

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
  envDef?: EnvTileDef,
): Promise<void> {
  const T = TILE_SIZE
  const def = envDef ?? ENV_TILES[environment ?? '']
  const pathFile = tileFileOverride ?? def?.pathFile ?? PATH_TILE.grass1Dirt1
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  const tileUrl = `${base}${pathFile.slice(1)}`
  const pathWidth = tileFileOverride ? 1 : (def?.pathWidth ?? 1)
  const isCanal = !!useCanal || pathWidth > 1
  const lookup = isCanal ? CANAL_TILE_LOOKUP : PATH_TILE_LOOKUP

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

  // Only meaningful when fully surrounded by water — the case currently
  // collapsed into PATH.allSidesNoGrass regardless of which diagonals are missing.
  const missingCorners = (tx: number, ty: number): Corner[] => {
    if (!isCanal) return []
    const N = has(tx, ty - 1), E = has(tx + 1, ty), S = has(tx, ty + 1), W = has(tx - 1, ty)
    if (!(N && E && S && W)) return []
    const out: Corner[] = []
    if (!has(tx + 1, ty - 1)) out.push('NE')
    if (!has(tx + 1, ty + 1)) out.push('SE')
    if (!has(tx - 1, ty + 1)) out.push('SW')
    if (!has(tx - 1, ty - 1)) out.push('NW')
    return out
  }

  const byVariant = new Map<number, Array<{ tx: number; ty: number }>>()
  const accentTiles: Array<{ tx: number; ty: number; corner: Corner }> = []
  for (const k of pathSet) {
    const [tx, ty] = k.split(',').map(Number)
    const v = tileVariant(tx, ty)
    if (!byVariant.has(v)) byVariant.set(v, [])
    byVariant.get(v)!.push({ tx, ty })
    for (const corner of missingCorners(tx, ty)) accentTiles.push({ tx, ty, corner })
  }

  await Promise.all(
    Array.from(byVariant.entries()).map(async ([v, tiles]) => {
      let tex: PIXI.Texture
      try { tex = await loadTileTexture(tileUrl, v, 8) } catch { return }
      if (container.destroyed) return
      for (const { tx, ty } of tiles) {
        const s = new PIXI.Sprite(tex)
        s.position.set(tx * T, ty * T)
        container.addChild(s)
      }
    })
  )

  if (accentTiles.length === 0) return
  let accentTex: PIXI.Texture
  try {
    const cornerX = (PATH.turnBottomRight % 8) * T
    const cornerY = Math.floor(PATH.turnBottomRight / 8) * T
    accentTex = await loadTileSubRect(tileUrl, cornerX, cornerY, CORNER_ACCENT_SIZE, CORNER_ACCENT_SIZE)
  } catch { return }
  if (container.destroyed) return
  for (const { tx, ty, corner } of accentTiles) {
    const s = new PIXI.Sprite(accentTex)
    const [flipX, flipY] = CORNER_FLIP[corner]
    s.scale.set(flipX, flipY)
    s.position.set(tx * T + (flipX < 0 ? T : 0), ty * T + (flipY < 0 ? T : 0))
    container.addChild(s)
  }
}
