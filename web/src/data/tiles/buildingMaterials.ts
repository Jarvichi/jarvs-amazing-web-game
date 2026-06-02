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
  leftTop:          number
  pillarTop:        number
  shadowTop:        number
  shadowRightTop:   number
  middleTop:        number
  rightTop:         number
  leftBottom:       number
  pillarBottom:     number
  shadowBottom:     number
  shadowRightBottom: number
  middleBottom:     number
  rightBottom:      number
  doorArchTop:      number
  doorTop:          number
  doorBottom:       number
}

export const WALL_TILES: Record<WallMaterial, WallTileSet> = {
  brick: {
    leftTop:           T.brickLeftTop,
    pillarTop:         T.brickPillarTop,
    shadowTop:         T.brickShadowTop,
    shadowRightTop:    T.brickShadowRightTop,
    middleTop:         T.brickMiddleTop,
    rightTop:          T.brickRightTop,
    leftBottom:        T.brickLeftBottom,
    pillarBottom:      T.brickPillarBottom,
    shadowBottom:      T.brickShadowBottom,
    shadowRightBottom: T.brickShadowRightBottom,
    middleBottom:      T.brickMiddleBottom,
    rightBottom:       T.brickRightBottom,
    doorArchTop:       T.brickDoorArchTop,
    doorTop:           T.brickDoorTop,
    doorBottom:        T.brickDoorBottom,
  },
  woodWall: {
    leftTop:           T.woodWallLeftTop,
    pillarTop:         T.woodWallPillarTop,
    shadowTop:         T.woodWallShadowTop,
    shadowRightTop:    T.woodWallShadowRightTop,
    middleTop:         T.woodWallMiddleTop,
    rightTop:          T.woodWallRightTop,
    leftBottom:        T.woodWallLeftBottom,
    pillarBottom:      T.woodWallPillarBottom,
    shadowBottom:      T.woodWallShadowBottom,
    shadowRightBottom: T.woodWallShadowRightBottom,
    middleBottom:      T.woodWallMiddleBottom,
    rightBottom:       T.woodWallRightBottom,
    doorArchTop:       T.woodWallDoorArchTop,
    doorTop:           T.woodWallDoorTop,
    doorBottom:        T.woodWallDoorBottom,
  },
  tudorFrame: {
    leftTop:           T.tudorFrameLeftTop,
    pillarTop:         T.tudorFramePillarTop,
    shadowTop:         T.tudorFrameShadowTop,
    shadowRightTop:    T.tudorFrameShadowRightTop,
    middleTop:         T.tudorFrameMiddleTop,
    rightTop:          T.tudorFrameRightTop,
    leftBottom:        T.tudorFrameLeftBottom,
    pillarBottom:      T.tudorFramePillarBottom,
    shadowBottom:      T.tudorFrameShadowBottom,
    shadowRightBottom: T.tudorFrameShadowRightBottom,
    middleBottom:      T.tudorFrameMiddleBottom,
    rightBottom:       T.tudorFrameRightBottom,
    doorArchTop:       T.tudorFrameDoorArchTop,
    doorTop:           T.tudorFrameDoorTop,
    doorBottom:        T.tudorFrameDoorBottom,
  },
  renderedBrick: {
    leftTop:           T.renderedBrickLeftTop,
    pillarTop:         T.renderedBrickPillarTop,
    shadowTop:         T.renderedBrickShadowTop,
    shadowRightTop:    T.renderedBrickShadowRightTop,
    middleTop:         T.renderedBrickMiddleTop,
    rightTop:          T.renderedBrickRightTop,
    leftBottom:        T.renderedBrickLeftBottom,
    pillarBottom:      T.renderedBrickPillarBottom,
    shadowBottom:      T.renderedBrickShadowBottom,
    shadowRightBottom: T.renderedBrickShadowRightBottom,
    middleBottom:      T.renderedBrickMiddleBottom,
    rightBottom:       T.renderedBrickRightBottom,
    doorArchTop:       T.renderedBrickDoorArchTop,
    doorTop:           T.renderedBrickDoorTop,
    doorBottom:        T.renderedBrickDoorBottom,
  },
  whiteStone: {
    leftTop:           T.whiteStoneLeftTop,
    pillarTop:         T.whiteStonePillarTop,
    shadowTop:         T.whiteStoneShadowTop,
    shadowRightTop:    T.whiteStoneShadowRightTop,
    middleTop:         T.whiteStoneMiddleTop,
    rightTop:          T.whiteStoneRightTop,
    leftBottom:        T.whiteStoneLeftBottom,
    pillarBottom:      T.whiteStonePillarBottom,
    shadowBottom:      T.whiteStoneShadowBottom,
    shadowRightBottom: T.whiteStoneShadowRightBottom,
    middleBottom:      T.whiteStoneMiddleBottom,
    rightBottom:       T.whiteStoneRightBottom,
    doorArchTop:       T.whiteStoneDoorArchTop,
    doorTop:           T.whiteStoneDoorTop,
    doorBottom:        T.whiteStoneDoorBottom,
  },
  darkStone: {
    leftTop:           T.darkStoneLeftTop,
    pillarTop:         T.darkStonePillarTop,
    shadowTop:         T.darkStoneShadowTop,
    shadowRightTop:    T.darkStoneShadowRightTop,
    middleTop:         T.darkStoneMiddleTop,
    rightTop:          T.darkStoneRightTop,
    leftBottom:        T.darkStoneLeftBottom,
    pillarBottom:      T.darkStonePillarBottom,
    shadowBottom:      T.darkStoneShadowBottom,
    shadowRightBottom: T.darkStoneShadowRightBottom,
    middleBottom:      T.darkStoneMiddleBottom,
    rightBottom:       T.darkStoneRightBottom,
    doorArchTop:       T.darkStoneDoorArchTop,
    doorTop:           T.darkStoneDoorTop,
    doorBottom:        T.darkStoneDoorBottom,
  },
  castleStone: {
    leftTop:           T.castleStoneLeftTop,
    pillarTop:         T.castleStonePillarTop,
    shadowTop:         T.castleStoneShadowTop,
    shadowRightTop:    T.castleStoneShadowRightTop,
    middleTop:         T.castleStoneMiddleTop,
    rightTop:          T.castleStoneRightTop,
    leftBottom:        T.castleStoneLeftBottom,
    pillarBottom:      T.castleStonePillarBottom,
    shadowBottom:      T.castleStoneShadowBottom,
    shadowRightBottom: T.castleStoneShadowRightBottom,
    middleBottom:      T.castleStoneMiddleBottom,
    rightBottom:       T.castleStoneRightBottom,
    doorArchTop:       T.castleStoneDoorArchTop,
    doorTop:           T.castleStoneDoorTop,
    doorBottom:        T.castleStoneDoorBottom,
  },
  ornateStone: {
    leftTop:           T.ornateStoneLeftTop,
    pillarTop:         T.ornateStonePillarTop,
    shadowTop:         T.ornateStoneShadowTop,
    shadowRightTop:    T.ornateStoneShadowRightTop,
    middleTop:         T.ornateStoneMiddleTop,
    rightTop:          T.ornateStoneRightTop,
    leftBottom:        T.ornateStoneLeftBottom,
    pillarBottom:      T.ornateStonePillarBottom,
    shadowBottom:      T.ornateStoneShadowBottom,
    shadowRightBottom: T.ornateStoneShadowRightBottom,
    middleBottom:      T.ornateStoneMiddleBottom,
    rightBottom:       T.ornateStoneRightBottom,
    doorArchTop:       T.ornateStoneDoorArchTop,
    doorTop:           T.ornateStoneDoorTop,
    doorBottom:        T.ornateStoneDoorBottom,
  },
  reinforcedStone: {
    leftTop:           T.reinforcedStoneLeftTop,
    pillarTop:         T.reinforcedStonePillarTop,
    shadowTop:         T.reinforcedStoneShadowTop,
    shadowRightTop:    T.reinforcedStoneShadowRightTop,
    middleTop:         T.reinforcedStoneMiddleTop,
    rightTop:          T.reinforcedStoneRightTop,
    leftBottom:        T.reinforcedStoneLeftBottom,
    pillarBottom:      T.reinforcedStonePillarBottom,
    shadowBottom:      T.reinforcedStoneShadowBottom,
    shadowRightBottom: T.reinforcedStoneShadowRightBottom,
    middleBottom:      T.reinforcedStoneMiddleBottom,
    rightBottom:       T.reinforcedStoneRightBottom,
    doorArchTop:       T.reinforcedStoneDoorArchTop,
    doorTop:           T.reinforcedStoneDoorTop,
    doorBottom:        T.reinforcedStoneDoorBottom,
  },
  woodenSlats: {
    leftTop:           T.woodenSlatsLeftTop,
    pillarTop:         T.woodenSlatsPillarTop,
    shadowTop:         T.woodenSlatsShadowTop,
    shadowRightTop:    T.woodenSlatsShadowRightTop,
    middleTop:         T.woodenSlatsMiddleTop,
    rightTop:          T.woodenSlatsRightTop,
    leftBottom:        T.woodenSlatsLeftBottom,
    pillarBottom:      T.woodenSlatsPillarBottom,
    shadowBottom:      T.woodenSlatsShadowBottom,
    shadowRightBottom: T.woodenSlatsShadowRightBottom,
    middleBottom:      T.woodenSlatsMiddleBottom,
    rightBottom:       T.woodenSlatsRightBottom,
    doorArchTop:       T.woodenSlatsDoorArchTop,
    doorTop:           T.woodenSlatsDoorTop,
    doorBottom:        T.woodenSlatsDoorBottom,
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
  isLeftCol: boolean,
  isPillarCol: boolean,       // col === x1+2
  isShadowCol: boolean,       // col === x1+3 (left shadow)
  isRightCol:  boolean,       // col === x2
  isShadowRightCol = false,   // col === x2-1 (right shadow)
): number {
  const w = WALL_TILES[wall]
  if (isBottomRow) {
    if (isLeftCol)        return w.leftBottom
    if (isPillarCol)      return w.pillarBottom
    if (isShadowCol)      return w.shadowBottom
    if (isShadowRightCol) return w.shadowRightBottom
    if (isRightCol)       return w.rightBottom
    return w.middleBottom
  }
  if (isLeftCol)        return w.leftTop
  if (isPillarCol)      return w.pillarTop
  if (isShadowCol)      return w.shadowTop
  if (isShadowRightCol) return w.shadowRightTop
  if (isRightCol)       return w.rightTop
  return w.middleTop
}
