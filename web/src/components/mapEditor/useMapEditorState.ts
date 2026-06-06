import { useState, useCallback } from 'react'
import type { MapId, RawMapConfig, SelectedEntity, ToolMode, Zlayer, MapEditorState } from './mapEditorTypes'
import hubConfig from '../../data/hub/config.json'
import town2Config from '../../data/town2/config.json'
import castleConfig from '../../data/castle/config.json'

const RAW_CONFIGS: Record<MapId, RawMapConfig> = {
  hub:    hubConfig    as unknown as RawMapConfig,
  town2:  town2Config  as unknown as RawMapConfig,
  castle: castleConfig as unknown as RawMapConfig,
}

const MAX_UNDO = 50

export function useMapEditorState(initialMapId: MapId = 'hub') {
  const [state, setState] = useState<MapEditorState>(() => ({
    mapId:            initialMapId,
    configData:       structuredClone(RAW_CONFIGS[initialMapId]),
    tool:             'select',
    activeTileId:     null,
    activeBundleId:   null,
    activeZlayer:     'solid',
    viewMode:         'exterior',
    activeInteriorId: null,
    selectedEntity:   null,
    undoStack:        [],
    redoStack:        [],
    isDirty:          false,
  }))

  const setMapId = useCallback((mapId: MapId) => {
    setState(s => ({
      ...s,
      mapId,
      configData:       structuredClone(RAW_CONFIGS[mapId]),
      selectedEntity:   null,
      viewMode:         'exterior',
      activeInteriorId: null,
      undoStack:        [],
      redoStack:        [],
      isDirty:          false,
    }))
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
    setState(s => ({ ...s, viewMode: 'interior', activeInteriorId: interiorId, selectedEntity: null }))
  }, [])

  const closeInterior = useCallback(() => {
    setState(s => ({ ...s, viewMode: 'exterior', activeInteriorId: null, selectedEntity: null }))
  }, [])

  const selectEntity = useCallback((entity: SelectedEntity | null) => {
    setState(s => ({ ...s, selectedEntity: entity }))
  }, [])

  const placeDecor = useCallback((tx: number, ty: number) => {
    setState(s => {
      if (!s.activeTileId && !s.activeBundleId) return s
      const prevConfig = s.configData
      const newItem = s.activeBundleId
        ? { tx, ty, bundleID: s.activeBundleId, zlayer: s.activeZlayer }
        : { tx, ty, tileId: s.activeTileId!, zlayer: s.activeZlayer }

      let newConfig: RawMapConfig
      if (s.viewMode === 'exterior') {
        newConfig = { ...prevConfig, exteriorDecor: [...(prevConfig.exteriorDecor ?? []), newItem] }
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

  const moveEntity = useCallback((entity: SelectedEntity, tx: number, ty: number) => {
    setState(s => {
      const prevConfig = s.configData
      let newConfig = prevConfig

      if (entity.type === 'exteriorDecor') {
        const decor = [...(prevConfig.exteriorDecor ?? [])]
        if (!decor[entity.index]) return s
        decor[entity.index] = { ...decor[entity.index], tx, ty }
        newConfig = { ...prevConfig, exteriorDecor: decor }
      } else if (entity.type === 'npc') {
        const npcs = [...(prevConfig.npcs ?? [])]
        if (!npcs[entity.index]) return s
        npcs[entity.index] = { ...npcs[entity.index], tx, ty }
        newConfig = { ...prevConfig, npcs }
      } else if (entity.type === 'building') {
        const buildings = [...(prevConfig.buildings ?? [])]
        if (!buildings[entity.index]) return s
        const b = buildings[entity.index]
        const rects = b.rects ?? (b.rect ? [b.rect] : [])
        const oldTx1 = rects[0]?.[0] ?? 0
        const oldTy1 = rects[0]?.[1] ?? 0
        const dx = tx - oldTx1
        const dy = ty - oldTy1
        if (dx === 0 && dy === 0) return s
        const newRects = rects.map(([rx1, ry1, rx2, ry2]) =>
          [rx1 + dx, ry1 + dy, rx2 + dx, ry2 + dy] as [number, number, number, number],
        )
        buildings[entity.index] = b.rects
          ? { ...b, rects: newRects }
          : { ...b, rect: newRects[0] }
        newConfig = { ...prevConfig, buildings }
      } else if (entity.type === 'street') {
        const streets = [...(prevConfig.streets ?? [])]
        if (!streets[entity.index]) return s
        const entry = streets[entity.index]
        if (entry.rect) {
          const [tx1, ty1, tx2, ty2] = entry.rect
          const dx = tx - tx1
          const dy = ty - ty1
          if (dx === 0 && dy === 0) return s
          streets[entity.index] = { ...entry, rect: [tx1 + dx, ty1 + dy, tx2 + dx, ty2 + dy] }
        } else if (entry.tile) {
          streets[entity.index] = { ...entry, tile: [tx, ty] }
        } else {
          return s
        }
        newConfig = { ...prevConfig, streets }
      } else if (entity.type === 'interiorDecor' && prevConfig.interiors?.[entity.interiorId]) {
        const interior = prevConfig.interiors[entity.interiorId]
        const decor = [...interior.decor]
        if (!decor[entity.index]) return s
        decor[entity.index] = { ...decor[entity.index], tx, ty }
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

  const deleteEntity = useCallback((entity: SelectedEntity) => {
    setState(s => {
      const prevConfig = s.configData
      let newConfig = prevConfig

      if (entity.type === 'exteriorDecor') {
        newConfig = { ...prevConfig, exteriorDecor: (prevConfig.exteriorDecor ?? []).filter((_, i) => i !== entity.index) }
      } else if (entity.type === 'npc') {
        newConfig = { ...prevConfig, npcs: (prevConfig.npcs ?? []).filter((_, i) => i !== entity.index) }
      } else if (entity.type === 'building') {
        newConfig = { ...prevConfig, buildings: (prevConfig.buildings ?? []).filter((_, i) => i !== entity.index) }
      } else if (entity.type === 'street') {
        newConfig = { ...prevConfig, streets: (prevConfig.streets ?? []).filter((_, i) => i !== entity.index) }
      } else if (entity.type === 'interiorDecor' && prevConfig.interiors?.[entity.interiorId]) {
        const interior = prevConfig.interiors[entity.interiorId]
        newConfig = {
          ...prevConfig,
          interiors: {
            ...prevConfig.interiors,
            [entity.interiorId]: { ...interior, decor: interior.decor.filter((_, i) => i !== entity.index) },
          },
        }
      }

      if (newConfig === prevConfig) return s
      return {
        ...s,
        configData:     newConfig,
        selectedEntity: null,
        undoStack:      [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack:      [],
        isDirty:        true,
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

  const undo = useCallback(() => {
    setState(s => {
      if (s.undoStack.length === 0) return s
      const undoStack = [...s.undoStack]
      const prevConfig = undoStack.pop()!
      return {
        ...s,
        configData:     prevConfig,
        undoStack,
        redoStack:      [s.configData, ...s.redoStack],
        selectedEntity: null,
        isDirty:        undoStack.length > 0,
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
        selectedEntity: { type: 'street' as const, index: newIndex },
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

  const markSaved = useCallback(() => {
    setState(s => ({ ...s, isDirty: false }))
  }, [])

  return {
    state,
    setMapId,
    setTool,
    setActiveTile,
    setZlayer,
    openInterior,
    closeInterior,
    selectEntity,
    placeDecor,
    moveEntity,
    deleteEntity,
    updateDecorZlayer,
    updateNpcDialogue,
    undo,
    redo,
    addStreet,
    updateStreetEntry,
    markSaved,
  }
}
