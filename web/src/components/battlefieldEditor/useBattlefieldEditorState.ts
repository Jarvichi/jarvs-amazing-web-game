import { useState, useCallback } from 'react'
import type { Act, RoadDef, TerrainObstacle, TerrainType, ToolMode, EditTarget, SelectedEntity, BattlefieldEditorState, BattlefieldDecorItem, TerrainPathDef } from './battlefieldEditorTypes'
import { generateTerrain } from '../../game/engine/terrain'
import { isSelfSave } from '../../utils/hotReloadGuard'
import { WORLD_DECOR } from '../../data/tiles/worldTileIndex'

import act1 from '../../data/acts/act1.json'
import act2 from '../../data/acts/act2.json'
import act3 from '../../data/acts/act3.json'
import act4 from '../../data/acts/act4.json'
import act5 from '../../data/acts/act5.json'
import act6 from '../../data/acts/act6.json'
import act7 from '../../data/acts/act7.json'
import act8 from '../../data/acts/act8.json'
import act9 from '../../data/acts/act9.json'
import act10 from '../../data/acts/act10.json'
import act11 from '../../data/acts/act11.json'
import act12 from '../../data/acts/act12.json'
import act13 from '../../data/acts/act13.json'
import actfinale from '../../data/acts/actfinale.json'
import c2act1 from '../../data/acts/c2act1.json'
import c2act2 from '../../data/acts/c2act2.json'
import c2act3 from '../../data/acts/c2act3.json'
import c2act4 from '../../data/acts/c2act4.json'
import c2act5 from '../../data/acts/c2act5.json'
import c2act6 from '../../data/acts/c2act6.json'
import c2act7 from '../../data/acts/c2act7.json'
import c2act8 from '../../data/acts/c2act8.json'
import c2act9 from '../../data/acts/c2act9.json'
import c2act10 from '../../data/acts/c2act10.json'
import c2act11 from '../../data/acts/c2act11.json'
import c2act12 from '../../data/acts/c2act12.json'
import c2act13 from '../../data/acts/c2act13.json'
import c2finale from '../../data/acts/c2finale.json'
import worldbattles from '../../data/acts/worldbattles.json'

// Exported so the toolbar's act picker and the Storybook stories can enumerate
// every editable act without re-importing the JSON.
export const RAW_ACTS: Record<string, Act> = {
  act1: act1 as unknown as Act,
  act2: act2 as unknown as Act,
  act3: act3 as unknown as Act,
  act4: act4 as unknown as Act,
  act5: act5 as unknown as Act,
  act6: act6 as unknown as Act,
  act7: act7 as unknown as Act,
  act8: act8 as unknown as Act,
  act9: act9 as unknown as Act,
  act10: act10 as unknown as Act,
  act11: act11 as unknown as Act,
  act12: act12 as unknown as Act,
  act13: act13 as unknown as Act,
  actfinale: actfinale as unknown as Act,
  c2act1: c2act1 as unknown as Act,
  c2act2: c2act2 as unknown as Act,
  c2act3: c2act3 as unknown as Act,
  c2act4: c2act4 as unknown as Act,
  c2act5: c2act5 as unknown as Act,
  c2act6: c2act6 as unknown as Act,
  c2act7: c2act7 as unknown as Act,
  c2act8: c2act8 as unknown as Act,
  c2act9: c2act9 as unknown as Act,
  c2act10: c2act10 as unknown as Act,
  c2act11: c2act11 as unknown as Act,
  c2act12: c2act12 as unknown as Act,
  c2act13: c2act13 as unknown as Act,
  c2finale: c2finale as unknown as Act,
  // Keyed by the actual filename (not "world") — saveBattlefieldAct writes to
  // `data/acts/${actId}.json`, so the RAW_ACTS key IS the save target; a
  // mismatched key here previously caused saves to land in a stray new
  // world.json instead of updating this file.
  worldbattles: worldbattles as unknown as Act,
}

export const BATTLEFIELD_ACT_IDS: string[] = Object.keys(RAW_ACTS)

// Saving writes straight onto these same act JSON files, which Vite would
// otherwise respond to with a full page reload (see hotReloadGuard.ts). A
// self-triggered save's data already matches what's in memory, so we no-op;
// an external change (another tab, or a hand-edit) also no-ops but warns,
// since silently reloading could discard unsaved work in this tab.
if (import.meta.hot) {
  import.meta.hot.accept([
    '../../data/acts/act1.json',
    '../../data/acts/act2.json',
    '../../data/acts/act3.json',
    '../../data/acts/act4.json',
    '../../data/acts/act5.json',
    '../../data/acts/act6.json',
    '../../data/acts/act7.json',
    '../../data/acts/act8.json',
    '../../data/acts/act9.json',
    '../../data/acts/act10.json',
    '../../data/acts/act11.json',
    '../../data/acts/act12.json',
    '../../data/acts/act13.json',
    '../../data/acts/actfinale.json',
    '../../data/acts/c2act1.json',
    '../../data/acts/c2act2.json',
    '../../data/acts/c2act3.json',
    '../../data/acts/c2act4.json',
    '../../data/acts/c2act5.json',
    '../../data/acts/c2act6.json',
    '../../data/acts/c2act7.json',
    '../../data/acts/c2act8.json',
    '../../data/acts/c2act9.json',
    '../../data/acts/c2act10.json',
    '../../data/acts/c2act11.json',
    '../../data/acts/c2act12.json',
    '../../data/acts/c2act13.json',
    '../../data/acts/c2finale.json',
    '../../data/acts/worldbattles.json',
  ], () => {
    if (!isSelfSave()) {
      console.warn('[battlefield editor] An act JSON file changed on disk outside this tab. Refresh to pick it up — unsaved changes here were left alone.')
    }
  })
}

const MAX_UNDO = 50

// ─── Target resolution ────────────────────────────────────────────────────
// A node without its own `roads`/`terrain` inherits the act-level default.
// Reading always resolves the effective (rendered) value; writing always
// targets exactly the level currently being edited (act-default or a
// specific node), never the level it happened to inherit from.

function resolveRoadsForTarget(act: Act, nodeId: EditTarget): RoadDef[] {
  if (nodeId === 'act-default') return act.roads ?? []
  return act.nodes[nodeId]?.roads ?? act.roads ?? []
}

/** Unlike roads, terrain always resolves to *something* — the procedural
 *  generator's output — so a node-level edit starts from what's already
 *  rendering rather than a blank field. */
function resolveTerrainForTarget(act: Act, nodeId: EditTarget): TerrainObstacle[] {
  if (nodeId === 'act-default') return act.terrain ?? []
  const node = act.nodes[nodeId]
  if (node?.terrain) return node.terrain
  if (act.terrain) return act.terrain
  const environment = node?.environment ?? act.environment ?? 'forest'
  return generateTerrain(nodeId, environment)
}

function withRoads(act: Act, nodeId: EditTarget, roads: RoadDef[]): Act {
  if (nodeId === 'act-default') return { ...act, roads }
  const node = act.nodes[nodeId]
  if (!node) return act
  return { ...act, nodes: { ...act.nodes, [nodeId]: { ...node, roads } } }
}

function resolveRoadFollowingForTarget(act: Act, nodeId: EditTarget): boolean {
  if (nodeId === 'act-default') return act.roadFollowing ?? false
  return act.nodes[nodeId]?.roadFollowing ?? act.roadFollowing ?? false
}

function withRoadFollowing(act: Act, nodeId: EditTarget, roadFollowing: boolean): Act {
  if (nodeId === 'act-default') return { ...act, roadFollowing }
  const node = act.nodes[nodeId]
  if (!node) return act
  return { ...act, nodes: { ...act.nodes, [nodeId]: { ...node, roadFollowing } } }
}

function resolveTerrainValidatedForTarget(act: Act, nodeId: EditTarget): boolean {
  if (nodeId === 'act-default') return act.terrainValidated ?? false
  return act.nodes[nodeId]?.terrainValidated ?? act.terrainValidated ?? false
}

function withTerrainValidated(act: Act, nodeId: EditTarget, terrainValidated: boolean): Act {
  if (nodeId === 'act-default') return { ...act, terrainValidated }
  const node = act.nodes[nodeId]
  if (!node) return act
  return { ...act, nodes: { ...act.nodes, [nodeId]: { ...node, terrainValidated } } }
}

function withTerrain(act: Act, nodeId: EditTarget, terrain: TerrainObstacle[]): Act {
  if (nodeId === 'act-default') return { ...act, terrain }
  const node = act.nodes[nodeId]
  if (!node) return act
  return { ...act, nodes: { ...act.nodes, [nodeId]: { ...node, terrain } } }
}

function nextObstacleId(existing: TerrainObstacle[]): string {
  const ids = new Set(existing.map(o => o.id))
  let n = existing.length + 1
  while (ids.has(`t${n}`)) n++
  return `t${n}`
}

/** Like roads, a node without its own `terrainPaths` inherits the act-level
 *  default (or an empty array) — no procedural fallback. */
function resolveTerrainPathsForTarget(act: Act, nodeId: EditTarget): TerrainPathDef[] {
  if (nodeId === 'act-default') return act.terrainPaths ?? []
  return act.nodes[nodeId]?.terrainPaths ?? act.terrainPaths ?? []
}

function withTerrainPaths(act: Act, nodeId: EditTarget, terrainPaths: TerrainPathDef[]): Act {
  if (nodeId === 'act-default') return { ...act, terrainPaths }
  const node = act.nodes[nodeId]
  if (!node) return act
  return { ...act, nodes: { ...act.nodes, [nodeId]: { ...node, terrainPaths } } }
}

/** Decor has no procedural fallback — like roads, a node without its own
 *  `decor` inherits the act-level default (or an empty array). */
function resolveDecorForTarget(act: Act, nodeId: EditTarget): BattlefieldDecorItem[] {
  if (nodeId === 'act-default') return act.decor ?? []
  return act.nodes[nodeId]?.decor ?? act.decor ?? []
}

function withDecor(act: Act, nodeId: EditTarget, decor: BattlefieldDecorItem[]): Act {
  if (nodeId === 'act-default') return { ...act, decor }
  const node = act.nodes[nodeId]
  if (!node) return act
  return { ...act, nodes: { ...act.nodes, [nodeId]: { ...node, decor } } }
}

function nextDecorId(existing: BattlefieldDecorItem[]): string {
  const ids = new Set(existing.map(o => o.id))
  let n = existing.length + 1
  while (ids.has(`d${n}`)) n++
  return `d${n}`
}

export function useBattlefieldEditorState(initialActId: string = 'act1') {
  const [state, setState] = useState<BattlefieldEditorState>(() => ({
    actId:               initialActId,
    actData:             structuredClone(RAW_ACTS[initialActId]),
    nodeId:              'act-default',
    tool:                'select',
    activeObstacleType:  'rock',
    activeDecorTileId:   WORLD_DECOR.singleTree,
    activeBundleId:      null,
    activePathType:      'tree',
    inProgressRoadIndex: null,
    inProgressPathIndex: null,
    selectedEntities:    [],
    undoStack:           [],
    redoStack:           [],
    isDirty:             false,
  }))

  const setActId = useCallback((actId: string) => {
    setState(s => ({
      ...s,
      actId,
      actData:             structuredClone(RAW_ACTS[actId]),
      nodeId:              'act-default',
      tool:                'select',
      activeBundleId:      null,
      inProgressRoadIndex: null,
      inProgressPathIndex: null,
      selectedEntities:    [],
      undoStack:           [],
      redoStack:           [],
      isDirty:             false,
    }))
  }, [])

  const setNodeId = useCallback((nodeId: EditTarget) => {
    setState(s => ({ ...s, nodeId, inProgressRoadIndex: null, inProgressPathIndex: null, selectedEntities: [] }))
  }, [])

  const setTool = useCallback((tool: ToolMode) => {
    setState(s => ({
      ...s,
      tool,
      inProgressRoadIndex: tool === 'road' ? s.inProgressRoadIndex : null,
      inProgressPathIndex: tool === 'path' ? s.inProgressPathIndex : null,
    }))
  }, [])

  const setActiveObstacleType = useCallback((activeObstacleType: TerrainType) => {
    setState(s => ({ ...s, activeObstacleType }))
  }, [])

  const setActivePathType = useCallback((activePathType: TerrainType) => {
    setState(s => ({ ...s, activePathType }))
  }, [])

  const setActiveDecorTileId = useCallback((activeDecorTileId: number) => {
    setState(s => ({ ...s, activeDecorTileId, activeBundleId: null }))
  }, [])

  const setActiveBundleId = useCallback((activeBundleId: string | null) => {
    setState(s => ({ ...s, activeBundleId }))
  }, [])

  const selectEntities = useCallback((entities: SelectedEntity[]) => {
    setState(s => ({ ...s, selectedEntities: entities }))
  }, [])

  // ── Roads ─────────────────────────────────────────────────────────────

  /** 'road' tool click: extends the in-progress road, or starts a new one. */
  const clickRoadTool = useCallback((x: number, y: number) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveRoadsForTarget(prevAct, s.nodeId)
      const inProgress = s.inProgressRoadIndex !== null && current[s.inProgressRoadIndex]
      const roadIndex = inProgress ? s.inProgressRoadIndex! : current.length
      const newRoads = inProgress
        ? current.map((r, i) => i === roadIndex ? { ...r, points: [...r.points, { x, y }] } : r)
        : [...current, { points: [{ x, y }] }]
      const newAct = withRoads(prevAct, s.nodeId, newRoads)
      return {
        ...s,
        actData:             newAct,
        inProgressRoadIndex: roadIndex,
        selectedEntities:    [{ type: 'road' as const, index: roadIndex }],
        undoStack:           [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack:           [],
        isDirty:             true,
      }
    })
  }, [])

  const finishRoad = useCallback(() => {
    setState(s => s.inProgressRoadIndex === null ? s : { ...s, inProgressRoadIndex: null })
  }, [])

  const moveRoadPoint = useCallback((roadIndex: number, pointIndex: number, x: number, y: number) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveRoadsForTarget(prevAct, s.nodeId)
      if (!current[roadIndex]?.points[pointIndex]) return s
      const newRoads = current.map((r, i) => i !== roadIndex ? r : {
        ...r, points: r.points.map((p, j) => j === pointIndex ? { x, y } : p),
      })
      return {
        ...s,
        actData:   withRoads(prevAct, s.nodeId, newRoads),
        undoStack: [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack: [],
        isDirty:   true,
      }
    })
  }, [])

  const updateRoad = useCallback((roadIndex: number, patch: Partial<Pick<RoadDef, 'width' | 'tileFile' | 'zIndex'>>) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveRoadsForTarget(prevAct, s.nodeId)
      if (!current[roadIndex]) return s
      const newRoads = current.map((r, i) => i === roadIndex ? { ...r, ...patch } : r)
      return {
        ...s,
        actData:   withRoads(prevAct, s.nodeId, newRoads),
        undoStack: [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack: [],
        isDirty:   true,
      }
    })
  }, [])

  const deleteRoadPoint = useCallback((roadIndex: number, pointIndex: number) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveRoadsForTarget(prevAct, s.nodeId)
      const road = current[roadIndex]
      if (!road?.points[pointIndex]) return s
      const points = road.points.filter((_, j) => j !== pointIndex)
      const newRoads = points.length >= 2
        ? current.map((r, i) => i === roadIndex ? { ...r, points } : r)
        : current.filter((_, i) => i !== roadIndex)
      return {
        ...s,
        actData:             withRoads(prevAct, s.nodeId, newRoads),
        selectedEntities:    [],
        inProgressRoadIndex: s.inProgressRoadIndex === roadIndex ? null : s.inProgressRoadIndex,
        undoStack:           [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack:           [],
        isDirty:             true,
      }
    })
  }, [])

  const deleteRoad = useCallback((roadIndex: number) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveRoadsForTarget(prevAct, s.nodeId)
      if (!current[roadIndex]) return s
      const newRoads = current.filter((_, i) => i !== roadIndex)
      return {
        ...s,
        actData:             withRoads(prevAct, s.nodeId, newRoads),
        selectedEntities:    [],
        inProgressRoadIndex: s.inProgressRoadIndex === roadIndex ? null : s.inProgressRoadIndex,
        undoStack:           [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack:           [],
        isDirty:             true,
      }
    })
  }, [])

  // ── Obstacles ─────────────────────────────────────────────────────────

  const addObstacle = useCallback((x: number, y: number, type: TerrainType) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveTerrainForTarget(prevAct, s.nodeId)
      const obstacle: TerrainObstacle = { id: nextObstacleId(current), type, x, y, radius: 20 }
      const newTerrain = [...current, obstacle]
      return {
        ...s,
        actData:          withTerrain(prevAct, s.nodeId, newTerrain),
        selectedEntities: [{ type: 'obstacle' as const, index: newTerrain.length - 1 }],
        undoStack:        [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack:        [],
        isDirty:          true,
      }
    })
  }, [])

  const moveObstacle = useCallback((index: number, x: number, y: number) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveTerrainForTarget(prevAct, s.nodeId)
      if (!current[index]) return s
      const newTerrain = current.map((o, i) => i === index ? { ...o, x, y } : o)
      return {
        ...s,
        actData:   withTerrain(prevAct, s.nodeId, newTerrain),
        undoStack: [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack: [],
        isDirty:   true,
      }
    })
  }, [])

  const updateObstacle = useCallback((index: number, patch: Partial<Pick<TerrainObstacle, 'type' | 'radius' | 'zIndex'>>) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveTerrainForTarget(prevAct, s.nodeId)
      if (!current[index]) return s
      const newTerrain = current.map((o, i) => i === index ? { ...o, ...patch } : o)
      return {
        ...s,
        actData:   withTerrain(prevAct, s.nodeId, newTerrain),
        undoStack: [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack: [],
        isDirty:   true,
      }
    })
  }, [])

  const deleteObstacle = useCallback((index: number) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveTerrainForTarget(prevAct, s.nodeId)
      if (!current[index]) return s
      const newTerrain = current.filter((_, i) => i !== index)
      return {
        ...s,
        actData:          withTerrain(prevAct, s.nodeId, newTerrain),
        selectedEntities: [],
        undoStack:        [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack:        [],
        isDirty:          true,
      }
    })
  }, [])

  // ── Decor ─────────────────────────────────────────────────────────────

  const addDecor = useCallback((x: number, y: number, tileId: number) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveDecorForTarget(prevAct, s.nodeId)
      const item: BattlefieldDecorItem = { id: nextDecorId(current), tileId, x, y }
      const newDecor = [...current, item]
      return {
        ...s,
        actData:          withDecor(prevAct, s.nodeId, newDecor),
        selectedEntities: [{ type: 'decor' as const, index: newDecor.length - 1 }],
        undoStack:        [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack:        [],
        isDirty:          true,
      }
    })
  }, [])

  /** Places a bundle as ONE decor entry (origin + bundleId) — mirrors
   *  mapEditor's bundleID items. Rendering expands it into its constituent
   *  tiles (see buildManualDecorGfx), but selecting/dragging/deleting always
   *  acts on this single entry, so the whole group moves together. */
  const addDecorBundle = useCallback((x: number, y: number, bundleId: string) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveDecorForTarget(prevAct, s.nodeId)
      const item: BattlefieldDecorItem = { id: nextDecorId(current), tileId: 0, bundleId, x, y }
      const newDecor = [...current, item]
      return {
        ...s,
        actData:          withDecor(prevAct, s.nodeId, newDecor),
        selectedEntities: [{ type: 'decor' as const, index: newDecor.length - 1 }],
        undoStack:        [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack:        [],
        isDirty:          true,
      }
    })
  }, [])

  const moveDecor = useCallback((index: number, x: number, y: number) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveDecorForTarget(prevAct, s.nodeId)
      if (!current[index]) return s
      const newDecor = current.map((d, i) => i === index ? { ...d, x, y } : d)
      return {
        ...s,
        actData:   withDecor(prevAct, s.nodeId, newDecor),
        undoStack: [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack: [],
        isDirty:   true,
      }
    })
  }, [])

  const updateDecor = useCallback((index: number, patch: Partial<Pick<BattlefieldDecorItem, 'tileId' | 'zIndex'>>) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveDecorForTarget(prevAct, s.nodeId)
      if (!current[index]) return s
      const newDecor = current.map((d, i) => i === index ? { ...d, ...patch } : d)
      return {
        ...s,
        actData:   withDecor(prevAct, s.nodeId, newDecor),
        undoStack: [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack: [],
        isDirty:   true,
      }
    })
  }, [])

  const deleteDecor = useCallback((index: number) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveDecorForTarget(prevAct, s.nodeId)
      if (!current[index]) return s
      const newDecor = current.filter((_, i) => i !== index)
      return {
        ...s,
        actData:          withDecor(prevAct, s.nodeId, newDecor),
        selectedEntities: [],
        undoStack:        [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack:        [],
        isDirty:          true,
      }
    })
  }, [])

  // ── Terrain paths ─────────────────────────────────────────────────────

  /** 'path' tool click: extends the in-progress path, or starts a new one. */
  const clickPathTool = useCallback((x: number, y: number) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveTerrainPathsForTarget(prevAct, s.nodeId)
      const inProgress = s.inProgressPathIndex !== null && current[s.inProgressPathIndex]
      const pathIndex = inProgress ? s.inProgressPathIndex! : current.length
      const newPaths = inProgress
        ? current.map((p, i) => i === pathIndex ? { ...p, points: [...p.points, { x, y }] } : p)
        : [...current, { type: s.activePathType, points: [{ x, y }] }]
      const newAct = withTerrainPaths(prevAct, s.nodeId, newPaths)
      return {
        ...s,
        actData:             newAct,
        inProgressPathIndex: pathIndex,
        selectedEntities:    [{ type: 'terrainPath' as const, index: pathIndex }],
        undoStack:           [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack:           [],
        isDirty:             true,
      }
    })
  }, [])

  const finishPath = useCallback(() => {
    setState(s => s.inProgressPathIndex === null ? s : { ...s, inProgressPathIndex: null })
  }, [])

  const movePathPoint = useCallback((pathIndex: number, pointIndex: number, x: number, y: number) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveTerrainPathsForTarget(prevAct, s.nodeId)
      if (!current[pathIndex]?.points[pointIndex]) return s
      const newPaths = current.map((p, i) => i !== pathIndex ? p : {
        ...p, points: p.points.map((pt, j) => j === pointIndex ? { x, y } : pt),
      })
      return {
        ...s,
        actData:   withTerrainPaths(prevAct, s.nodeId, newPaths),
        undoStack: [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack: [],
        isDirty:   true,
      }
    })
  }, [])

  const updatePath = useCallback((pathIndex: number, patch: Partial<Pick<TerrainPathDef, 'type' | 'radius'>>) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveTerrainPathsForTarget(prevAct, s.nodeId)
      if (!current[pathIndex]) return s
      const newPaths = current.map((p, i) => i === pathIndex ? { ...p, ...patch } : p)
      return {
        ...s,
        actData:   withTerrainPaths(prevAct, s.nodeId, newPaths),
        undoStack: [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack: [],
        isDirty:   true,
      }
    })
  }, [])

  const deletePathPoint = useCallback((pathIndex: number, pointIndex: number) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveTerrainPathsForTarget(prevAct, s.nodeId)
      const path = current[pathIndex]
      if (!path?.points[pointIndex]) return s
      const points = path.points.filter((_, j) => j !== pointIndex)
      const newPaths = points.length >= 1
        ? current.map((p, i) => i === pathIndex ? { ...p, points } : p)
        : current.filter((_, i) => i !== pathIndex)
      return {
        ...s,
        actData:             withTerrainPaths(prevAct, s.nodeId, newPaths),
        selectedEntities:    [],
        inProgressPathIndex: s.inProgressPathIndex === pathIndex ? null : s.inProgressPathIndex,
        undoStack:           [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack:           [],
        isDirty:             true,
      }
    })
  }, [])

  const deletePath = useCallback((pathIndex: number) => {
    setState(s => {
      const prevAct = s.actData
      const current = resolveTerrainPathsForTarget(prevAct, s.nodeId)
      if (!current[pathIndex]) return s
      const newPaths = current.filter((_, i) => i !== pathIndex)
      return {
        ...s,
        actData:             withTerrainPaths(prevAct, s.nodeId, newPaths),
        selectedEntities:    [],
        inProgressPathIndex: s.inProgressPathIndex === pathIndex ? null : s.inProgressPathIndex,
        undoStack:           [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack:           [],
        isDirty:             true,
      }
    })
  }, [])

  // ── Road following ────────────────────────────────────────────────────

  const setRoadFollowing = useCallback((roadFollowing: boolean) => {
    setState(s => {
      const prevAct = s.actData
      return {
        ...s,
        actData:   withRoadFollowing(prevAct, s.nodeId, roadFollowing),
        undoStack: [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack: [],
        isDirty:   true,
      }
    })
  }, [])

  // ── Inheritance ───────────────────────────────────────────────────────

  const revertToActDefault = useCallback((field: 'roads' | 'terrain' | 'decor' | 'terrainPaths') => {
    setState(s => {
      if (s.nodeId === 'act-default') return s
      const prevAct = s.actData
      const node = prevAct.nodes[s.nodeId]
      if (!node || node[field] === undefined) return s
      const { [field]: _drop, ...rest } = node
      const newAct = { ...prevAct, nodes: { ...prevAct.nodes, [s.nodeId]: rest } }
      return {
        ...s,
        actData:          newAct,
        selectedEntities: [],
        undoStack:        [...s.undoStack, prevAct].slice(-MAX_UNDO),
        redoStack:        [],
        isDirty:          true,
      }
    })
  }, [])

  // ── Undo / redo / save ───────────────────────────────────────────────

  const undo = useCallback(() => {
    setState(s => {
      if (s.undoStack.length === 0) return s
      const undoStack = [...s.undoStack]
      const prevAct = undoStack.pop()!
      return {
        ...s,
        actData:          prevAct,
        undoStack,
        redoStack:        [s.actData, ...s.redoStack],
        selectedEntities: [],
        isDirty:          undoStack.length > 0,
      }
    })
  }, [])

  const redo = useCallback(() => {
    setState(s => {
      if (s.redoStack.length === 0) return s
      const redoStack = [...s.redoStack]
      const nextAct = redoStack.shift()!
      return { ...s, actData: nextAct, undoStack: [...s.undoStack, s.actData], redoStack, isDirty: true }
    })
  }, [])

  const markSaved = useCallback(() => {
    setState(s => ({ ...s, isDirty: false }))
  }, [])

  return {
    state,
    resolveRoadsForTarget,
    resolveTerrainForTarget,
    resolveDecorForTarget,
    resolveTerrainPathsForTarget,
    resolveRoadFollowingForTarget,
    resolveTerrainValidatedForTarget,
    withTerrainValidated,
    setRoadFollowing,
    setActId,
    setNodeId,
    setTool,
    setActiveObstacleType,
    setActiveDecorTileId,
    setActiveBundleId,
    setActivePathType,
    selectEntities,
    clickRoadTool,
    finishRoad,
    moveRoadPoint,
    updateRoad,
    deleteRoadPoint,
    deleteRoad,
    addObstacle,
    moveObstacle,
    updateObstacle,
    deleteObstacle,
    addDecor,
    addDecorBundle,
    moveDecor,
    updateDecor,
    deleteDecor,
    clickPathTool,
    finishPath,
    movePathPoint,
    updatePath,
    deletePathPoint,
    deletePath,
    revertToActDefault,
    undo,
    redo,
    markSaved,
  }
}
