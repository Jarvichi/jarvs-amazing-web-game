// Door spritesheets pack a 3-frame swing animation (closed → opening → open/edge-on)
// per door style, each style spanning `tileRows` tile-rows (doors are drawn 2 tiles
// tall: upper + lower half) by `frameCols` tile-columns per frame. Single-leaf doors
// (Door1, Door2) are 1 column per frame; double-leaf doors (Door3) are 2 columns per
// frame since both leaves swing together. Frame layout confirmed by visual inspection
// of the sheets — verify in the TileBrowser (World / door1|door2|door3 stories) before
// adding new style origins below.
export interface DoorSheetDef {
  file: string
  frameCols: number  // tile-columns spanned by one animation frame
  tileRows: number   // tile-rows spanned by the door sprite (upper + lower half)
  frameCount: number // 3: closed, opening, open
}

export const DOOR_SHEETS: Record<string, DoorSheetDef> = {
  door1: { file: '/world/doors/Door1_pipo.png', frameCols: 1, tileRows: 2, frameCount: 3 },
  door2: { file: '/world/doors/Door2_pipo.png', frameCols: 1, tileRows: 2, frameCount: 3 },
  door3: { file: '/world/doors/Door3_pipo.png', frameCols: 2, tileRows: 2, frameCount: 3 },
}

/**
 * Pixel rect (in the sheet's native resolution) for one animation frame of a door
 * style. `styleRow`/`styleCol` is the tile position of the style's closed frame
 * (top-left cell), as seen in the TileBrowser.
 */
export function doorFrameRect(
  def: DoorSheetDef,
  styleRow: number,
  styleCol: number,
  frame: number,
): { x: number; y: number; w: number; h: number } {
  const s = 32
  return {
    x: (styleCol + frame * def.frameCols) * s,
    y: styleRow * s,
    w: def.frameCols * s,
    h: def.tileRows * s,
  }
}
