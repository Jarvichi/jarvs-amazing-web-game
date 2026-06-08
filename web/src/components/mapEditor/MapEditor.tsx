import React, { useState, useEffect, useCallback } from 'react'
import { MapEditorToolbar } from './MapEditorToolbar'
import { TilePalette } from './TilePalette'
import { EntityInspector } from './EntityInspector'
import { MapEditorCanvas } from './MapEditorCanvas'
import { useMapEditorState } from './useMapEditorState'
import type { MapId,  QuestDefsJson } from '../../data/hub/hubWorldFactory'
import  {  QUEST_DEFS_BY_MAP } from '../../data/hub/hubWorldFactory'

import { SelectedEntity } from './mapEditorTypes'


interface Props {
  initialMapId?: MapId
}

export function MapEditor({ initialMapId = 'ravenwatch' }: Props) {
  const [showGrid, setShowGrid] = useState(true)
  const [showQuestItems, setShowQuestItems] = useState(false)
  const [questDefsData, setQuestDefsData] = useState<QuestDefsJson | null>(
    () => QUEST_DEFS_BY_MAP[initialMapId] ? structuredClone(QUEST_DEFS_BY_MAP[initialMapId]!) : null,
  )

  const {
    state, setMapId, setTool, setActiveTile, setZlayer,
    openInterior, closeInterior, selectEntity,
    placeDecor, moveEntity, deleteEntity,
    updateDecorZlayer, updateNpcDialogue,
    addStreet, updateStreetEntry,
    undo, redo, markSaved,
  } = useMapEditorState(initialMapId)

  // Reset questDefs when map changes
  useEffect(() => {
    const mapId: MapId = state.mapId
    const defs = QUEST_DEFS_BY_MAP[mapId]
    setQuestDefsData( structuredClone(defs)    )
  }, [state.mapId])

  // Intercept pickupItem moves/deletes to update questDefsData instead of configData
  const handleMoveEntity = useCallback((entity: SelectedEntity, tx: number, ty: number) => {
    if (entity.type === 'pickupItem') {
      setQuestDefsData(prev => {
        if (!prev) return prev
        const items = [...(prev.pickupItems ?? [])]
        if (!items[entity.index]) return prev
        items[entity.index] = { ...items[entity.index], tx, ty }
        return { ...prev, pickupItems: items }
      })
    } else {
      moveEntity(entity, tx, ty)
    }
  }, [moveEntity])

  const handleDeleteEntity = useCallback((entity: SelectedEntity) => {
    if (entity.type === 'pickupItem') {
      setQuestDefsData(prev => {
        if (!prev) return prev
        return { ...prev, pickupItems: (prev.pickupItems ?? []).filter((_, i) => i !== entity.index) }
      })
      selectEntity(null)
    } else {
      deleteEntity(entity)
    }
  }, [deleteEntity, selectEntity])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo() }
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) setTool('select')
      if (e.key === 'p') setTool('place')
      if (e.key === 'd' && !e.ctrlKey && !e.metaKey) setTool('delete')
      if (e.key === 'r') setTool('street')
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedEntity) handleDeleteEntity(state.selectedEntity)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [undo, redo, setTool, handleDeleteEntity, state.selectedEntity])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif', background: '#0f0f22' }}>
      <MapEditorToolbar
        mapId={state.mapId}
        tool={state.tool}
        canUndo={state.undoStack.length > 0}
        canRedo={state.redoStack.length > 0}
        isDirty={state.isDirty}
        showGrid={showGrid}
        showQuestItems={showQuestItems}
        configData={state.configData}
        onMapChange={setMapId}
        onToolChange={setTool}
        onUndo={undo}
        onRedo={redo}
        onGridToggle={() => setShowGrid(g => !g)}
        onQuestItemsToggle={() => setShowQuestItems(q => !q)}
        questDefsData={questDefsData as Record<string, unknown> | null}
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
          showQuestItems={showQuestItems}
          selectedEntity={state.selectedEntity}
          viewMode={state.viewMode}
          activeInteriorId={state.activeInteriorId}
          activeTileId={state.activeTileId}
          activeBundleId={state.activeBundleId}
          activeZlayer={state.activeZlayer}
          onSelectEntity={selectEntity}
          onPlaceDecor={placeDecor}
          onMoveEntity={handleMoveEntity}
          onDeleteEntity={handleDeleteEntity}
          onAddStreet={addStreet}
          questPickupItems={questDefsData?.pickupItems ?? []}
        />

        {/* Right: Inspector */}
        <div style={{ width: 220, flexShrink: 0, borderLeft: '1px solid #333', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <EntityInspector
            selectedEntity={state.selectedEntity}
            configData={state.configData}
            activeInteriorId={state.activeInteriorId}
            viewMode={state.viewMode}
            onDelete={handleDeleteEntity}
            onMoveEntity={handleMoveEntity}
            onZlayerChange={updateDecorZlayer}
            onDialogueChange={updateNpcDialogue}
            onOpenInterior={openInterior}
            onCloseInterior={closeInterior}
            onUpdateStreetEntry={updateStreetEntry}
            questPickupItems={questDefsData?.pickupItems ?? []}
          />
        </div>
      </div>
    </div>
  )
}
