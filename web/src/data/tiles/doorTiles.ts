// Animated door tiles — see the material -> style comments in baseChipIndex.ts
// (search "Animated doors") for how each WallMaterial's 9 (or 18, double-leaf)
// globalIds were derived from the door1/door2/door3 sheets.
import { BASE_CHIP_TILES } from './baseChipIndex'
import type { WallMaterial } from './buildingMaterials'

export type DoorRole = 'Above' | 'Top' | 'Bottom'
export type DoorFrame = 0 | 1 | 2 // closed, opening, open

interface DoorStyle {
  doubleLeaf: boolean
  prefix: string // e.g. 'woodWall' or 'portcullis'
}

/** Which door style (and sheet) each wall material's building door uses. */
export const DOOR_STYLE_BY_MATERIAL: Record<WallMaterial, DoorStyle> = {
  woodWall:            { doubleLeaf: false, prefix: 'woodWall' },
  whiteStone:          { doubleLeaf: false, prefix: 'whiteStone' },
  tudorFrame:          { doubleLeaf: false, prefix: 'tudorFrame' },
  darkStone:           { doubleLeaf: false, prefix: 'darkStone' },
  brick:               { doubleLeaf: false, prefix: 'brick' },
  castleStone:         { doubleLeaf: false, prefix: 'castleStone' },
  renderedBrick:       { doubleLeaf: false, prefix: 'renderedBrick' },
  interiorWallWhite:   { doubleLeaf: false, prefix: 'interiorWallWhite' },
  ornateStone:         { doubleLeaf: false, prefix: 'ornateStone' },
  reinforcedStone:     { doubleLeaf: false, prefix: 'reinforcedStone' },
  prisonRailings:      { doubleLeaf: false, prefix: 'prisonRailings' },
  woodenSlats:         { doubleLeaf: false, prefix: 'woodenSlats' },
  interiorWallStriped: { doubleLeaf: false, prefix: 'interiorWallStriped' },
  ironholdKeep:        { doubleLeaf: true,  prefix: 'portcullis' },
}

function tileFor(name: string): number {
  const id = (BASE_CHIP_TILES as Record<string, number | undefined>)[name]
  if (id === undefined) throw new Error(`[doorTiles] missing BASE_CHIP_TILES entry: ${name}`)
  return id
}

/** Left/right leaf tile(s) for one role (Above/Top/Bottom) at a given frame. Single-leaf doors return a 1-element array. */
export function getDoorRoleTiles(material: WallMaterial, role: DoorRole, frame: DoorFrame): number[] {
  const style = DOOR_STYLE_BY_MATERIAL[material]
  const anim = frame + 1
  if (!style.doubleLeaf) return [tileFor(`${style.prefix}Door${role}Anim${anim}`)]
  return [
    tileFor(`${style.prefix}Door${role}LeftAnim${anim}`),
    tileFor(`${style.prefix}Door${role}RightAnim${anim}`),
  ]
}

/** All 3 roles' tile(s) for a given frame, in Above/Top/Bottom order (top-to-bottom draw order). */
export function getDoorFrameTiles(material: WallMaterial, frame: DoorFrame): Record<DoorRole, number[]> {
  return {
    Above:  getDoorRoleTiles(material, 'Above', frame),
    Top:    getDoorRoleTiles(material, 'Top', frame),
    Bottom: getDoorRoleTiles(material, 'Bottom', frame),
  }
}
