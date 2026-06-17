import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { MapEditorToolbar } from './MapEditorToolbar'
import { TilePalette } from './TilePalette'
import { EntityInspector } from './EntityInspector'
import { MapEditorCanvas } from './MapEditorCanvas'
import { useMapEditorState } from './useMapEditorState'
import type { MapId,  QuestDefsJson } from '../../data/hub/hubWorldFactory'
import  {  QUEST_DEFS_BY_MAP } from '../../data/hub/hubWorldFactory'

import { SelectedEntity } from './mapEditorTypes'
import type { RawBlockedPath, RawAnimal } from './mapEditorTypes'
import { NpcQuestDrawer } from './npcQuestDrawer/NpcQuestDrawer'
import type { DrawerTab } from './npcQuestDrawer/npcQuestDrawerTypes'


interface Props {
  initialMapId?: MapId
}

export function MapEditor({ initialMapId = 'ravenwatch' }: Props) {
  const [showGrid, setShowGrid] = useState(true)
  const [showQuestItems, setShowQuestItems] = useState(false)
  const [showBlockedPaths, setShowBlockedPaths] = useState(false)
  const [showAreas, setShowAreas] = useState(false)
  const [questDefsData, setQuestDefsData] = useState<QuestDefsJson | null>(
    () => QUEST_DEFS_BY_MAP[initialMapId] ? structuredClone(QUEST_DEFS_BY_MAP[initialMapId]!) : null,
  )
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('npcs')
  const [drawerHeight, setDrawerHeight] = useState(280)
  const [focusedNpcIndex, setFocusedNpcIndex] = useState<number | null>(null)
  const drawerDragRef = useRef<{ startY: number; startH: number } | null>(null)

  const {
    state, setMapId, setTool, setActiveTile, setZlayer,
    openInterior, closeInterior, selectEntity,
    placeDecor, moveEntity, deleteEntity,
    updateDecorZlayer, addNpc, updateNpcDialogue, updateNpc,
    addAnimal, updateAnimal,
    updateTreasure,
    updateArea, updateMapProps, resizeMap,
    resizeInterior, addInterior, addInteriorExit, updateInteriorProps, updateInteriorExit, removeInteriorExit,
    addStreet, updateStreetEntry,
    addLockedDoor, updateLockedDoor, deleteLockedDoor,
    undo, redo, markSaved,
  } = useMapEditorState(initialMapId)

  // Reset questDefs when map changes
  useEffect(() => {
    const mapId: MapId = state.mapId
    const defs = QUEST_DEFS_BY_MAP[mapId]
    setQuestDefsData( structuredClone(defs)    )
  }, [state.mapId])

  // Auto-open drawer and focus NPC when one is selected on canvas
  useEffect(() => {
    if (state.selectedEntity?.type === 'npc') {
      setFocusedNpcIndex(state.selectedEntity.index)
      setDrawerOpen(true)
      setDrawerTab('npcs')
    }
  }, [state.selectedEntity])

  const hasDuplicateQuestIds = useMemo(() => {
    if (!questDefsData) return false
    const quests = (questDefsData.quests as Array<{ id: string }> | undefined) ?? []
    const ids = quests.map(q => q.id)
    return ids.length !== new Set(ids).size
  }, [questDefsData])

  const handleQuestDefsChange = useCallback((updater: (prev: QuestDefsJson) => QuestDefsJson) => {
    setQuestDefsData(prev => prev ? updater(prev) : prev)
  }, [])

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    drawerDragRef.current = { startY: e.clientY, startH: drawerHeight }
    const onMove = (ev: MouseEvent) => {
      if (!drawerDragRef.current) return
      const delta = drawerDragRef.current.startY - ev.clientY
      setDrawerHeight(h => Math.max(150, Math.min(600, drawerDragRef.current!.startH + delta)))
    }
    const onUp = () => {
      drawerDragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [drawerHeight])

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

  const handleUpdateBlockedPath = useCallback((index: number, patch: Partial<RawBlockedPath>) => {
    setQuestDefsData(prev => {
      if (!prev) return prev
      const paths = [...((prev.blockedPaths as RawBlockedPath[]) ?? [])]
      if (!paths[index]) return prev
      paths[index] = { ...paths[index], ...patch }
      return { ...prev, blockedPaths: paths }
    })
  }, [])

  const handleDeleteBlockedPath = useCallback((index: number) => {
    setQuestDefsData(prev => {
      if (!prev) return prev
      return { ...prev, blockedPaths: ((prev.blockedPaths as RawBlockedPath[]) ?? []).filter((_, i) => i !== index) }
    })
    selectEntity(null)
  }, [selectEntity])

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
        showBlockedPaths={showBlockedPaths}
        showAreas={showAreas}
        drawerOpen={drawerOpen}
        hasDuplicateQuestIds={hasDuplicateQuestIds}
        configData={state.configData}
        onMapChange={setMapId}
        onToolChange={setTool}
        onUndo={undo}
        onRedo={redo}
        onGridToggle={() => setShowGrid(g => !g)}
        onQuestItemsToggle={() => setShowQuestItems(q => !q)}
        onBlockedPathsToggle={() => setShowBlockedPaths(b => !b)}
        onAreasToggle={() => setShowAreas(a => !a)}
        onDrawerToggle={() => setDrawerOpen(o => !o)}
        questDefsData={questDefsData as Record<string, unknown> | null}
        onSaved={markSaved}
      />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* Canvas row */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
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
            showBlockedPaths={showBlockedPaths}
            showAreas={showAreas}
            blockedPaths={(questDefsData?.blockedPaths as RawBlockedPath[]) ?? []}
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
              onResizeInterior={resizeInterior}
              onAddInterior={addInterior}
              onAddInteriorExit={addInteriorExit}
              onUpdateInteriorProps={updateInteriorProps}
              onUpdateInteriorExit={updateInteriorExit}
              onRemoveInteriorExit={removeInteriorExit}
              questPickupItems={questDefsData?.pickupItems ?? []}
              blockedPaths={(questDefsData?.blockedPaths as RawBlockedPath[]) ?? []}
              onUpdateBlockedPath={handleUpdateBlockedPath}
              onDeleteBlockedPath={handleDeleteBlockedPath}
              onAddLockedDoor={addLockedDoor}
              onUpdateLockedDoor={updateLockedDoor}
              onDeleteLockedDoor={deleteLockedDoor}
              onUpdateNpc={updateNpc}
              onUpdateAnimal={updateAnimal}
              onUpdateArea={updateArea}
              onResizeMap={resizeMap}
              onUpdateMapProps={updateMapProps}
              onUpdateTreasureTile={(index, tileId) => updateTreasure(index, { tileId })}
              onUpdatePickupItemTile={(index, tileId) => setQuestDefsData(prev => {
                if (!prev) return prev
                const items = [...(prev.pickupItems ?? [])]
                if (!items[index]) return prev
                items[index] = { ...items[index], tileId }
                return { ...prev, pickupItems: items }
              })}
            />
          </div>
        </div>

        {/* Bottom drawer: NPCs & Quests */}
        {drawerOpen && questDefsData && (
          <div style={{ height: drawerHeight, flexShrink: 0, display: 'flex', flexDirection: 'column', borderTop: '1px solid #333' }}>
            <div
              onMouseDown={handleDragStart}
              style={{ height: 6, background: '#1a1a3a', cursor: 'ns-resize', flexShrink: 0 }}
              title="Drag to resize"
            />
            <NpcQuestDrawer
              tab={drawerTab}
              focusedNpcIndex={focusedNpcIndex}
              configData={state.configData}
              questDefsData={questDefsData}
              onTabChange={setDrawerTab}
              onAddNpc={addNpc}
              onUpdateNpc={updateNpc}
              onQuestDefsChange={handleQuestDefsChange}
            />
            <div style={{ padding: '6px 10px', borderTop: '1px solid #2a2a4a', flexShrink: 0 }}>
              <button
                onClick={() => {
                  const newAnimal: RawAnimal = {
                    id: `animal-${Date.now()}`,
                    type: 'cat',
                    tx: Math.floor((state.configData.mapW ?? 20) / 2),
                    ty: Math.floor((state.configData.mapH ?? 20) / 2),
                  }
                  addAnimal(newAnimal)
                  selectEntity({ type: 'animal', index: (state.configData.animals ?? []).length })
                }}
                style={{ padding: '4px 10px', background: '#1a2e1a', border: '1px solid #3a6a3a', color: '#88ffaa', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}
              >
                + Add Animal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
