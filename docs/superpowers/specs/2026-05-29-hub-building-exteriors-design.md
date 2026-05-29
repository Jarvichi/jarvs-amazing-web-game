# Hub Building Exteriors Design

**Date:** 2026-05-29
**Status:** Ready for implementation

---

## Context

Hub world buildings are currently rendered as uniform black squares using a single `PATH_TILE.wall2` tile for every cell in every building rectangle. The user has added exterior wall tiles (brick set, indices 400–415) and roof tiles (7 material types × 4 rows, starting at 560) to `baseChipIndex.ts`. The goal is to render each building with its own configurable wall texture, 4-row roof, and south-facing door tile stack using these new tile indices.

---

## Building Structure (approved)

From top to bottom of each building rectangle:

| Rows | Content |
|------|---------|
| y1 + 0 | Roof row 1 (repeated across full width) |
| y1 + 1 | Roof row 2 |
| y1 + 2 | Roof row 3 |
| y1 + 3 | Roof row 4 |
| y1 + 4 | Wall — top row: `leftTop` / `middleTop` / `shadowTop` / `pillarTop` (see column layout below) |
| y1 + 5 … y2 − 1 | Wall — additional rows: same top tile IDs repeated (top tiles stack vertically) |
| y2 | Wall — bottom row: `leftBottom` / `middleBottom` / `shadowBottom` / `pillarBottom` |

**Column layout within each wall row:**

| Column position | Tile |
|-----------------|------|
| x1 (leftmost) | `pillarTop` / `pillarBottom` (left corner pillar) |
| x1+1 | `shadowTop` / `shadowBottom` (depth shadow to the **right** of the pillar) |
| x1+2 … x2−1 | `middleTop` / `middleBottom` |
| x2 (rightmost) | `rightTop` / `rightBottom` |

Door tiles stack vertically on the south facade:

| Position | Tile |
|----------|------|
| (door.tx, y2 − 1) | `brickDoorArchTop` (inside wall, second-to-last row) |
| (door.tx, y2)     | `brickDoorTop`     (inside wall, last row) |
| (door.tx, y2 + 1) | `brickDoorBottom`  (on street threshold — door.ty) |

All doors are south-facing: `door.ty === building.rect[3] + 1`.

---

## File Changes

### 1. `web/src/data/tiles/baseChipIndex.ts`

**Fix typo:** `brickShadowBottom` is listed as `404` (same as `brickShadowTop`). Based on the +8 row pattern it should be `412`. Correct it during implementation.

Add missing roof rows 2–4 for all coloured roof types. Pattern: base + 8 per row.

```typescript
yellowSlateRoofRow2: 569, yellowSlateRoofRow3: 577, yellowSlateRoofRow4: 585,
blueSlateRoofRow2:   570, blueSlateRoofRow3:   578, blueSlateRoofRow4:   586,
redSlateRoofRow2:    571, redSlateRoofRow3:     579, redSlateRoofRow4:    587,
greySlateRoofRow2:   572, greySlateRoofRow3:    580, greySlateRoofRow4:   588,
metalRoofRow2:       573, metalRoofRow3:        581, metalRoofRow4:       589,
strawRoofRow2:       574, strawRoofRow3:        582, strawRoofRow4:       590,
```

### 2. `web/src/data/hubConfig.json`

**Buildings array** — add `id`, `wall`, `roof` to each entry:

```json
{ "rect": [1,  1, 16, 10], "id": "main-building",      "wall": "brick", "roof": "woodRoof" },
{ "rect": [1, 15, 16, 21], "id": "south-building",      "wall": "brick", "roof": "redSlateRoof" },
{ "rect": [21, 5, 31, 19], "id": "home-building",       "wall": "brick", "roof": "yellowSlateRoof" },
{ "rect": [41,  1, 53,  6], "id": "scholars-north-w",  "wall": "brick", "roof": "blueSlateRoof" },
{ "rect": [58,  1, 72,  6], "id": "scholars-north-e",  "wall": "brick", "roof": "blueSlateRoof" },
{ "rect": [41, 11, 53, 19], "id": "scholars-hall-w",   "wall": "brick", "roof": "blueSlateRoof" },
{ "rect": [58, 11, 72, 19], "id": "scholars-hall-e",   "wall": "brick", "roof": "blueSlateRoof" },
{ "rect": [1,  27, 12, 33], "id": "sw-building-a",     "wall": "brick", "roof": "greySlateRoof" },
{ "rect": [1,  38, 12, 47], "id": "sw-building-b",     "wall": "brick", "roof": "strawRoof" },
{ "rect": [17, 27, 32, 33], "id": "traders-building",  "wall": "brick", "roof": "metalRoof" },
{ "rect": [17, 38, 32, 47], "id": "market-building",   "wall": "brick", "roof": "greySlateRoof" },
{ "rect": [42, 38, 53, 47], "id": "arcade-building-w", "wall": "brick", "roof": "strawRoof" },
{ "rect": [58, 27, 72, 34], "id": "barracks-north",    "wall": "brick", "roof": "greySlateRoof" },
{ "rect": [58, 38, 72, 47], "id": "barracks-south",    "wall": "brick", "roof": "greySlateRoof" },
{ "rect": [42, 27, 53, 34], "id": "arcade-building-e", "wall": "brick", "roof": "yellowSlateRoof" }
```

**Door position corrections** — two doors are currently not south-facing and must be moved:
- supply-shop: `(8, 14)` → `(8, 22)` (south of building [1,15,16,21], y2=21)
- trader-den: `(11, 26)` → `(11, 34)` (south of building [1,27,12,33], y2=33)

Also add street tiles at the new door positions in the `streets` array:
- `{ "tile": [8, 22] }` for supply-shop
- `{ "tile": [11, 34] }` for trader-den

**Exterior decor cleanup** — remove the 6 manual brick entries for building [42,27,53,34] (lines 56–61); the new building material system renders these automatically.

### 3. New file: `web/src/data/tiles/buildingMaterials.ts`

Constants for all wall and roof tile lookups.

```typescript
import { BASE_CHIP_TILES as T } from './baseChipIndex'

export type WallMaterial = 'brick'
export type RoofMaterial = 'woodRoof' | 'yellowSlateRoof' | 'blueSlateRoof' |
                           'redSlateRoof' | 'greySlateRoof' | 'metalRoof' | 'strawRoof'

export const WALL_TILES: Record<WallMaterial, {
  pillarTop: number; shadowTop: number; middleTop: number; rightTop: number
  pillarBottom: number; shadowBottom: number; middleBottom: number; rightBottom: number
  doorArchTop: number; doorTop: number; doorBottom: number
}> = {
  brick: {
    pillarTop:    T.brickPillarTop,   shadowTop:    T.brickShadowTop,
    middleTop:    T.brickMiddleTop,   rightTop:     T.brickRightTop,
    pillarBottom: T.brickPillarBottom, shadowBottom: T.brickShadowBottom,
    middleBottom: T.brickMiddleBottom, rightBottom:  T.brickRightBottom,
    doorArchTop: T.brickDoorArchTop,  doorTop: T.brickDoorTop, doorBottom: T.brickDoorBottom,
  }
}

// [row1, row2, row3, row4]
export const ROOF_TILES: Record<RoofMaterial, [number, number, number, number]> = {
  woodRoof:        [T.woodRoofRow1,        T.woodRoofRow2,        T.woodRoofRow3,        T.woodRoofRow4],
  yellowSlateRoof: [T.yellowSlateRoofRow1, T.yellowSlateRoofRow2, T.yellowSlateRoofRow3, T.yellowSlateRoofRow4],
  blueSlateRoof:   [T.blueSlateRoofRow1,   T.blueSlateRoofRow2,   T.blueSlateRoofRow3,   T.blueSlateRoofRow4],
  redSlateRoof:    [T.redSlateRoofRow1,     T.redSlateRoofRow2,     T.redSlateRoofRow3,     T.redSlateRoofRow4],
  greySlateRoof:   [T.greySlateRoofRow1,   T.greySlateRoofRow2,   T.greySlateRoofRow3,   T.greySlateRoofRow4],
  metalRoof:       [T.metalRoofRow1,        T.metalRoofRow2,        T.metalRoofRow3,        T.metalRoofRow4],
  strawRoof:       [T.strawRoofRow1,        T.strawRoofRow2,        T.strawRoofRow3,        T.strawRoofRow4],
}

export function getWallTile(
  wall: WallMaterial,
  isBottomRow: boolean,
  isPillarCol: boolean, isShadowCol: boolean, isRightCol: boolean,
): number {
  const w = WALL_TILES[wall]
  // Top and middle rows share the same tile IDs (top tiles repeat vertically)
  if (isBottomRow) {
    if (isPillarCol)  return w.pillarBottom   // x1: left corner pillar
    if (isShadowCol)  return w.shadowBottom   // x1+1: shadow to the right of pillar
    if (isRightCol)   return w.rightBottom    // x2: right edge
    return w.middleBottom
  }
  if (isPillarCol)  return w.pillarTop
  if (isShadowCol)  return w.shadowTop
  if (isRightCol)   return w.rightTop
  return w.middleTop
}
// isPillarCol: col === x1 (left edge pillar)
// isShadowCol: col === x1+1 (shadow to the right of pillar; only meaningful when width >= 3)
// isRightCol:  col === x2
```

### 4. `web/src/data/hubConfigLoader.ts`

Add `HubBuilding` interface and `HUB_BUILDINGS` export:

```typescript
export interface HubBuilding {
  rect: [number, number, number, number]
  id?: string
  wall?: WallMaterial
  roof?: RoofMaterial
}

export const HUB_BUILDINGS: HubBuilding[] = rawConfig.buildings.map(b => ({
  rect: b.rect as [number, number, number, number],
  id:   (b as Record<string, unknown>).id   as string | undefined,
  wall: (b as Record<string, unknown>).wall as WallMaterial | undefined,
  roof: (b as Record<string, unknown>).roof as RoofMaterial | undefined,
}))
```

### 5. `web/src/data/hubLayout.ts`

Add `HUB_BUILDINGS` to re-exports.

### 6. `web/src/components/hub/HubTownCanvas.tsx`

Replace the single `renderPathTiles(wall2)` call with a new `renderBuildingExteriors` call.

**Door association** uses spatial lookup (south-facing only):
```
door belongs to building if door.ty === y2 + 1 && door.tx >= x1 && door.tx <= x2
```

**Rendering per building:**
1. No `wall`/`roof` → fall back: `renderPathTiles` with `wall2` on that building's tile set
2. Has `wall` + `roof`:
   a. Rows y1..y1+3: load roof tile for that row, render full width
   b. Rows y1+4..y2: for each col, compute wall tile variant, render
   c. For each south-adjacent door: render arch/top/bottom tiles at `(tx, y2−1)`, `(tx, y2)`, `(tx, y2+1)` **after** the wall pass — they overdraw the wall tiles at those positions (PIXI render order within `buildingLayer`)

All tile loads use `loadTileTexture(baseChipUrl, tileId, TILESET_COLUMNS.baseChip)`.

---

## Scholars-Hall Door Note

The scholars-hall door at `(56, 11)` does not align with any building rect's south edge. It is left unchanged for now — the building south-facing door tile rendering simply won't activate for this entry. This can be revisited when the scholars area layout is updated.

---

## Verification

1. `npm run dev` in `web/` — open hub world in browser
2. All 15 buildings show brick walls with distinct coloured roofs instead of black squares
3. Card-shop (tx=6), augment-shop (tx=14), home (tx=21) show door tile stack at south edge
4. Supply-shop and trader-den show wall/roof only (doors moved, no scholars-hall regression)
5. Entering any building still opens the interior view correctly
6. No console errors from tile loading
