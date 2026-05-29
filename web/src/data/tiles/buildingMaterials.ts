import { BASE_CHIP_TILES } from './baseChipIndex'

const T = BASE_CHIP_TILES

export type WallMaterial = 'brick'
export type RoofMaterial =
  | 'woodRoof'
  | 'yellowSlateRoof'
  | 'blueSlateRoof'
  | 'redSlateRoof'
  | 'greySlateRoof'
  | 'metalRoof'
  | 'strawRoof'

interface WallTileSet {
  pillarTop:    number
  shadowTop:    number
  middleTop:    number
  rightTop:     number
  pillarBottom: number
  shadowBottom: number
  middleBottom: number
  rightBottom:  number
  doorArchTop:  number
  doorTop:      number
  doorBottom:   number
}

export const WALL_TILES: Record<WallMaterial, WallTileSet> = {
  brick: {
    pillarTop:    T.brickPillarTop,
    shadowTop:    T.brickShadowTop,
    middleTop:    T.brickMiddleTop,
    rightTop:     T.brickRightTop,
    pillarBottom: T.brickPillarBottom,
    shadowBottom: T.brickShadowBottom,
    middleBottom: T.brickMiddleBottom,
    rightBottom:  T.brickRightBottom,
    doorArchTop:  T.brickDoorArchTop,
    doorTop:      T.brickDoorTop,
    doorBottom:   T.brickDoorBottom,
  },
}

// [row1, row2, row3, row4] tile IDs for each roof material
export const ROOF_TILES: Record<RoofMaterial, [number, number, number, number]> = {
  woodRoof:        [T.woodRoofRow1,        T.woodRoofRow2,        T.woodRoofRow3,        T.woodRoofRow4],
  yellowSlateRoof: [T.yellowSlateRoofRow1, T.yellowSlateRoofRow2, T.yellowSlateRoofRow3, T.yellowSlateRoofRow4],
  blueSlateRoof:   [T.blueSlateRoofRow1,   T.blueSlateRoofRow2,   T.blueSlateRoofRow3,   T.blueSlateRoofRow4],
  redSlateRoof:    [T.redSlateRoofRow1,     T.redSlateRoofRow2,     T.redSlateRoofRow3,     T.redSlateRoofRow4],
  greySlateRoof:   [T.greySlateRoofRow1,   T.greySlateRoofRow2,   T.greySlateRoofRow3,   T.greySlateRoofRow4],
  metalRoof:       [T.metalRoofRow1,        T.metalRoofRow2,        T.metalRoofRow3,        T.metalRoofRow4],
  strawRoof:       [T.strawRoofRow1,        T.strawRoofRow2,        T.strawRoofRow3,        T.strawRoofRow4],
}

export const ROOF_ROWS = 4

/**
 * Returns the correct wall tile ID for a given column position and row type.
 * Column layout (left→right): pillar | shadow | middle… | right
 * Top and middle rows use the same tile IDs (top tiles repeat vertically).
 */
export function getWallTile(
  wall: WallMaterial,
  isBottomRow: boolean,
  isPillarCol: boolean,  // col === x1
  isShadowCol: boolean,  // col === x1+1
  isRightCol:  boolean,  // col === x2
): number {
  const w = WALL_TILES[wall]
  if (isBottomRow) {
    if (isPillarCol) return w.pillarBottom
    if (isShadowCol) return w.shadowBottom
    if (isRightCol)  return w.rightBottom
    return w.middleBottom
  }
  if (isPillarCol) return w.pillarTop
  if (isShadowCol) return w.shadowTop
  if (isRightCol)  return w.rightTop
  return w.middleTop
}
