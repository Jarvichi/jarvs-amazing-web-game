# Map Editor: Multi-select, Draw Tools & Road↔Pond Toggle

**Date:** 2026-06-22  
**Files:** `web/src/components/mapEditor/`

---

## Overview

Three connected improvements to the map editor:

1. **Multi-select** — Shift+click to select multiple entities of the same type; group drag; batch inspector controls.
2. **Draw tools for pond tiles, spawn tiles, chicken zones, and areas** — new `ToolMode` values with drag-to-rect or click-to-place canvas interactions.
3. **Road ↔ Pond toggle** — convert a selected street entry to a pond tile and vice versa via a button in each inspector.

---

## Section 1 — State & Types

### `SelectedEntity` (mapEditorTypes.ts)

Add two new variants to the union (pond tiles and spawn tiles currently have no canvas-selectable entity type):

```ts
| { type: 'pondTile'; index: number }
| { type: 'npcSpawnTile'; index: number }
```

### `ToolMode` (mapEditorTypes.ts)

```ts
export type ToolMode = 'select' | 'place' | 'delete' | 'street' | 'pond' | 'spawn' | 'chickenZone' | 'area'
```

### `MapEditorState` (mapEditorTypes.ts)

- **Remove** `selectedEntity: SelectedEntity | null`
- **Add** `selectedEntities: SelectedEntity[]`

Empty array = nothing selected. Single element = single-select (primary). Multiple elements = multi-select. All existing code that needs the primary entity derives it as `selectedEntities[0] ?? null`.

### `useMapEditorState` API changes (useMapEditorState.ts)

**Replaced:**
- `selectEntity(e: SelectedEntity | null)` → `selectEntities(e: SelectedEntity[])` — clears and sets
- `moveEntity(entity, tx, ty)` → `moveEntities(moves: { entity: SelectedEntity; tx: number; ty: number }[])` — batch move, single undo entry
- `deleteEntity(entity)` → `deleteEntities(entities: SelectedEntity[])` — batch delete, single undo entry

**New:**
- `addToSelection(e: SelectedEntity)` — appends to `selectedEntities` if same type as `[0]`; removes if already present (toggle); no-op if different type
- `addPondTile(tx1, ty1, tx2, ty2)` — appends to `pondTiles`, auto-selects new entry
- `updatePondEntry(index, data: { rect?: number[]; tile?: number[] })` — mirrors `updateStreetEntry`
- `addNpcSpawnTile(tx, ty)` — appends to `npcSpawnTiles`, auto-selects new entry
- `deleteNpcSpawnTile(index)` — removes from `npcSpawnTiles`
- `addChickenZone(tx1, ty1, tx2, ty2)` — appends `{ rect: [tx1,ty1,tx2,ty2], count: 1 }` to `chickenZones`, auto-selects
- `addArea(tx1, ty1, tx2, ty2)` — appends `{ id: auto-generated, name: '', tx: tx1, ty: ty1, tw: tx2-tx1+1, th: ty2-ty1+1 }` to `areas`, auto-selects
- `convertStreetToPond(index)` — removes `streets[index]` (dropping `pathType`), appends same `rect`/`tile` to `pondTiles`; updates `selectedEntities` to the new pond entry
- `convertPondToStreet(index)` — removes `pondTiles[index]`, appends same `rect`/`tile` to `streets`; updates `selectedEntities` to the new street entry

All other existing actions remain unchanged.

---

## Section 2 — Canvas Interactions (MapEditorCanvas.tsx)

### Props change

`selectedEntity: SelectedEntity | null` → `selectedEntities: SelectedEntity[]`

### Multi-select (select tool)

| Interaction | Result |
|---|---|
| Plain click on entity | Clear `selectedEntities`, set to `[hitEntity]` |
| Plain click on empty space | Clear `selectedEntities` (set to `[]`) |
| Shift+click on same-type entity | Toggle entity in `selectedEntities` (add if absent, remove if present) |
| Shift+click on different-type entity | Ignored |
| Shift+click on empty space | Ignored (selection unchanged) |

### Group drag

`dragRef` shape changes to:

```ts
{
  entities: { entity: SelectedEntity; offsetX: number; offsetY: number }[]
  lastTx: number
  lastTy: number
}
```

- Pointerdown on any entity in `selectedEntities`: all selected entities begin dragging together. Each entity records its own `offsetX/Y` from the click tile.
- Pointermove: calls `moveEntities` with `{ entity, tx: curTx - offsetX, ty: curTy - offsetY }` per entity.
- Pointerdown on an entity **not** in `selectedEntities`: clears multi-select, starts single-entity drag (existing behaviour).

### Highlighting

All entities in `selectedEntities` receive the yellow `0xf0c040` outline. No style change — just drawn for every item in the array.

### New draw tools

**`pond` and `chickenZone` (drag-to-rect):**
- Identical pattern to the existing `street` tool.
- Preview rect shown on pointermove; committed on pointerup.
- `pond` calls `addPondTile`; `chickenZone` calls `addChickenZone`.
- New entry auto-selected after commit.

**`area` (drag-to-rect):**
- Same drag-to-rect pattern.
- Calls `addArea` on pointerup; auto-selects so the inspector opens immediately for naming.

**`spawn` (click-to-place):**
- Single click (no drag) calls `addNpcSpawnTile(tx, ty)` and auto-selects the new entry.

### New canvas rendering

**Pond tiles:** Already rendered as `POND_COLOR` fills. Add per-tile click handlers (similar to how street entries are hit-tested) so they can be selected and dragged.

**Spawn tiles:** Not currently rendered. Render as a small cyan crosshair/dot for each entry in `npcSpawnTiles`. Always visible in exterior view. Each is a clickable target.

**Chicken zones:** Already in `SelectedEntity` union. Add a canvas overlay (semi-transparent fill + border, similar to the areas overlay) with click handlers. Always visible in exterior view.

---

## Section 3 — Inspector (EntityInspector.tsx)

### Props change

`selectedEntity: SelectedEntity | null` → `selectedEntities: SelectedEntity[]`

Primary entity derived internally as `selectedEntities[0] ?? null`.

### Multi-select panel

Shown when `selectedEntities.length > 1`. Displays:

- Entity type label + count (e.g. "4 exteriorDecor selected")
- Shared field controls per type:
  - `exteriorDecor` / `interiorDecor` / `buildingLevelDecor` / `festivalDecor`: Z-layer toggle (updates all selected items)
  - `street`: pathType input (updates all selected)
- "Delete all (N)" button — calls `deleteEntities(selectedEntities)`
- No position fields (managed via group drag on canvas)
- No sub-panels (NPC dialogue, building interiors, etc. — single-select only)

### New single-item inspectors

**`PondInspector`:** Mirrors `StreetInspector`. Shows rect/tile position fields, delete button, and a "Convert to Street" button at the bottom that calls `convertPondToStreet`.

**`SpawnTileInspector`:** Shows position (X/Y num inputs) and a delete button.

**`StreetInspector` change:** Add a "Convert to Pond" button (drops `pathType`, calls `convertStreetToPond`).

Chicken zones and areas already have inspectors — no structural changes needed beyond wiring the new `addChickenZone` / `addArea` actions.

---

## Section 4 — Toolbar (MapEditorToolbar.tsx)

Four new tool buttons added to the tools group, after the existing `street` (⊟) button:

| Symbol | Mode | Tooltip |
|--------|------|---------|
| `≈` | `pond` | Draw Pond Tile |
| `⊕` | `spawn` | Place Spawn Tile |
| `⊛` | `chickenZone` | Draw Chicken Zone |
| `□` | `area` | Draw Area |

Same active/inactive styling as existing tool buttons. No keyboard shortcuts assigned (can be added later).

No new overlay toggle buttons needed — spawn tiles and chicken zones are always rendered in exterior view (small enough to be unobtrusive). Areas already have the `▣` toggle.

---

## Constraints & Notes

- All new state mutations follow the existing undo/redo pattern (push to `undoStack`, clear `redoStack`).
- `moveEntities` batch-moves all items in a single undo step (not one step per entity).
- `deleteEntities` batch-deletes in a single undo step.
- The same-type constraint for multi-select is enforced in `addToSelection` in the state hook (not in the canvas), so it can be tested independently.
- Auto-generated area IDs use an incrementing suffix that avoids collisions with existing IDs (e.g. `area-1`, `area-2`, skipping any already in use); the user renames in the inspector.
- Interior view: multi-select, new draw tools, and pond/street toggle are **exterior-only** features. Interior view continues to use existing single-select behaviour.
