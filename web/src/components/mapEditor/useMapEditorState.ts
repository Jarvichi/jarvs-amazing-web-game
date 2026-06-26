import { useState, useCallback } from 'react'
import type { RawMapConfig, RawNpc, RawAnimal, RawInterior, RawBuilding, RawDecorItem, RawLockedDoor, SelectedEntity, ToolMode, Zlayer, MapEditorState } from './mapEditorTypes'
import { toggleInSelection, nextAreaId, convertStreetToPond as cSTP, convertPondToStreet as cPTS, applyDeleteEntities, applyBatchUpdateZlayer, applyBatchUpdateStreetPathType } from './multiSelectHelpers'

type InteriorExit = NonNullable<RawInterior['exits']>[number]
import hubConfig from '../../data/hub/ravenwatch/config.json'
import town2Config from '../../data/hub/millhaven/config.json'
import castleConfig from '../../data/hub/ironholdkeep/config.json'
import thornwoodcampConfig from '../../data/hub/thornwoodcamp/config.json'
import capitalcityConfig from '../../data/hub/capitalcity/config.json'
import royalpalaceConfig from '../../data/hub/royalpalace/config.json'
import saltmereportConfig from '../../data/hub/saltmereport/config.json'
import gearfordConfig from '../../data/hub/gearford/config.json'
import harrowfieldConfig from '../../data/hub/harrowfield/config.json'
import applefordConfig from '../../data/hub/appleford/config.json'
import gravemoorConfig from '../../data/hub/gravemoor/config.json'
import hollowmereConfig from '../../data/hub/hollowmere/config.json'
import dreadspirecitadelConfig from '../../data/hub/dreadspirecitadel/config.json'
import { MapId } from '../../data/hub/hubWorldFactory'
import type { WallMaterial, RoofMaterial } from '../../data/tiles/buildingMaterials'

// Exported so cross-town reference pickers (entityRefs.ts) can read every town's
// NPCs / buildings / interiors without re-importing all the config JSON.
export const RAW_CONFIGS: Record<MapId, RawMapConfig> = {
  ravenwatch:    hubConfig    as unknown as RawMapConfig,
  millhaven:  town2Config  as unknown as RawMapConfig,
  ironholdkeep: castleConfig as unknown as RawMapConfig,
  thornwoodcamp: thornwoodcampConfig as unknown as RawMapConfig,
  capitalcity: capitalcityConfig as unknown as RawMapConfig,
  royalpalace: royalpalaceConfig as unknown as RawMapConfig,
  saltmereport: saltmereportConfig as unknown as RawMapConfig,
  gearford: gearfordConfig as unknown as RawMapConfig,
  harrowfield: harrowfieldConfig as unknown as RawMapConfig,
  appleford: applefordConfig as unknown as RawMapConfig,
  gravemoor: gravemoorConfig as unknown as RawMapConfig,
  hollowmere: hollowmereConfig as unknown as RawMapConfig,
  dreadspirecitadel: dreadspirecitadelConfig as unknown as RawMapConfig,
}

const MAX_UNDO = 50

/** Immutably patch one item inside a festival decor group; returns a new config. */
function patchFestivalDecor(
  cfg: RawMapConfig, festivalId: string, index: number, patch: Partial<RawDecorItem>,
): RawMapConfig {
  return { ...cfg, festivalDecor: (cfg.festivalDecor ?? []).map(g => {
    if (g.festivalId !== festivalId || !g.decor[index]) return g
    const decor = [...g.decor]
    decor[index] = { ...decor[index], ...patch }
    return { ...g, decor }
  }) }
}

/** Apply a single entity move to a config, returning a new config (or the same if no-op). */
function applyMove(prevConfig: RawMapConfig, entity: SelectedEntity, tx: number, ty: number): RawMapConfig {
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
    const newRects = rects.map(([rx1, ry1, rx2, ry2]) => [rx1 + dx, ry1 + dy, rx2 + dx, ry2 + dy] as [number, number, number, number])
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
      streets[entity.index] = { ...entry, rect: [tx1 + dx, ty1 + dy, tx2 + dx, ty2 + dy] }
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
      pondTiles[entity.index] = { ...entry, rect: [tx1 + dx, ty1 + dy, tx2 + dx, ty2 + dy] }
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
    zones[entity.index] = { ...z, rect: [x1 + dx, y1 + dy, x2 + dx, y2 + dy] }
    newConfig = { ...prevConfig, chickenZones: zones }
  } else if (entity.type === 'buildingLevelDecor') {
    const buildings = [...(prevConfig.buildings ?? [])]
    const b = buildings[entity.buildingIndex]
    if (!b?.levelDecor?.[entity.index]) return prevConfig
    const levelDecor = [...b.levelDecor]
    levelDecor[entity.index] = { ...levelDecor[entity.index], tx, ty }
    buildings[entity.buildingIndex] = { ...b, levelDecor }
    newConfig = { ...prevConfig, buildings }
  } else if (entity.type === 'buildingDecor') {
    // tx/ty are absolute; convert to relative before storing
    const buildings = [...(prevConfig.buildings ?? [])]
    const b = buildings[entity.buildingIndex]
    if (!b?.decor?.[entity.index]) return prevConfig
    const allRects = (b.rects ?? (b.rect ? [b.rect] : [])) as [number, number, number, number][]
    const ox = Math.min(...allRects.map(r => r[0]))
    const oy = Math.max(...allRects.map(r => r[3]))
    const decor = [...b.decor!]
    decor[entity.index] = { ...decor[entity.index], tx: tx - ox, ty: ty - oy }
    buildings[entity.buildingIndex] = { ...b, decor }
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

export function useMapEditorState(initialMapId: MapId = 'ravenwatch', initialFestival: string | null = null) {
  const [state, setState] = useState<MapEditorState>(() => ({
    mapId:            initialMapId,
    configData:       structuredClone(RAW_CONFIGS[initialMapId]),
    tool:             'select',
    activeTileId:     null,
    activeBundleId:   null,
    activeZlayer:     'solid',
    viewMode:            'exterior',
    activeInteriorId:    null,
    activeBuildingIndex: null,
    activeLevel:      0,
    previewFestivalId: initialFestival,
    selectedEntities: [],
    undoStack:        [],
    redoStack:        [],
    isDirty:          false,
  }))

  const setMapId = useCallback((mapId: MapId) => {
    setState(s => ({
      ...s,
      mapId,
      configData:       structuredClone(RAW_CONFIGS[mapId]),
      selectedEntities: [],
      viewMode:         'exterior',
      activeInteriorId: null,
      activeLevel:      0,
      undoStack:        [],
      redoStack:        [],
      isDirty:          false,
    }))
  }, [])

  const setActiveLevel = useCallback((activeLevel: number) => {
    setState(s => ({ ...s, activeLevel: Math.max(0, activeLevel) }))
  }, [])

  const setPreviewFestival = useCallback((previewFestivalId: string | null) => {
    setState(s => ({ ...s, previewFestivalId, selectedEntities: [] }))
  }, [])

  const setTool = useCallback((tool: ToolMode) => {
    setState(s => ({ ...s, tool }))
  }, [])

  const setActiveTile = useCallback((tileId: string | null, bundleId?: string) => {
    setState(s => ({
      ...s,
      activeTileId:   tileId,
      activeBundleId: bundleId ?? null,
      tool:           (tileId || bundleId) ? 'place' : s.tool,
    }))
  }, [])

  const setZlayer = useCallback((zlayer: Zlayer) => {
    setState(s => ({ ...s, activeZlayer: zlayer }))
  }, [])

  const openInterior = useCallback((interiorId: string) => {
    setState(s => ({ ...s, viewMode: 'interior', activeInteriorId: interiorId, activeLevel: 0, selectedEntities: [] }))
  }, [])

  const closeInterior = useCallback(() => {
    setState(s => ({ ...s, viewMode: 'exterior', activeInteriorId: null, activeLevel: 0, selectedEntities: [] }))
  }, [])

  const openBuildingEditor = useCallback((buildingIndex: number) => {
    setState(s => ({ ...s, viewMode: 'building', activeBuildingIndex: buildingIndex, activeLevel: 0, selectedEntities: [] }))
  }, [])

  const closeBuildingEditor = useCallback(() => {
    setState(s => ({ ...s, viewMode: 'exterior', activeBuildingIndex: null, activeLevel: 0, selectedEntities: [] }))
  }, [])

  const selectEntities = useCallback((entities: SelectedEntity[]) => {
    setState(s => ({ ...s, selectedEntities: entities }))
  }, [])

  const addToSelection = useCallback((entity: SelectedEntity) => {
    setState(s => ({ ...s, selectedEntities: toggleInSelection(s.selectedEntities, entity) }))
  }, [])

  const placeDecor = useCallback((tx: number, ty: number) => {
    setState(s => {
      if (!s.activeTileId && !s.activeBundleId) return s
      const prevConfig = s.configData
      // Tag the item with the active level (cumulative reveal). Level 0 = base.
      const levelTag = s.activeLevel > 0 ? { minLevel: s.activeLevel } : {}
      const newItem = s.activeBundleId
        ? { tx, ty, bundleID: s.activeBundleId, zlayer: s.activeZlayer, ...levelTag }
        : { tx, ty, tileId: s.activeTileId!, zlayer: s.activeZlayer, ...levelTag }

      let newConfig: RawMapConfig
      if (s.viewMode === 'exterior') {
        // When previewing a festival, placed decor belongs to that festival's group.
        if (s.previewFestivalId) {
          const groups = [...(prevConfig.festivalDecor ?? [])]
          const gi = groups.findIndex(g => g.festivalId === s.previewFestivalId)
          if (gi >= 0) groups[gi] = { ...groups[gi], decor: [...groups[gi].decor, newItem] }
          else groups.push({ festivalId: s.previewFestivalId, decor: [newItem] })
          newConfig = { ...prevConfig, festivalDecor: groups }
        } else
        // When a building is selected, exterior decor belongs to that building's
        // per-level decor (revealed by upgrade level). Otherwise it is ambient
        // exterior decor with no level association.
        if (s.selectedEntities[0]?.type === 'building') {
          const buildings = [...(prevConfig.buildings ?? [])]
          const b = buildings[s.selectedEntities[0].index]
          if (!b) return s
          buildings[s.selectedEntities[0].index] = { ...b, levelDecor: [...(b.levelDecor ?? []), newItem] }
          newConfig = { ...prevConfig, buildings }
        } else {
          newConfig = { ...prevConfig, exteriorDecor: [...(prevConfig.exteriorDecor ?? []), newItem] }
        }
      } else if (s.viewMode === 'interior' && s.activeInteriorId) {
        const interior = prevConfig.interiors?.[s.activeInteriorId]
        if (!interior) return s
        newConfig = {
          ...prevConfig,
          interiors: {
            ...prevConfig.interiors,
            [s.activeInteriorId]: { ...interior, decor: [...interior.decor, newItem] },
          },
        }
      } else if (s.viewMode === 'building' && s.activeBuildingIndex != null) {
        // In building editor, placed coords are absolute; convert to building-relative.
        const buildings = [...(prevConfig.buildings ?? [])]
        const b = buildings[s.activeBuildingIndex]
        if (!b) return s
        const allRects = (b.rects ?? (b.rect ? [b.rect] : [])) as [number, number, number, number][]
        const ox = Math.min(...allRects.map(r => r[0]))
        const oy = Math.max(...allRects.map(r => r[3]))
        const relItem = { ...newItem, tx: tx - ox, ty: ty - oy }
        if (s.activeLevel > 0) {
          // levelDecor uses absolute coords (same as exteriorDecor)
          buildings[s.activeBuildingIndex] = { ...b, levelDecor: [...(b.levelDecor ?? []), { ...newItem, minLevel: s.activeLevel }] }
        } else {
          // b.decor uses relative coords from (ox, oy)
          buildings[s.activeBuildingIndex] = { ...b, decor: [...(b.decor ?? []), relItem] }
        }
        newConfig = { ...prevConfig, buildings }
      } else {
        return s
      }

      return {
        ...s,
        configData: newConfig,
        undoStack:  [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack:  [],
        isDirty:    true,
      }
    })
  }, [])

  const moveEntities = useCallback((moves: { entity: SelectedEntity; tx: number; ty: number }[]) => {
    setState(s => {
      const prevConfig = s.configData
      let newConfig = prevConfig

      for (const { entity, tx, ty } of moves) {
        newConfig = applyMove(newConfig, entity, tx, ty)
      }

      if (newConfig === prevConfig) return s
      return {
        ...s,
        configData: newConfig,
        undoStack:  [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack:  [],
        isDirty:    true,
      }
    })
  }, [])

  const deleteEntities = useCallback((entities: SelectedEntity[]) => {
    setState(s => {
      const prevConfig = s.configData
      const newConfig = applyDeleteEntities(prevConfig, entities)
      if (newConfig === prevConfig) return s
      return {
        ...s,
        configData:       newConfig,
        selectedEntities: [],
        undoStack:        [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack:        [],
        isDirty:          true,
      }
    })
  }, [])

  const addPondTile = useCallback((tx1: number, ty1: number, tx2: number, ty2: number) => {
    setState(s => {
      const prevConfig = s.configData
      const entry = tx1 === tx2 && ty1 === ty2 ? { tile: [tx1, ty1] } : { rect: [tx1, ty1, tx2, ty2] }
      const pondTiles = [...(prevConfig.pondTiles ?? []), entry]
      const newIndex = pondTiles.length - 1
      return {
        ...s,
        configData: { ...prevConfig, pondTiles },
        selectedEntities: [{ type: 'pondTile' as const, index: newIndex }],
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const updatePondEntry = useCallback((index: number, data: { rect?: number[]; tile?: number[] }) => {
    setState(s => {
      const prevConfig = s.configData
      const pondTiles = [...(prevConfig.pondTiles ?? [])]
      if (!pondTiles[index]) return s
      pondTiles[index] = { ...pondTiles[index], ...data }
      return {
        ...s,
        configData: { ...prevConfig, pondTiles },
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const addNpcSpawnTile = useCallback((tx: number, ty: number) => {
    setState(s => {
      const prevConfig = s.configData
      const npcSpawnTiles = [...(prevConfig.npcSpawnTiles ?? []), [tx, ty] as [number, number]]
      const newIndex = npcSpawnTiles.length - 1
      return {
        ...s,
        configData: { ...prevConfig, npcSpawnTiles },
        selectedEntities: [{ type: 'npcSpawnTile' as const, index: newIndex }],
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const addChickenZone = useCallback((tx1: number, ty1: number, tx2: number, ty2: number) => {
    setState(s => {
      const prevConfig = s.configData
      const chickenZones = [...(prevConfig.chickenZones ?? []), { rect: [tx1, ty1, tx2, ty2] as [number, number, number, number], count: 1 }]
      const newIndex = chickenZones.length - 1
      return {
        ...s,
        configData: { ...prevConfig, chickenZones },
        selectedEntities: [{ type: 'chickenZone' as const, index: newIndex }],
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const addArea = useCallback((tx1: number, ty1: number, tx2: number, ty2: number) => {
    setState(s => {
      const prevConfig = s.configData
      const id = nextAreaId(prevConfig.areas ?? [])
      const areas = [...(prevConfig.areas ?? []), { id, name: id, tx: tx1, ty: ty1, tw: tx2 - tx1 + 1, th: ty2 - ty1 + 1 }]
      const newIndex = areas.length - 1
      return {
        ...s,
        configData: { ...prevConfig, areas },
        selectedEntities: [{ type: 'area' as const, index: newIndex }],
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const convertStreetToPond = useCallback((index: number) => {
    setState(s => {
      const result = cSTP(s.configData, index)
      if (!result) return s
      return {
        ...s,
        configData: result.config,
        selectedEntities: [{ type: 'pondTile' as const, index: result.pondIndex }],
        undoStack: [...s.undoStack, s.configData].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const convertPondToStreet = useCallback((index: number) => {
    setState(s => {
      const result = cPTS(s.configData, index)
      if (!result) return s
      return {
        ...s,
        configData: result.config,
        selectedEntities: [{ type: 'street' as const, index: result.streetIndex }],
        undoStack: [...s.undoStack, s.configData].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const batchUpdateZlayer = useCallback((entities: SelectedEntity[], zlayer: Zlayer) => {
    setState(s => {
      const prevConfig = s.configData
      const newConfig = applyBatchUpdateZlayer(prevConfig, entities, zlayer)
      if (newConfig === prevConfig) return s
      return {
        ...s,
        configData: newConfig,
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const batchUpdateStreetPathType = useCallback((entities: SelectedEntity[], pathType: string | undefined) => {
    setState(s => {
      const prevConfig = s.configData
      const newConfig = applyBatchUpdateStreetPathType(prevConfig, entities, pathType)
      if (newConfig === prevConfig) return s
      return {
        ...s,
        configData: newConfig,
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const updateDecorZlayer = useCallback((entity: SelectedEntity, zlayer: Zlayer) => {
    setState(s => {
      const prevConfig = s.configData
      let newConfig = prevConfig

      if (entity.type === 'exteriorDecor') {
        const decor = [...(prevConfig.exteriorDecor ?? [])]
        if (!decor[entity.index]) return s
        decor[entity.index] = { ...decor[entity.index], zlayer }
        newConfig = { ...prevConfig, exteriorDecor: decor }
      } else if (entity.type === 'festivalDecor') {
        newConfig = patchFestivalDecor(prevConfig, entity.festivalId, entity.index, { zlayer })
      } else if (entity.type === 'buildingLevelDecor' && prevConfig.buildings?.[entity.buildingIndex]?.levelDecor) {
        const buildings = [...prevConfig.buildings]
        const b = buildings[entity.buildingIndex]
        const levelDecor = [...(b.levelDecor ?? [])]
        if (!levelDecor[entity.index]) return s
        levelDecor[entity.index] = { ...levelDecor[entity.index], zlayer }
        buildings[entity.buildingIndex] = { ...b, levelDecor }
        newConfig = { ...prevConfig, buildings }
      } else if (entity.type === 'buildingDecor' && prevConfig.buildings?.[entity.buildingIndex]?.decor) {
        const buildings = [...prevConfig.buildings]
        const b = buildings[entity.buildingIndex]
        const decor = [...(b.decor ?? [])]
        if (!decor[entity.index]) return s
        decor[entity.index] = { ...decor[entity.index], zlayer }
        buildings[entity.buildingIndex] = { ...b, decor }
        newConfig = { ...prevConfig, buildings }
      } else if (entity.type === 'interiorDecor' && prevConfig.interiors?.[entity.interiorId]) {
        const interior = prevConfig.interiors[entity.interiorId]
        const decor = [...interior.decor]
        if (!decor[entity.index]) return s
        decor[entity.index] = { ...decor[entity.index], zlayer }
        newConfig = {
          ...prevConfig,
          interiors: { ...prevConfig.interiors, [entity.interiorId]: { ...interior, decor } },
        }
      }

      if (newConfig === prevConfig) return s
      return {
        ...s,
        configData: newConfig,
        undoStack:  [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack:  [],
        isDirty:    true,
      }
    })
  }, [])

  const reorderDecor = useCallback((entity: SelectedEntity, direction: 'forward' | 'back') => {
    setState(s => {
      const prevConfig = s.configData
      const i = entity.index
      const swapWith = direction === 'forward' ? i + 1 : i - 1
      let newConfig = prevConfig

      if (entity.type === 'exteriorDecor') {
        const decor = [...(prevConfig.exteriorDecor ?? [])]
        if (swapWith < 0 || swapWith >= decor.length) return s
        ;[decor[i], decor[swapWith]] = [decor[swapWith], decor[i]]
        newConfig = { ...prevConfig, exteriorDecor: decor }
      } else if (entity.type === 'interiorDecor' && prevConfig.interiors?.[entity.interiorId]) {
        const interior = prevConfig.interiors[entity.interiorId]
        const decor = [...interior.decor]
        if (swapWith < 0 || swapWith >= decor.length) return s
        ;[decor[i], decor[swapWith]] = [decor[swapWith], decor[i]]
        newConfig = { ...prevConfig, interiors: { ...prevConfig.interiors, [entity.interiorId]: { ...interior, decor } } }
      } else {
        return s
      }

      const newSelected = s.selectedEntities.map(e =>
        e.type === entity.type && e.index === i ? { ...e, index: swapWith } : e
      )
      return {
        ...s,
        configData: newConfig,
        selectedEntities: newSelected,
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const updateDecorTileId = useCallback((entity: SelectedEntity, tileId: string) => {
    setState(s => {
      const prevConfig = s.configData
      let newConfig = prevConfig

      if (entity.type === 'exteriorDecor') {
        const decor = [...(prevConfig.exteriorDecor ?? [])]
        if (!decor[entity.index]) return s
        decor[entity.index] = { ...decor[entity.index], tileId }
        newConfig = { ...prevConfig, exteriorDecor: decor }
      } else if (entity.type === 'buildingLevelDecor' && prevConfig.buildings?.[entity.buildingIndex]?.levelDecor) {
        const buildings = [...prevConfig.buildings]
        const b = buildings[entity.buildingIndex]
        const levelDecor = [...(b.levelDecor ?? [])]
        if (!levelDecor[entity.index]) return s
        levelDecor[entity.index] = { ...levelDecor[entity.index], tileId }
        buildings[entity.buildingIndex] = { ...b, levelDecor }
        newConfig = { ...prevConfig, buildings }
      } else if (entity.type === 'buildingDecor' && prevConfig.buildings?.[entity.buildingIndex]?.decor) {
        const buildings = [...prevConfig.buildings]
        const b = buildings[entity.buildingIndex]
        const decor = [...(b.decor ?? [])]
        if (!decor[entity.index]) return s
        decor[entity.index] = { ...decor[entity.index], tileId }
        buildings[entity.buildingIndex] = { ...b, decor }
        newConfig = { ...prevConfig, buildings }
      } else if (entity.type === 'interiorDecor' && prevConfig.interiors?.[entity.interiorId]) {
        const interior = prevConfig.interiors[entity.interiorId]
        const decor = [...interior.decor]
        if (!decor[entity.index]) return s
        decor[entity.index] = { ...decor[entity.index], tileId }
        newConfig = {
          ...prevConfig,
          interiors: { ...prevConfig.interiors, [entity.interiorId]: { ...interior, decor } },
        }
      }

      if (newConfig === prevConfig) return s
      return { ...s, configData: newConfig, undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO), redoStack: [], isDirty: true }
    })
  }, [])

  // Merge glow fields (glow/glowRadius/pulse) into the selected decor item.
  const updateGlow = useCallback((entity: SelectedEntity, patch: Partial<{ glow: boolean; glowRadius: number; pulse: boolean }>) => {
    setState(s => {
      const prevConfig = s.configData
      let newConfig = prevConfig

      if (entity.type === 'exteriorDecor') {
        const decor = [...(prevConfig.exteriorDecor ?? [])]
        if (!decor[entity.index]) return s
        decor[entity.index] = { ...decor[entity.index], ...patch }
        newConfig = { ...prevConfig, exteriorDecor: decor }
      } else if (entity.type === 'festivalDecor') {
        newConfig = patchFestivalDecor(prevConfig, entity.festivalId, entity.index, patch)
      } else if (entity.type === 'buildingLevelDecor' && prevConfig.buildings?.[entity.buildingIndex]?.levelDecor) {
        const buildings = [...prevConfig.buildings]
        const b = buildings[entity.buildingIndex]
        const levelDecor = [...(b.levelDecor ?? [])]
        if (!levelDecor[entity.index]) return s
        levelDecor[entity.index] = { ...levelDecor[entity.index], ...patch }
        buildings[entity.buildingIndex] = { ...b, levelDecor }
        newConfig = { ...prevConfig, buildings }
      } else if (entity.type === 'buildingDecor' && prevConfig.buildings?.[entity.buildingIndex]?.decor) {
        const buildings = [...prevConfig.buildings]
        const b = buildings[entity.buildingIndex]
        const decor = [...(b.decor ?? [])]
        if (!decor[entity.index]) return s
        decor[entity.index] = { ...decor[entity.index], ...patch }
        buildings[entity.buildingIndex] = { ...b, decor }
        newConfig = { ...prevConfig, buildings }
      } else if (entity.type === 'interiorDecor' && prevConfig.interiors?.[entity.interiorId]) {
        const interior = prevConfig.interiors[entity.interiorId]
        const decor = [...interior.decor]
        if (!decor[entity.index]) return s
        decor[entity.index] = { ...decor[entity.index], ...patch }
        newConfig = {
          ...prevConfig,
          interiors: { ...prevConfig.interiors, [entity.interiorId]: { ...interior, decor } },
        }
      }

      if (newConfig === prevConfig) return s
      return {
        ...s,
        configData: newConfig,
        undoStack:  [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack:  [],
        isDirty:    true,
      }
    })
  }, [])

  // Patch the minLevel of a level-aware decor item (building level-decor or interior decor).
  const updateDecorMinLevel = useCallback((entity: SelectedEntity, minLevel: number | undefined) => {
    setState(s => {
      const prevConfig = s.configData
      let newConfig = prevConfig
      const clean = (item: RawDecorItem): RawDecorItem => {
        const next = { ...item, minLevel }
        if (minLevel === undefined || minLevel <= 0) delete next.minLevel
        return next
      }

      if (entity.type === 'buildingLevelDecor' && prevConfig.buildings?.[entity.buildingIndex]?.levelDecor) {
        const buildings = [...prevConfig.buildings]
        const b = buildings[entity.buildingIndex]
        const levelDecor = [...(b.levelDecor ?? [])]
        if (!levelDecor[entity.index]) return s
        levelDecor[entity.index] = clean(levelDecor[entity.index])
        buildings[entity.buildingIndex] = { ...b, levelDecor }
        newConfig = { ...prevConfig, buildings }
      } else if (entity.type === 'buildingDecor' && prevConfig.buildings?.[entity.buildingIndex]?.decor) {
        const buildings = [...prevConfig.buildings]
        const b = buildings[entity.buildingIndex]
        const decor = [...(b.decor ?? [])]
        if (!decor[entity.index]) return s
        decor[entity.index] = clean(decor[entity.index])
        buildings[entity.buildingIndex] = { ...b, decor }
        newConfig = { ...prevConfig, buildings }
      } else if (entity.type === 'interiorDecor' && prevConfig.interiors?.[entity.interiorId]) {
        const interior = prevConfig.interiors[entity.interiorId]
        const decor = [...interior.decor]
        if (!decor[entity.index]) return s
        decor[entity.index] = clean(decor[entity.index])
        newConfig = {
          ...prevConfig,
          interiors: { ...prevConfig.interiors, [entity.interiorId]: { ...interior, decor } },
        }
      }

      if (newConfig === prevConfig) return s
      return {
        ...s,
        configData: newConfig,
        undoStack:  [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack:  [],
        isDirty:    true,
      }
    })
  }, [])

  // Patch the hideAtLevel of a level-aware decor item (building level-decor or interior decor).
  const updateDecorHideAtLevel = useCallback((entity: SelectedEntity, hideAtLevel: number | undefined) => {
    setState(s => {
      const prevConfig = s.configData
      let newConfig = prevConfig
      const clean = (item: RawDecorItem): RawDecorItem => {
        const next = { ...item, hideAtLevel }
        if (hideAtLevel === undefined || hideAtLevel <= 0) delete next.hideAtLevel
        return next
      }

      if (entity.type === 'buildingLevelDecor' && prevConfig.buildings?.[entity.buildingIndex]?.levelDecor) {
        const buildings = [...prevConfig.buildings]
        const b = buildings[entity.buildingIndex]
        const levelDecor = [...(b.levelDecor ?? [])]
        if (!levelDecor[entity.index]) return s
        levelDecor[entity.index] = clean(levelDecor[entity.index])
        buildings[entity.buildingIndex] = { ...b, levelDecor }
        newConfig = { ...prevConfig, buildings }
      } else if (entity.type === 'buildingDecor' && prevConfig.buildings?.[entity.buildingIndex]?.decor) {
        const buildings = [...prevConfig.buildings]
        const b = buildings[entity.buildingIndex]
        const decor = [...(b.decor ?? [])]
        if (!decor[entity.index]) return s
        decor[entity.index] = clean(decor[entity.index])
        buildings[entity.buildingIndex] = { ...b, decor }
        newConfig = { ...prevConfig, buildings }
      } else if (entity.type === 'interiorDecor' && prevConfig.interiors?.[entity.interiorId]) {
        const interior = prevConfig.interiors[entity.interiorId]
        const decor = [...interior.decor]
        if (!decor[entity.index]) return s
        decor[entity.index] = clean(decor[entity.index])
        newConfig = {
          ...prevConfig,
          interiors: { ...prevConfig.interiors, [entity.interiorId]: { ...interior, decor } },
        }
      }

      if (newConfig === prevConfig) return s
      return {
        ...s,
        configData: newConfig,
        undoStack:  [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack:  [],
        isDirty:    true,
      }
    })
  }, [])

  // Create/patch/remove a per-level visual override (footprint/wall/roof) for a building.
  const updateBuildingLevelVisual = useCallback((
    buildingIndex: number,
    minLevel: number,
    patch: Partial<{ rect: [number, number, number, number]; wall: WallMaterial; roof: RoofMaterial }>,
  ) => {
    setState(s => {
      const prevConfig = s.configData
      const buildings = [...(prevConfig.buildings ?? [])]
      const b = buildings[buildingIndex]
      if (!b) return s
      const levelVisuals = [...(b.levelVisuals ?? [])]
      const idx = levelVisuals.findIndex(v => v.minLevel === minLevel)
      const merged = { ...(idx >= 0 ? levelVisuals[idx] : { minLevel }), ...patch }
      // Drop fields cleared to undefined so they fall back to the base building.
      for (const k of ['rect', 'wall', 'roof'] as const)
        if (merged[k] === undefined) delete (merged as Record<string, unknown>)[k]
      const hasOverride = merged.rect !== undefined || merged.wall !== undefined || merged.roof !== undefined
      if (idx >= 0) {
        if (hasOverride) levelVisuals[idx] = merged
        else levelVisuals.splice(idx, 1)                 // nothing left to override — remove entry
      } else if (hasOverride) {
        levelVisuals.push(merged)
      }
      levelVisuals.sort((a, c) => a.minLevel - c.minLevel)
      buildings[buildingIndex] = { ...b, levelVisuals: levelVisuals.length ? levelVisuals : undefined }
      return {
        ...s,
        configData: { ...prevConfig, buildings },
        undoStack:  [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack:  [],
        isDirty:    true,
      }
    })
  }, [])

  // Patch building-level fields (upgradeKind / maxLevel) on a building.
  const updateBuilding = useCallback((index: number, patch: Partial<RawBuilding>) => {
    setState(s => {
      const prevConfig = s.configData
      const buildings = [...(prevConfig.buildings ?? [])]
      if (!buildings[index]) return s
      buildings[index] = { ...buildings[index], ...patch }
      return {
        ...s,
        configData: { ...prevConfig, buildings },
        undoStack:  [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack:  [],
        isDirty:    true,
      }
    })
  }, [])

  const updateNpcDialogue = useCallback((index: number, dialogue: string[]) => {
    setState(s => {
      const prevConfig = s.configData
      const npcs = [...(prevConfig.npcs ?? [])]
      if (!npcs[index]) return s
      npcs[index] = { ...npcs[index], dialogue }
      return {
        ...s,
        configData: { ...prevConfig, npcs },
        undoStack:  [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack:  [],
        isDirty:    true,
      }
    })
  }, [])

  const addNpc = useCallback((npc: RawNpc) => {
    setState(s => {
      const prevConfig = s.configData
      const npcs = [...(prevConfig.npcs ?? []), npc]
      return {
        ...s,
        configData: { ...prevConfig, npcs },
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const updateNpc = useCallback((index: number, partial: Partial<RawNpc>) => {
    setState(s => {
      const prevConfig = s.configData
      const npcs = [...(prevConfig.npcs ?? [])]
      if (!npcs[index]) return s
      npcs[index] = { ...npcs[index], ...partial }
      return {
        ...s,
        configData: { ...prevConfig, npcs },
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const addAnimal = useCallback((animal: RawAnimal) => {
    setState(s => {
      const prevConfig = s.configData
      const animals = [...(prevConfig.animals ?? []), animal]
      return {
        ...s,
        configData: { ...prevConfig, animals },
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const updateAnimal = useCallback((index: number, partial: Partial<RawAnimal>) => {
    setState(s => {
      const prevConfig = s.configData
      const animals = [...(prevConfig.animals ?? [])]
      if (!animals[index]) return s
      animals[index] = { ...animals[index], ...partial }
      return {
        ...s,
        configData: { ...prevConfig, animals },
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const updateTreasure = useCallback((index: number, patch: Partial<NonNullable<RawMapConfig['treasures']>[number]>) => {
    setState(s => {
      const prevConfig = s.configData
      const treasures = [...(prevConfig.treasures ?? [])]
      if (!treasures[index]) return s
      treasures[index] = { ...treasures[index], ...patch }
      return {
        ...s,
        configData: { ...prevConfig, treasures },
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  // Generic top-level config patch with undo support. Used by the simpler list
  // editors (treasures, interactables, exitTiles, chickenZones, weather,
  // ambientNpcSprites, avatarStart, pondTiles, npcSpawnTiles…) which read the
  // current array/value from configData and write the whole thing back.
  const updateConfig = useCallback((patch: Partial<RawMapConfig>) => {
    setState(s => ({
      ...s,
      configData: { ...s.configData, ...patch },
      undoStack:  [...s.undoStack, s.configData].slice(-MAX_UNDO),
      redoStack:  [],
      isDirty:    true,
    }))
  }, [])

  const updateArea = useCallback((index: number, patch: Partial<{ name: string; tw: number; th: number }>) => {
    setState(s => {
      const prevConfig = s.configData
      const areas = [...(prevConfig.areas ?? [])]
      if (!areas[index]) return s
      areas[index] = { ...areas[index], ...patch }
      return {
        ...s,
        configData: { ...prevConfig, areas },
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const updateMapProps = useCallback((patch: { townName?: string; environment?: string }) => {
    setState(s => {
      const prevConfig = s.configData
      return {
        ...s,
        configData: { ...prevConfig, ...patch },
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const resizeMap = useCallback((dir: 'n' | 's' | 'e' | 'w', grow: boolean) => {
    setState(s => {
      const prevConfig = s.configData
      const TILE = 32
      const tileW = prevConfig.mapW / TILE
      const tileH = prevConfig.mapH / TILE
      const MIN = 5
      if (!grow) {
        if ((dir === 'e' || dir === 'w') && tileW <= MIN) return s
        if ((dir === 'n' || dir === 's') && tileH <= MIN) return s
      }

      // dx/dy = how much to shift all entity positions (only N/W insertions/removals shift things)
      const dx = grow ? (dir === 'w' ? 1 : 0) : (dir === 'w' ? -1 : 0)
      const dy = grow ? (dir === 'n' ? 1 : 0) : (dir === 'n' ? -1 : 0)
      const newMapW = (dir === 'e' || dir === 'w') ? prevConfig.mapW + (grow ? TILE : -TILE) : prevConfig.mapW
      const newMapH = (dir === 'n' || dir === 's') ? prevConfig.mapH + (grow ? TILE : -TILE) : prevConfig.mapH

      const shiftTile = (tx: number, ty: number) => ({ tx: tx + dx, ty: ty + dy })
      const shiftRect = ([tx1, ty1, tx2, ty2]: number[]) => [tx1 + dx, ty1 + dy, tx2 + dx, ty2 + dy]

      const newConfig: RawMapConfig = {
        ...prevConfig,
        mapW: newMapW,
        mapH: newMapH,
        ...(dx || dy ? {
          avatarStart: shiftTile(prevConfig.avatarStart.tx, prevConfig.avatarStart.ty),
          exitTiles:   (prevConfig.exitTiles ?? []).map(e => ({ ...e, ...shiftTile(e.tx, e.ty) })),
          npcs:        (prevConfig.npcs ?? []).map(n => ({ ...n, ...shiftTile(n.tx, n.ty) })),
          animals:     (prevConfig.animals ?? []).map(a => ({ ...a, ...shiftTile(a.tx, a.ty) })),
          exteriorDecor: (prevConfig.exteriorDecor ?? []).map(d => d.tx === undefined ? d : { ...d, ...shiftTile(d.tx, d.ty ?? 0) }),
          buildings:   (prevConfig.buildings ?? []).map(b => {
            const rects = b.rects ?? (b.rect ? [b.rect] : [])
            const newRects = rects.map(r => shiftRect(r) as [number, number, number, number])
            return b.rects ? { ...b, rects: newRects } : { ...b, rect: newRects[0] }
          }),
          streets:     (prevConfig.streets ?? []).map(e => e.rect ? { ...e, rect: shiftRect(e.rect) } : e.tile ? { ...e, tile: [e.tile[0] + dx, e.tile[1] + dy] } : e),
          pondTiles:   (prevConfig.pondTiles ?? []).map(e => e.rect ? { ...e, rect: shiftRect(e.rect) } : e.tile ? { ...e, tile: [e.tile[0] + dx, e.tile[1] + dy] } : e),
          treasures:   (prevConfig.treasures ?? []).map(t => ({ ...t, ...shiftTile(t.tx, t.ty) })),
          areas:       (prevConfig.areas ?? []).map(a => ({ ...a, ...shiftTile(a.tx, a.ty) })),
        } : {}),
      }

      return {
        ...s,
        configData: newConfig,
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const resizeInterior = useCallback((interiorId: string, dir: 'top' | 'bottom' | 'left' | 'right', grow = true) => {
    setState(s => {
      const prevConfig = s.configData
      const interior = prevConfig.interiors?.[interiorId]
      if (!interior) return s

      const MIN = 4
      if (!grow) {
        if ((dir === 'left' || dir === 'right') && interior.width <= MIN) return s
        if ((dir === 'top' || dir === 'bottom') && interior.height <= MIN) return s
      }

      let newInterior: RawInterior
      if (grow) {
        const shiftX = dir === 'left' ? 1 : 0
        const shiftY = dir === 'top' ? 1 : 0
        newInterior = {
          ...interior,
          width: dir === 'left' || dir === 'right' ? interior.width + 1 : interior.width,
          height: dir === 'top' || dir === 'bottom' ? interior.height + 1 : interior.height,
          decor: interior.decor.map(d => ({
            ...d,
            ...(shiftX ? { tx: (d.tx ?? 0) + shiftX } : {}),
            ...(shiftY ? { ty: (d.ty ?? 0) + shiftY } : {}),
          })),
          exits: interior.exits?.map(e => ({ ...e, tx: e.tx + shiftX, ty: e.ty + shiftY })),
        }
      } else {
        // Shrink: remove the edge row/col and shift inward if needed
        const removeCol = dir === 'left' ? 0 : dir === 'right' ? interior.width - 1 : null
        const removeRow = dir === 'top' ? 0 : dir === 'bottom' ? interior.height - 1 : null
        const shiftX = dir === 'left' ? -1 : 0
        const shiftY = dir === 'top' ? -1 : 0
        newInterior = {
          ...interior,
          width: removeCol !== null ? interior.width - 1 : interior.width,
          height: removeRow !== null ? interior.height - 1 : interior.height,
          decor: interior.decor
            .filter(d => {
              if (removeCol !== null && (d.tx ?? 0) === removeCol) return false
              if (removeRow !== null && (d.ty ?? 0) === removeRow) return false
              return true
            })
            .map(d => ({
              ...d,
              ...(shiftX ? { tx: (d.tx ?? 0) + shiftX } : {}),
              ...(shiftY ? { ty: (d.ty ?? 0) + shiftY } : {}),
            })),
          exits: interior.exits
            ?.filter(e => {
              if (removeCol !== null && e.tx === removeCol) return false
              if (removeRow !== null && e.ty === removeRow) return false
              return true
            })
            .map(e => ({ ...e, tx: e.tx + shiftX, ty: e.ty + shiftY })),
        }
      }

      return {
        ...s,
        configData: { ...prevConfig, interiors: { ...prevConfig.interiors, [interiorId]: newInterior } },
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const addInterior = useCallback((id: string, interior: RawInterior) => {
    setState(s => {
      const prevConfig = s.configData
      return {
        ...s,
        configData: { ...prevConfig, interiors: { ...(prevConfig.interiors ?? {}), [id]: interior } },
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const addInteriorExit = useCallback((interiorId: string, exit: InteriorExit) => {
    setState(s => {
      const prevConfig = s.configData
      const a = prevConfig.interiors?.[interiorId]
      if (!a) return s

      const opposite: Record<string, InteriorExit['direction']> = {
        left: 'right', right: 'left', up: 'down', down: 'up', front: 'back', back: 'front',
      }

      // Auto-set exit tile position for wall-gap exits
      let finalExit = exit
      if (exit.direction === 'left' || exit.direction === 'right') {
        const midY = Math.floor(a.height / 2)
        finalExit = { ...exit, tx: exit.direction === 'left' ? 0 : a.width - 1, ty: midY }
      } else if (exit.direction === 'front') {
        finalExit = { ...exit, tx: Math.floor(a.width / 2), ty: a.height - 1 }
      } else if (exit.direction === 'back') {
        finalExit = { ...exit, tx: Math.floor(a.width / 2), ty: 0 }
      }
      // up/down: tx/ty are explicit (stairs location) — keep as-is

      // Build reverse exit in target room if both rooms exist and target doesn't already link back
      const b = prevConfig.interiors?.[exit.toInteriorId]
      const rev = exit.direction ? opposite[exit.direction] : undefined
      const alreadyLinked = b?.exits?.some(e => e.toInteriorId === interiorId && e.direction === rev)

      let newInteriors = {
        ...prevConfig.interiors,
        [interiorId]: { ...a, exits: [...(a.exits ?? []), finalExit] },
      }

      if (b && rev && !alreadyLinked) {
        let revTx = finalExit.tx, revTy = finalExit.ty
        let entryTxInA = finalExit.tx, entryTyInA = finalExit.ty

        if (finalExit.direction === 'left') {
          revTx = b.width - 1; revTy = Math.floor(b.height / 2)
          entryTxInA = 1; entryTyInA = finalExit.ty
        } else if (finalExit.direction === 'right') {
          revTx = 0; revTy = Math.floor(b.height / 2)
          entryTxInA = a.width - 2; entryTyInA = finalExit.ty
        } else if (finalExit.direction === 'up') {
          revTx = finalExit.tx; revTy = b.height - 1
          entryTxInA = finalExit.tx; entryTyInA = 1
        } else if (finalExit.direction === 'down') {
          revTx = finalExit.tx; revTy = 0
          entryTxInA = finalExit.tx; entryTyInA = a.height - 2
        } else if (finalExit.direction === 'front') {
          revTx = Math.floor(b.width / 2); revTy = 0
          entryTxInA = finalExit.tx; entryTyInA = a.height - 2
        } else if (finalExit.direction === 'back') {
          revTx = Math.floor(b.width / 2); revTy = b.height - 1
          entryTxInA = finalExit.tx; entryTyInA = 1
        }

        const entryInB: [number, number] = exit.direction === 'left'
          ? [b.width - 2, Math.floor(b.height / 2)]
          : exit.direction === 'right'
          ? [1, Math.floor(b.height / 2)]
          : exit.direction === 'up'
          ? [finalExit.tx, b.height - 2]
          : exit.direction === 'front'
          ? [finalExit.tx, 1]
          : exit.direction === 'back'
          ? [finalExit.tx, b.height - 2]
          : [finalExit.tx, 1]

        const reverseExit: InteriorExit = {
          tx: revTx, ty: revTy,
          toInteriorId: interiorId,
          entryTx: entryTxInA, entryTy: entryTyInA,
          direction: rev,
          ...(exit.label ? { label: exit.label } : {}),
        }

        // Also update the forward exit's entryTx/entryTy to land correctly in B
        finalExit = { ...finalExit, entryTx: entryInB[0], entryTy: entryInB[1] }
        newInteriors = {
          ...newInteriors,
          [interiorId]: { ...a, exits: [...(a.exits ?? []), finalExit] },
          [exit.toInteriorId]: { ...b, exits: [...(b.exits ?? []), reverseExit] },
        }
      }

      return {
        ...s,
        configData: { ...prevConfig, interiors: newInteriors },
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const updateInteriorProps = useCallback((interiorId: string, patch: Partial<RawInterior>) => {
    setState(s => {
      const prevConfig = s.configData
      const interior = prevConfig.interiors?.[interiorId]
      if (!interior) return s
      return {
        ...s,
        configData: { ...prevConfig, interiors: { ...prevConfig.interiors, [interiorId]: { ...interior, ...patch } } },
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const updateInteriorExit = useCallback((interiorId: string, index: number, patch: Partial<InteriorExit>) => {
    setState(s => {
      const prevConfig = s.configData
      const interior = prevConfig.interiors?.[interiorId]
      if (!interior || !interior.exits?.[index]) return s
      const exits = [...interior.exits]
      exits[index] = { ...exits[index], ...patch }
      return {
        ...s,
        configData: { ...prevConfig, interiors: { ...prevConfig.interiors, [interiorId]: { ...interior, exits } } },
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const removeInteriorExit = useCallback((interiorId: string, index: number) => {
    setState(s => {
      const prevConfig = s.configData
      const interior = prevConfig.interiors?.[interiorId]
      if (!interior) return s
      const newInterior: RawInterior = {
        ...interior,
        exits: (interior.exits ?? []).filter((_, i) => i !== index),
      }
      return {
        ...s,
        configData: { ...prevConfig, interiors: { ...prevConfig.interiors, [interiorId]: newInterior } },
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const undo = useCallback(() => {
    setState(s => {
      if (s.undoStack.length === 0) return s
      const undoStack = [...s.undoStack]
      const prevConfig = undoStack.pop()!
      return {
        ...s,
        configData:     prevConfig,
        undoStack,
        redoStack:        [s.configData, ...s.redoStack],
        selectedEntities: [],
        isDirty:          undoStack.length > 0,
      }
    })
  }, [])

  const redo = useCallback(() => {
    setState(s => {
      if (s.redoStack.length === 0) return s
      const redoStack = [...s.redoStack]
      const nextConfig = redoStack.shift()!
      return {
        ...s,
        configData: nextConfig,
        undoStack:  [...s.undoStack, s.configData],
        redoStack,
        isDirty:    true,
      }
    })
  }, [])

  const addStreet = useCallback((tx1: number, ty1: number, tx2: number, ty2: number) => {
    setState(s => {
      const prevConfig = s.configData
      const newEntry = tx1 === tx2 && ty1 === ty2
        ? { tile: [tx1, ty1] }
        : { rect: [tx1, ty1, tx2, ty2] }
      const streets = [...(prevConfig.streets ?? []), newEntry]
      const newIndex = streets.length - 1
      return {
        ...s,
        configData: { ...prevConfig, streets },
        selectedEntities: [{ type: 'street' as const, index: newIndex }],
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const updateStreetEntry = useCallback((index: number, data: { rect?: number[]; tile?: number[]; pathType?: string }) => {
    setState(s => {
      const prevConfig = s.configData
      const streets = [...(prevConfig.streets ?? [])]
      if (!streets[index]) return s
      streets[index] = { ...streets[index], ...data }
      return {
        ...s,
        configData: { ...prevConfig, streets },
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty: true,
      }
    })
  }, [])

  const addLockedDoor = useCallback((door: RawLockedDoor) => {
    setState(s => {
      const prevConfig = s.configData
      const lockedDoors = [...(prevConfig.lockedDoors ?? []), door]
      return {
        ...s,
        configData: { ...prevConfig, lockedDoors },
        undoStack:  [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack:  [],
        isDirty:    true,
      }
    })
  }, [])

  const updateLockedDoor = useCallback((index: number, patch: Partial<RawLockedDoor>) => {
    setState(s => {
      const prevConfig = s.configData
      const lockedDoors = [...(prevConfig.lockedDoors ?? [])]
      if (!lockedDoors[index]) return s
      lockedDoors[index] = { ...lockedDoors[index], ...patch }
      return {
        ...s,
        configData: { ...prevConfig, lockedDoors },
        undoStack:  [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack:  [],
        isDirty:    true,
      }
    })
  }, [])

  const deleteLockedDoor = useCallback((index: number) => {
    setState(s => {
      const prevConfig = s.configData
      const lockedDoors = (prevConfig.lockedDoors ?? []).filter((_, i) => i !== index)
      return {
        ...s,
        configData:       { ...prevConfig, lockedDoors },
        selectedEntities: [],
        undoStack:      [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack:      [],
        isDirty:        true,
      }
    })
  }, [])

  const placeBuildingDoor = useCallback((buildingIndex: number, absTx: number, absTy: number) => {
    setState(s => {
      const prevConfig = s.configData
      const buildings = [...(prevConfig.buildings ?? [])]
      const b = buildings[buildingIndex]
      if (!b) return s
      const allRects = (b.rects ?? (b.rect ? [b.rect] : [])) as [number, number, number, number][]
      const ox = Math.min(...allRects.map(r => r[0]))
      const oy = Math.max(...allRects.map(r => r[3]))
      const relTx = absTx - ox
      const relTy = absTy - oy
      const existing = (b.doors ?? []).findIndex(d => d.tx === relTx && d.ty === relTy)
      const doors = existing >= 0
        ? (b.doors ?? []).filter((_, i) => i !== existing)  // toggle off
        : [...(b.doors ?? []), { tx: relTx, ty: relTy }]    // toggle on
      buildings[buildingIndex] = { ...b, doors }
      return {
        ...s,
        configData: { ...prevConfig, buildings },
        undoStack: [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack: [],
        isDirty:   true,
      }
    })
  }, [])

  const markSaved = useCallback(() => {
    setState(s => ({ ...s, isDirty: false }))
  }, [])

  return {
    state,
    setMapId,
    setTool,
    setActiveTile,
    setZlayer,
    setActiveLevel,
    setPreviewFestival,
    openInterior,
    closeInterior,
    openBuildingEditor,
    closeBuildingEditor,
    placeBuildingDoor,
    selectEntities,
    addToSelection,
    placeDecor,
    moveEntities,
    deleteEntities,
    addPondTile,
    updatePondEntry,
    addNpcSpawnTile,
    addChickenZone,
    addArea,
    convertStreetToPond,
    convertPondToStreet,
    batchUpdateZlayer,
    batchUpdateStreetPathType,
    updateDecorZlayer,
    updateDecorTileId,
    reorderDecor,
    updateGlow,
    updateDecorMinLevel,
    updateDecorHideAtLevel,
    updateBuildingLevelVisual,
    updateBuilding,
    addNpc,
    updateNpcDialogue,
    updateNpc,
    addAnimal,
    updateAnimal,
    updateTreasure,
    updateArea,
    updateConfig,
    updateMapProps,
    resizeMap,
    resizeInterior,
    addInterior,
    addInteriorExit,
    updateInteriorProps,
    updateInteriorExit,
    removeInteriorExit,
    undo,
    redo,
    addStreet,
    updateStreetEntry,
    addLockedDoor,
    updateLockedDoor,
    deleteLockedDoor,
    markSaved,
  }
}
