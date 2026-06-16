import React, { useState } from 'react'
import type { ToolMode } from './mapEditorTypes'
import { saveMap, saveQuestDefs } from './mapEditorApi'
import type { RawMapConfig } from './mapEditorTypes'
import { MapId } from '../../data/hub/hubWorldFactory'

const MAP_OPTIONS: { id: MapId; label: string }[] = [
  { id: 'ravenwatch',        label: 'Hub — Ravenwatch' },
  { id: 'millhaven',         label: 'Town — Millhaven' },
  { id: 'ironholdkeep',      label: 'Castle — Ironhold Keep' },
  { id: 'thornwoodcamp',     label: 'Camp — Thornwood' },
  { id: 'capitalcity',       label: 'City — Capital City' },
  { id: 'royalpalace',       label: 'Palace — Royal Palace' },
  { id: 'saltmereport',      label: 'Port — Saltmere' },
  { id: 'gearford',          label: 'Town — Gearford' },
  { id: 'harrowfield',       label: 'Town — Harrowfield' },
  { id: 'appleford',         label: 'Town — Appleford' },
  { id: 'gravemoor',         label: 'Town — Gravemoor' },
  { id: 'hollowmere',        label: 'Town — Hollowmere' },
  { id: 'dreadspirecitadel', label: 'Citadel — Dreadspire' },
]

interface Props {
  mapId:       MapId
  tool:        ToolMode
  canUndo:     boolean
  canRedo:     boolean
  isDirty:     boolean
  showGrid:             boolean
  showQuestItems:       boolean
  showBlockedPaths:     boolean
  drawerOpen:           boolean
  hasDuplicateQuestIds: boolean
  configData:           RawMapConfig
  onMapChange:          (id: MapId) => void
  onToolChange:         (t: ToolMode) => void
  onUndo:               () => void
  onRedo:               () => void
  onGridToggle:         () => void
  onQuestItemsToggle:   () => void
  onBlockedPathsToggle: () => void
  onDrawerToggle:       () => void
  questDefsData:        Record<string, unknown> | null
  onSaved:              () => void
}

const TOOLS: { mode: ToolMode; label: string; title: string }[] = [
  { mode: 'select', label: '↖', title: 'Select / Move (S)' },
  { mode: 'place',  label: '✎', title: 'Place tile (P)' },
  { mode: 'delete', label: '✕', title: 'Delete (D)' },
  { mode: 'street', label: '⊟', title: 'Draw Street / Path (R)' },
]

export function MapEditorToolbar({
  mapId, tool, canUndo, canRedo, isDirty, showGrid, showQuestItems, showBlockedPaths, drawerOpen, hasDuplicateQuestIds,
  configData, questDefsData, onMapChange, onToolChange, onUndo, onRedo,
  onGridToggle, onQuestItemsToggle, onBlockedPathsToggle, onDrawerToggle, onSaved,
}: Props) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  const handleSave = async () => {
    setSaveState('saving')
    setSaveError('')
    try {
      await saveMap(mapId, configData)
      if (questDefsData) await saveQuestDefs(mapId, questDefsData)
      setSaveState('ok')
      onSaved()
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (e) {
      setSaveState('error')
      setSaveError(e instanceof Error ? e.message : String(e))
      setTimeout(() => setSaveState('idle'), 4000)
    }
  }

  const btnBase: React.CSSProperties = {
    padding: '4px 10px', border: '1px solid #444', cursor: 'pointer',
    borderRadius: 3, fontSize: 12, lineHeight: '1.4',
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
      background: '#12122a', borderBottom: '1px solid #333', height: 42, flexShrink: 0,
    }}>
      {/* Map selector */}
      <select
        value={mapId}
        onChange={e => onMapChange(e.target.value as MapId)}
        style={{
          padding: '4px 6px', background: '#1e1e3e', border: '1px solid #444',
          color: '#eee', borderRadius: 3, fontSize: 12, cursor: 'pointer',
        }}
      >
        {MAP_OPTIONS.map(o => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>

      <div style={{ width: 1, height: 24, background: '#333' }} />

      {/* Tool buttons */}
      {TOOLS.map(t => (
        <button
          key={t.mode}
          title={t.title}
          onClick={() => onToolChange(t.mode)}
          style={{
            ...btnBase,
            background: tool === t.mode ? '#2a3a7e' : '#1e1e3e',
            color:      tool === t.mode ? '#8af' : '#888',
            borderColor: tool === t.mode ? '#4a5aae' : '#444',
            fontWeight: tool === t.mode ? 'bold' : 'normal',
          }}
        >
          {t.label}
        </button>
      ))}

      <div style={{ width: 1, height: 24, background: '#333' }} />

      {/* Undo/Redo */}
      <button
        title="Undo (Ctrl+Z)"
        onClick={onUndo}
        disabled={!canUndo}
        style={{ ...btnBase, background: '#1e1e3e', color: canUndo ? '#aaa' : '#444', borderColor: '#444' }}
      >
        ↩
      </button>
      <button
        title="Redo (Ctrl+Y)"
        onClick={onRedo}
        disabled={!canRedo}
        style={{ ...btnBase, background: '#1e1e3e', color: canRedo ? '#aaa' : '#444', borderColor: '#444' }}
      >
        ↪
      </button>

      <div style={{ width: 1, height: 24, background: '#333' }} />

      {/* Grid toggle */}
      <button
        title="Toggle grid"
        onClick={onGridToggle}
        style={{
          ...btnBase,
          background: showGrid ? '#1e2e1e' : '#1e1e3e',
          color:      showGrid ? '#6f6' : '#666',
          borderColor: showGrid ? '#4a7a4a' : '#444',
        }}
      >
        ⊞
      </button>

      {/* Quest items toggle */}
      <button
        title="Toggle quest items — treasures (gold) and pickup items (cyan)"
        onClick={onQuestItemsToggle}
        style={{
          ...btnBase,
          background: showQuestItems ? '#2e2a0e' : '#1e1e3e',
          color:      showQuestItems ? '#f0c040' : '#666',
          borderColor: showQuestItems ? '#7a6a1a' : '#444',
        }}
      >
        ◈
      </button>

      {/* Blocked paths / locked doors toggle */}
      <button
        title="Toggle blocked paths and locked doors"
        onClick={onBlockedPathsToggle}
        style={{
          ...btnBase,
          background:  showBlockedPaths ? '#2e1e1e' : '#1e1e3e',
          color:       showBlockedPaths ? '#ff7744' : '#666',
          borderColor: showBlockedPaths ? '#8a3a1a' : '#444',
        }}
      >
        ⊗
      </button>

      {/* NPC & Quest drawer toggle */}
      <button
        title="NPCs & Quests editor"
        onClick={onDrawerToggle}
        style={{
          ...btnBase,
          background: drawerOpen ? '#2a1e4e' : '#1e1e3e',
          color:      drawerOpen ? '#c8a0ff' : '#666',
          borderColor: drawerOpen ? '#7a5aae' : '#444',
        }}
      >
        ⚇
      </button>

      <div style={{ flex: 1 }} />

      {/* Save */}
      {saveState === 'error' && (
        <span style={{ color: '#f66', fontSize: 11 }}>{saveError}</span>
      )}
      {hasDuplicateQuestIds && (
        <span style={{ color: '#f88', fontSize: 10 }}>Duplicate quest IDs — fix before saving</span>
      )}
      <button
        onClick={handleSave}
        disabled={saveState === 'saving' || hasDuplicateQuestIds}
        title={hasDuplicateQuestIds ? 'Fix duplicate quest IDs before saving' : undefined}
        style={{
          ...btnBase,
          background: saveState === 'ok'    ? '#1e4e1e'
                    : saveState === 'error' ? '#4e1e1e'
                    : isDirty               ? '#2a4e2a'
                    : '#1e1e3e',
          color: saveState === 'ok'    ? '#6f6'
               : saveState === 'error' ? '#f66'
               : isDirty               ? '#8d8'
               : '#666',
          borderColor: saveState === 'ok'    ? '#3a7a3a'
                     : saveState === 'error' ? '#7a3a3a'
                     : isDirty               ? '#3a6a3a'
                     : '#444',
          fontWeight: 'bold', minWidth: 60,
        }}
      >
        {saveState === 'saving' ? '…' : saveState === 'ok' ? '✓ Saved' : 'Save'}
      </button>
    </div>
  )
}
