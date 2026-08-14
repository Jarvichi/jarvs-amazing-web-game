// ─── Shared building-tile placement ──────────────────────────────────────────
//
// Computes the roof / wall / door tile placements for a single building
// footprint. Shared by the live hub canvas (HubTownCanvas) and the map editor
// (MapEditorCanvas) so editor previews match the in-game look exactly.

import { WALL_TILES, ROOF_TILES, ROOF_ROWS, getWallTile } from './buildingMaterials'
import type { WallMaterial, RoofMaterial } from './buildingMaterials'

/** A door tile, in absolute tile coords — `(tx, ty)` is the player's walk-in
 *  trigger tile. The door sprite always renders one tile north (up) of that,
 *  for any door whose tx falls within a rect's horizontal span (used only to
 *  pick the matching wall's door-tile art). Set `hideSprite` for a door that
 *  should stay a fully invisible walk-in trigger (e.g. a hidden side/back
 *  entrance). */
export interface BuildingDoorTile {
  tx: number
  ty: number
  hideSprite?: boolean
}

/**
 * Returns a `tileId → [(tx, ty), …]` map of every tile needed to draw a
 * building. Insertion order matters: wall tiles are emitted before door tiles so
 * doors overdraw the wall at shared positions (mirror the live renderer).
 */
export function placeBuildingTiles(
  rect: [number, number, number, number],
  wall: WallMaterial,
  roof: RoofMaterial,
  doors: BuildingDoorTile[] = [],
  opts: { skipDoorLeaf?: boolean } = {},
): Map<number, [number, number][]> {
  const placements = new Map<number, [number, number][]>()
  const place = (tileId: number, tx: number, ty: number) => {
    const list = placements.get(tileId) ?? []
    list.push([tx, ty])
    placements.set(tileId, list)
  }

  const [x1, y1, x2, y2] = rect
  const roofTileIds = ROOF_TILES[roof]
  const width = x2 - x1 + 1

  // Roof pass — top rows
  for (let row = 1; row < ROOF_ROWS; row++)
    for (let tx = x1; tx <= x2; tx++)
      place(roofTileIds[row], tx, y1 + row)

  // Wall pass — remaining rows (top tiles repeat for middle rows)
  const firstWallRow = y1 + ROOF_ROWS
  for (let ty = firstWallRow; ty <= y2; ty++) {
    for (let tx = x1; tx <= x2; tx++) {
      const isPillarCol      = tx === x1 + 1 || tx === x2 - 1
      const isShadowCol      = width >= 5 && tx === x1 + 2
      const isShadowRightCol = width >= 5 && tx === x2
      const isBottomRow      = ty === y2
      const tileId = getWallTile(
        wall, isBottomRow,
        tx === x1,
        isPillarCol,
        isShadowCol,
        tx === x2,
        isShadowRightCol,
      )
      place(tileId, tx, ty)
    }
  }

  // Door pass — inserted after wall tiles so they overdraw. Anchored on the
  // door's own tile (its walk-in trigger), not the rect's south edge, so a
  // door can sit anywhere relative to the building (e.g. above a flight of
  // steps) and still render — matching tx to this rect only picks which
  // wall's door art to use.
  //
  // `skipDoorLeaf` omits the doorTop/doorBottom leaf tiles — the live hub
  // canvas draws those itself as animated sprites (see doorAnimation.ts) and
  // only wants the static arch decoration from this pass. Callers that don't
  // animate doors (e.g. the map editor preview) leave it unset and get the
  // full static door as before.
  const wallTiles = WALL_TILES[wall]
  for (const door of doors) {
    if (door.hideSprite || door.tx < x1 || door.tx > x2) continue
    place(wallTiles.doorArchTop, door.tx, door.ty - 2)
    if (opts.skipDoorLeaf) continue
    place(wallTiles.doorTop,     door.tx, door.ty - 2)
    place(wallTiles.doorBottom,  door.tx, door.ty - 1)
  }

  return placements
}

/**
 * Resolves the effective footprint/wall/roof for a building at a given upgrade
 * level. The highest `levelVisuals` entry whose `minLevel <= level` wins; each
 * omitted field inherits from the base building.
 */
export function resolveBuildingVisual(
  base: { rect: [number, number, number, number]; wall?: WallMaterial; roof?: RoofMaterial },
  levelVisuals: Array<{ minLevel: number; rect?: [number, number, number, number]; wall?: WallMaterial; roof?: RoofMaterial }> | undefined,
  level: number,
): { rect: [number, number, number, number]; wall?: WallMaterial; roof?: RoofMaterial } {
  let rect = base.rect
  let wall = base.wall
  let roof = base.roof
  // Apply cumulatively in ascending level order: a later level's overrides win,
  // while fields it leaves unset keep whatever an earlier level (or the base) set.
  const sorted = [...(levelVisuals ?? [])].sort((a, b) => a.minLevel - b.minLevel)
  for (const v of sorted) {
    if (v.minLevel > level) continue
    if (v.rect) rect = v.rect
    if (v.wall) wall = v.wall
    if (v.roof) roof = v.roof
  }
  return { rect, wall, roof }
}
