import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { MapEditorToolbar } from './MapEditorToolbar'
import { TilePalette } from './TilePalette'
import { EntityInspector } from './EntityInspector'
import { MapEditorCanvas } from './MapEditorCanvas'
import { useMapEditorState } from './useMapEditorState'
import type { MapId,  QuestDefsJson } from '../../data/hub/hubWorldFactory'
import  {  QUEST_DEFS_BY_MAP } from '../../data/hub/hubWorldFactory'

import { SelectedEntity } from './mapEditorTypes'
import type { RawBlockedPath, RawInteractable, PickKind } from './mapEditorTypes'
import { NpcQuestDrawer } from './npcQuestDrawer/NpcQuestDrawer'
import type { DrawerTab } from './npcQuestDrawer/npcQuestDrawerTypes'


interface Props {
  initialMapId?: MapId
  /** Seed the festival preview/authoring mode (e.g. for Storybook). */
  initialFestival?: string
}

export function MapEditor({ initialMapId = 'ravenwatch', initialFestival = undefined }: Props) {
  const [showGrid, setShowGrid] = useState(true)
  const [showQuestItems, setShowQuestItems] = useState(false)
  const [showBlockedPaths, setShowBlockedPaths] = useState(false)
  const [showAreas, setShowAreas] = useState(false)
  const [showInteractables, setShowInteractables] = useState(false)
  const [questDefsData, setQuestDefsData] = useState<QuestDefsJson | null>(
    () => QUEST_DEFS_BY_MAP[initialMapId] ? structuredClone(QUEST_DEFS_BY_MAP[initialMapId]!) : null,
  )
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('npcs')
  const [drawerHeight, setDrawerHeight] = useState(280)
  const [focusedNpcIndex, setFocusedNpcIndex] = useState<number | null>(null)
  // When set, the next canvas tile click places this NPC/animal there.
  const [pick, setPick] = useState<{ kind: PickKind; index: number } | null>(null)
  const drawerDragRef = useRef<{ startY: number; startH: number } | null>(null)

  const {
    state, setMapId, setTool, setActiveTile, setZlayer, setActiveLevel, setPreviewFestival,
    openInterior, closeInterior, selectEntity,
    placeDecor, moveEntity, deleteEntity,
    updateDecorZlayer, updateGlow, updateDecorMinLevel, updateBuilding, addNpc, updateNpcDialogue, updateNpc,
    addAnimal, updateAnimal,
    updateTreasure, updateConfig,
    updateArea, updateMapProps, resizeMap,
    resizeInterior, addInterior, addInteriorExit, updateInteriorProps, updateInteriorExit, removeInteriorExit,
    addStreet, updateStreetEntry,
    addLockedDoor, updateLockedDoor, deleteLockedDoor,
    undo, redo, markSaved,
  } = useMapEditorState(initialMapId, initialFestival ?? null)

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

  // Enter "pick a tile" mode for an entity; the next canvas click sets its location.
  const handlePickLocation = useCallback((kind: PickKind, index = 0) => {
    setPick({ kind, index })
  }, [])

  const handlePickTile = useCallback((tx: number, ty: number) => {
    if (!pick) return
    const cfg = state.configData
    // Inside an interior the coords are interior-local and the building is recorded;
    // in the exterior the building association is cleared.
    const building = state.viewMode === 'interior' ? (state.activeInteriorId ?? undefined) : undefined
    switch (pick.kind) {
      case 'npc':    updateNpc(pick.index, { tx, ty, building }); break
      case 'animal': updateAnimal(pick.index, { tx, ty, building }); break
      case 'treasure': updateTreasure(pick.index, { tx, ty }); break
      case 'interactable':
        updateConfig({ interactables: (cfg.interactables ?? []).map((it, i) => i === pick.index ? { ...it, tx, ty } : it) })
        break
      case 'exitTile':
        updateConfig({ exitTiles: (cfg.exitTiles ?? []).map((e, i) => i === pick.index ? { ...e, tx, ty } : e) })
        break
      case 'avatarStart':
        updateConfig({ avatarStart: { tx, ty } })
        break
      case 'blockedTile':
        setQuestDefsData(prev => {
          if (!prev) return prev
          const paths = [...((prev.blockedPaths as RawBlockedPath[]) ?? [])]
          const bp = paths[pick.index]
          if (!bp) return prev
          if (bp.blockedTiles.some(([x, y]) => x === tx && y === ty)) return prev
          paths[pick.index] = { ...bp, blockedTiles: [...bp.blockedTiles, [tx, ty]] }
          return { ...prev, blockedPaths: paths }
        })
        break
    }
    setPick(null)
  }, [pick, state.configData, state.viewMode, state.activeInteriorId, updateNpc, updateAnimal, updateTreasure, updateConfig])

  // Create handlers — drop a new object at map centre, reveal its overlay, and select it.
  const centreTile = useCallback(() => ({
    tx: Math.floor(state.configData.mapW / 32 / 2),
    ty: Math.floor(state.configData.mapH / 32 / 2),
  }), [state.configData.mapW, state.configData.mapH])

  const handleAddTreasure = useCallback(() => {
    const { tx, ty } = centreTile()
    const list = state.configData.treasures ?? []
    updateConfig({ treasures: [...list, { id: `treasure-${Date.now()}`, tx, ty, tileId: 'chest', collectedTileId: 'openChest', title: 'New treasure', reward: { crystals: 10 } }] })
    setShowQuestItems(true)
    selectEntity({ type: 'treasure', index: list.length })
  }, [centreTile, state.configData.treasures, updateConfig, selectEntity])

  const handleAddInteractable = useCallback(() => {
    const { tx, ty } = centreTile()
    const list = state.configData.interactables ?? []
    updateConfig({ interactables: [...list, { id: `interactable-${Date.now()}`, tx, ty, reactions: [{ type: 'screen', screen: '' }] }] })
    setShowInteractables(true)
    selectEntity({ type: 'interactable', index: list.length })
  }, [centreTile, state.configData.interactables, updateConfig, selectEntity])

  const handleAddBlockedPath = useCallback(() => {
    const { tx, ty } = centreTile()
    const list = (questDefsData?.blockedPaths as RawBlockedPath[]) ?? []
    setQuestDefsData(prev => prev ? {
      ...prev,
      blockedPaths: [...((prev.blockedPaths as RawBlockedPath[]) ?? []), {
        id: `block-${Date.now()}`, blockedTiles: [[tx, ty]], questId: '',
        blocked: { decor: [] }, cleared: { decor: [] },
      }],
    } : prev)
    setShowBlockedPaths(true)
    selectEntity({ type: 'blockedPath', index: list.length })
  }, [centreTile, questDefsData, selectEntity])

  const handleUpdateInteractable = useCallback((index: number, patch: Partial<RawInteractable>) => {
    updateConfig({ interactables: (state.configData.interactables ?? []).map((it, i) => i === index ? { ...it, ...patch } : it) })
  }, [state.configData.interactables, updateConfig])

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
        showInteractables={showInteractables}
        drawerOpen={drawerOpen}
        hasDuplicateQuestIds={hasDuplicateQuestIds}
        configData={state.configData}
        previewFestivalId={state.previewFestivalId}
        onPreviewFestivalChange={setPreviewFestival}
        onMapChange={setMapId}
        onToolChange={setTool}
        onUndo={undo}
        onRedo={redo}
        onGridToggle={() => setShowGrid(g => !g)}
        onQuestItemsToggle={() => setShowQuestItems(q => !q)}
        onBlockedPathsToggle={() => setShowBlockedPaths(b => !b)}
        onAreasToggle={() => setShowAreas(a => !a)}
        onInteractablesToggle={() => setShowInteractables(i => !i)}
        onDrawerToggle={() => setDrawerOpen(o => !o)}
        questDefsData={questDefsData as Record<string, unknown> | null}
        onSaved={markSaved}
      />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {pick && (
          <div style={{
            flexShrink: 0, padding: '5px 12px', background: '#1e2a4e', borderBottom: '1px solid #3a4a8e',
            color: '#8af', fontSize: 12, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span>📍 Click a tile on the map to place this {pick.kind}{state.viewMode === 'interior' ? ` (in ${state.activeInteriorId})` : ''}.</span>
            <button
              onClick={() => setPick(null)}
              style={{ marginLeft: 'auto', padding: '2px 10px', background: '#333', border: '1px solid #555', color: '#aaa', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}
            >Cancel</button>
          </div>
        )}
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
            key={`${state.mapId}-${state.viewMode}-${state.activeInteriorId ?? ''}-${state.previewFestivalId ?? ''}`}
            configData={state.configData}
            previewFestivalId={state.previewFestivalId}
            tool={state.tool}
            showGrid={showGrid}
            showQuestItems={showQuestItems}
            showBlockedPaths={showBlockedPaths}
            showAreas={showAreas}
            showInteractables={showInteractables}
            blockedPaths={(questDefsData?.blockedPaths as RawBlockedPath[]) ?? []}
            selectedEntity={state.selectedEntity}
            viewMode={state.viewMode}
            activeInteriorId={state.activeInteriorId}
            activeLevel={state.activeLevel}
            activeTileId={state.activeTileId}
            activeBundleId={state.activeBundleId}
            activeZlayer={state.activeZlayer}
            pickActive={pick !== null}
            onPickTile={handlePickTile}
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
              mapId={state.mapId}
              configData={state.configData}
              activeInteriorId={state.activeInteriorId}
              activeLevel={state.activeLevel}
              viewMode={state.viewMode}
              onSetActiveLevel={setActiveLevel}
              onUpdateBuilding={updateBuilding}
              onUpdateDecorMinLevel={updateDecorMinLevel}
              onPickLocation={handlePickLocation}
              onDelete={handleDeleteEntity}
              onMoveEntity={handleMoveEntity}
              onZlayerChange={updateDecorZlayer}
              onUpdateGlow={updateGlow}
              onUpdatePickupGlow={(index, patch) => setQuestDefsData(prev => {
                if (!prev) return prev
                const items = [...(prev.pickupItems ?? [])]
                if (!items[index]) return prev
                items[index] = { ...items[index], ...patch }
                return { ...prev, pickupItems: items }
              })}
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
              onUpdateTreasure={updateTreasure}
              onUpdateInteractable={handleUpdateInteractable}
              onUpdateConfig={updateConfig}
              onAddTreasure={handleAddTreasure}
              onAddInteractable={handleAddInteractable}
              onAddBlockedPath={handleAddBlockedPath}
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
              mapId={state.mapId}
              focusedNpcIndex={focusedNpcIndex}
              configData={state.configData}
              questDefsData={questDefsData}
              onTabChange={setDrawerTab}
              onAddNpc={addNpc}
              onUpdateNpc={updateNpc}
              onAddAnimal={addAnimal}
              onUpdateAnimal={updateAnimal}
              onDeleteAnimal={(index) => handleDeleteEntity({ type: 'animal', index })}
              onPickLocation={handlePickLocation}
              onQuestDefsChange={handleQuestDefsChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}
