import { BASE_CHIP_TILES } from './baseChipIndex'

const T = BASE_CHIP_TILES

export type WallMaterial =
  | 'brick'
  | 'woodWall'
  | 'tudorFrame'
  | 'renderedBrick'
  | 'whiteStone'
  | 'darkStone'
  | 'castleStone'
  | 'ornateStone'
  | 'reinforcedStone'
  | 'woodenSlats'
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
  woodWall: {
    pillarTop:    T.woodWallPillarTop,
    shadowTop:    T.woodWallShadowTop,
    middleTop:    T.woodWallMiddleTop,
    rightTop:     T.woodWallRightTop,
    pillarBottom: T.woodWallPillarBottom,
    shadowBottom: T.woodWallShadowBottom,
    middleBottom: T.woodWallMiddleBottom,
    rightBottom:  T.woodWallRightBottom,
    doorArchTop:  T.woodWallDoorArchTop,
    doorTop:      T.woodWallDoorTop,
    doorBottom:   T.woodWallDoorBottom,
  },
  tudorFrame: {
    pillarTop:    T.tudorFramePillarTop,
    shadowTop:    T.tudorFrameShadowTop,
    middleTop:    T.tudorFrameMiddleTop,
    rightTop:     T.tudorFrameRightTop,
    pillarBottom: T.tudorFramePillarBottom,
    shadowBottom: T.tudorFrameShadowBottom,
    middleBottom: T.tudorFrameMiddleBottom,
    rightBottom:  T.tudorFrameRightBottom,
    doorArchTop:  T.tudorFrameDoorArchTop,
    doorTop:      T.tudorFrameDoorTop,
    doorBottom:   T.tudorFrameDoorBottom,
  },
  renderedBrick: {
    pillarTop:    T.renderedBrickPillarTop,
    shadowTop:    T.renderedBrickShadowTop,
    middleTop:    T.renderedBrickMiddleTop,
    rightTop:     T.renderedBrickRightTop,
    pillarBottom: T.renderedBrickPillarBottom,
    shadowBottom: T.renderedBrickShadowBottom,
    middleBottom: T.renderedBrickMiddleBottom,
    rightBottom:  T.renderedBrickRightBottom,
    doorArchTop:  T.renderedBrickDoorArchTop,
    doorTop:      T.renderedBrickDoorTop,
    doorBottom:   T.renderedBrickDoorBottom,
  },
  whiteStone: {
    pillarTop:    T.whiteStonePillarTop,
    shadowTop:    T.whiteStoneShadowTop,
    middleTop:    T.whiteStoneMiddleTop,
    rightTop:     T.whiteStoneRightTop,
    pillarBottom: T.whiteStonePillarBottom,
    shadowBottom: T.whiteStoneShadowBottom,
    middleBottom: T.whiteStoneMiddleBottom,
    rightBottom:  T.whiteStoneRightBottom,
    doorArchTop:  T.whiteStoneDoorArchTop,
    doorTop:      T.whiteStoneDoorTop,
    doorBottom:   T.whiteStoneDoorBottom,
  },
  darkStone: {
    pillarTop:    T.darkStonePillarTop,
    shadowTop:    T.darkStoneShadowTop,
    middleTop:    T.darkStoneMiddleTop,
    rightTop:     T.darkStoneRightTop,
    pillarBottom: T.darkStonePillarBottom,
    shadowBottom: T.darkStoneShadowBottom,
    middleBottom: T.darkStoneMiddleBottom,
    rightBottom:  T.darkStoneRightBottom,
    doorArchTop:  T.darkStoneDoorArchTop,
    doorTop:      T.darkStoneDoorTop,
    doorBottom:   T.darkStoneDoorBottom,
  },
  castleStone: {
    pillarTop:    T.castleStonePillarTop,
    shadowTop:    T.castleStoneShadowTop,
    middleTop:    T.castleStoneMiddleTop,
    rightTop:     T.castleStoneRightTop,
    pillarBottom: T.castleStonePillarBottom,
    shadowBottom: T.castleStoneShadowBottom,
    middleBottom: T.castleStoneMiddleBottom,
    rightBottom:  T.castleStoneRightBottom,
    doorArchTop:  T.castleStoneDoorArchTop,
    doorTop:      T.castleStoneDoorTop,
    doorBottom:   T.castleStoneDoorBottom,
  },
  ornateStone: {
    pillarTop:    T.ornateStonePillarTop,
    shadowTop:    T.ornateStoneShadowTop,
    middleTop:    T.ornateStoneMiddleTop,
    rightTop:     T.ornateStoneRightTop,
    pillarBottom: T.ornateStonePillarBottom,
    shadowBottom: T.ornateStoneShadowBottom,
    middleBottom: T.ornateStoneMiddleBottom,
    rightBottom:  T.ornateStoneRightBottom,
    doorArchTop:  T.ornateStoneDoorArchTop,
    doorTop:      T.ornateStoneDoorTop,
    doorBottom:   T.ornateStoneDoorBottom,
  },
  reinforcedStone: {
    pillarTop:    T.reinforcedStonePillarTop,
    shadowTop:    T.reinforcedStoneShadowTop,
    middleTop:    T.reinforcedStoneMiddleTop,
    rightTop:     T.reinforcedStoneRightTop,
    pillarBottom: T.reinforcedStonePillarBottom,
    shadowBottom: T.reinforcedStoneShadowBottom,
    middleBottom: T.reinforcedStoneMiddleBottom,
    rightBottom:  T.reinforcedStoneRightBottom,
    doorArchTop:  T.reinforcedStoneDoorArchTop,
    doorTop:      T.reinforcedStoneDoorTop,
    doorBottom:   T.reinforcedStoneDoorBottom,
  },
  woodenSlats: {
    pillarTop:    T.woodenSlatsPillarTop,
    shadowTop:    T.woodenSlatsShadowTop,
    middleTop:    T.woodenSlatsMiddleTop,
    rightTop:     T.woodenSlatsRightTop,
    pillarBottom: T.woodenSlatsPillarBottom,
    shadowBottom: T.woodenSlatsShadowBottom,
    middleBottom: T.woodenSlatsMiddleBottom,
    rightBottom:  T.woodenSlatsRightBottom,
    doorArchTop:  T.woodenSlatsDoorArchTop,
    doorTop:      T.woodenSlatsDoorTop,
    doorBottom:   T.woodenSlatsDoorBottom,
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
