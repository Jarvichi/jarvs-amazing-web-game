import React, { useState } from 'react'
import { useBattlefieldEditorState } from './useBattlefieldEditorState'
import { BattlefieldEditorCanvas } from './BattlefieldEditorCanvas'
import { BattlefieldEditorInspector } from './BattlefieldEditorInspector'
import { BattlefieldEditorToolbar } from './BattlefieldEditorToolbar'
import { WORLD_ENV_TILES } from '../../data/tiles/worldTileIndex'
import { ENV_TILES } from '../../data/tiles/tileIndex'

export interface Props {
  initialActId?: string
}

/**
 * Storybook-hosted battlefield editor — authors act/node `roads` and `terrain`
 * on the exact same WYSIWYG rendering the live Battlefield uses. Mirrors the
 * hub Map Editor's architecture (web/src/components/mapEditor/), scoped down
 * for this much smaller domain. Dev-only — requires the Storybook dev server
 * for file saves (see .storybook/main.ts's /api/battlefield-editor/save route).
 */
export function BattlefieldEditor({ initialActId = 'act1' }: Props) {
  const editor = useBattlefieldEditorState(initialActId)
  const { state } = editor
  const [showGuides, setShowGuides] = useState(true)

  const node = state.nodeId === 'act-default' ? undefined : state.actData.nodes[state.nodeId]
  const environment = node?.environment ?? state.actData.environment ?? 'forest'
  const envDef = WORLD_ENV_TILES[environment] ?? ENV_TILES[environment]
  const roads = editor.resolveRoadsForTarget(state.actData, state.nodeId)
  const terrain = editor.resolveTerrainForTarget(state.actData, state.nodeId)
  const roadFollowing = editor.resolveRoadFollowingForTarget(state.actData, state.nodeId)
  const hasNodeRoadsOverride = state.nodeId !== 'act-default' && node?.roads !== undefined
  const hasNodeTerrainOverride = state.nodeId !== 'act-default' && node?.terrain !== undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#111', color: '#eee' }}>
      <BattlefieldEditorToolbar
        actId={state.actId}
        actData={state.actData}
        nodeId={state.nodeId}
        tool={state.tool}
        activeObstacleType={state.activeObstacleType}
        inProgressRoadIndex={state.inProgressRoadIndex}
        showGuides={showGuides}
        environment={environment}
        roadFollowing={roadFollowing}
        canUndo={state.undoStack.length > 0}
        canRedo={state.redoStack.length > 0}
        isDirty={state.isDirty}
        onSetActId={editor.setActId}
        onSetNodeId={editor.setNodeId}
        onSetTool={editor.setTool}
        onSetActiveObstacleType={editor.setActiveObstacleType}
        onFinishRoad={editor.finishRoad}
        onToggleGuides={() => setShowGuides(g => !g)}
        onToggleRoadFollowing={() => editor.setRoadFollowing(!roadFollowing)}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onSaved={editor.markSaved}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <BattlefieldEditorCanvas
            environment={environment}
            envDef={envDef}
            id={`${state.actId}-${state.nodeId}`}
            roads={roads}
            terrain={terrain}
            tool={state.tool}
            activeObstacleType={state.activeObstacleType}
            inProgressRoadIndex={state.inProgressRoadIndex}
            selectedEntities={state.selectedEntities}
            showGuides={showGuides}
            onSelectEntities={editor.selectEntities}
            onRoadClick={editor.clickRoadTool}
            onObstacleClick={(x, y) => editor.addObstacle(x, y, state.activeObstacleType)}
            onMoveRoadPoint={editor.moveRoadPoint}
            onMoveObstacle={editor.moveObstacle}
            onDeleteRoad={editor.deleteRoad}
            onDeleteRoadPoint={editor.deleteRoadPoint}
            onDeleteObstacle={editor.deleteObstacle}
          />
        </div>
        <BattlefieldEditorInspector
          selectedEntities={state.selectedEntities}
          roads={roads}
          terrain={terrain}
          nodeId={state.nodeId}
          hasNodeRoadsOverride={hasNodeRoadsOverride}
          hasNodeTerrainOverride={hasNodeTerrainOverride}
          onUpdateRoad={editor.updateRoad}
          onMoveRoadPoint={editor.moveRoadPoint}
          onDeleteRoad={editor.deleteRoad}
          onDeleteRoadPoint={editor.deleteRoadPoint}
          onUpdateObstacle={editor.updateObstacle}
          onMoveObstacle={editor.moveObstacle}
          onDeleteObstacle={editor.deleteObstacle}
          onRevertRoads={() => editor.revertToActDefault('roads')}
          onRevertTerrain={() => editor.revertToActDefault('terrain')}
        />
      </div>
    </div>
  )
}
