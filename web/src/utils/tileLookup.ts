import * as PIXI from 'pixi.js'
import { ENV_TILES, PATH, TILE_SIZE, PATH_TILE, PATH_TILE_ANIM, EnvTileDef } from '../data/tiles/tileIndex'
import { loadTileTexture, animateTileSprites } from './pixiHelpers'

// ── 8-neighbor tile lookup tables ─────────────────────────────────────────────
// Normalized 8-bit key: bit0=N, bit1=NE(only if N&&E), bit2=E, bit3=SE(only if S&&E),
//                       bit4=S, bit5=SW(only if S&&W), bit6=W, bit7=NW(only if N&&W)
// Diagonals bits are pre-zeroed when adjacent cardinals aren't both set, so any
// combination that reaches here is already canonical. 256 entries → ~47 tile IDs.

// All-4-cardinal family: 16 variants keyed by which diagonal corners are WATER
// (raw mask bit = 1, i.e. the diagonal neighbor is also in the path/water set),
// indexed by (NW?1:0)|(NE?2:0)|(SE?4:0)|(SW?8:0). A clear bit means that corner
// is land/grass poking into an otherwise water-surrounded tile.
const ALL_SIDES_BY_CORNERS = [
  PATH.allSides,            // 0000 — no corners water → grass at all 4
  PATH.allSidesWaterNW,     // 0001 NW water → grass at NE+SE+SW
  PATH.allSidesWaterNE,     // 0010 NE water → grass at NW+SE+SW
  PATH.allSidesGrassS,      // 0011 NW+NE water → grass at SW+SE
  PATH.allSidesWaterSE,     // 0100 SE water → grass at NW+NE+SW
  PATH.allSidesGrassNESW,   // 0101 NW+SE water (diagonal) → grass at NE+SW
  PATH.allSidesGrassW,      // 0110 NE+SE water → grass at NW+SW
  PATH.allSidesGrassSW,     // 0111 NW+NE+SE water → grass at SW only
  PATH.allSidesWaterSW,     // 1000 SW water → grass at NW+NE+SE
  PATH.allSidesGrassE,      // 1001 NW+SW water → grass at NE+SE
  PATH.allSidesGrassNWSE,   // 1010 NE+SW water (diagonal) → grass at NW+SE
  PATH.allSidesGrassSE,     // 1011 NW+NE+SW water → grass at SE only
  PATH.allSidesGrassN,      // 1100 SE+SW water → grass at NW+NE
  PATH.allSidesGrassNE,     // 1101 NW+SE+SW water → grass at NE only
  PATH.allSidesGrassNW,     // 1110 NE+SE+SW water → grass at NW only
  PATH.allSidesNoGrass,     // 1111 — all corners water → no grass
] as const

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
    if (N && E && S && W) {
      t[mask] = ALL_SIDES_BY_CORNERS[(NW?1:0) | (NE?2:0) | (SE?4:0) | (SW?8:0)]
    }
    else if (N && E && S)        t[mask] = NE ? (SE ? PATH.tJuncRight     : PATH.missingWGrassSE)
                                               : (SE ? PATH.missingWGrassNE : PATH.tJuncLeft)
    else if (E && S && W)        t[mask] = SW ? (SE ? PATH.edgeTop        : PATH.missingNGrassSE)
                                               : (SE ? PATH.missingNGrassSW : PATH.tJuncTop)
    else if (N && S && W)        t[mask] = NW ? (SW ? PATH.tJuncLeft2     : PATH.missingEGrassSW)
                                               : (SW ? PATH.missingEGrassNW : PATH.tJuncRight2)
    else if (N && E && W)        t[mask] = NW ? (NE ? PATH.edgeBottom     : PATH.missingSGrassNE)
                                               : (NE ? PATH.missingSGrassNW : PATH.tJuncBottom)
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

  const byVariant = new Map<number, Array<{ tx: number; ty: number }>>()
  for (const k of pathSet) {
    const [tx, ty] = k.split(',').map(Number)
    const v = tileVariant(tx, ty)
    if (!byVariant.has(v)) byVariant.set(v, [])
    byVariant.get(v)!.push({ tx, ty })
  }

  const anim = PATH_TILE_ANIM[pathFile]

  await Promise.all(
    Array.from(byVariant.entries()).map(async ([v, tiles]) => {
      let tex: PIXI.Texture
      try { tex = await loadTileTexture(tileUrl, v, 8) } catch { return }
      if (container.destroyed) return
      const sprites: PIXI.Sprite[] = []
      for (const { tx, ty } of tiles) {
        const s = new PIXI.Sprite(tex)
        s.position.set(tx * T, ty * T)
        container.addChild(s)
        sprites.push(s)
      }
      if (anim) {
        animateTileSprites(sprites, tex.source, anim, Math.floor(v / 8), v % 8)
      }
    })
  )
}
