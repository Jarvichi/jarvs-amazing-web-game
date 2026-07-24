import type { Act } from '../../game/questline'
import type { RoadDef, TerrainObstacle, TerrainType, BattlefieldDecorItem, TerrainPathDef } from '../../game/engine/terrain'

export type ToolMode = 'select' | 'road' | 'obstacle' | 'decor' | 'path' | 'delete'

export type SelectedEntity =
  | { type: 'road'; index: number }
  | { type: 'roadPoint'; roadIndex: number; pointIndex: number }
  | { type: 'obstacle'; index: number }
  | { type: 'decor'; index: number }
  | { type: 'terrainPath'; index: number }
  | { type: 'terrainPathPoint'; pathIndex: number; pointIndex: number }

/** 'act-default' edits the act-level roads/terrain; otherwise a specific node id. */
export type EditTarget = 'act-default' | string

export interface BattlefieldEditorState {
  actId: string
  nodeId: EditTarget
  actData: Act
  tool: ToolMode
  activeObstacleType: TerrainType
  activeDecorTileId: number
  activePathType: TerrainType
  /** Index into the current target's roads array while a road is being drawn point-by-point. */
  inProgressRoadIndex: number | null
  /** Index into the current target's terrainPaths array while a path is being drawn point-by-point. */
  inProgressPathIndex: number | null
  selectedEntities: SelectedEntity[]
  undoStack: Act[]
  redoStack: Act[]
  isDirty: boolean
}

export type { Act, RoadDef, TerrainObstacle, TerrainType, BattlefieldDecorItem, TerrainPathDef }
