import React, { useState, useEffect } from 'react'
import { MapEditorToolbar } from './MapEditorToolbar'
import { TilePalette } from './TilePalette'
import { EntityInspector } from './EntityInspector'
import { MapEditorCanvas } from './MapEditorCanvas'
import { useMapEditorState } from './useMapEditorState'
import type { MapId } from './mapEditorTypes'

interface Props {
  initialMapId?: MapId
}

export function MapEditor({ initialMapId = 'hub' }: Props) {
  const [showGrid, setShowGrid] = useState(true)

  const {
    state, setMapId, setTool, setActiveTile, setZlayer,
    openInterior, closeInterior, selectEntity,
    placeDecor, moveEntity, deleteEntity,
    updateDecorZlayer, updateNpcDialogue,
    undo, redo, markSaved,
  } = useMapEditorState(initialMapId)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo() }
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) setTool('select')
      if (e.key === 'p') setTool('place')
      if (e.key === 'd' && !e.ctrlKey && !e.metaKey) setTool('delete')
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedEntity) deleteEntity(state.selectedEntity)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [undo, redo, setTool, deleteEntity, state.selectedEntity])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif', background: '#0f0f22' }}>
      <MapEditorToolbar
        mapId={state.mapId}
        tool={state.tool}
        canUndo={state.undoStack.length > 0}
        canRedo={state.redoStack.length > 0}
        isDirty={state.isDirty}
        showGrid={showGrid}
        configData={state.configData}
        onMapChange={setMapId}
        onToolChange={setTool}
        onUndo={undo}
        onRedo={redo}
        onGridToggle={() => setShowGrid(g => !g)}
        onSaved={markSaved}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Tile palette */}
        <div style={{ width: 192, flexShrink: 0, borderRight: '1px solid #333', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TilePalette
            activeTileId={state.activeTileId}
            activeBundleId={state.activeBundleId}
            activeZlayer={state.activeZlayer}
            onSelectTile={tileId => setActiveTile(tileId)}
            onSelectBundle={bundleId => setActiveTile(null, bundleId)}
            onZlayerChange={setZlayer}
          />
        </div>

        {/* Center: Map canvas — key forces remount when canvas dimensions change */}
        <MapEditorCanvas
          key={`${state.mapId}-${state.viewMode}-${state.activeInteriorId ?? ''}`}
          configData={state.configData}
          tool={state.tool}
          showGrid={showGrid}
          selectedEntity={state.selectedEntity}
          viewMode={state.viewMode}
          activeInteriorId={state.activeInteriorId}
          activeTileId={state.activeTileId}
          activeBundleId={state.activeBundleId}
          activeZlayer={state.activeZlayer}
          onSelectEntity={selectEntity}
          onPlaceDecor={placeDecor}
          onMoveEntity={moveEntity}
          onDeleteEntity={deleteEntity}
        />

        {/* Right: Inspector */}
        <div style={{ width: 220, flexShrink: 0, borderLeft: '1px solid #333', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <EntityInspector
            selectedEntity={state.selectedEntity}
            configData={state.configData}
            activeInteriorId={state.activeInteriorId}
            viewMode={state.viewMode}
            onDelete={deleteEntity}
            onMoveEntity={moveEntity}
            onZlayerChange={updateDecorZlayer}
            onDialogueChange={updateNpcDialogue}
            onOpenInterior={openInterior}
            onCloseInterior={closeInterior}
          />
        </div>
      </div>
    </div>
  )
}
