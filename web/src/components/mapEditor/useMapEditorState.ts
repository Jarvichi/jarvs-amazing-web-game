import { useState, useCallback } from 'react'
import type { RawMapConfig, RawNpc, RawInterior, RawLockedDoor, SelectedEntity, ToolMode, Zlayer, MapEditorState } from './mapEditorTypes'

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

const RAW_CONFIGS: Record<MapId, RawMapConfig> = {
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

export function useMapEditorState(initialMapId: MapId = 'ravenwatch') {
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
      } else if (entity.type === 'treasure') {
        const treasures = [...(prevConfig.treasures ?? [])]
        if (!treasures[entity.index]) return s
        treasures[entity.index] = { ...treasures[entity.index], tx, ty }
        newConfig = { ...prevConfig, treasures }
      } else if (entity.type === 'pickupItem') {
        const items = [...(prevConfig.pickupItems ?? [])]
        if (!items[entity.index]) return s
        items[entity.index] = { ...items[entity.index], tx, ty }
        newConfig = { ...prevConfig, pickupItems: items }
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
      } else if (entity.type === 'treasure') {
        newConfig = { ...prevConfig, treasures: (prevConfig.treasures ?? []).filter((_, i) => i !== entity.index) }
      } else if (entity.type === 'pickupItem') {
        newConfig = { ...prevConfig, pickupItems: (prevConfig.pickupItems ?? []).filter((_, i) => i !== entity.index) }
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
        configData:     { ...prevConfig, lockedDoors },
        selectedEntity: null,
        undoStack:      [...s.undoStack, prevConfig].slice(-MAX_UNDO),
        redoStack:      [],
        isDirty:        true,
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
    addNpc,
    updateNpcDialogue,
    updateNpc,
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
