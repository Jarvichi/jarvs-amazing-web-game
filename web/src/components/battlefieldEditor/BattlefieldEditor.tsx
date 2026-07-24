import React, { useState } from 'react'
import { useBattlefieldEditorState } from './useBattlefieldEditorState'
import { BattlefieldEditorCanvas } from './BattlefieldEditorCanvas'
import { BattlefieldEditorInspector } from './BattlefieldEditorInspector'
import { BattlefieldEditorToolbar } from './BattlefieldEditorToolbar'
import { BattlefieldDecorPalette } from './BattlefieldDecorPalette'
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
  const decor = editor.resolveDecorForTarget(state.actData, state.nodeId)
  const terrainPaths = editor.resolveTerrainPathsForTarget(state.actData, state.nodeId)
  const roadFollowing = editor.resolveRoadFollowingForTarget(state.actData, state.nodeId)
  const hasNodeRoadsOverride = state.nodeId !== 'act-default' && node?.roads !== undefined
  const hasNodeTerrainOverride = state.nodeId !== 'act-default' && node?.terrain !== undefined
  const hasNodeDecorOverride = state.nodeId !== 'act-default' && node?.decor !== undefined
  const hasNodeTerrainPathsOverride = state.nodeId !== 'act-default' && node?.terrainPaths !== undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#111', color: '#eee' }}>
      <BattlefieldEditorToolbar
        actId={state.actId}
        actData={state.actData}
        nodeId={state.nodeId}
        tool={state.tool}
        activeObstacleType={state.activeObstacleType}
        activePathType={state.activePathType}
        inProgressRoadIndex={state.inProgressRoadIndex}
        inProgressPathIndex={state.inProgressPathIndex}
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
        onSetActivePathType={editor.setActivePathType}
        onFinishRoad={editor.finishRoad}
        onFinishPath={editor.finishPath}
        onToggleGuides={() => setShowGuides(g => !g)}
        onToggleRoadFollowing={() => editor.setRoadFollowing(!roadFollowing)}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onSaved={editor.markSaved}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {state.tool === 'decor' && (
          <div style={{ width: 192, flexShrink: 0, borderRight: '1px solid #333', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <BattlefieldDecorPalette
              activeTileId={state.activeDecorTileId}
              onSelectTile={editor.setActiveDecorTileId}
            />
          </div>
        )}
        <div style={{ flex: 1, position: 'relative' }}>
          <BattlefieldEditorCanvas
            environment={environment}
            envDef={envDef}
            id={`${state.actId}-${state.nodeId}`}
            roads={roads}
            terrain={terrain}
            decor={decor}
            terrainPaths={terrainPaths}
            tool={state.tool}
            activeObstacleType={state.activeObstacleType}
            activeDecorTileId={state.activeDecorTileId}
            activePathType={state.activePathType}
            inProgressRoadIndex={state.inProgressRoadIndex}
            inProgressPathIndex={state.inProgressPathIndex}
            selectedEntities={state.selectedEntities}
            showGuides={showGuides}
            onSelectEntities={editor.selectEntities}
            onRoadClick={editor.clickRoadTool}
            onObstacleClick={(x, y) => editor.addObstacle(x, y, state.activeObstacleType)}
            onDecorClick={(x, y) => editor.addDecor(x, y, state.activeDecorTileId)}
            onPathClick={editor.clickPathTool}
            onMoveRoadPoint={editor.moveRoadPoint}
            onMoveObstacle={editor.moveObstacle}
            onMoveDecor={editor.moveDecor}
            onMovePathPoint={editor.movePathPoint}
            onDeleteRoad={editor.deleteRoad}
            onDeleteRoadPoint={editor.deleteRoadPoint}
            onDeleteObstacle={editor.deleteObstacle}
            onDeleteDecor={editor.deleteDecor}
            onDeletePath={editor.deletePath}
            onDeletePathPoint={editor.deletePathPoint}
          />
        </div>
        <BattlefieldEditorInspector
          selectedEntities={state.selectedEntities}
          roads={roads}
          terrain={terrain}
          decor={decor}
          terrainPaths={terrainPaths}
          nodeId={state.nodeId}
          hasNodeRoadsOverride={hasNodeRoadsOverride}
          hasNodeTerrainOverride={hasNodeTerrainOverride}
          hasNodeDecorOverride={hasNodeDecorOverride}
          hasNodeTerrainPathsOverride={hasNodeTerrainPathsOverride}
          onUpdateRoad={editor.updateRoad}
          onMoveRoadPoint={editor.moveRoadPoint}
          onDeleteRoad={editor.deleteRoad}
          onDeleteRoadPoint={editor.deleteRoadPoint}
          onUpdateObstacle={editor.updateObstacle}
          onMoveObstacle={editor.moveObstacle}
          onDeleteObstacle={editor.deleteObstacle}
          onUpdateDecorTile={editor.updateDecorTile}
          onMoveDecor={editor.moveDecor}
          onDeleteDecor={editor.deleteDecor}
          onUpdatePath={editor.updatePath}
          onMovePathPoint={editor.movePathPoint}
          onDeletePath={editor.deletePath}
          onDeletePathPoint={editor.deletePathPoint}
          onRevertRoads={() => editor.revertToActDefault('roads')}
          onRevertTerrain={() => editor.revertToActDefault('terrain')}
          onRevertDecor={() => editor.revertToActDefault('decor')}
          onRevertTerrainPaths={() => editor.revertToActDefault('terrainPaths')}
        />
      </div>
    </div>
  )
}
