import React from 'react'
import type { SelectedEntity, RawMapConfig, Zlayer, RawDecorItem, RawNpc, RawBuilding } from './mapEditorTypes'
import { BASE_CHIP_TILES } from '../../data/tiles/baseChipIndex'

const SHEET_URL = '/world/SampleMap/[Base]BaseChip_pipo.png'
const COLS = 8
const T = 32

interface Props {
  selectedEntity:   SelectedEntity | null
  configData:       RawMapConfig
  activeInteriorId: string | null
  onDelete:         (entity: SelectedEntity) => void
  onMoveEntity:     (entity: SelectedEntity, tx: number, ty: number) => void
  onZlayerChange:   (entity: SelectedEntity, z: Zlayer) => void
  onDialogueChange: (index: number, dialogue: string[]) => void
  onOpenInterior:   (id: string) => void
  onCloseInterior:  () => void
  viewMode:         'exterior' | 'interior'
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

function StreetInspector({
  entry, onDelete,
}: {
  entry: { rect?: number[]; tile?: number[]; pathType?: string }
  onDelete: () => void
}) {
  return (
    <div>
      {entry.pathType && (
        <Field label="Path Type">
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{entry.pathType}</span>
        </Field>
      )}
      {entry.rect ? (
        <Field label="Rect">
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>
            ({entry.rect[0]},{entry.rect[1]}) → ({entry.rect[2]},{entry.rect[3]}) — {entry.rect[2]-entry.rect[0]+1}×{entry.rect[3]-entry.rect[1]+1} tiles
          </span>
        </Field>
      ) : entry.tile ? (
        <Field label="Tile">
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>
            ({entry.tile[0]},{entry.tile[1]})
          </span>
        </Field>
      ) : null}
      <div style={{ color: '#666', fontSize: 10, marginTop: 4, marginBottom: 8 }}>
        Drag to reposition. Deleting a rect removes all its tiles.
      </div>
      <button
        onClick={onDelete}
        style={{
          width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922',
          color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12,
        }}
      >
        Delete Street Entry
      </button>
    </div>
  )
}

function BuildingInspector({
  building, onOpenInterior, interiorIds,
}: {
  building: RawBuilding
  onOpenInterior: (id: string) => void
  interiorIds: string[]
}) {
  const [tx1, ty1, tx2, ty2] = building.rect ?? [0, 0, 0, 0]
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
      {interiorIds.length > 0 && (
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
          </div>
        </Field>
      )}
    </div>
  )
}

export function EntityInspector({
  selectedEntity, configData, activeInteriorId, viewMode,
  onDelete, onMoveEntity, onZlayerChange, onDialogueChange, onOpenInterior, onCloseInterior,
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
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span>Interior: {interior?.name ?? activeInteriorId}</span>
          <button
            onClick={onCloseInterior}
            style={{
              padding: '3px 8px', background: '#333', border: '1px solid #555',
              color: '#aaa', cursor: 'pointer', borderRadius: 3, fontSize: 11,
            }}
          >
            ← Back
          </button>
        </div>
        <div style={bodyStyle}>
          {interior && (
            <>
              <Field label="Size">{interior.width} × {interior.height} tiles</Field>
              <Field label="Floor">{interior.floorTileId && <TilePreview tileId={interior.floorTileId} />}</Field>
              {interior.wallTileId && <Field label="Wall">{interior.wallTileId}</Field>}
              <Field label="Decor items">
                <span style={{ color: '#aaa' }}>{interior.decor.length} items</span>
              </Field>
              <div style={{ color: '#666', fontSize: 10, marginTop: 8 }}>
                Click an item on the canvas to select it, or use the Place tool to add new decor.
              </div>
            </>
          )}
          {selectedEntity?.type === 'interiorDecor' && selectedEntity.interiorId === activeInteriorId && interior && (
            <>
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
            </>
          )}
        </div>
      </div>
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

  if (selectedEntity.type === 'street') {
    const entry = (configData.streets ?? [])[selectedEntity.index]
    if (!entry) return null
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Street / Path #{selectedEntity.index}</div>
        <div style={bodyStyle}>
          <StreetInspector
            entry={entry}
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
          />
        </div>
      </div>
    )
  }

  return null
}
