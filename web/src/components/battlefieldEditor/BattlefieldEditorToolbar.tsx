import React, { useState } from 'react'
import type { Act, ToolMode, TerrainType, EditTarget, RoadDef, TerrainObstacle } from './battlefieldEditorTypes'
import { BATTLEFIELD_ACT_IDS } from './useBattlefieldEditorState'
import { saveBattlefieldAct } from './battlefieldEditorApi'
import { markSelfSave } from '../../utils/hotReloadGuard'
import { checkAllProfilesReachable } from '../../game/engine/terrainGrid'

const TOOLS: { tool: ToolMode; label: string }[] = [
  { tool: 'select', label: 'Select' },
  { tool: 'road', label: 'Road' },
  { tool: 'obstacle', label: 'Obstacle' },
  { tool: 'decor', label: 'Decor' },
  { tool: 'path', label: 'Path' },
  { tool: 'delete', label: 'Delete' },
]

const OBSTACLE_TYPES: TerrainType[] = ['rock', 'tree', 'water', 'ruin']
const PATH_TYPES: TerrainType[] = ['rock', 'tree', 'water', 'ruin']

export interface Props {
  actId: string
  actData: Act
  nodeId: EditTarget
  tool: ToolMode
  activeObstacleType: TerrainType
  activePathType: TerrainType
  inProgressRoadIndex: number | null
  inProgressPathIndex: number | null
  showGuides: boolean
  environment: string
  roadFollowing: boolean
  /** Resolved-for-target terrain (including expanded terrainPaths), matching exactly what the live engine would build — used for the validate-on-save reachability check. */
  terrain: TerrainObstacle[]
  /** Resolved-for-target roads — used for the validate-on-save reachability check. */
  roads: RoadDef[]
  canUndo: boolean
  canRedo: boolean
  isDirty: boolean
  onSetActId: (actId: string) => void
  onSetNodeId: (nodeId: EditTarget) => void
  onSetTool: (tool: ToolMode) => void
  onSetActiveObstacleType: (type: TerrainType) => void
  onSetActivePathType: (type: TerrainType) => void
  onFinishRoad: () => void
  onFinishPath: () => void
  onToggleGuides: () => void
  onToggleRoadFollowing: () => void
  onUndo: () => void
  onRedo: () => void
  onSaved: () => void
  /** Returns actData with terrainValidated set at the current edit target (act-default or node) — see useBattlefieldEditorState.ts's withTerrainValidated. */
  withTerrainValidated: (act: Act, nodeId: EditTarget, value: boolean) => Act
}

const MOVEMENT_LABELS = { ground: 'ground units', flying: 'flying units', burrowing: 'burrowing units' } as const

export function BattlefieldEditorToolbar(props: Props) {
  const {
    actId, actData, nodeId, tool, activeObstacleType, activePathType, inProgressRoadIndex, inProgressPathIndex, showGuides,
    environment, roadFollowing, terrain, roads, canUndo, canRedo, isDirty,
    onSetActId, onSetNodeId, onSetTool, onSetActiveObstacleType, onSetActivePathType, onFinishRoad, onFinishPath,
    onToggleGuides, onToggleRoadFollowing, onUndo, onRedo, onSaved, withTerrainValidated,
  } = props

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  const handleSave = async () => {
    setSaveState('saving')
    setSaveError('')

    const report = checkAllProfilesReachable(terrain, roads)
    const failed = (Object.keys(MOVEMENT_LABELS) as Array<keyof typeof MOVEMENT_LABELS>)
      .filter(profile => !report[profile].reachable)
    if (failed.length > 0) {
      setSaveState('error')
      setSaveError(`Sealed off for ${failed.map(f => MOVEMENT_LABELS[f]).join(', ')} — adjust terrain/roads before saving.`)
      setTimeout(() => setSaveState('idle'), 6000)
      return
    }

    markSelfSave()
    try {
      await saveBattlefieldAct(actId, withTerrainValidated(actData, nodeId, true))
      setSaveState('ok')
      onSaved()
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (e) {
      setSaveState('error')
      setSaveError(e instanceof Error ? e.message : String(e))
      setTimeout(() => setSaveState('idle'), 4000)
    }
  }

  const nodeIds = Object.keys(actData.nodes)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderBottom: '1px solid #333', flexWrap: 'wrap' }}>
      <label>
        Act:{' '}
        <select value={actId} onChange={e => onSetActId(e.target.value)}>
          {BATTLEFIELD_ACT_IDS.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>

      <label>
        Node:{' '}
        <select value={nodeId} onChange={e => onSetNodeId(e.target.value)}>
          <option value="act-default">(act default){actData.terrainValidated ? ' (Validated)' : ''}</option>
          {nodeIds.map(id => (
            <option key={id} value={id}>
              {actData.nodes[id].label || id}{actData.nodes[id].terrainValidated ? ' (Validated)' : ''}
            </option>
          ))}
        </select>
      </label>

      <span style={{ fontSize: 11, opacity: 0.7 }}>env: {environment}</span>

      <div style={{ display: 'flex', gap: 4 }}>
        {TOOLS.map(t => (
          <button
            key={t.tool}
            onClick={() => onSetTool(t.tool)}
            style={{ fontWeight: tool === t.tool ? 'bold' : 'normal', textDecoration: tool === t.tool ? 'underline' : 'none' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tool === 'obstacle' && (
        <label>
          Type:{' '}
          <select value={activeObstacleType} onChange={e => onSetActiveObstacleType(e.target.value as TerrainType)}>
            {OBSTACLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      )}

      {tool === 'path' && (
        <label>
          Type:{' '}
          <select value={activePathType} onChange={e => onSetActivePathType(e.target.value as TerrainType)}>
            {PATH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      )}

      {tool === 'road' && inProgressRoadIndex !== null && (
        <button onClick={onFinishRoad}>Finish road</button>
      )}

      {tool === 'path' && inProgressPathIndex !== null && (
        <button onClick={onFinishPath}>Finish path</button>
      )}

      <label style={{ fontSize: 11 }}>
        <input type="checkbox" checked={showGuides} onChange={onToggleGuides} /> Guides
      </label>

      <label style={{ fontSize: 11 }} title="When on, mobile units path onto and follow the nearest road toward the enemy base — scoped to the currently selected node/act default.">
        <input type="checkbox" checked={roadFollowing} onChange={onToggleRoadFollowing} /> Road following
      </label>

      <button onClick={onUndo} disabled={!canUndo}>Undo</button>
      <button onClick={onRedo} disabled={!canRedo}>Redo</button>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {saveState === 'error' && <span style={{ color: '#f88', fontSize: 10 }}>{saveError}</span>}
        <button
          onClick={handleSave}
          disabled={saveState === 'saving'}
          style={{
            color: saveState === 'ok' ? '#8f8' : saveState === 'error' ? '#f88' : undefined,
            fontWeight: isDirty ? 'bold' : 'normal',
          }}
        >
          {saveState === 'saving' ? 'Saving…' : saveState === 'ok' ? '✓ Saved' : saveState === 'error' ? 'Save failed' : isDirty ? 'Save*' : 'Save'}
        </button>
      </div>
    </div>
  )
}
