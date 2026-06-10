import React, { useState } from 'react'
import type { SelectedEntity, RawMapConfig, RawInterior, Zlayer, RawDecorItem, RawNpc, RawBuilding } from './mapEditorTypes'
import { BASE_CHIP_TILES } from '../../data/tiles/baseChipIndex'
import { RawQuestPickupItem } from '../../data/hub/hubWorldFactory'

const SHEET_URL = '/world/SampleMap/[Base]BaseChip_pipo.png'
const COLS = 8
const T = 32

type InteriorExit = NonNullable<RawInterior['exits']>[number]

interface Props {
  selectedEntity:   SelectedEntity | null
  configData:       RawMapConfig
  activeInteriorId: string | null
  onDelete:              (entity: SelectedEntity) => void
  onMoveEntity:          (entity: SelectedEntity, tx: number, ty: number) => void
  onZlayerChange:        (entity: SelectedEntity, z: Zlayer) => void
  onDialogueChange:      (index: number, dialogue: string[]) => void
  onOpenInterior:        (id: string) => void
  onCloseInterior:       () => void
  onUpdateStreetEntry:   (index: number, data: { rect?: number[]; tile?: number[]; pathType?: string }) => void
  onResizeInterior:      (interiorId: string, dir: 'top' | 'bottom' | 'left' | 'right') => void
  onAddInterior:         (id: string, interior: RawInterior) => void
  onAddInteriorExit:     (interiorId: string, exit: InteriorExit) => void
  onRemoveInteriorExit:  (interiorId: string, index: number) => void
  questPickupItems:      RawQuestPickupItem[]
  viewMode:              'exterior' | 'interior'
}

function TilePreview({ tileId }: { tileId: string }) {
  const id = (BASE_CHIP_TILES as Record<string, number>)[tileId]
  if (id === undefined) return <span style={{ color: '#888' }}>{tileId}</span>
  const col = id % COLS
  const row = Math.floor(id / COLS)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: T, height: T, flexShrink: 0,
          backgroundImage: `url("${SHEET_URL}")`,
          backgroundPosition: `-${col * T}px -${row * T}px`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
          border: '1px solid #444',
        }}
      />
      <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{tileId}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: '#888', fontSize: 10, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      {children}
    </div>
  )
}

function numInput(value: number, onChange: (v: number) => void) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{
        width: 60, padding: '3px 5px', background: '#111', border: '1px solid #444',
        color: '#eee', borderRadius: 3, fontSize: 12,
      }}
    />
  )
}

function DecorInspector({
  item, entity, onMove, onZlayer, onDelete,
}: {
  item: RawDecorItem
  entity: SelectedEntity
  onMove: (tx: number, ty: number) => void
  onZlayer: (z: Zlayer) => void
  onDelete: () => void
}) {
  return (
    <div>
      <Field label="Tile">
        {item.tileId ? <TilePreview tileId={item.tileId} /> : <span style={{ color: '#aaa' }}>{item.bundleID ?? '—'}</span>}
      </Field>
      <Field label="Position">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: '#888' }}>X</label>
          {numInput(item.tx ?? 0, tx => onMove(tx, item.ty ?? 0))}
          <label style={{ fontSize: 11, color: '#888' }}>Y</label>
          {numInput(item.ty ?? 0, ty => onMove(item.tx ?? 0, ty))}
        </div>
      </Field>
      <Field label="Z-Layer">
        <div style={{ display: 'flex', gap: 4 }}>
          {(['solid', 'below', 'above'] as Zlayer[]).map(z => (
            <button
              key={z}
              onClick={() => onZlayer(z)}
              style={{
                padding: '3px 8px', fontSize: 11, cursor: 'pointer',
                background: (item.zlayer ?? 'solid') === z ? '#f0c040' : '#333',
                color: (item.zlayer ?? 'solid') === z ? '#1a1a2e' : '#aaa',
                border: 'none', borderRadius: 3,
              }}
            >
              {z}
            </button>
          ))}
        </div>
      </Field>
      <button
        onClick={onDelete}
        style={{
          width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922',
          color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12, marginTop: 4,
        }}
      >
        Delete
      </button>
    </div>
  )
}

function NpcInspector({
  npc, entity, onMove, onDelete, onDialogueChange,
}: {
  npc: RawNpc
  entity: SelectedEntity & { type: 'npc' }
  onMove: (tx: number, ty: number) => void
  onDelete: () => void
  onDialogueChange: (d: string[]) => void
}) {
  return (
    <div>
      <Field label="ID">
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{npc.id}</span>
      </Field>
      <Field label="Name">
        <span style={{ fontSize: 12 }}>{npc.name}</span>
      </Field>
      <Field label="Sprite">
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{npc.sprite}</span>
      </Field>
      <Field label="Position">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: '#888' }}>X</label>
          {numInput(npc.tx, tx => onMove(tx, npc.ty))}
          <label style={{ fontSize: 11, color: '#888' }}>Y</label>
          {numInput(npc.ty, ty => onMove(npc.tx, ty))}
        </div>
      </Field>
      <Field label="Dialogue">
        <textarea
          value={npc.dialogue.join('\n')}
          onChange={e => onDialogueChange(e.target.value.split('\n'))}
          rows={4}
          style={{
            width: '100%', background: '#111', border: '1px solid #444',
            color: '#eee', borderRadius: 3, fontSize: 11, padding: 4,
            boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
          }}
        />
        <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>One line = one dialogue entry</div>
      </Field>
      <button
        onClick={onDelete}
        style={{
          width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922',
          color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12,
        }}
      >
        Delete NPC
      </button>
    </div>
  )
}

function QuestItemInspector({
  label, id, tileId, tx, ty, extra, onMove, onDelete,
}: {
  label: string
  id: string
  tileId: string
  tx: number
  ty: number
  extra?: React.ReactNode
  onMove: (tx: number, ty: number) => void
  onDelete: () => void
}) {
  return (
    <div>
      <Field label="ID">
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{id}</span>
      </Field>
      <Field label="Tile">
        <TilePreview tileId={tileId} />
      </Field>
      <Field label="Position">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: '#888' }}>X</label>
          {numInput(tx, v => onMove(v, ty))}
          <label style={{ fontSize: 11, color: '#888' }}>Y</label>
          {numInput(ty, v => onMove(tx, v))}
        </div>
      </Field>
      {extra}
      <button
        onClick={onDelete}
        style={{
          width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922',
          color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12, marginTop: 4,
        }}
      >
        Delete {label}
      </button>
    </div>
  )
}

function StreetInspector({
  entry, onUpdate, onDelete,
}: {
  entry: { rect?: number[]; tile?: number[]; pathType?: string }
  onUpdate: (data: { rect?: number[]; tile?: number[]; pathType?: string }) => void
  onDelete: () => void
}) {
  const r = entry.rect
  const t = entry.tile
  return (
    <div>
      <Field label="Path Type">
        <input
          type="text"
          value={entry.pathType ?? ''}
          onChange={e => onUpdate({ pathType: e.target.value || undefined })}
          placeholder="e.g. cobblestone (optional)"
          style={{
            width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444',
            color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box',
          }}
        />
      </Field>
      {r ? (
        <>
          <Field label="Top-left">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: '#888' }}>X</label>
              {numInput(r[0], v => onUpdate({ rect: [v, r[1], r[2], r[3]] }))}
              <label style={{ fontSize: 11, color: '#888' }}>Y</label>
              {numInput(r[1], v => onUpdate({ rect: [r[0], v, r[2], r[3]] }))}
            </div>
          </Field>
          <Field label="Bottom-right">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: '#888' }}>X</label>
              {numInput(r[2], v => onUpdate({ rect: [r[0], r[1], v, r[3]] }))}
              <label style={{ fontSize: 11, color: '#888' }}>Y</label>
              {numInput(r[3], v => onUpdate({ rect: [r[0], r[1], r[2], v] }))}
            </div>
          </Field>
          <Field label="Size">
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#666' }}>
              {r[2]-r[0]+1} × {r[3]-r[1]+1} tiles
            </span>
          </Field>
        </>
      ) : t ? (
        <Field label="Position">
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <label style={{ fontSize: 11, color: '#888' }}>X</label>
            {numInput(t[0], v => onUpdate({ tile: [v, t[1]] }))}
            <label style={{ fontSize: 11, color: '#888' }}>Y</label>
            {numInput(t[1], v => onUpdate({ tile: [t[0], v] }))}
          </div>
        </Field>
      ) : null}
      <button
        onClick={onDelete}
        style={{
          width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922',
          color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12, marginTop: 8,
        }}
      >
        Delete Street Entry
      </button>
    </div>
  )
}

function BuildingInspector({
  building, onOpenInterior, interiorIds, existingInteriorIds, onAddInterior,
}: {
  building: RawBuilding
  onOpenInterior: (id: string) => void
  interiorIds: string[]
  existingInteriorIds: string[]
  onAddInterior: (id: string, interior: RawInterior) => void
}) {
  const [tx1, ty1, tx2, ty2] = building.rect ?? [0, 0, 0, 0]
  const [showForm, setShowForm] = useState(false)
  const baseId = building.id ?? 'room'

  function nextAutoId() {
    let n = 1
    while (existingInteriorIds.includes(`${baseId}-${n}`)) n++
    return `${baseId}-${n}`
  }

  const [newId, setNewId]     = useState('')
  const [newName, setNewName] = useState('')
  const [newW, setNewW]       = useState(10)
  const [newH, setNewH]       = useState(8)
  const [newFloor, setNewFloor] = useState('woodFloor')

  function openForm() {
    setNewId(nextAutoId())
    setNewName('')
    setNewW(10)
    setNewH(8)
    setNewFloor('woodFloor')
    setShowForm(true)
  }

  function handleSave() {
    const id = newId.trim()
    if (!id) return
    const interior: RawInterior = {
      name: newName.trim() || id,
      width: newW,
      height: newH,
      floorTileId: newFloor.trim() || 'woodFloor',
      decor: [],
    }
    onAddInterior(id, interior)
    setShowForm(false)
    onOpenInterior(id)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444',
    color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box',
  }
  const numStyle: React.CSSProperties = {
    width: 52, padding: '3px 5px', background: '#111', border: '1px solid #444',
    color: '#eee', borderRadius: 3, fontSize: 11,
  }
  const idConflict = existingInteriorIds.includes(newId.trim())

  return (
    <div>
      {building.id && (
        <Field label="ID">
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{building.id}</span>
        </Field>
      )}
      <Field label="Rect">
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>
          ({tx1},{ty1}) → ({tx2},{ty2}) — {tx2 - tx1 + 1}×{ty2 - ty1 + 1} tiles
        </span>
      </Field>
      {building.wall && (
        <Field label="Wall">
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{building.wall}</span>
        </Field>
      )}
      {building.roof && (
        <Field label="Roof">
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{building.roof}</span>
        </Field>
      )}
      <Field label="Interiors">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {interiorIds.map(id => (
            <button
              key={id}
              onClick={() => onOpenInterior(id)}
              style={{
                padding: '5px 8px', background: '#1e2a4e', border: '1px solid #3a4a8e',
                color: '#8af', cursor: 'pointer', borderRadius: 3, fontSize: 11, textAlign: 'left',
              }}
            >
              Edit interior: {id}
            </button>
          ))}
          {!showForm && (
            <button
              onClick={openForm}
              style={{
                padding: '4px 8px', background: '#1e2e1e', border: '1px solid #3a5a3a',
                color: '#6d6', cursor: 'pointer', borderRadius: 3, fontSize: 11, textAlign: 'left',
              }}
            >
              + New room
            </button>
          )}
          {showForm && (
            <div style={{ background: '#16161e', border: '1px solid #3a3a5a', borderRadius: 4, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>
                <div style={{ color: idConflict ? '#f88' : '#888', fontSize: 10, marginBottom: 2 }}>ID{idConflict ? ' — already exists' : ''}</div>
                <input style={{ ...inputStyle, borderColor: idConflict ? '#922' : '#444' }} value={newId} onChange={e => setNewId(e.target.value)} />
              </div>
              <div>
                <div style={{ color: '#888', fontSize: 10, marginBottom: 2 }}>Name</div>
                <input style={inputStyle} value={newName} placeholder={newId || 'Room name'} onChange={e => setNewName(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <label style={{ color: '#888', fontSize: 10 }}>W</label>
                <input type="number" style={numStyle} value={newW} min={2} onChange={e => setNewW(Number(e.target.value))} />
                <label style={{ color: '#888', fontSize: 10 }}>H</label>
                <input type="number" style={numStyle} value={newH} min={2} onChange={e => setNewH(Number(e.target.value))} />
              </div>
              <div>
                <div style={{ color: '#888', fontSize: 10, marginBottom: 2 }}>Floor tile ID</div>
                <input style={inputStyle} value={newFloor} onChange={e => setNewFloor(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleSave}
                  disabled={!newId.trim() || idConflict}
                  style={{ flex: 1, padding: '4px 0', background: idConflict ? '#333' : '#1a3a5a', border: '1px solid #3a7aaa', color: idConflict ? '#555' : '#7af', borderRadius: 3, fontSize: 11, cursor: idConflict ? 'default' : 'pointer' }}
                >
                  Create & Edit
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  style={{ padding: '4px 10px', background: '#2a2a2a', border: '1px solid #444', color: '#aaa', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </Field>
    </div>
  )
}

function InteriorInspector({
  interiorId, interior, selectedEntity, allInteriorIds,
  panelStyle, headerStyle, bodyStyle,
  onCloseInterior, onResizeInterior, onAddInteriorExit, onRemoveInteriorExit,
  onMoveEntity, onZlayerChange, onDelete,
}: {
  interiorId: string
  interior: RawInterior | undefined
  selectedEntity: SelectedEntity | null
  allInteriorIds: string[]
  panelStyle: React.CSSProperties
  headerStyle: React.CSSProperties
  bodyStyle: React.CSSProperties
  onCloseInterior: () => void
  onResizeInterior: (id: string, dir: 'top' | 'bottom' | 'left' | 'right') => void
  onAddInteriorExit: (id: string, exit: InteriorExit) => void
  onRemoveInteriorExit: (id: string, index: number) => void
  onMoveEntity: (entity: SelectedEntity, tx: number, ty: number) => void
  onZlayerChange: (entity: SelectedEntity, z: Zlayer) => void
  onDelete: (entity: SelectedEntity) => void
}) {
  const [showExitForm, setShowExitForm] = useState(false)
  const [exitTx, setExitTx]           = useState(0)
  const [exitTy, setExitTy]           = useState(0)
  const [exitTo, setExitTo]           = useState('')
  const [exitEntryTx, setExitEntryTx] = useState(1)
  const [exitEntryTy, setExitEntryTy] = useState(1)
  const [exitDir, setExitDir]         = useState<'' | 'up' | 'down'>('')

  const otherInteriorIds = allInteriorIds.filter(id => id !== interiorId)

  function openExitForm() {
    setExitTx(0); setExitTy(0)
    setExitTo(otherInteriorIds[0] ?? '')
    setExitEntryTx(1); setExitEntryTy(1)
    setExitDir('')
    setShowExitForm(true)
  }

  function saveExit() {
    if (!exitTo) return
    const exit: InteriorExit = {
      tx: exitTx, ty: exitTy,
      toInteriorId: exitTo,
      entryTx: exitEntryTx, entryTy: exitEntryTy,
      ...(exitDir ? { direction: exitDir } : {}),
    }
    onAddInteriorExit(interiorId, exit)
    setShowExitForm(false)
  }

  const resize = (dir: 'top' | 'bottom' | 'left' | 'right') => onResizeInterior(interiorId, dir)

  const btnSm: React.CSSProperties = {
    padding: '3px 8px', fontSize: 10, cursor: 'pointer', borderRadius: 3,
    background: '#1a2030', border: '1px solid #2a3050', color: '#88aaee',
  }
  const numSm: React.CSSProperties = {
    width: 44, padding: '2px 4px', background: '#111', border: '1px solid #444',
    color: '#eee', borderRadius: 3, fontSize: 11,
  }
  const inputFull: React.CSSProperties = {
    width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444',
    color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box',
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span>Interior: {interior?.name ?? interiorId}</span>
        <button onClick={onCloseInterior} style={{ padding: '3px 8px', background: '#333', border: '1px solid #555', color: '#aaa', cursor: 'pointer', borderRadius: 3, fontSize: 11 }}>← Back</button>
      </div>
      <div style={bodyStyle}>
        {interior && (
          <>
            {/* Size + resize buttons */}
            <Field label="Size">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                <button style={btnSm} onClick={() => resize('top')}>+ row top</button>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button style={btnSm} onClick={() => resize('left')}>+ col left</button>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa', minWidth: 60, textAlign: 'center' }}>{interior.width} × {interior.height}</span>
                  <button style={btnSm} onClick={() => resize('right')}>+ col right</button>
                </div>
                <button style={btnSm} onClick={() => resize('bottom')}>+ row bottom</button>
              </div>
            </Field>

            <Field label="Floor">{interior.floorTileId && <TilePreview tileId={interior.floorTileId} />}</Field>
            {interior.wallTileId && <Field label="Wall">{interior.wallTileId}</Field>}
            <Field label="Decor items"><span style={{ color: '#aaa' }}>{interior.decor.length} items</span></Field>

            {/* Exits */}
            <Field label={`Exits (${interior.exits?.length ?? 0})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
                {(interior.exits ?? []).map((exit, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#16202e', border: '1px solid #2a3a5a', borderRadius: 3, padding: '3px 6px', fontSize: 10 }}>
                    <span style={{ color: '#88aaee', fontFamily: 'monospace' }}>({exit.tx},{exit.ty})</span>
                    <span style={{ color: '#888' }}>→</span>
                    <span style={{ color: '#aad', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exit.toInteriorId}</span>
                    {exit.direction && <span style={{ color: '#f0c040', fontSize: 9 }}>{exit.direction === 'up' ? '↑' : '↓'}</span>}
                    <button style={{ ...btnSm, padding: '1px 5px', background: '#4a1a1a', borderColor: '#922', color: '#f88' }} onClick={() => onRemoveInteriorExit(interiorId, i)}>✕</button>
                  </div>
                ))}
              </div>

              {!showExitForm ? (
                <button style={{ ...btnSm, background: '#1e2e1e', borderColor: '#3a5a3a', color: '#6d6' }} onClick={openExitForm}>+ Add doorway</button>
              ) : (
                <div style={{ background: '#12121e', border: '1px solid #2a2a5a', borderRadius: 4, padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <label style={{ color: '#888', fontSize: 10 }}>Tile X</label>
                    <input type="number" style={numSm} value={exitTx} min={0} onChange={e => setExitTx(Number(e.target.value))} />
                    <label style={{ color: '#888', fontSize: 10 }}>Y</label>
                    <input type="number" style={numSm} value={exitTy} min={0} onChange={e => setExitTy(Number(e.target.value))} />
                  </div>
                  <div>
                    <div style={{ color: '#888', fontSize: 10, marginBottom: 2 }}>Leads to interior</div>
                    {otherInteriorIds.length > 0 ? (
                      <select style={inputFull} value={exitTo} onChange={e => setExitTo(e.target.value)}>
                        {otherInteriorIds.map(id => <option key={id} value={id}>{id}</option>)}
                      </select>
                    ) : (
                      <input style={inputFull} placeholder="interior ID" value={exitTo} onChange={e => setExitTo(e.target.value)} />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <label style={{ color: '#888', fontSize: 10 }}>Entry X</label>
                    <input type="number" style={numSm} value={exitEntryTx} min={0} onChange={e => setExitEntryTx(Number(e.target.value))} />
                    <label style={{ color: '#888', fontSize: 10 }}>Y</label>
                    <input type="number" style={numSm} value={exitEntryTy} min={0} onChange={e => setExitEntryTy(Number(e.target.value))} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <label style={{ color: '#888', fontSize: 10 }}>Direction</label>
                    <select style={{ ...inputFull, width: 'auto' }} value={exitDir} onChange={e => setExitDir(e.target.value as '' | 'up' | 'down')}>
                      <option value="">— none —</option>
                      <option value="up">up</option>
                      <option value="down">down</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ flex: 1, padding: '3px 0', background: '#1a3a5a', border: '1px solid #3a7aaa', color: '#7af', borderRadius: 3, fontSize: 11, cursor: 'pointer' }} onClick={saveExit}>Save doorway</button>
                    <button style={{ padding: '3px 10px', background: '#2a2a2a', border: '1px solid #444', color: '#aaa', borderRadius: 3, fontSize: 11, cursor: 'pointer' }} onClick={() => setShowExitForm(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </Field>

            <div style={{ color: '#666', fontSize: 10, marginTop: 4 }}>
              Click an item on the canvas to select it, or use the Place tool to add decor.
            </div>
          </>
        )}

        {selectedEntity?.type === 'interiorDecor' && selectedEntity.interiorId === interiorId && interior && (
          <div style={{ borderTop: '1px solid #333', marginTop: 12, paddingTop: 12 }}>
            <div style={{ color: '#f0c040', marginBottom: 8, fontWeight: 'bold' }}>Selected Decor</div>
            <DecorInspector
              item={interior.decor[selectedEntity.index]}
              entity={selectedEntity}
              onMove={(tx, ty) => onMoveEntity(selectedEntity, tx, ty)}
              onZlayer={z => onZlayerChange(selectedEntity, z)}
              onDelete={() => onDelete(selectedEntity)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function EntityInspector({
  selectedEntity, configData, activeInteriorId, viewMode,
  onDelete, onMoveEntity, onZlayerChange, onDialogueChange,
  onOpenInterior, onCloseInterior, onUpdateStreetEntry,
  onResizeInterior, onAddInterior, onAddInteriorExit, onRemoveInteriorExit,
  questPickupItems,
}: Props) {
  const panelStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', height: '100%',
    background: '#1a1a2e', color: '#ccc', fontSize: 12,
  }

  const headerStyle: React.CSSProperties = {
    padding: '8px 10px', borderBottom: '1px solid #333',
    fontWeight: 'bold', fontSize: 12, color: '#ddd', background: '#252540',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }

  const bodyStyle: React.CSSProperties = {
    flex: 1, overflowY: 'auto', padding: 10,
  }

  if (viewMode === 'interior' && activeInteriorId) {
    const interior = configData.interiors?.[activeInteriorId]
    return (
      <InteriorInspector
        key={activeInteriorId}
        interiorId={activeInteriorId}
        interior={interior}
        selectedEntity={selectedEntity}
        allInteriorIds={Object.keys(configData.interiors ?? {})}
        panelStyle={panelStyle}
        headerStyle={headerStyle}
        bodyStyle={bodyStyle}
        onCloseInterior={onCloseInterior}
        onResizeInterior={onResizeInterior}
        onAddInteriorExit={onAddInteriorExit}
        onRemoveInteriorExit={onRemoveInteriorExit}
        onMoveEntity={onMoveEntity}
        onZlayerChange={onZlayerChange}
        onDelete={onDelete}
      />
    )
  }

  if (!selectedEntity) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Inspector</div>
        <div style={bodyStyle}>
          <div style={{ color: '#555', fontSize: 11, marginTop: 20, textAlign: 'center' }}>
            Click an entity to inspect it.<br /><br />
            Use the Select tool to move entities.<br />
            Use the Place tool to add decor.
          </div>
        </div>
      </div>
    )
  }

  if (selectedEntity.type === 'exteriorDecor') {
    const items = configData.exteriorDecor ?? []
    const item = items[selectedEntity.index]
    if (!item) return null
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Exterior Decor #{selectedEntity.index}</div>
        <div style={bodyStyle}>
          <DecorInspector
            item={item}
            entity={selectedEntity}
            onMove={(tx, ty) => onMoveEntity(selectedEntity, tx, ty)}
            onZlayer={z => onZlayerChange(selectedEntity, z)}
            onDelete={() => onDelete(selectedEntity)}
          />
        </div>
      </div>
    )
  }

  if (selectedEntity.type === 'npc') {
    const npcs = configData.npcs ?? []
    const npc = npcs[selectedEntity.index]
    if (!npc) return null
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>NPC</div>
        <div style={bodyStyle}>
          <NpcInspector
            npc={npc}
            entity={selectedEntity}
            onMove={(tx, ty) => onMoveEntity(selectedEntity, tx, ty)}
            onDelete={() => onDelete(selectedEntity)}
            onDialogueChange={d => onDialogueChange(selectedEntity.index, d)}
          />
        </div>
      </div>
    )
  }

  if (selectedEntity.type === 'treasure') {
    const t = (configData.treasures ?? [])[selectedEntity.index]
    if (!t) return null
    return (
      <div style={panelStyle}>
        <div style={{ ...headerStyle, color: '#f0c040' }}>Treasure</div>
        <div style={bodyStyle}>
          <QuestItemInspector
            label="Treasure"
            id={t.id}
            tileId={t.tileId}
            tx={t.tx}
            ty={t.ty}
            extra={t.title ? <Field label="Title"><span style={{ fontSize: 12 }}>{t.title}</span></Field> : undefined}
            onMove={(tx, ty) => onMoveEntity(selectedEntity, tx, ty)}
            onDelete={() => onDelete(selectedEntity)}
          />
        </div>
      </div>
    )
  }

  if (selectedEntity.type === 'pickupItem') {
    const p = questPickupItems[selectedEntity.index] ?? (configData.pickupItems ?? [])[selectedEntity.index]
    if (!p) return null
    return (
      <div style={panelStyle}>
        <div style={{ ...headerStyle, color: '#40d0f0' }}>Pickup Item</div>
        <div style={bodyStyle}>
          <QuestItemInspector
            label="Pickup Item"
            id={p.id}
            tileId={p.tileId}
            tx={p.tx}
            ty={p.ty}
            extra={p.questId ? <Field label="Quest"><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{p.questId}</span></Field> : undefined}
            onMove={(tx, ty) => onMoveEntity(selectedEntity, tx, ty)}
            onDelete={() => onDelete(selectedEntity)}
          />
        </div>
      </div>
    )
  }

  if (selectedEntity.type === 'street') {
    const entry = (configData.streets ?? [])[selectedEntity.index]
    if (!entry) return null
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Street / Path #{selectedEntity.index}</div>
        <div style={bodyStyle}>
          <StreetInspector
            entry={entry}
            onUpdate={data => onUpdateStreetEntry(selectedEntity.index, data)}
            onDelete={() => onDelete(selectedEntity)}
          />
        </div>
      </div>
    )
  }

  if (selectedEntity.type === 'building') {
    const buildings = configData.buildings ?? []
    const building = buildings[selectedEntity.index]
    if (!building) return null

    // Find which interiors are linked to this building
    const buildingId = building.id
    const interiorIds: string[] = buildingId
      ? Object.keys(configData.interiors ?? {}).filter(id => {
          const doors = building.doors ?? []
          return doors.some(d => d.buildingId === id) || id.startsWith(buildingId)
        })
      : []

    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Building</div>
        <div style={bodyStyle}>
          <BuildingInspector
            building={building}
            onOpenInterior={onOpenInterior}
            interiorIds={interiorIds}
            existingInteriorIds={Object.keys(configData.interiors ?? {})}
            onAddInterior={onAddInterior}
          />
        </div>
      </div>
    )
  }

  return null
}
