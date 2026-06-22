# Map Editor: Multi-select, Draw Tools & Road↔Pond Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-select with group drag, four new draw-on-canvas tool modes (pond/spawn/chickenZone/area), and a road↔pond convert button in the street/pond inspectors.

**Architecture:** Pure helper functions in a new `multiSelectHelpers.ts` are tested in isolation; the state hook (`useMapEditorState`) consumes them; canvas and inspector receive `selectedEntities: SelectedEntity[]` replacing the old single `selectedEntity`. All new draw tools follow the existing street-draw drag pattern.

**Tech Stack:** React, TypeScript, PixiJS v8, Vitest

## Global Constraints

- Run all tests from `web/` directory: `npx vitest run <file>`
- Never write comments unless the WHY is non-obvious
- All undo/redo entries are single steps — batch operations push one entry
- Multi-select and new draw tools are exterior-view only
- Interior view retains existing single-select behaviour unchanged

---

### Task 1: Types + pure helper module + tests

**Files:**
- Modify: `web/src/components/mapEditor/mapEditorTypes.ts`
- Create: `web/src/components/mapEditor/multiSelectHelpers.ts`
- Create: `web/src/components/mapEditor/multiSelectHelpers.test.ts`

**Interfaces:**
- Produces: `SelectedEntity` (with `pondTile`, `npcSpawnTile`), `ToolMode` (with new modes), `MapEditorState.selectedEntities`, and exported helpers used by Tasks 2–7

- [ ] **Step 1: Update `mapEditorTypes.ts`**

Replace:
```ts
export type ToolMode = 'select' | 'place' | 'delete' | 'street'
```
With:
```ts
export type ToolMode = 'select' | 'place' | 'delete' | 'street' | 'pond' | 'spawn' | 'chickenZone' | 'area'
```

Add two variants to `SelectedEntity` (after `street`):
```ts
  | { type: 'pondTile'; index: number }
  | { type: 'npcSpawnTile'; index: number }
```

In `MapEditorState`, replace:
```ts
  selectedEntity: SelectedEntity | null
```
With:
```ts
  selectedEntities: SelectedEntity[]
```

- [ ] **Step 2: Create `multiSelectHelpers.ts`**

```ts
import type { SelectedEntity, RawMapConfig, Zlayer } from './mapEditorTypes'

export function isSameType(a: SelectedEntity, b: SelectedEntity): boolean {
  return a.type === b.type
}

export function isSameEntityRef(a: SelectedEntity, b: SelectedEntity): boolean {
  if (a.type !== b.type) return false
  if ('index' in a && 'index' in b && (a as {index:number}).index !== (b as {index:number}).index) return false
  if (a.type === 'interiorDecor' && b.type === 'interiorDecor' && a.interiorId !== b.interiorId) return false
  if (a.type === 'buildingLevelDecor' && b.type === 'buildingLevelDecor' && a.buildingIndex !== b.buildingIndex) return false
  if (a.type === 'festivalDecor' && b.type === 'festivalDecor' && a.festivalId !== b.festivalId) return false
  return true
}

export function toggleInSelection(entities: SelectedEntity[], entity: SelectedEntity): SelectedEntity[] {
  const idx = entities.findIndex(e => isSameEntityRef(e, entity))
  if (idx >= 0) return entities.filter((_, i) => i !== idx)
  if (entities.length > 0 && !isSameType(entities[0], entity)) return entities
  return [...entities, entity]
}

export function nextAreaId(areas: { id: string }[]): string {
  const ids = new Set(areas.map(a => a.id))
  let n = 1
  while (ids.has(`area-${n}`)) n++
  return `area-${n}`
}

export function convertStreetToPond(
  config: RawMapConfig, index: number,
): { config: RawMapConfig; pondIndex: number } | null {
  const streets = config.streets ?? []
  const entry = streets[index]
  if (!entry) return null
  const { pathType: _dropped, ...rest } = entry as { pathType?: string; rect?: number[]; tile?: number[] }
  const pondTiles = [...(config.pondTiles ?? []), rest]
  return {
    config: { ...config, streets: streets.filter((_, i) => i !== index), pondTiles },
    pondIndex: pondTiles.length - 1,
  }
}

export function convertPondToStreet(
  config: RawMapConfig, index: number,
): { config: RawMapConfig; streetIndex: number } | null {
  const pondTiles = config.pondTiles ?? []
  const entry = pondTiles[index]
  if (!entry) return null
  const streets = [...(config.streets ?? []), entry]
  return {
    config: { ...config, pondTiles: pondTiles.filter((_, i) => i !== index), streets },
    streetIndex: streets.length - 1,
  }
}

function indexSet(entities: SelectedEntity[], type: string): Set<number> {
  return new Set(
    entities.filter(e => e.type === type && 'index' in e).map(e => (e as { index: number }).index),
  )
}

export function applyDeleteEntities(config: RawMapConfig, entities: SelectedEntity[]): RawMapConfig {
  let c = config

  const extDecor = indexSet(entities, 'exteriorDecor')
  if (extDecor.size) c = { ...c, exteriorDecor: (c.exteriorDecor ?? []).filter((_, i) => !extDecor.has(i)) }

  const streets = indexSet(entities, 'street')
  if (streets.size) c = { ...c, streets: (c.streets ?? []).filter((_, i) => !streets.has(i)) }

  const ponds = indexSet(entities, 'pondTile')
  if (ponds.size) c = { ...c, pondTiles: (c.pondTiles ?? []).filter((_, i) => !ponds.has(i)) }

  const spawns = indexSet(entities, 'npcSpawnTile')
  if (spawns.size) c = { ...c, npcSpawnTiles: (c.npcSpawnTiles ?? []).filter((_, i) => !spawns.has(i)) }

  const npcs = indexSet(entities, 'npc')
  if (npcs.size) c = { ...c, npcs: (c.npcs ?? []).filter((_, i) => !npcs.has(i)) }

  const animals = indexSet(entities, 'animal')
  if (animals.size) c = { ...c, animals: (c.animals ?? []).filter((_, i) => !animals.has(i)) }

  const areas = indexSet(entities, 'area')
  if (areas.size) c = { ...c, areas: (c.areas ?? []).filter((_, i) => !areas.has(i)) }

  const chickens = indexSet(entities, 'chickenZone')
  if (chickens.size) c = { ...c, chickenZones: (c.chickenZones ?? []).filter((_, i) => !chickens.has(i)) }

  const interactables = indexSet(entities, 'interactable')
  if (interactables.size) c = { ...c, interactables: (c.interactables ?? []).filter((_, i) => !interactables.has(i)) }

  const exitTiles = indexSet(entities, 'exitTile')
  if (exitTiles.size) c = { ...c, exitTiles: (c.exitTiles ?? []).filter((_, i) => !exitTiles.has(i)) }

  const treasures = indexSet(entities, 'treasure')
  if (treasures.size) c = { ...c, treasures: (c.treasures ?? []).filter((_, i) => !treasures.has(i)) }

  // buildingLevelDecor — group by buildingIndex to avoid index-shift bugs
  const bldMap = new Map<number, Set<number>>()
  for (const e of entities) {
    if (e.type !== 'buildingLevelDecor') continue
    if (!bldMap.has(e.buildingIndex)) bldMap.set(e.buildingIndex, new Set())
    bldMap.get(e.buildingIndex)!.add(e.index)
  }
  if (bldMap.size) {
    const buildings = [...(c.buildings ?? [])]
    for (const [bIdx, idxs] of bldMap) {
      const b = buildings[bIdx]
      if (!b) continue
      buildings[bIdx] = { ...b, levelDecor: (b.levelDecor ?? []).filter((_, i) => !idxs.has(i)) }
    }
    c = { ...c, buildings }
  }

  // interiorDecor — group by interiorId
  const roomMap = new Map<string, Set<number>>()
  for (const e of entities) {
    if (e.type !== 'interiorDecor') continue
    if (!roomMap.has(e.interiorId)) roomMap.set(e.interiorId, new Set())
    roomMap.get(e.interiorId)!.add(e.index)
  }
  if (roomMap.size) {
    let interiors = { ...c.interiors }
    for (const [roomId, idxs] of roomMap) {
      const room = interiors[roomId]
      if (!room) continue
      interiors = { ...interiors, [roomId]: { ...room, decor: room.decor.filter((_, i) => !idxs.has(i)) } }
    }
    c = { ...c, interiors }
  }

  // festivalDecor — group by festivalId
  const festMap = new Map<string, Set<number>>()
  for (const e of entities) {
    if (e.type !== 'festivalDecor') continue
    if (!festMap.has(e.festivalId)) festMap.set(e.festivalId, new Set())
    festMap.get(e.festivalId)!.add(e.index)
  }
  if (festMap.size) {
    c = {
      ...c,
      festivalDecor: (c.festivalDecor ?? []).map(g => {
        const idxs = festMap.get(g.festivalId)
        return idxs ? { ...g, decor: g.decor.filter((_, i) => !idxs.has(i)) } : g
      }),
    }
  }

  return c
}

export function applyBatchUpdateZlayer(
  config: RawMapConfig, entities: SelectedEntity[], zlayer: Zlayer,
): RawMapConfig {
  let c = config
  const extIdx = indexSet(entities, 'exteriorDecor')
  if (extIdx.size) c = { ...c, exteriorDecor: (c.exteriorDecor ?? []).map((d, i) => extIdx.has(i) ? { ...d, zlayer } : d) }

  const bldMap = new Map<number, Set<number>>()
  for (const e of entities) {
    if (e.type !== 'buildingLevelDecor') continue
    if (!bldMap.has(e.buildingIndex)) bldMap.set(e.buildingIndex, new Set())
    bldMap.get(e.buildingIndex)!.add(e.index)
  }
  if (bldMap.size) {
    const buildings = [...(c.buildings ?? [])]
    for (const [bIdx, idxs] of bldMap) {
      const b = buildings[bIdx]
      if (!b) continue
      buildings[bIdx] = { ...b, levelDecor: (b.levelDecor ?? []).map((d, i) => idxs.has(i) ? { ...d, zlayer } : d) }
    }
    c = { ...c, buildings }
  }

  const roomMap = new Map<string, Set<number>>()
  for (const e of entities) {
    if (e.type !== 'interiorDecor') continue
    if (!roomMap.has(e.interiorId)) roomMap.set(e.interiorId, new Set())
    roomMap.get(e.interiorId)!.add(e.index)
  }
  if (roomMap.size) {
    let interiors = { ...c.interiors }
    for (const [roomId, idxs] of roomMap) {
      const room = interiors[roomId]
      if (!room) continue
      interiors = { ...interiors, [roomId]: { ...room, decor: room.decor.map((d, i) => idxs.has(i) ? { ...d, zlayer } : d) } }
    }
    c = { ...c, interiors }
  }

  const festMap = new Map<string, Set<number>>()
  for (const e of entities) {
    if (e.type !== 'festivalDecor') continue
    if (!festMap.has(e.festivalId)) festMap.set(e.festivalId, new Set())
    festMap.get(e.festivalId)!.add(e.index)
  }
  if (festMap.size) {
    c = {
      ...c,
      festivalDecor: (c.festivalDecor ?? []).map(g => {
        const idxs = festMap.get(g.festivalId)
        return idxs ? { ...g, decor: g.decor.map((d, i) => idxs.has(i) ? { ...d, zlayer } : d) } : g
      }),
    }
  }
  return c
}

export function applyBatchUpdateStreetPathType(
  config: RawMapConfig, entities: SelectedEntity[], pathType: string | undefined,
): RawMapConfig {
  const idxs = indexSet(entities, 'street')
  if (!idxs.size) return config
  const streets = (config.streets ?? []).map((s, i) => {
    if (!idxs.has(i)) return s
    const next = { ...s, pathType }
    if (!pathType) delete next.pathType
    return next
  })
  return { ...config, streets }
}
```

- [ ] **Step 3: Write `multiSelectHelpers.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  isSameType, isSameEntityRef, toggleInSelection, nextAreaId,
  convertStreetToPond, convertPondToStreet, applyDeleteEntities,
} from './multiSelectHelpers'
import type { SelectedEntity, RawMapConfig } from './mapEditorTypes'

const street0: SelectedEntity = { type: 'street', index: 0 }
const street1: SelectedEntity = { type: 'street', index: 1 }
const decor0: SelectedEntity  = { type: 'exteriorDecor', index: 0 }

describe('isSameType', () => {
  it('returns true for same type', () => expect(isSameType(street0, street1)).toBe(true))
  it('returns false for different types', () => expect(isSameType(street0, decor0)).toBe(false))
})

describe('isSameEntityRef', () => {
  it('returns true for identical ref', () => expect(isSameEntityRef(street0, { type: 'street', index: 0 })).toBe(true))
  it('returns false for same type different index', () => expect(isSameEntityRef(street0, street1)).toBe(false))
  it('returns false for interiorDecor with different interiorId', () => {
    const a: SelectedEntity = { type: 'interiorDecor', index: 0, interiorId: 'room-a' }
    const b: SelectedEntity = { type: 'interiorDecor', index: 0, interiorId: 'room-b' }
    expect(isSameEntityRef(a, b)).toBe(false)
  })
})

describe('toggleInSelection', () => {
  it('adds entity to empty selection', () => expect(toggleInSelection([], street0)).toEqual([street0]))
  it('adds same-type entity', () => expect(toggleInSelection([street0], street1)).toEqual([street0, street1]))
  it('removes entity already present', () => expect(toggleInSelection([street0, street1], street0)).toEqual([street1]))
  it('ignores different-type when non-empty', () => expect(toggleInSelection([street0], decor0)).toEqual([street0]))
  it('allows different type when selection is empty', () => expect(toggleInSelection([], decor0)).toEqual([decor0]))
})

describe('nextAreaId', () => {
  it('returns area-1 when empty', () => expect(nextAreaId([])).toBe('area-1'))
  it('increments past existing', () => expect(nextAreaId([{ id: 'area-1' }, { id: 'area-2' }])).toBe('area-3'))
  it('fills first gap', () => expect(nextAreaId([{ id: 'area-1' }, { id: 'area-3' }])).toBe('area-2'))
})

const baseConfig = {
  streets: [{ rect: [0, 0, 2, 2], pathType: 'cobble' }, { tile: [5, 5] }],
  pondTiles: [{ rect: [3, 3, 4, 4] }],
  exteriorDecor: [{ tx: 1, ty: 1, tileId: 'barrel', zlayer: 'solid' }, { tx: 2, ty: 2, tileId: 'crate', zlayer: 'solid' }],
  npcSpawnTiles: [[1, 1], [2, 2]],
} as unknown as RawMapConfig

describe('convertStreetToPond', () => {
  it('moves entry to pondTiles and drops pathType', () => {
    const result = convertStreetToPond(baseConfig, 0)!
    expect(result.config.streets).toHaveLength(1)
    expect(result.config.streets![0]).toEqual({ tile: [5, 5] })
    expect(result.config.pondTiles).toHaveLength(2)
    expect(result.config.pondTiles![1]).toEqual({ rect: [0, 0, 2, 2] })
    expect(result.pondIndex).toBe(1)
  })
  it('returns null for out-of-bounds index', () => expect(convertStreetToPond(baseConfig, 99)).toBeNull())
})

describe('convertPondToStreet', () => {
  it('moves entry to streets', () => {
    const result = convertPondToStreet(baseConfig, 0)!
    expect(result.config.pondTiles).toHaveLength(0)
    expect(result.config.streets).toHaveLength(3)
    expect(result.streetIndex).toBe(2)
  })
  it('returns null for out-of-bounds', () => expect(convertPondToStreet(baseConfig, 99)).toBeNull())
})

describe('applyDeleteEntities', () => {
  it('deletes single exteriorDecor', () => {
    const c = applyDeleteEntities(baseConfig, [decor0])
    expect(c.exteriorDecor).toHaveLength(1)
    expect(c.exteriorDecor![0].tileId).toBe('crate')
  })
  it('deletes multiple streets in one pass (no index shift)', () => {
    const c = applyDeleteEntities(baseConfig, [street0, street1])
    expect(c.streets).toHaveLength(0)
  })
  it('deletes npcSpawnTile', () => {
    const c = applyDeleteEntities(baseConfig, [{ type: 'npcSpawnTile', index: 0 }])
    expect(c.npcSpawnTiles).toHaveLength(1)
  })
  it('leaves unrelated data unchanged', () => {
    const c = applyDeleteEntities(baseConfig, [street0])
    expect(c.pondTiles).toHaveLength(1)
    expect(c.exteriorDecor).toHaveLength(2)
  })
})
```

- [ ] **Step 4: Run tests — expect pass**

```
cd web && npx vitest run src/components/mapEditor/multiSelectHelpers.test.ts
```

- [ ] **Step 5: Commit**

```
git add web/src/components/mapEditor/mapEditorTypes.ts web/src/components/mapEditor/multiSelectHelpers.ts web/src/components/mapEditor/multiSelectHelpers.test.ts
git commit -m "feat: add pondTile/npcSpawnTile entity types, new ToolModes, multiSelectHelpers"
```

---

### Task 2: State hook — replace selectedEntity, add all new actions

**Files:**
- Modify: `web/src/components/mapEditor/useMapEditorState.ts`

**Interfaces:**
- Consumes: `toggleInSelection`, `nextAreaId`, `convertStreetToPond`, `convertPondToStreet`, `applyDeleteEntities`, `applyBatchUpdateZlayer`, `applyBatchUpdateStreetPathType` from `./multiSelectHelpers`
- Produces: new hook return values: `selectEntities`, `addToSelection`, `moveEntities`, `deleteEntities`, `addPondTile`, `updatePondEntry`, `addNpcSpawnTile`, `deleteNpcSpawnTile`, `addChickenZone`, `addArea`, `convertStreetToPond` (wrapped), `convertPondToStreet` (wrapped), `batchUpdateZlayer`, `batchUpdateStreetPathType`

- [ ] **Step 1: Add imports at top of file**

Add after existing imports:
```ts
import { toggleInSelection, nextAreaId, convertStreetToPond as cSTP, convertPondToStreet as cPTS, applyDeleteEntities, applyBatchUpdateZlayer, applyBatchUpdateStreetPathType } from './multiSelectHelpers'
```

- [ ] **Step 2: Update initial state**

Change `selectedEntity: null` → `selectedEntities: []` in the `useState` initializer, and in `setMapId`, `openInterior`, `closeInterior`, `setPreviewFestival`:

In `useState(() => ({ ... }))`:
```ts
selectedEntities: [],
```

In `setMapId`:
```ts
selectedEntities: [],
```

In `openInterior`:
```ts
setState(s => ({ ...s, viewMode: 'interior', activeInteriorId: interiorId, activeLevel: 0, selectedEntities: [] }))
```

In `closeInterior`:
```ts
setState(s => ({ ...s, viewMode: 'exterior', activeInteriorId: null, activeLevel: 0, selectedEntities: [] }))
```

In `setPreviewFestival`:
```ts
setState(s => ({ ...s, previewFestivalId, selectedEntities: [] }))
```

- [ ] **Step 3: Replace `selectEntity` with `selectEntities` and add `addToSelection`**

Remove the `selectEntity` callback entirely. Add:
```ts
const selectEntities = useCallback((entities: SelectedEntity[]) => {
  setState(s => ({ ...s, selectedEntities: entities }))
}, [])

const addToSelection = useCallback((entity: SelectedEntity) => {
  setState(s => ({ ...s, selectedEntities: toggleInSelection(s.selectedEntities, entity) }))
}, [])
```

- [ ] **Step 4: Replace `moveEntity` with `moveEntities`**

Remove the `moveEntity` callback. Add `moveEntities` that applies each move sequentially (copy-paste the existing if-else chain from `moveEntity` into a local `applyMove` function, then loop):

```ts
const moveEntities = useCallback((moves: { entity: SelectedEntity; tx: number; ty: number }[]) => {
  setState(s => {
    const prevConfig = s.configData
    let newConfig = prevConfig

    for (const { entity, tx, ty } of moves) {
      newConfig = applyMove(newConfig, entity, tx, ty)
    }

    if (newConfig === prevConfig) return s
    return { ...s, configData: newConfig, undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO), redoStack: [], isDirty: true }
  })
}, [])
```

Add `applyMove` as a module-level function (outside the hook, below the `patchFestivalDecor` helper) — this is the exact body of the old `moveEntity` setState callback, extracted to take `(config, entity, tx, ty)` and return `RawMapConfig`:

```ts
function applyMove(prevConfig: RawMapConfig, entity: SelectedEntity, tx: number, ty: number): RawMapConfig {
  // Copy the entire if-else body from the old moveEntity setState callback verbatim,
  // replacing references to `prevConfig` with the parameter name and returning newConfig.
  // The logic is unchanged — only the wrapper changes.
  let newConfig = prevConfig
  if (entity.type === 'exteriorDecor') {
    const decor = [...(prevConfig.exteriorDecor ?? [])]
    if (!decor[entity.index]) return prevConfig
    decor[entity.index] = { ...decor[entity.index], tx, ty }
    newConfig = { ...prevConfig, exteriorDecor: decor }
  } else if (entity.type === 'festivalDecor') {
    newConfig = patchFestivalDecor(prevConfig, entity.festivalId, entity.index, { tx, ty })
  } else if (entity.type === 'npc') {
    const npcs = [...(prevConfig.npcs ?? [])]
    if (!npcs[entity.index]) return prevConfig
    npcs[entity.index] = { ...npcs[entity.index], tx, ty }
    newConfig = { ...prevConfig, npcs }
  } else if (entity.type === 'building') {
    const buildings = [...(prevConfig.buildings ?? [])]
    if (!buildings[entity.index]) return prevConfig
    const b = buildings[entity.index]
    const rects = b.rects ?? (b.rect ? [b.rect] : [])
    const oldTx1 = rects[0]?.[0] ?? 0
    const oldTy1 = rects[0]?.[1] ?? 0
    const dx = tx - oldTx1, dy = ty - oldTy1
    if (dx === 0 && dy === 0) return prevConfig
    const newRects = rects.map(([rx1, ry1, rx2, ry2]) => [rx1+dx, ry1+dy, rx2+dx, ry2+dy] as [number,number,number,number])
    buildings[entity.index] = b.rects ? { ...b, rects: newRects } : { ...b, rect: newRects[0] }
    newConfig = { ...prevConfig, buildings }
  } else if (entity.type === 'treasure') {
    const treasures = [...(prevConfig.treasures ?? [])]
    if (!treasures[entity.index]) return prevConfig
    treasures[entity.index] = { ...treasures[entity.index], tx, ty }
    newConfig = { ...prevConfig, treasures }
  } else if (entity.type === 'pickupItem') {
    const items = [...(prevConfig.pickupItems ?? [])]
    if (!items[entity.index]) return prevConfig
    items[entity.index] = { ...items[entity.index], tx, ty }
    newConfig = { ...prevConfig, pickupItems: items }
  } else if (entity.type === 'street') {
    const streets = [...(prevConfig.streets ?? [])]
    if (!streets[entity.index]) return prevConfig
    const entry = streets[entity.index]
    if (entry.rect) {
      const [tx1, ty1, tx2, ty2] = entry.rect
      const dx = tx - tx1, dy = ty - ty1
      if (dx === 0 && dy === 0) return prevConfig
      streets[entity.index] = { ...entry, rect: [tx1+dx, ty1+dy, tx2+dx, ty2+dy] }
    } else if (entry.tile) {
      streets[entity.index] = { ...entry, tile: [tx, ty] }
    } else return prevConfig
    newConfig = { ...prevConfig, streets }
  } else if (entity.type === 'pondTile') {
    const pondTiles = [...(prevConfig.pondTiles ?? [])]
    if (!pondTiles[entity.index]) return prevConfig
    const entry = pondTiles[entity.index]
    if (entry.rect) {
      const [tx1, ty1, tx2, ty2] = entry.rect
      const dx = tx - tx1, dy = ty - ty1
      if (dx === 0 && dy === 0) return prevConfig
      pondTiles[entity.index] = { ...entry, rect: [tx1+dx, ty1+dy, tx2+dx, ty2+dy] }
    } else if (entry.tile) {
      pondTiles[entity.index] = { ...entry, tile: [tx, ty] }
    } else return prevConfig
    newConfig = { ...prevConfig, pondTiles }
  } else if (entity.type === 'npcSpawnTile') {
    const npcSpawnTiles = [...(prevConfig.npcSpawnTiles ?? [])]
    if (!npcSpawnTiles[entity.index]) return prevConfig
    npcSpawnTiles[entity.index] = [tx, ty]
    newConfig = { ...prevConfig, npcSpawnTiles }
  } else if (entity.type === 'animal') {
    const animals = [...(prevConfig.animals ?? [])]
    if (!animals[entity.index]) return prevConfig
    animals[entity.index] = { ...animals[entity.index], tx, ty }
    newConfig = { ...prevConfig, animals }
  } else if (entity.type === 'area') {
    const areas = [...(prevConfig.areas ?? [])]
    if (!areas[entity.index]) return prevConfig
    areas[entity.index] = { ...areas[entity.index], tx, ty }
    newConfig = { ...prevConfig, areas }
  } else if (entity.type === 'interactable') {
    const items = [...(prevConfig.interactables ?? [])]
    if (!items[entity.index]) return prevConfig
    items[entity.index] = { ...items[entity.index], tx, ty }
    newConfig = { ...prevConfig, interactables: items }
  } else if (entity.type === 'exitTile') {
    const tiles = [...(prevConfig.exitTiles ?? [])]
    if (!tiles[entity.index]) return prevConfig
    tiles[entity.index] = { ...tiles[entity.index], tx, ty }
    newConfig = { ...prevConfig, exitTiles: tiles }
  } else if (entity.type === 'chickenZone') {
    const zones = [...(prevConfig.chickenZones ?? [])]
    const z = zones[entity.index]
    if (!z) return prevConfig
    const [x1, y1, x2, y2] = z.rect
    const dx = tx - x1, dy = ty - y1
    if (dx === 0 && dy === 0) return prevConfig
    zones[entity.index] = { ...z, rect: [x1+dx, y1+dy, x2+dx, y2+dy] }
    newConfig = { ...prevConfig, chickenZones: zones }
  } else if (entity.type === 'buildingLevelDecor') {
    const buildings = [...(prevConfig.buildings ?? [])]
    const b = buildings[entity.buildingIndex]
    if (!b?.levelDecor?.[entity.index]) return prevConfig
    const levelDecor = [...b.levelDecor]
    levelDecor[entity.index] = { ...levelDecor[entity.index], tx, ty }
    buildings[entity.buildingIndex] = { ...b, levelDecor }
    newConfig = { ...prevConfig, buildings }
  } else if (entity.type === 'interiorDecor' && prevConfig.interiors?.[entity.interiorId]) {
    const interior = prevConfig.interiors[entity.interiorId]
    const decor = [...interior.decor]
    if (!decor[entity.index]) return prevConfig
    decor[entity.index] = { ...decor[entity.index], tx, ty }
    newConfig = { ...prevConfig, interiors: { ...prevConfig.interiors, [entity.interiorId]: { ...interior, decor } } }
  }
  return newConfig
}
```

- [ ] **Step 5: Replace `deleteEntity` with `deleteEntities`**

Remove the `deleteEntity` callback. Add:
```ts
const deleteEntities = useCallback((entities: SelectedEntity[]) => {
  setState(s => {
    const prevConfig = s.configData
    const newConfig = applyDeleteEntities(prevConfig, entities)
    if (newConfig === prevConfig) return s
    return { ...s, configData: newConfig, selectedEntities: [], undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO), redoStack: [], isDirty: true }
  })
}, [])
```

- [ ] **Step 6: Add pond/spawn/chickenZone/area/convert actions**

```ts
const addPondTile = useCallback((tx1: number, ty1: number, tx2: number, ty2: number) => {
  setState(s => {
    const prevConfig = s.configData
    const entry = tx1 === tx2 && ty1 === ty2 ? { tile: [tx1, ty1] } : { rect: [tx1, ty1, tx2, ty2] }
    const pondTiles = [...(prevConfig.pondTiles ?? []), entry]
    const newIndex = pondTiles.length - 1
    return { ...s, configData: { ...prevConfig, pondTiles }, selectedEntities: [{ type: 'pondTile', index: newIndex }], undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO), redoStack: [], isDirty: true }
  })
}, [])

const updatePondEntry = useCallback((index: number, data: { rect?: number[]; tile?: number[] }) => {
  setState(s => {
    const prevConfig = s.configData
    const pondTiles = [...(prevConfig.pondTiles ?? [])]
    if (!pondTiles[index]) return s
    pondTiles[index] = { ...pondTiles[index], ...data }
    return { ...s, configData: { ...prevConfig, pondTiles }, undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO), redoStack: [], isDirty: true }
  })
}, [])

const addNpcSpawnTile = useCallback((tx: number, ty: number) => {
  setState(s => {
    const prevConfig = s.configData
    const npcSpawnTiles = [...(prevConfig.npcSpawnTiles ?? []), [tx, ty] as [number, number]]
    const newIndex = npcSpawnTiles.length - 1
    return { ...s, configData: { ...prevConfig, npcSpawnTiles }, selectedEntities: [{ type: 'npcSpawnTile', index: newIndex }], undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO), redoStack: [], isDirty: true }
  })
}, [])

const addChickenZone = useCallback((tx1: number, ty1: number, tx2: number, ty2: number) => {
  setState(s => {
    const prevConfig = s.configData
    const chickenZones = [...(prevConfig.chickenZones ?? []), { rect: [tx1, ty1, tx2, ty2] as [number,number,number,number], count: 1 }]
    const newIndex = chickenZones.length - 1
    return { ...s, configData: { ...prevConfig, chickenZones }, selectedEntities: [{ type: 'chickenZone', index: newIndex }], undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO), redoStack: [], isDirty: true }
  })
}, [])

const addArea = useCallback((tx1: number, ty1: number, tx2: number, ty2: number) => {
  setState(s => {
    const prevConfig = s.configData
    const id = nextAreaId(prevConfig.areas ?? [])
    const areas = [...(prevConfig.areas ?? []), { id, name: id, tx: tx1, ty: ty1, tw: tx2 - tx1 + 1, th: ty2 - ty1 + 1 }]
    const newIndex = areas.length - 1
    return { ...s, configData: { ...prevConfig, areas }, selectedEntities: [{ type: 'area', index: newIndex }], undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO), redoStack: [], isDirty: true }
  })
}, [])

const convertStreetToPond = useCallback((index: number) => {
  setState(s => {
    const result = cSTP(s.configData, index)
    if (!result) return s
    return { ...s, configData: result.config, selectedEntities: [{ type: 'pondTile', index: result.pondIndex }], undoStack: [...s.undoStack, s.configData].slice(-MAX_UNDO), redoStack: [], isDirty: true }
  })
}, [])

const convertPondToStreet = useCallback((index: number) => {
  setState(s => {
    const result = cPTS(s.configData, index)
    if (!result) return s
    return { ...s, configData: result.config, selectedEntities: [{ type: 'street', index: result.streetIndex }], undoStack: [...s.undoStack, s.configData].slice(-MAX_UNDO), redoStack: [], isDirty: true }
  })
}, [])

const batchUpdateZlayer = useCallback((entities: SelectedEntity[], zlayer: import('./mapEditorTypes').Zlayer) => {
  setState(s => {
    const prevConfig = s.configData
    const newConfig = applyBatchUpdateZlayer(prevConfig, entities, zlayer)
    if (newConfig === prevConfig) return s
    return { ...s, configData: newConfig, undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO), redoStack: [], isDirty: true }
  })
}, [])

const batchUpdateStreetPathType = useCallback((entities: SelectedEntity[], pathType: string | undefined) => {
  setState(s => {
    const prevConfig = s.configData
    const newConfig = applyBatchUpdateStreetPathType(prevConfig, entities, pathType)
    if (newConfig === prevConfig) return s
    return { ...s, configData: newConfig, undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO), redoStack: [], isDirty: true }
  })
}, [])
```

- [ ] **Step 7: Update the `undo` callback**

Change `selectedEntity: null` → `selectedEntities: []` inside the `undo` setState.

- [ ] **Step 8: Update the return object**

Remove: `selectEntity`, `moveEntity`, `deleteEntity`

Add: `selectEntities`, `addToSelection`, `moveEntities`, `deleteEntities`, `addPondTile`, `updatePondEntry`, `addNpcSpawnTile`, `addChickenZone`, `addArea`, `convertStreetToPond`, `convertPondToStreet`, `batchUpdateZlayer`, `batchUpdateStreetPathType`

- [ ] **Step 9: Verify TypeScript compiles**

```
cd web && npx tsc --noEmit
```

Expected: 0 errors (there will be errors in MapEditor/Canvas/Inspector since they still reference `selectedEntity` — that's fine for now, will be fixed in Tasks 4–8).

- [ ] **Step 10: Commit**

```
git add web/src/components/mapEditor/useMapEditorState.ts
git commit -m "feat: replace selectedEntity with selectedEntities, add new state actions"
```

---

### Task 3: Toolbar — four new tool buttons

**Files:**
- Modify: `web/src/components/mapEditor/MapEditorToolbar.tsx`

**Interfaces:**
- Consumes: `ToolMode` (now includes `'pond' | 'spawn' | 'chickenZone' | 'area'`)

- [ ] **Step 1: Extend the `TOOLS` array**

Find the existing `TOOLS` array in `MapEditorToolbar.tsx` and add four entries after `street`:

```ts
const TOOLS: { mode: ToolMode; label: string; title: string }[] = [
  { mode: 'select',      label: '↖', title: 'Select / Move (S)' },
  { mode: 'place',       label: '✎', title: 'Place tile (P)' },
  { mode: 'delete',      label: '✕', title: 'Delete (D)' },
  { mode: 'street',      label: '⊟', title: 'Draw Street / Path (R)' },
  { mode: 'pond',        label: '≈', title: 'Draw Pond Tile' },
  { mode: 'spawn',       label: '⊕', title: 'Place Spawn Tile' },
  { mode: 'chickenZone', label: '⊛', title: 'Draw Chicken Zone' },
  { mode: 'area',        label: '□', title: 'Draw Area' },
]
```

No other changes needed — the existing render loop handles all tools uniformly.

- [ ] **Step 2: Verify TypeScript compiles**

```
cd web && npx tsc --noEmit 2>&1 | grep MapEditorToolbar
```

Expected: no errors for this file.

- [ ] **Step 3: Commit**

```
git add web/src/components/mapEditor/MapEditorToolbar.tsx
git commit -m "feat: add pond/spawn/chickenZone/area tool buttons to toolbar"
```

---

### Task 4: Canvas — multi-select highlight, group drag, shift+click

**Files:**
- Modify: `web/src/components/mapEditor/MapEditorCanvas.tsx`

**Interfaces:**
- Consumes: `selectedEntities: SelectedEntity[]`, `onSelectEntities`, `onAddToSelection`, `onMoveEntities`, `onDeleteEntities`; `isSameEntityRef` from `./multiSelectHelpers`
- Produces: updated canvas props interface (breaking change — MapEditor.tsx will be fixed in Task 8)

- [ ] **Step 1: Update imports**

Add to imports:
```ts
import { isSameEntityRef } from './multiSelectHelpers'
```

- [ ] **Step 2: Update the `Props` interface**

Replace:
```ts
selectedEntity:   SelectedEntity | null
onSelectEntity:   (e: SelectedEntity | null) => void
onMoveEntity:     (entity: SelectedEntity, tx: number, ty: number) => void
onDeleteEntity:   (entity: SelectedEntity) => void
```
With:
```ts
selectedEntities:  SelectedEntity[]
onSelectEntities:  (e: SelectedEntity[]) => void
onAddToSelection:  (e: SelectedEntity) => void
onMoveEntities:    (moves: { entity: SelectedEntity; tx: number; ty: number }[]) => void
onDeleteEntities:  (entities: SelectedEntity[]) => void
```

Add new draw callbacks:
```ts
onAddPondTile:      (tx1: number, ty1: number, tx2: number, ty2: number) => void
onAddNpcSpawnTile:  (tx: number, ty: number) => void
onAddChickenZone:   (tx1: number, ty1: number, tx2: number, ty2: number) => void
onAddArea:          (tx1: number, ty1: number, tx2: number, ty2: number) => void
```

- [ ] **Step 3: Update the destructure at the top of `MapEditorCanvas`**

Replace `onSelectEntity, onMoveEntity, onDeleteEntity` with `onSelectEntities, onAddToSelection, onMoveEntities, onDeleteEntities`, and add the four new draw callbacks.

- [ ] **Step 4: Update `dragRef` type**

Replace:
```ts
const dragRef = useRef<{ entity: SelectedEntity; lastTx: number; lastTy: number; offsetX: number; offsetY: number } | null>(null)
```
With:
```ts
const dragRef = useRef<{
  entities: { entity: SelectedEntity; offsetX: number; offsetY: number }[]
  lastTx: number
  lastTy: number
} | null>(null)
```

- [ ] **Step 5: Rename street draw refs/state to generic rect draw**

Rename throughout the file:
- `streetDrawRef` → `rectDrawRef`
- `streetPreview` → `rectPreview`
- `setStreetPreview` → `setRectPreview`
- `setStreetPreviewRef` → `setRectPreviewRef`
- `streetDrawRef.current = null` → `rectDrawRef.current = null`

Update the clear-on-tool-change useEffect:
```ts
useEffect(() => {
  const rectTools: ToolMode[] = ['street', 'pond', 'chickenZone', 'area']
  if (!rectTools.includes(tool)) {
    rectDrawRef.current = null
    setRectPreview(null)
  }
}, [tool])
```

- [ ] **Step 6: Update the `pointerdown` handler**

Replace the select-tool block and street-tool block:

```ts
stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
  const { tool: t, activeTileId: tid, activeBundleId: bid, viewMode: vm,
           activeInteriorId: iid, configData: cfg, showQuestItems: sqI,
           showBlockedPaths: sbp, blockedPaths: bps, showAreas: sareas,
           selectedEntities: selEnts } = propsRef.current
  const { x: ox, y: oy } = worldOriginRef.current
  const pos = e.getLocalPosition(stage)
  const tx = Math.floor((pos.x - ox) / T)
  const ty = Math.floor((pos.y - oy) / T)

  if (propsRef.current.pickActive) {
    propsRef.current.onPickTile?.(tx, ty)
    return
  }

  if (t === 'select') {
    const entity = hitTest(cfg, tx, ty, vm, iid, sqI, sbp, bps, sareas)
    if (e.shiftKey) {
      if (entity) propsRef.current.onAddToSelection(entity)
      // shift+click on empty space: do nothing
    } else {
      propsRef.current.onSelectEntities(entity ? [entity] : [])
      if (entity) {
        const isAlreadyInSelection = selEnts.some(s => isSameEntityRef(s, entity))
        const entitiesToDrag = isAlreadyInSelection && selEnts.length > 1 ? selEnts : [entity]
        dragRef.current = {
          entities: entitiesToDrag.map(ent => ({
            entity: ent,
            offsetX: tx - getEntityTx(cfg, ent),
            offsetY: ty - getEntityTy(cfg, ent),
          })),
          lastTx: tx, lastTy: ty,
        }
      }
    }
  } else if (t === 'place' && (tid || bid)) {
    propsRef.current.onPlaceDecor(tx, ty)
  } else if (t === 'delete') {
    const entity = hitTest(cfg, tx, ty, vm, iid, sqI, sbp, bps, sareas)
    if (entity) {
      propsRef.current.onDeleteEntities([entity])
      propsRef.current.onSelectEntities([])
    }
  } else if (t === 'street' || t === 'pond' || t === 'chickenZone' || t === 'area') {
    rectDrawRef.current = { startTx: tx, startTy: ty, lastTx: tx, lastTy: ty }
    setRectPreviewRef.current({ sx: tx, sy: ty, ex: tx, ey: ty })
  } else if (t === 'spawn') {
    propsRef.current.onAddNpcSpawnTile(tx, ty)
  }
})
```

- [ ] **Step 7: Update `pointermove` handler**

Replace the drag block:
```ts
if (dragRef.current) {
  const { entities, lastTx, lastTy } = dragRef.current
  if (tx !== lastTx || ty !== lastTy) {
    dragRef.current.lastTx = tx
    dragRef.current.lastTy = ty
    propsRef.current.onMoveEntities(
      entities.map(({ entity, offsetX, offsetY }) => ({ entity, tx: tx - offsetX, ty: ty - offsetY }))
    )
  }
}
```

- [ ] **Step 8: Update `pointerup` handler**

Replace the street commit block:
```ts
if (rectDrawRef.current) {
  const { x: ox, y: oy } = worldOriginRef.current
  const pos = e.getLocalPosition(stage)
  const upTx = Math.floor((pos.x - ox) / T)
  const upTy = Math.floor((pos.y - oy) / T)
  const { startTx, startTy } = rectDrawRef.current
  const tx1 = Math.min(upTx, startTx), ty1 = Math.min(upTy, startTy)
  const tx2 = Math.max(upTx, startTx), ty2 = Math.max(upTy, startTy)
  const { tool: t } = propsRef.current
  if      (t === 'street')      propsRef.current.onAddStreet(tx1, ty1, tx2, ty2)
  else if (t === 'pond')        propsRef.current.onAddPondTile(tx1, ty1, tx2, ty2)
  else if (t === 'chickenZone') propsRef.current.onAddChickenZone(tx1, ty1, tx2, ty2)
  else if (t === 'area')        propsRef.current.onAddArea(tx1, ty1, tx2, ty2)
  rectDrawRef.current = null
  setRectPreviewRef.current(null)
}
```

Same for `pointerupoutside` — just clear `rectDrawRef` and set preview to null.

- [ ] **Step 9: Update selection highlighting — replace all `selectedEntity` references with `selectedEntities` checks**

Every place that checks `selectedEntity?.type === 'X' && selectedEntity.index === idx` must become:
```ts
propsRef.current.selectedEntities.some(e => e.type === 'X' && (e as {index:number}).index === idx)
```

There are occurrences in:
- NPC rendering: `const isSel = selectedEntity?.type === 'npc' && selectedEntity.index === nIdx`
- Animal rendering
- Building rendering
- `renderDecorItems` (receives `selectedEntity` as prop)
- `renderBuildingLevelDecor`
- `renderFestivalDecor`
- `renderAreasOverlay`
- `renderInteractablesOverlay`
- `renderBlockedPathsOverlay`
- `drawSelection`

For each, replace with `.some(e => ...)` check on `selectedEntities`.

For `drawSelection`, update to draw all selected entities:
```ts
function drawSelection(gfx: PIXI.Graphics) {
  for (const selectedEntity of selectedEntities) {
    // existing per-entity drawing logic unchanged, just wrapped in the loop
  }
}
```

- [ ] **Step 10: Update entity sprite pointerdown handlers to support shift+click**

For each entity sprite (NPC, animal, decor, building, etc.), update the pointerdown handler:
```ts
sp.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
  e.stopPropagation()
  const entity: SelectedEntity = { type: 'npc', index: nIdx }
  if (e.shiftKey) {
    propsRef.current.onAddToSelection(entity)
  } else {
    const selEnts = propsRef.current.selectedEntities
    const isAlreadySelected = selEnts.some(s => isSameEntityRef(s, entity))
    const entitiesToDrag = isAlreadySelected && selEnts.length > 1 ? selEnts : [entity]
    propsRef.current.onSelectEntities(isAlreadySelected ? selEnts : [entity])
    if (propsRef.current.tool === 'select') {
      const cfg = propsRef.current.configData
      dragRef.current = {
        entities: entitiesToDrag.map(ent => ({ entity: ent, offsetX: 0, offsetY: 0 })),
        lastTx: npc.tx, lastTy: npc.ty,
      }
    }
  }
})
```

Apply this pattern to: NPC sprite, animal sprite, decor sprites (in `renderDecorItems`), building graphics, area graphics, interactable graphics, street selection (stage-level handler already handles streets).

- [ ] **Step 11: Update rect draw preview rendering**

The preview rect still uses `rectPreview` (renamed from `streetPreview`). The fill color can stay as `STREET_COLOR` for all rect tools since it's just a preview.

- [ ] **Step 12: Commit**

```
git add web/src/components/mapEditor/MapEditorCanvas.tsx
git commit -m "feat: canvas multi-select, group drag, shift+click, new draw tool dispatch"
```

---

### Task 5: Canvas — new entity rendering (pond click targets, spawn tiles, chicken zone overlay)

**Files:**
- Modify: `web/src/components/mapEditor/MapEditorCanvas.tsx`

- [ ] **Step 1: Make pond tiles clickable**

In `renderExterior`, find the pond rendering block:
```ts
// Ponds
const pGfx = new PIXI.Graphics()
for (const p of configData.pondTiles ?? [])
  for (const [tx, ty] of expandEntries([p]))
    pGfx.rect(tx * T, ty * T, T, T).fill(POND_COLOR)
streetLayer.addChild(pGfx)
```

Replace with per-entry interactive graphics (matching the pattern used for areas):
```ts
;(configData.pondTiles ?? []).forEach((pond, pIdx) => {
  const isSel = selectedEntities.some(e => e.type === 'pondTile' && e.index === pIdx)
  const entity: SelectedEntity = { type: 'pondTile', index: pIdx }
  const gfx = new PIXI.Graphics()
  for (const [ptx, pty] of expandEntries([pond]))
    gfx.rect(ptx * T, pty * T, T, T).fill(POND_COLOR)
  if (isSel) {
    for (const [ptx, pty] of expandEntries([pond]))
      selLayer.rect(ptx * T - 1, pty * T - 1, T + 2, T + 2).stroke({ color: 0xf0c040, width: 2 })
  }
  gfx.eventMode = 'static'; gfx.cursor = 'pointer'
  gfx.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
    e.stopPropagation()
    if (e.shiftKey) { propsRef.current.onAddToSelection(entity); return }
    const selEnts = propsRef.current.selectedEntities
    const isAlreadySelected = selEnts.some(s => isSameEntityRef(s, entity))
    propsRef.current.onSelectEntities(isAlreadySelected ? selEnts : [entity])
    if (propsRef.current.tool === 'select') {
      const entryPos = pond.rect ? { tx: pond.rect[0], ty: pond.rect[1] } : { tx: pond.tile![0], ty: pond.tile![1] }
      const entitiesToDrag = isAlreadySelected && selEnts.length > 1 ? selEnts : [entity]
      dragRef.current = {
        entities: entitiesToDrag.map(ent => ({ entity: ent, offsetX: 0, offsetY: 0 })),
        lastTx: entryPos.tx, lastTy: entryPos.ty,
      }
    }
  })
  streetLayer.addChild(gfx)
})
```

Also add pond tiles to `hitTest` (exterior branch, after streets):
```ts
const pondTiles = cfg.pondTiles ?? []
for (let i = pondTiles.length - 1; i >= 0; i--) {
  const entry = pondTiles[i]
  if (entry.rect) {
    const [tx1, ty1, tx2, ty2] = entry.rect
    if (tx >= tx1 && tx <= tx2 && ty >= ty1 && ty <= ty2) return { type: 'pondTile', index: i }
  } else if (entry.tile && entry.tile[0] === tx && entry.tile[1] === ty) {
    return { type: 'pondTile', index: i }
  }
}
```

Also add pond tiles to `getEntityTx`/`getEntityTy`:
```ts
if (entity.type === 'pondTile') {
  const e = cfg.pondTiles?.[entity.index]
  return e?.rect?.[0] ?? e?.tile?.[0] ?? 0
}
```
```ts
if (entity.type === 'pondTile') {
  const e = cfg.pondTiles?.[entity.index]
  return e?.rect?.[1] ?? e?.tile?.[1] ?? 0
}
```

- [ ] **Step 2: Render spawn tiles**

In `renderExterior`, after the pond block, add:
```ts
// Spawn tiles
;(configData.npcSpawnTiles ?? []).forEach(([stx, sty], idx) => {
  const isSel = selectedEntities.some(e => e.type === 'npcSpawnTile' && e.index === idx)
  const entity: SelectedEntity = { type: 'npcSpawnTile', index: idx }
  const gfx = new PIXI.Graphics()
  // Cyan crosshair
  gfx.rect(stx * T + T / 2 - 2, sty * T + 3, 4, T - 6).fill({ color: 0x40d0f0, alpha: 0.85 })
  gfx.rect(stx * T + 3, sty * T + T / 2 - 2, T - 6, 4).fill({ color: 0x40d0f0, alpha: 0.85 })
  gfx.eventMode = 'static'; gfx.cursor = 'pointer'
  gfx.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
    e.stopPropagation()
    if (e.shiftKey) { propsRef.current.onAddToSelection(entity); return }
    propsRef.current.onSelectEntities([entity])
    if (propsRef.current.tool === 'select')
      dragRef.current = { entities: [{ entity, offsetX: 0, offsetY: 0 }], lastTx: stx, lastTy: sty }
  })
  if (isSel) selLayer.rect(stx * T - 2, sty * T - 2, T + 4, T + 4).stroke({ color: 0xf0c040, width: 2 })
  questLayer.addChild(gfx)
})
```

Add spawn tiles to `hitTest` (exterior, after pond tiles):
```ts
const spawnTiles = cfg.npcSpawnTiles ?? []
for (let i = spawnTiles.length - 1; i >= 0; i--) {
  if (spawnTiles[i][0] === tx && spawnTiles[i][1] === ty) return { type: 'npcSpawnTile', index: i }
}
```

Add to `getEntityTx`/`getEntityTy`:
```ts
if (entity.type === 'npcSpawnTile') return cfg.npcSpawnTiles?.[entity.index]?.[0] ?? 0
if (entity.type === 'npcSpawnTile') return cfg.npcSpawnTiles?.[entity.index]?.[1] ?? 0
```

- [ ] **Step 3: Render chicken zone overlay (always visible in exterior)**

In `renderExterior`, call a new helper after `renderAreasOverlay` (which is called conditionally on `showAreas`):
```ts
renderChickenZonesOverlay(questLayer, selLayer)
```

Add the function (below `renderAreasOverlay`):
```ts
function renderChickenZonesOverlay(layer: PIXI.Container, selLayer: PIXI.Graphics) {
  ;(configData.chickenZones ?? []).forEach((zone, zIdx) => {
    const isSel = selectedEntities.some(e => e.type === 'chickenZone' && e.index === zIdx)
    const entity: SelectedEntity = { type: 'chickenZone', index: zIdx }
    const [x1, y1, x2, y2] = zone.rect
    const gfx = new PIXI.Graphics()
    gfx.rect(x1 * T, y1 * T, (x2 - x1 + 1) * T, (y2 - y1 + 1) * T)
      .fill({ color: 0xffaa00, alpha: 0.10 })
      .stroke({ color: isSel ? 0xf0c040 : 0xffaa00, width: isSel ? 2 : 1 })
    gfx.eventMode = 'static'; gfx.cursor = 'pointer'
    gfx.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation()
      if (e.shiftKey) { propsRef.current.onAddToSelection(entity); return }
      const selEnts = propsRef.current.selectedEntities
      const isAlreadySelected = selEnts.some(s => isSameEntityRef(s, entity))
      const entitiesToDrag = isAlreadySelected && selEnts.length > 1 ? selEnts : [entity]
      propsRef.current.onSelectEntities(isAlreadySelected ? selEnts : [entity])
      if (propsRef.current.tool === 'select')
        dragRef.current = { entities: entitiesToDrag.map(ent => ({ entity: ent, offsetX: 0, offsetY: 0 })), lastTx: x1, lastTy: y1 }
    })
    layer.addChild(gfx)
    const lbl = new PIXI.Text({ text: `🐔×${zone.count ?? 1}`, style: { fontSize: 9, fill: isSel ? 0xf0c040 : 0xffaa00 } })
    lbl.x = x1 * T + 4; lbl.y = y1 * T + 4
    layer.addChild(lbl)
  })
}
```

Note: `renderChickenZonesOverlay` is called unconditionally (no toggle) matching the spec.

- [ ] **Step 4: Verify TypeScript compiles**

```
cd web && npx tsc --noEmit 2>&1 | grep MapEditorCanvas
```

Expected: only errors from MapEditor.tsx passing old props (fixed in Task 8), none from within MapEditorCanvas itself.

- [ ] **Step 5: Commit**

```
git add web/src/components/mapEditor/MapEditorCanvas.tsx
git commit -m "feat: canvas pond click targets, spawn tile rendering, chicken zone overlay"
```

---

### Task 6: Inspector — props update + multi-select batch panel

**Files:**
- Modify: `web/src/components/mapEditor/EntityInspector.tsx`

**Interfaces:**
- Consumes: `selectedEntities: SelectedEntity[]` (replaces `selectedEntity`)
- New props: `onDeleteEntities`, `onBatchUpdateZlayer`, `onBatchUpdateStreetPathType`, `onConvertStreetToPond`, `onConvertPondToStreet`, `onUpdatePondEntry`, `onDeletePondTile`, `onDeleteNpcSpawnTile`

- [ ] **Step 1: Update `Props` interface in `EntityInspector.tsx`**

Replace:
```ts
selectedEntity: SelectedEntity | null
```
With:
```ts
selectedEntities: SelectedEntity[]
```

Add to Props:
```ts
onDeleteEntities?:            (entities: SelectedEntity[]) => void
onBatchUpdateZlayer?:         (entities: SelectedEntity[], z: Zlayer) => void
onBatchUpdateStreetPathType?: (entities: SelectedEntity[], pathType: string | undefined) => void
onConvertStreetToPond?:       (index: number) => void
onConvertPondToStreet?:       (index: number) => void
onUpdatePondEntry?:           (index: number, data: { rect?: number[]; tile?: number[] }) => void
onDeletePondTile?:            (index: number) => void
onDeleteNpcSpawnTile?:        (index: number) => void
```

- [ ] **Step 2: Derive `selectedEntity` internally**

At the top of the `EntityInspector` function body, add:
```ts
const selectedEntity = selectedEntities[0] ?? null
```

This means existing inspector sub-panels continue to work without changes — they all use `selectedEntity`.

- [ ] **Step 3: Add the multi-select batch panel**

Add a new component above the main `EntityInspector` return:
```ts
function MultiSelectPanel({
  entities, onDelete, onBatchZlayer, onBatchPathType,
}: {
  entities: SelectedEntity[]
  onDelete?: (e: SelectedEntity[]) => void
  onBatchZlayer?: (e: SelectedEntity[], z: Zlayer) => void
  onBatchPathType?: (e: SelectedEntity[], pt: string | undefined) => void
}) {
  const type = entities[0].type
  const decorTypes = ['exteriorDecor', 'interiorDecor', 'buildingLevelDecor', 'festivalDecor']
  const isDecor = decorTypes.includes(type)
  const isStreet = type === 'street'
  const [pathType, setPathType] = useState('')

  return (
    <div style={{ padding: 12 }}>
      <div style={{ color: '#f0c040', fontWeight: 'bold', marginBottom: 8 }}>
        {entities.length} {type} selected
      </div>
      {isDecor && onBatchZlayer && (
        <Field label="Z-Layer (all)">
          <div style={{ display: 'flex', gap: 4 }}>
            {(['solid', 'below', 'above'] as Zlayer[]).map(z => (
              <button
                key={z}
                onClick={() => onBatchZlayer(entities, z)}
                style={{
                  padding: '3px 8px', fontSize: 11, cursor: 'pointer',
                  background: '#333', color: '#aaa', border: 'none', borderRadius: 3,
                }}
              >{z}</button>
            ))}
          </div>
        </Field>
      )}
      {isStreet && onBatchPathType && (
        <Field label="Path Type (all)">
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={pathType}
              onChange={e => setPathType(e.target.value)}
              placeholder="e.g. cobblestone"
              style={{ flex: 1, padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }}
            />
            <button
              onClick={() => onBatchPathType(entities, pathType || undefined)}
              style={{ padding: '3px 7px', background: '#1a3a1a', border: '1px solid #3a6a3a', color: '#8d8', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}
            >✓</button>
          </div>
        </Field>
      )}
      {onDelete && (
        <button
          onClick={() => onDelete(entities)}
          style={{ width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922', color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12, marginTop: 4 }}
        >
          Delete all ({entities.length})
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Inject multi-select panel into the main inspector render**

In the main `EntityInspector` component, find the outermost return. The component currently renders different panels based on `viewMode` and `selectedEntity`. Add a guard at the very top of the body section that short-circuits to `MultiSelectPanel` when multiple entities are selected:

Find the section where `selectedEntity` is used to switch on what to render. Above that, add:
```ts
if (selectedEntities.length > 1) {
  return (
    <div style={panelStyle}>
      <div style={headerStyle}>Inspector</div>
      <div style={bodyStyle}>
        <MultiSelectPanel
          entities={selectedEntities}
          onDelete={onDeleteEntities}
          onBatchZlayer={onBatchUpdateZlayer}
          onBatchPathType={onBatchUpdateStreetPathType}
        />
      </div>
    </div>
  )
}
```

(The exact location is just before the main switch on `selectedEntity?.type`.)

- [ ] **Step 5: Commit**

```
git add web/src/components/mapEditor/EntityInspector.tsx
git commit -m "feat: inspector multi-select batch panel, updated props"
```

---

### Task 7: Inspector — PondInspector, SpawnTileInspector, StreetInspector convert button

**Files:**
- Modify: `web/src/components/mapEditor/EntityInspector.tsx`

- [ ] **Step 1: Add `PondInspector` component**

Add below `StreetInspector`:
```ts
function PondInspector({
  entry, onUpdate, onDelete, onConvertToStreet,
}: {
  entry: { rect?: number[]; tile?: number[] }
  onUpdate: (data: { rect?: number[]; tile?: number[] }) => void
  onDelete: () => void
  onConvertToStreet: () => void
}) {
  const r = entry.rect
  const t = entry.tile
  return (
    <div>
      {r ? (
        <>
          <Field label="Top-left">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: '#888' }}>X</label>
              {numInput(r[0], v => onUpdate({ rect: [v, r[1], r[2], r[3]] }))}
              <label style={{ fontSize: 11, color: '#888' }}>Y</label>
              {numInput(r[1], v => onUpdate({ rect: [r[0], v, r[2], r[3]] }))}
            </div>
          </Field>
          <Field label="Bottom-right">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: '#888' }}>X</label>
              {numInput(r[2], v => onUpdate({ rect: [r[0], r[1], v, r[3]] }))}
              <label style={{ fontSize: 11, color: '#888' }}>Y</label>
              {numInput(r[3], v => onUpdate({ rect: [r[0], r[1], r[2], v] }))}
            </div>
          </Field>
          <Field label="Size">
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#666' }}>
              {r[2]-r[0]+1} × {r[3]-r[1]+1} tiles
            </span>
          </Field>
        </>
      ) : t ? (
        <Field label="Position">
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <label style={{ fontSize: 11, color: '#888' }}>X</label>
            {numInput(t[0], v => onUpdate({ tile: [v, t[1]] }))}
            <label style={{ fontSize: 11, color: '#888' }}>Y</label>
            {numInput(t[1], v => onUpdate({ tile: [t[0], v] }))}
          </div>
        </Field>
      ) : null}
      <button
        onClick={onConvertToStreet}
        style={{ width: '100%', padding: '5px 0', background: '#1a2e3a', border: '1px solid #2a5a6a', color: '#6ad', cursor: 'pointer', borderRadius: 3, fontSize: 11, marginTop: 4 }}
      >
        Convert to Street
      </button>
      <button
        onClick={onDelete}
        style={{ width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922', color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12, marginTop: 4 }}
      >
        Delete Pond Entry
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Add `SpawnTileInspector` component**

```ts
function SpawnTileInspector({
  tile, onMove, onDelete,
}: {
  tile: [number, number]
  onMove: (tx: number, ty: number) => void
  onDelete: () => void
}) {
  return (
    <div>
      <Field label="Position">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: '#888' }}>X</label>
          {numInput(tile[0], tx => onMove(tx, tile[1]))}
          <label style={{ fontSize: 11, color: '#888' }}>Y</label>
          {numInput(tile[1], ty => onMove(tile[0], ty))}
        </div>
      </Field>
      <button
        onClick={onDelete}
        style={{ width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922', color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12, marginTop: 4 }}
      >
        Delete Spawn Tile
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Add "Convert to Pond" button to `StreetInspector`**

Find `StreetInspector`. After its delete button, add a `onConvertToPond?: () => void` prop and render:
```ts
{onConvertToPond && (
  <button
    onClick={onConvertToPond}
    style={{ width: '100%', padding: '5px 0', background: '#1a2e3a', border: '1px solid #2a5a6a', color: '#6ad', cursor: 'pointer', borderRadius: 3, fontSize: 11, marginTop: 4 }}
  >
    Convert to Pond
  </button>
)}
```

Update `StreetInspector` Props type to include `onConvertToPond?: () => void`.

- [ ] **Step 4: Wire up new inspectors in the main `EntityInspector` body**

In the section that switches on `selectedEntity?.type`, add cases for `pondTile` and `npcSpawnTile`:

For `pondTile`:
```ts
} else if (selectedEntity.type === 'pondTile') {
  const entry = configData.pondTiles?.[selectedEntity.index]
  if (entry) {
    header = 'Pond Tile'
    body = (
      <PondInspector
        entry={entry}
        onUpdate={data => onUpdatePondEntry?.(selectedEntity.index, data)}
        onDelete={() => onDeletePondTile?.(selectedEntity.index)}
        onConvertToStreet={() => onConvertPondToStreet?.(selectedEntity.index)}
      />
    )
  }
```

For `npcSpawnTile`:
```ts
} else if (selectedEntity.type === 'npcSpawnTile') {
  const tile = configData.npcSpawnTiles?.[selectedEntity.index]
  if (tile) {
    header = 'Spawn Tile'
    body = (
      <SpawnTileInspector
        tile={tile as [number, number]}
        onMove={(tx, ty) => onMoveEntity(selectedEntity, tx, ty)}
        onDelete={() => onDeleteNpcSpawnTile?.(selectedEntity.index)}
      />
    )
  }
```

For the existing `street` case, pass `onConvertToPond`:
```ts
<StreetInspector
  entry={entry}
  onUpdate={data => onUpdateStreetEntry(selectedEntity.index, data)}
  onDelete={() => onDelete(selectedEntity)}
  onConvertToPond={onConvertStreetToPond ? () => onConvertStreetToPond(selectedEntity.index) : undefined}
/>
```

- [ ] **Step 5: Verify TypeScript compiles**

```
cd web && npx tsc --noEmit 2>&1 | grep EntityInspector
```

- [ ] **Step 6: Commit**

```
git add web/src/components/mapEditor/EntityInspector.tsx
git commit -m "feat: PondInspector, SpawnTileInspector, street→pond convert button"
```

---

### Task 8: Orchestration — wire everything in MapEditor.tsx

**Files:**
- Modify: `web/src/components/mapEditor/MapEditor.tsx`

- [ ] **Step 1: Update destructured state hook values**

Replace `selectEntity, moveEntity, deleteEntity` with:
```ts
selectEntities, addToSelection, moveEntities, deleteEntities,
addPondTile, updatePondEntry, addNpcSpawnTile, addChickenZone, addArea,
convertStreetToPond, convertPondToStreet,
batchUpdateZlayer, batchUpdateStreetPathType,
```

- [ ] **Step 2: Replace `state.selectedEntity` references**

- Line ~62: `state.selectedEntity?.type === 'npc'` → `state.selectedEntities[0]?.type === 'npc'`
- Line ~67: dep array `state.selectedEntity` → `state.selectedEntities`
- Line ~231: `state.selectedEntity` in Delete key handler → `state.selectedEntities`

- [ ] **Step 3: Update `handleMoveEntity` → `handleMoveEntities`**

```ts
const handleMoveEntities = useCallback((moves: { entity: SelectedEntity; tx: number; ty: number }[]) => {
  const pickupMoves = moves.filter(m => m.entity.type === 'pickupItem')
  const otherMoves  = moves.filter(m => m.entity.type !== 'pickupItem')
  if (pickupMoves.length > 0) {
    setQuestDefsData(prev => {
      if (!prev) return prev
      const items = [...(prev.pickupItems ?? [])]
      for (const { entity, tx, ty } of pickupMoves) {
        if (!items[entity.index]) continue
        items[entity.index] = { ...items[entity.index], tx, ty }
      }
      return { ...prev, pickupItems: items }
    })
  }
  if (otherMoves.length > 0) moveEntities(otherMoves)
}, [moveEntities])
```

- [ ] **Step 4: Update `handleDeleteEntity` → `handleDeleteEntities`**

```ts
const handleDeleteEntities = useCallback((entities: SelectedEntity[]) => {
  const pickups = entities.filter(e => e.type === 'pickupItem')
  const others  = entities.filter(e => e.type !== 'pickupItem')
  if (pickups.length > 0) {
    const indices = new Set(pickups.map(e => e.index))
    setQuestDefsData(prev => prev
      ? { ...prev, pickupItems: (prev.pickupItems ?? []).filter((_, i) => !indices.has(i)) }
      : prev)
    selectEntities([])
  }
  if (others.length > 0) deleteEntities(others)
}, [deleteEntities, selectEntities])
```

- [ ] **Step 5: Update `handleAddTreasure`, `handleAddInteractable`, `handleAddBlockedPath`, `handleDeleteBlockedPath`**

Any call to `selectEntity(...)` → `selectEntities([...])`
Any call to `selectEntity(null)` → `selectEntities([])`

- [ ] **Step 6: Update Delete key handler**

```ts
if (e.key === 'Delete' || e.key === 'Backspace') {
  if (state.selectedEntities.length > 0) handleDeleteEntities(state.selectedEntities)
}
```

Update dep array: `state.selectedEntity` → `state.selectedEntities`.

- [ ] **Step 7: Update `MapEditorCanvas` props**

```tsx
<MapEditorCanvas
  {/* ... unchanged props ... */}
  selectedEntities={state.selectedEntities}
  onSelectEntities={selectEntities}
  onAddToSelection={addToSelection}
  onMoveEntities={handleMoveEntities}
  onDeleteEntities={handleDeleteEntities}
  onAddStreet={addStreet}
  onAddPondTile={addPondTile}
  onAddNpcSpawnTile={addNpcSpawnTile}
  onAddChickenZone={addChickenZone}
  onAddArea={addArea}
  {/* remove: selectedEntity, onSelectEntity, onMoveEntity, onDeleteEntity */}
/>
```

- [ ] **Step 8: Update `EntityInspector` props**

```tsx
<EntityInspector
  {/* ... unchanged props ... */}
  selectedEntities={state.selectedEntities}
  onDeleteEntities={handleDeleteEntities}
  onBatchUpdateZlayer={batchUpdateZlayer}
  onBatchUpdateStreetPathType={batchUpdateStreetPathType}
  onConvertStreetToPond={convertStreetToPond}
  onConvertPondToStreet={convertPondToStreet}
  onUpdatePondEntry={updatePondEntry}
  onDeletePondTile={(i) => deleteEntities([{ type: 'pondTile', index: i }])}
  onDeleteNpcSpawnTile={(i) => deleteEntities([{ type: 'npcSpawnTile', index: i }])}
  onMoveEntity={(entity, tx, ty) => handleMoveEntities([{ entity, tx, ty }])}
  onDelete={(entity) => handleDeleteEntities([entity])}
  {/* remove: selectedEntity */}
/>
```

- [ ] **Step 9: Verify TypeScript compiles cleanly**

```
cd web && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 10: Run all tests**

```
cd web && npx vitest run
```

Expected: all pass.

- [ ] **Step 11: Commit**

```
git add web/src/components/mapEditor/MapEditor.tsx
git commit -m "feat: wire multi-select, new draw tools, pond↔street convert in MapEditor"
```
