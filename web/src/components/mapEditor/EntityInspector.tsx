import React, { useState } from 'react'
import type { SelectedEntity, RawMapConfig, RawInterior, RawBlockedPath, RawLockedDoor, Zlayer, RawDecorItem, RawNpc, RawBuilding, RawAnimal, RawInteractable, RawInteractableReaction, RawWeather, PickKind } from './mapEditorTypes'
import type { MapId } from '../../data/hub/hubWorldFactory'
import { EntityRefPicker } from './EntityRefPicker'
import { buildingRefOptions, allQuestOptions, hubItemRefOptions, type RefOption } from './entityRefs'
import { BASE_CHIP_TILES } from '../../data/tiles/baseChipIndex'
import { resolveTileRef, PATH_TILE } from '../../data/tiles/tileIndex'
import type { WallMaterial, RoofMaterial } from '../../data/tiles/buildingMaterials'
import { ROOF_TILES } from '../../data/tiles/buildingMaterials'
import { RawQuestPickupItem } from '../../data/hub/hubWorldFactory'
import { SpriteSearchPicker, AnimalTypePicker } from './SpritePicker'
import { ANIMAL_SPECS } from '../../game/hub/animals'
import type { AnimalType } from '../../game/hub/animals'
import { BUILDING_MUSIC_IDS, AMBIANCE_IDS } from '../../game/sound'
import { getUpgradeTrack, UPGRADE_CATALOG } from '../../data/hub/buildingUpgrades'
import type { BundleTileRaw } from '../../data/bundles/bundleEditorApi'
import type { NpcActivity } from '../../data/hub/loader'

type ReorderDirection = 'forward' | 'back' | 'toFront' | 'toBack'

/** Swap two elements' positions, returning a new array. */
function swap<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

/** Highest upgrade level a building can reach: explicit maxLevel, else its kind track length. */
function buildingMaxLevel(building: RawBuilding): number {
  return building.maxLevel ?? getUpgradeTrack(building.upgradeKind).length
}

const FLOOR_TILES = [
  'woodFloor', 'stoneFloor', 'cobblestoneFloor', 'quarteredFloor', 'checkeredFloor',
  'redCarpetFloor', 'darkWoodFloor', 'darkStoneFloor', 'darkCobblestoneFloor',
  'darkQuarteredFloor', 'darkCheckeredFloor', 'yellowCarpetFloor', 'parquetFloor',
  'smallStoneFloor', 'diagonalFloor', 'fourByFourTileFloor', 'meshFloor', 'ornateFloor',
  'darkParquetFloor', 'goldSmallTileFloor', 'darkDiagonalFloor', 'darkFourByFourTileFloor',
  'lightMeshFloor', 'blueOrnateFloor',
]

const UPGRADE_KINDS = Object.keys(UPGRADE_CATALOG)

export const SCREEN_IDS = [
  'campaign', 'casino', 'chronicle', 'citybuilder', 'codex', 'collection-tabs',
  'commander', 'crystalcatch', 'dailychallenge', 'deckbuilder', 'endless', 'fishing',
  'fruitMachine', 'hall-of-achievements', 'higherOrLower', 'home-shelf', 'marble',
  'marblerace', 'minigames', 'news', 'prizes', 'quickbattle', 'shop-augments',
  'shop-cards', 'shop-supplies', 'spinner', 'tileflip', 'towerDefence', 'videoPoker',
  'weeklychallenge', 'worldmap', 'town-upgrades',
]

const PATH_TILE_KEYS = Object.keys(PATH_TILE)

const WALL_MATERIALS: WallMaterial[] = [
  'brick', 'woodWall', 'tudorFrame', 'renderedBrick', 'whiteStone', 'darkStone',
  'castleStone', 'ornateStone', 'reinforcedStone', 'woodenSlats', 'interiorWallStriped',
  'interiorWallWhite', 'prisonRailings', 'ironholdKeep',
]

const ROOF_MATERIALS = Object.keys(ROOF_TILES) as RoofMaterial[]

const SHEET_URL = '/world/SampleMap/[Base]BaseChip_pipo.png'
const COLS = 8
const T = 32

type InteriorExit = NonNullable<RawInterior['exits']>[number]
type Treasure = NonNullable<RawMapConfig['treasures']>[number]

export type GlowPatch = Partial<{ glow: boolean; glowRadius: number; pulse: boolean }>

interface Props {
  selectedEntities: SelectedEntity[]
  mapId:            MapId
  configData:       RawMapConfig
  activeInteriorId: string | null
  activeLevel:      number
  onSetActiveLevel:      (level: number) => void
  onUpdateBuilding:      (index: number, patch: Partial<RawBuilding>) => void
  onResizeBuilding?:     (index: number, dir: 'top' | 'bottom' | 'left' | 'right', grow?: boolean) => void
  onUpdateBuildingLevelVisual: (buildingIndex: number, minLevel: number, patch: Partial<{ rect: [number, number, number, number]; wall: WallMaterial; roof: RoofMaterial }>) => void
  onUpdateDecorMinLevel: (entity: SelectedEntity, minLevel: number | undefined) => void
  onUpdateDecorHideAtLevel: (entity: SelectedEntity, hideAtLevel: number | undefined) => void
  onDelete:              (entity: SelectedEntity) => void
  onMoveEntity:          (entity: SelectedEntity, tx: number, ty: number) => void
  onZlayerChange:        (entity: SelectedEntity, z: Zlayer) => void
  onUpdateGlow?:         (entity: SelectedEntity, patch: GlowPatch) => void
  onUpdatePickupGlow?:   (index: number, patch: GlowPatch) => void
  onUpdatePickupExtraTiles?: (index: number, tiles: Array<{ dx: number; dy: number; tileId: string }>) => void
  onDialogueChange:      (index: number, dialogue: string[]) => void
  onOpenInterior:        (id: string) => void
  onCloseInterior:       () => void
  onOpenBuildingEditor:  (buildingIndex: number) => void
  onCloseBuildingEditor: () => void
  onUpdateStreetEntry:   (index: number, data: { rect?: number[]; tile?: number[]; pathType?: string }) => void
  onResizeInterior:      (interiorId: string, dir: 'top' | 'bottom' | 'left' | 'right', grow?: boolean) => void
  onAddInterior:         (id: string, interior: RawInterior) => void
  onAddInteriorExit:     (interiorId: string, exit: InteriorExit) => void
  onUpdateInteriorProps: (interiorId: string, patch: Partial<RawInterior>) => void
  onUpdateInteriorExit:  (interiorId: string, index: number, patch: Partial<InteriorExit>) => void
  onRemoveInteriorExit:  (interiorId: string, index: number) => void
  questPickupItems:      RawQuestPickupItem[]
  viewMode:              'exterior' | 'interior' | 'building'
  activeBuildingIndex:   number | null
  blockedPaths:          RawBlockedPath[]
  onUpdateBlockedPath:   (index: number, patch: Partial<RawBlockedPath>) => void
  onDeleteBlockedPath:   (index: number) => void
  onAddLockedDoor:       (door: RawLockedDoor) => void
  onUpdateLockedDoor:    (index: number, patch: Partial<RawLockedDoor>) => void
  onDeleteLockedDoor:    (index: number) => void
  onUpdateNpc:           (index: number, partial: Partial<RawNpc>) => void
  onUpdateAnimal:        (index: number, partial: Partial<RawAnimal>) => void
  onUpdateTreasureTile?: (index: number, tileId: string) => void
  onUpdateTreasure?:     (index: number, patch: Partial<Treasure>) => void
  onUpdateInteractable?: (index: number, patch: Partial<RawInteractable>) => void
  onUpdateConfig?:       (patch: Partial<RawMapConfig>) => void
  onAddTreasure?:        () => void
  onAddInteractable?:    () => void
  onAddBlockedPath?:     () => void
  onUpdatePickupItemTile?: (index: number, tileId: string) => void
  onUpdateArea?:         (index: number, patch: Partial<{ name: string; tw: number; th: number }>) => void
  onResizeMap?:          (dir: 'n' | 's' | 'e' | 'w', grow: boolean) => void
  onUpdateMapProps?:     (patch: { townName?: string; environment?: string }) => void
  onPickLocation?:       (kind: PickKind, index?: number) => void
  onDeleteEntities?:            (entities: SelectedEntity[]) => void
  onBatchUpdateZlayer?:         (entities: SelectedEntity[], z: Zlayer) => void
  onBatchUpdateStreetPathType?: (entities: SelectedEntity[], pathType: string | undefined) => void
  onSaveAsBundle?:              (bundleId: string, tiles: BundleTileRaw[]) => Promise<void>
  onUpdateDecorTileId?:         (entity: SelectedEntity, tileId: string) => void
  onReorderDecor?:              (entity: SelectedEntity, direction: ReorderDirection) => void
  onConvertDecorToInteractable?: (entity: SelectedEntity) => void
  onConvertStreetToPond?:       (index: number) => void
  onConvertPondToStreet?:       (index: number) => void
  onUpdatePondEntry?:           (index: number, data: { rect?: number[]; tile?: number[] }) => void
  onDeletePondTile?:            (index: number) => void
  onUpdateBridgeEntry?:         (index: number, data: { rect?: number[]; tile?: number[] }) => void
  onDeleteBridgeTile?:          (index: number) => void
  onDeleteNpcSpawnTile?:        (index: number) => void
}

const BTN_PICK: React.CSSProperties = {
  padding: '4px 8px', background: '#1e2a4e', border: '1px solid #3a4a8e',
  color: '#8af', borderRadius: 3, fontSize: 11, cursor: 'pointer', width: '100%', marginTop: 2,
}

const S = 20  // thumbnail size for tile picker grid

function TileThumb({ tileId }: { tileId: string }) {
  const id = (BASE_CHIP_TILES as Record<string, number>)[tileId]
  if (id === undefined) return null
  if (id >= 10000) {
    let ref: ReturnType<typeof resolveTileRef> | undefined
    try { ref = resolveTileRef(id) } catch { /* unknown */ }
    if (!ref) return null
    const col = ref.id % ref.columns
    const row = Math.floor(ref.id / ref.columns)
    return (
      <div style={{
        width: S, height: S, flexShrink: 0, imageRendering: 'pixelated',
        backgroundImage: `url("${ref.file}")`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: ref.columns === 1 ? `${S}px ${S}px` : `${ref.columns * S}px auto`,
        backgroundPosition: ref.columns === 1 ? '0 0' : `-${col * S}px -${row * S}px`,
      }} />
    )
  }
  const col = id % COLS
  const row = Math.floor(id / COLS)
  return (
    <div style={{
      width: S, height: S, flexShrink: 0, imageRendering: 'pixelated',
      backgroundImage: `url("${SHEET_URL}")`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${COLS * S}px auto`,
      backgroundPosition: `-${col * S}px -${row * S}px`,
    }} />
  )
}

function TilePicker({ current, onChange, onClose }: {
  current: string
  onChange: (tileId: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const allIds = Object.keys(BASE_CHIP_TILES as Record<string, number>)
  const filtered = search ? allIds.filter(id => id.toLowerCase().includes(search.toLowerCase())) : allIds
  return (
    <div style={{ marginTop: 6, background: '#0e0e1a', border: '1px solid #555', borderRadius: 4, padding: 6 }}>
      <input
        autoFocus
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Filter tiles…"
        style={{
          width: '100%', padding: '3px 6px', background: '#111', border: '1px solid #444',
          color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box', marginBottom: 4,
        }}
      />
      <div style={{
        maxHeight: 200, overflowY: 'auto',
        display: 'grid', gridTemplateColumns: `repeat(${Math.floor(186 / (S + 2))}, ${S}px)`, gap: 2,
      }}>
        {filtered.map(id => (
          <button
            key={id}
            title={id}
            onClick={() => { onChange(id); onClose() }}
            style={{
              width: S, height: S, padding: 0, cursor: 'pointer', display: 'flex',
              background: id === current ? '#2a4a7a' : 'transparent',
              border: id === current ? '1px solid #5a8aee' : '1px solid transparent',
              borderRadius: 1,
            }}
          >
            <TileThumb tileId={id} />
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        style={{ marginTop: 4, fontSize: 10, color: '#666', background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}
      >
        Cancel
      </button>
    </div>
  )
}

function TilePreview({ tileId }: { tileId: string }) {
  const id = (BASE_CHIP_TILES as Record<string, number>)[tileId]
  if (id === undefined) return <span style={{ color: '#888' }}>{tileId}</span>

  let previewStyle: React.CSSProperties
  if (id >= 10000) {
    let ref: ReturnType<typeof resolveTileRef> | undefined
    try { ref = resolveTileRef(id) } catch { /* unknown extended tile */ }
    if (ref) {
      const col = ref.id % ref.columns
      const row = Math.floor(ref.id / ref.columns)
      previewStyle = {
        width: T, height: T, flexShrink: 0,
        backgroundImage: `url("${ref.file}")`,
        backgroundPosition: ref.columns === 1 ? '0 0' : `-${col * T}px -${row * T}px`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: ref.columns === 1 ? `${T}px ${T}px` : 'auto',
        imageRendering: 'pixelated',
        border: '1px solid #444',
      }
    } else {
      return <span style={{ color: '#888' }}>{tileId} (#{id})</span>
    }
  } else {
    const col = id % COLS
    const row = Math.floor(id / COLS)
    previewStyle = {
      width: T, height: T, flexShrink: 0,
      backgroundImage: `url("${SHEET_URL}")`,
      backgroundPosition: `-${col * T}px -${row * T}px`,
      backgroundRepeat: 'no-repeat',
      imageRendering: 'pixelated',
      border: '1px solid #444',
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={previewStyle} />
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

// Upgrade-level selector. Stepping it changes which level the canvas previews
// and which level newly-placed decor is tagged with.
function LevelStepper({ level, max, onChange }: { level: number; max: number; onChange: (n: number) => void }) {
  const btn: React.CSSProperties = {
    padding: '2px 9px', fontSize: 13, cursor: 'pointer', borderRadius: 3,
    background: '#1a2030', border: '1px solid #2a3050', color: '#88aaee', lineHeight: 1.2,
  }
  const disabled: React.CSSProperties = { ...btn, opacity: 0.35, cursor: 'default' }
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button style={level <= 0 ? disabled : btn} disabled={level <= 0} onClick={() => onChange(level - 1)}>−</button>
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: level > 0 ? '#f0c040' : '#aaa', minWidth: 54, textAlign: 'center' }}>
        {level === 0 ? 'base' : `level ${level}`} / {max}
      </span>
      <button style={level >= max ? disabled : btn} disabled={level >= max} onClick={() => onChange(level + 1)}>+</button>
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

// Night-glow controls shared by decor and pickup-item inspectors.
function GlowControls({ glow, glowRadius, pulse, onChange }: {
  glow?: boolean; glowRadius?: number; pulse?: boolean; onChange: (patch: GlowPatch) => void
}) {
  const checkbox = (label: string, checked: boolean, on: (v: boolean) => void) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
      <input type="checkbox" checked={checked} onChange={e => on(e.target.checked)} />
      {label}
    </label>
  )
  return (
    <>
      <Field label="Glow">{checkbox('night light', !!glow, v => onChange({ glow: v }))}</Field>
      {glow && (
        <>
          <Field label="Glow radius">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="range" min={1} max={8} step={0.5}
                value={glowRadius ?? 2}
                onChange={e => onChange({ glowRadius: Number(e.target.value) })}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 11, color: '#aaa', width: 34, textAlign: 'right' }}>{glowRadius ?? 2}t</span>
            </div>
          </Field>
          <Field label="Pulse">{checkbox('animate radius', !!pulse, v => onChange({ pulse: v }))}</Field>
        </>
      )}
    </>
  )
}

function DecorInspector({
  item, entity, onMove, onZlayer, onGlow, onDelete, onMinLevel, onHideAtLevel, maxLevel, onTileChange, onReorder, listLength, onConvertToInteractable,
}: {
  item: RawDecorItem
  entity: SelectedEntity
  onMove: (tx: number, ty: number) => void
  onZlayer: (z: Zlayer) => void
  onGlow?: (patch: GlowPatch) => void
  onDelete: () => void
  onMinLevel?: (minLevel: number | undefined) => void
  onHideAtLevel?: (hideAtLevel: number | undefined) => void
  maxLevel?: number
  onTileChange?: (tileId: string) => void
  onReorder?: (direction: ReorderDirection) => void
  /** Length of the decor array this item lives in — used to show its z-order position. */
  listLength?: number
  onConvertToInteractable?: () => void
}) {
  const [pickingTile, setPickingTile] = useState(false)
  const tileId = item.tileId || ''
  return (
    <div>
      <Field label="Tile">

        {onTileChange ? (
          <>
            <div
              onClick={() => setPickingTile(p => !p)}
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 4px', borderRadius: 3, border: pickingTile ? '1px solid #5a8aee' : '1px solid transparent' }}
              title="Click to change tile"
            >
              <TilePreview tileId={tileId } />
              <span style={{ fontSize: 10, color: '#666' }}>✎</span>
            </div>
            {pickingTile && (
              <TilePicker
                current={tileId }
                onChange={onTileChange}
                onClose={() => setPickingTile(false)}
              />
            )}
          </>
        ) : (
          item.tileId ? <TilePreview tileId={item.tileId} /> : <span style={{ color: '#aaa' }}>{item.bundleID ?? '—'}</span>
        )}

      </Field>
      {onMinLevel && (
        <Field label="Appears at level">
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number" min={0} max={maxLevel ?? 9}
              value={item.minLevel ?? 0}
              onChange={e => onMinLevel(Number(e.target.value))}
              style={{ width: 56, padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 12 }}
            />
            <span style={{ fontSize: 10, color: '#666' }}>0 = always visible</span>
          </div>
        </Field>
      )}
      {onHideAtLevel && (
        <Field label="Hides at level">
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number" min={0} max={maxLevel ?? 9}
              value={item.hideAtLevel ?? 0}
              onChange={e => { const v = Number(e.target.value); onHideAtLevel(v > 0 ? v : undefined) }}
              style={{ width: 56, padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 12 }}
            />
            <span style={{ fontSize: 10, color: '#666' }}>0 = never hides (e.g. swap to an upgraded version)</span>
          </div>
        </Field>
      )}
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
      {onGlow && <GlowControls glow={item.glow} glowRadius={item.glowRadius} pulse={item.pulse} onChange={onGlow} />}
      {onReorder && (
        <Field label="Draw Order">
          {listLength != null && (
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>
              Layer <span style={{ color: '#f0c040', fontFamily: 'monospace' }}>{entity.index + 1}</span> of {listLength}
              {' '}({entity.index === 0 ? 'back-most' : entity.index === listLength - 1 ? 'front-most' : 'middle'})
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <button
              onClick={() => onReorder('back')}
              title="Draw behind (move one step earlier)"
              style={{ flex: 1, padding: '4px 0', background: '#1e2a1e', border: '1px solid #3a5a3a', color: '#8d8', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}
            >
              ↓ Send Back
            </button>
            <button
              onClick={() => onReorder('forward')}
              title="Draw in front (move one step later)"
              style={{ flex: 1, padding: '4px 0', background: '#1e2a4e', border: '1px solid #3a5a8e', color: '#8af', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}
            >
              ↑ Bring Forward
            </button>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => onReorder('toBack')}
              title="Push to the very back (lowest layer)"
              style={{ flex: 1, padding: '4px 0', background: '#141e14', border: '1px solid #2a3a2a', color: '#6a6', borderRadius: 3, fontSize: 10, cursor: 'pointer' }}
            >
              ⇊ Push to Back
            </button>
            <button
              onClick={() => onReorder('toFront')}
              title="Bring to the very front (highest layer)"
              style={{ flex: 1, padding: '4px 0', background: '#141e30', border: '1px solid #2a3a5a', color: '#69c', borderRadius: 3, fontSize: 10, cursor: 'pointer' }}
            >
              ⇈ Bring to Front
            </button>
          </div>
        </Field>
      )}
      {onConvertToInteractable && (
        <button
          onClick={onConvertToInteractable}
          title="Turn this decor tile into an interactable with reactions (dialogue, forage, shop, etc.)"
          style={{
            width: '100%', padding: '6px 0', background: '#12324a', border: '1px solid #2a6a9e',
            color: '#7cf', cursor: 'pointer', borderRadius: 3, fontSize: 12, marginTop: 4,
          }}
        >
          ⇄ Convert to Interactable
        </button>
      )}
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
  npc, entity, buildingIds, onMove, onDelete, onDialogueChange, onUpdate, onPickLocation,
}: {
  npc: RawNpc
  entity: SelectedEntity & { type: 'npc' }
  buildingIds: string[]
  onMove: (tx: number, ty: number) => void
  onDelete: () => void
  onDialogueChange: (d: string[]) => void
  onUpdate: (partial: Partial<RawNpc>) => void
  onPickLocation?: () => void
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
        <SpriteSearchPicker value={npc.sprite} onChange={slug => onUpdate({ sprite: slug })} />
      </Field>
      <Field label="Position">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: '#888' }}>X</label>
          {numInput(npc.tx, tx => onMove(tx, npc.ty))}
          <label style={{ fontSize: 11, color: '#888' }}>Y</label>
          {numInput(npc.ty, ty => onMove(npc.tx, ty))}
        </div>
        {onPickLocation && <button style={BTN_PICK} onClick={onPickLocation}>📍 Pick on map</button>}
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
      <Field label="Screen">
        <input
          type="text"
          value={npc.screen ?? ''}
          placeholder="e.g. adopt-pet"
          onChange={e => onUpdate({ screen: e.target.value || undefined })}
          style={{ width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 12, boxSizing: 'border-box' }}
        />
        <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>Opens a screen/modal (e.g. 'adopt-pet') via a dialogue choice, in addition to dialogue.</div>
      </Field>
      <NpcScheduleEditor npc={npc} buildingIds={buildingIds} onUpdate={onUpdate} />
      <Field label="Min Building Level">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="number" min={0}
            value={npc.minLevel ?? 0}
            onChange={e => {
              const v = Math.max(0, Number(e.target.value))
              onUpdate({ minLevel: v > 0 ? v : undefined })
            }}
            style={{ width: 56, padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 12 }}
          />
          <span style={{ fontSize: 10, color: '#666' }}>0 = always present</span>
        </div>
        {npc.building && (npc.questGive || npc.questReceive) && (npc.minLevel ?? 0) > 0 && (
          <div style={{ color: '#c97', fontSize: 10, marginTop: 3 }}>
            Quests on this NPC are only obtainable once the building reaches level {npc.minLevel}.
          </div>
        )}
      </Field>
      <Field label="Hide at level">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="number" min={0}
            value={npc.hideAtLevel ?? 0}
            onChange={e => { const v = Math.max(0, Number(e.target.value)); onUpdate({ hideAtLevel: v > 0 ? v : undefined }) }}
            style={{ width: 56, padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 12 }}
          />
          <span style={{ fontSize: 10, color: '#666' }}>0 = never hides</span>
        </div>
      </Field>
      {!npc.building && (
        <Field label="Gated by building">
          <select
            value={npc.levelBuildingId ?? ''}
            onChange={e => onUpdate({ levelBuildingId: e.target.value || undefined })}
            style={{ width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box' }}
          >
            <option value="">— none (always visible) —</option>
            {buildingIds.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
          <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>
            This exterior NPC appears only once the chosen building reaches the level(s) set above.
          </div>
        </Field>
      )}
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

const NPC_ACTIVITIES: NpcActivity[] = ['work', 'eat', 'idle-chat', 'sleep', 'sweep', 'fish']

type NpcScheduleEntry = NonNullable<RawNpc['schedule']>[number]

function NpcScheduleEditor({
  npc, buildingIds, onUpdate,
}: {
  npc: RawNpc
  buildingIds: string[]
  onUpdate: (partial: Partial<RawNpc>) => void
}) {
  const inp: React.CSSProperties = {
    background: '#111', border: '1px solid #444', color: '#eee',
    borderRadius: 3, fontSize: 11, padding: '3px 5px', boxSizing: 'border-box',
  }
  const addBtn: React.CSSProperties = { padding: '2px 8px', background: '#1e2e1e', border: '1px solid #3a5a3a', color: '#6d6', borderRadius: 3, fontSize: 10, cursor: 'pointer', alignSelf: 'flex-start' }
  const delBtn: React.CSSProperties = { padding: '2px 6px', background: '#3a1a1a', border: '1px solid #622', color: '#f88', borderRadius: 3, fontSize: 10, cursor: 'pointer' }

  const entries = npc.schedule ?? []
  const setEntries = (next: NpcScheduleEntry[]) => onUpdate({ schedule: next.length ? next : undefined })
  const updateEntry = (i: number, partial: Partial<NpcScheduleEntry>) =>
    setEntries(entries.map((e, j) => j === i ? { ...e, ...partial } : e))

  return (
    <Field label="Schedule">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.map((entry, i) => (
          <div key={i} style={{ border: '1px solid #333', borderRadius: 4, padding: 6, background: '#181818' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 10, color: '#888' }}>Start</label>
              <input type="number" min={0} max={23} value={entry.startHour} style={{ ...inp, width: 44 }}
                onChange={e => updateEntry(i, { startHour: Number(e.target.value) })} />
              <label style={{ fontSize: 10, color: '#888' }}>End</label>
              <input type="number" min={0} max={24} value={entry.endHour} style={{ ...inp, width: 44 }}
                onChange={e => updateEntry(i, { endHour: Number(e.target.value) })} />
              <select value={entry.activity ?? ''} style={{ ...inp, flex: 1 }}
                onChange={e => updateEntry(i, { activity: (e.target.value || undefined) as NpcActivity | undefined })}>
                <option value="">— activity —</option>
                {NPC_ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <button style={delBtn} onClick={() => setEntries(entries.filter((_, j) => j !== i))}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                value={entry.location.type}
                style={{ ...inp, width: 76 }}
                onChange={e => {
                  const type = e.target.value as 'exterior' | 'interior'
                  updateEntry(i, {
                    location: type === 'exterior'
                      ? { type: 'exterior', tx: entry.location.tx, ty: entry.location.ty }
                      : { type: 'interior', buildingId: buildingIds[0] ?? '', tx: entry.location.tx, ty: entry.location.ty },
                  })
                }}
              >
                <option value="exterior">exterior</option>
                <option value="interior">interior</option>
              </select>
              {entry.location.type === 'interior' && (
                <select
                  value={entry.location.buildingId}
                  style={{ ...inp, flex: 1 }}
                  onChange={e => updateEntry(i, { location: { ...entry.location, type: 'interior', buildingId: e.target.value } as NpcScheduleEntry['location'] })}
                >
                  {buildingIds.map(id => <option key={id} value={id}>{id}</option>)}
                </select>
              )}
              <label style={{ fontSize: 10, color: '#888' }}>X</label>
              <input type="number" value={entry.location.tx} style={{ ...inp, width: 44 }}
                onChange={e => updateEntry(i, { location: { ...entry.location, tx: Number(e.target.value) } as NpcScheduleEntry['location'] })} />
              <label style={{ fontSize: 10, color: '#888' }}>Y</label>
              <input type="number" value={entry.location.ty} style={{ ...inp, width: 44 }}
                onChange={e => updateEntry(i, { location: { ...entry.location, ty: Number(e.target.value) } as NpcScheduleEntry['location'] })} />
            </div>
          </div>
        ))}
        <button
          style={addBtn}
          onClick={() => setEntries([...entries, {
            startHour: 8, endHour: 12, location: { type: 'exterior', tx: npc.tx, ty: npc.ty },
          }])}
        >
          + Add schedule entry
        </button>
      </div>
      <div style={{ color: '#666', fontSize: 10, marginTop: 3 }}>
        Time-of-day locations (interior entries can move this NPC inside a building). Use the toolbar's preview-hour control to see this rendered on the canvas.
      </div>
    </Field>
  )
}

function AnimalInspector({
  animal, onMove, onDelete, onUpdate, onPickLocation,
}: {
  animal: RawAnimal
  onMove: (tx: number, ty: number) => void
  onDelete: () => void
  onUpdate: (partial: Partial<RawAnimal>) => void
  onPickLocation?: () => void
}) {
  const inputStyle: React.CSSProperties = {
    background: '#252540', border: '1px solid #444', color: '#ccc',
    fontSize: 11, padding: '3px 6px', borderRadius: 3, width: '100%', boxSizing: 'border-box',
  }
  const paletteKeys = ANIMAL_SPECS[animal.type as AnimalType]?.palette
    ? Object.keys(ANIMAL_SPECS[animal.type as AnimalType].palette)
    : []

  return (
    <div>
      <Field label="ID">
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{animal.id}</span>
      </Field>
      <Field label="Type">
        <AnimalTypePicker value={animal.type} onChange={type => onUpdate({ type, variant: undefined })} />
      </Field>
      <Field label="Variant">
        <select
          value={animal.variant ?? ''}
          onChange={e => onUpdate({ variant: e.target.value || undefined })}
          style={inputStyle}
        >
          <option value="">(none)</option>
          {paletteKeys.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </Field>
      <Field label="Name">
        <input
          value={animal.name ?? ''}
          onChange={e => onUpdate({ name: e.target.value || undefined })}
          style={inputStyle}
        />
      </Field>
      <Field label="Dialogue">
        <textarea
          value={(animal.dialogue ?? []).join('\n')}
          onChange={e => onUpdate({ dialogue: e.target.value ? e.target.value.split('\n') : [] })}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>One line = one dialogue entry</div>
      </Field>
      <Field label="Quest Give">
        <input
          value={animal.questGive ?? ''}
          onChange={e => onUpdate({ questGive: e.target.value || undefined })}
          style={inputStyle}
        />
      </Field>
      <Field label="Quest Receive">
        <input
          value={Array.isArray(animal.questReceive) ? animal.questReceive.join(', ') : (animal.questReceive ?? '')}
          onChange={e => {
            const val = e.target.value.trim()
            const parsed: string | string[] | undefined = val.includes(',')
              ? val.split(',').map(s => s.trim()).filter(Boolean)
              : val || undefined
            onUpdate({ questReceive: parsed })
          }}
          style={inputStyle}
        />
      </Field>
      <Field label="Roam">
        <input
          type="checkbox"
          checked={animal.roam ?? false}
          onChange={e => onUpdate({ roam: e.target.checked || undefined })}
        />
      </Field>
      {animal.roam && (
        <Field label="Wander Area (offset from this animal)">
          <div style={{ display: 'flex', gap: 4 }}>
            {(['dx', 'dy', 'w', 'h'] as const).map((k, ki) => (
              <input
                key={k}
                type="number"
                value={animal.areaRect?.[ki] ?? 0}
                onChange={e => {
                  const r: [number, number, number, number] = [...(animal.areaRect ?? [0, 0, 0, 0])] as [number, number, number, number]
                  r[ki] = Number(e.target.value)
                  onUpdate({ areaRect: r })
                }}
                style={{ width: 44, background: '#252540', border: '1px solid #444', color: '#ccc', fontSize: 11, padding: '2px 4px', borderRadius: 3 }}
                placeholder={k}
              />
            ))}
          </div>
        </Field>
      )}
      <Field label="Position">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: '#888' }}>X</label>
          {numInput(animal.tx, tx => onMove(tx, animal.ty))}
          <label style={{ fontSize: 11, color: '#888' }}>Y</label>
          {numInput(animal.ty, ty => onMove(animal.tx, ty))}
        </div>
        {onPickLocation && <button style={BTN_PICK} onClick={onPickLocation}>📍 Pick on map</button>}
      </Field>
      <button
        onClick={onDelete}
        style={{ width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922', color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12, marginTop: 4 }}
      >
        Delete Animal
      </button>
    </div>
  )
}

function QuestItemInspector({
  label, id, tileId, tx, ty, extra, onMove, onDelete, onTileChange,
}: {
  label: string
  id: string
  tileId: string
  tx: number
  ty: number
  extra?: React.ReactNode
  onMove: (tx: number, ty: number) => void
  onDelete: () => void
  onTileChange?: (tileId: string) => void
}) {
  const [pickingTile, setPickingTile] = useState(false)
  return (
    <div>
      <Field label="ID">
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{id}</span>
      </Field>
      <Field label="Tile">
        {onTileChange ? (
          <>
            <div
              onClick={() => setPickingTile(p => !p)}
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 4px', borderRadius: 3, border: pickingTile ? '1px solid #5a8aee' : '1px solid transparent' }}
              title="Click to change tile"
            >
              <TilePreview tileId={tileId} />
              <span style={{ fontSize: 10, color: '#666' }}>✎</span>
            </div>
            {pickingTile && (
              <TilePicker
                current={tileId}
                onChange={onTileChange}
                onClose={() => setPickingTile(false)}
              />
            )}
          </>
        ) : (
          <TilePreview tileId={tileId} />
        )}
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

/** Editable list of supplementary visual-only tiles offset from a parent
 *  item's anchor — e.g. a pickup's extraTiles (a lantern's second tile). */
function ExtraTilesEditor({ tiles, onChange }: {
  tiles: Array<{ dx: number; dy: number; tileId: string }>
  onChange: (tiles: Array<{ dx: number; dy: number; tileId: string }>) => void
}) {
  const [pickingIndex, setPickingIndex] = useState<number | null>(null)
  const numSm: React.CSSProperties = { width: 44, padding: '2px 4px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }
  return (
    <Field label={`Extra tiles (${tiles.length}) — offset from anchor`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {tiles.map((t, i) => (
          <div key={i} style={{ background: '#16161e', border: '1px solid #2a2a3a', borderRadius: 3, padding: 4 }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <div onClick={() => setPickingIndex(p => p === i ? null : i)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <TilePreview tileId={t.tileId} /><span style={{ fontSize: 10, color: '#666' }}>✎</span>
              </div>
              <label style={{ fontSize: 9, color: '#888' }}>dx</label>
              <input type="number" style={numSm} value={t.dx} onChange={e => onChange(tiles.map((x, j) => j === i ? { ...x, dx: Number(e.target.value) } : x))} />
              <label style={{ fontSize: 9, color: '#888' }}>dy</label>
              <input type="number" style={numSm} value={t.dy} onChange={e => onChange(tiles.map((x, j) => j === i ? { ...x, dy: Number(e.target.value) } : x))} />
              <button style={{ marginLeft: 'auto', padding: '1px 5px', background: '#4a1a1a', border: '1px solid #922', color: '#f88', borderRadius: 3, fontSize: 10, cursor: 'pointer' }}
                onClick={() => onChange(tiles.filter((_, j) => j !== i))}>✕</button>
            </div>
            {pickingIndex === i && <TilePicker current={t.tileId} onChange={tileId => onChange(tiles.map((x, j) => j === i ? { ...x, tileId } : x))} onClose={() => setPickingIndex(null)} />}
          </div>
        ))}
        <button style={{ padding: '2px 8px', background: '#1e2e1e', border: '1px solid #3a5a3a', color: '#6d6', borderRadius: 3, fontSize: 10, cursor: 'pointer', alignSelf: 'flex-start' }}
          onClick={() => onChange([...tiles, { dx: 0, dy: 1, tileId: 'signpost' }])}>+ Add tile</button>
      </div>
    </Field>
  )
}

function StreetInspector({
  entry, onUpdate, onDelete, onConvertToPond,
}: {
  entry: { rect?: number[]; tile?: number[]; pathType?: string }
  onUpdate: (data: { rect?: number[]; tile?: number[]; pathType?: string }) => void
  onDelete: () => void
  onConvertToPond?: () => void
}) {
  const r = entry.rect
  const t = entry.tile
  return (
    <div>
      <Field label="Path Type">
        <select
          value={entry.pathType ?? ''}
          onChange={e => onUpdate({ pathType: e.target.value || undefined })}
          style={{
            width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444',
            color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box',
          }}
        >
          <option value="">— default —</option>
          {PATH_TILE_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
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
      {onConvertToPond && (
        <button
          onClick={onConvertToPond}
          style={{ width: '100%', padding: '5px 0', background: '#1a2e3a', border: '1px solid #2a5a6a', color: '#6ad', cursor: 'pointer', borderRadius: 3, fontSize: 11, marginTop: 4 }}
        >
          Convert to Pond
        </button>
      )}
    </div>
  )
}

function BuildingInspector({
  building, buildingIndex, activeLevel, onSetActiveLevel, onUpdateBuilding, onUpdateBuildingLevelVisual,
  onOpenInterior, onOpenBuildingEditor, interiorIds, existingInteriorIds, onAddInterior, onResizeBuilding,
}: {
  building: RawBuilding
  buildingIndex: number
  activeLevel: number
  onSetActiveLevel: (level: number) => void
  onUpdateBuilding: (index: number, patch: Partial<RawBuilding>) => void
  onUpdateBuildingLevelVisual: (buildingIndex: number, minLevel: number, patch: Partial<{ rect: [number, number, number, number]; wall: WallMaterial; roof: RoofMaterial }>) => void
  onOpenInterior: (id: string) => void
  onOpenBuildingEditor: (buildingIndex: number) => void
  interiorIds: string[]
  existingInteriorIds: string[]
  onAddInterior: (id: string, interior: RawInterior) => void
  onResizeBuilding?: (index: number, dir: 'top' | 'bottom' | 'left' | 'right', grow?: boolean) => void
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
  const [newPlayerDecor, setNewPlayerDecor] = useState(false)

  function openForm() {
    setNewId(nextAutoId())
    setNewName('')
    setNewW(10)
    setNewH(8)
    setNewFloor('woodFloor')
    setNewPlayerDecor(false)
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
      ...(newPlayerDecor ? { playerDecor: true } : {}),
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
  const btnSm: React.CSSProperties = {
    padding: '3px 8px', fontSize: 10, cursor: 'pointer', borderRadius: 3,
    background: '#1a2030', border: '1px solid #2a3050', color: '#88aaee',
  }
  const idConflict = existingInteriorIds.includes(newId.trim())

  return (
    <div>
      {building.id && (
        <Field label="ID">
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{building.id}</span>
        </Field>
      )}
      <Field label="Name (authoring only, not shown to players)">
        <input
          style={inputStyle}
          value={building.comment ?? ''}
          placeholder="e.g. Blacksmith's forge"
          onChange={e => onUpdateBuilding(buildingIndex, { comment: e.target.value || undefined })}
        />
      </Field>
      <Field label="Rect">
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>
          ({tx1},{ty1}) → ({tx2},{ty2}) — {tx2 - tx1 + 1}×{ty2 - ty1 + 1} tiles
        </span>
      </Field>
      {onResizeBuilding && building.rect && !building.rects && (
        <Field label="Resize">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={btnSm} onClick={() => onResizeBuilding(buildingIndex, 'top', false)}>− row top</button>
              <button style={btnSm} onClick={() => onResizeBuilding(buildingIndex, 'top', true)}>+ row top</button>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button style={btnSm} onClick={() => onResizeBuilding(buildingIndex, 'left', false)}>− col left</button>
                <button style={btnSm} onClick={() => onResizeBuilding(buildingIndex, 'left', true)}>+ col left</button>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa', minWidth: 60, textAlign: 'center' }}>{tx2 - tx1 + 1} × {ty2 - ty1 + 1}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button style={btnSm} onClick={() => onResizeBuilding(buildingIndex, 'right', false)}>− col right</button>
                <button style={btnSm} onClick={() => onResizeBuilding(buildingIndex, 'right', true)}>+ col right</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={btnSm} onClick={() => onResizeBuilding(buildingIndex, 'bottom', false)}>− row bottom</button>
              <button style={btnSm} onClick={() => onResizeBuilding(buildingIndex, 'bottom', true)}>+ row bottom</button>
            </div>
          </div>
        </Field>
      )}
      {building.rects && (
        <div style={{ color: '#666', fontSize: 9, marginTop: -4, marginBottom: 6 }}>
          Multi-rect buildings can't be resized here — edit the rects directly in JSON.
        </div>
      )}

      {/* ── Doors list ──────────────────────────────────────────────────── */}
      <Field label={`Doors (${(building.doors ?? []).length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {(building.doors ?? []).map((d, i) => {
            const doorRects = (building.rects ?? (building.rect ? [building.rect] : [])) as [number, number, number, number][]
            const doorOx = Math.min(...doorRects.map(r => r[0]))
            const doorOy = Math.max(...doorRects.map(r => r[3]))
            const doorAbsTx = doorOx + d.tx
            const doorAbsTy = doorOy + d.ty
            return (
              <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', background: '#16161e', border: '1px solid #2a2a3a', borderRadius: 3, padding: 4 }}>
                <label style={{ fontSize: 9, color: '#888' }}>X</label>
                <input type="number" style={numStyle} value={doorAbsTx} onChange={e => {
                  const doors = (building.doors ?? []).map((x, j) => j === i ? { ...x, tx: Number(e.target.value) - doorOx } : x)
                  onUpdateBuilding(buildingIndex, { doors })
                }} />
                <label style={{ fontSize: 9, color: '#888' }}>Y</label>
                <input type="number" style={numStyle} value={doorAbsTy} onChange={e => {
                  const doors = (building.doors ?? []).map((x, j) => j === i ? { ...x, ty: Number(e.target.value) - doorOy } : x)
                  onUpdateBuilding(buildingIndex, { doors })
                }} />
                <button
                  style={{ marginLeft: 'auto', padding: '1px 5px', background: '#4a1a1a', border: '1px solid #922', color: '#f88', borderRadius: 3, fontSize: 10, cursor: 'pointer' }}
                  onClick={() => onUpdateBuilding(buildingIndex, { doors: (building.doors ?? []).filter((_, j) => j !== i) })}
                >✕</button>
              </div>
            )
          })}
          <div style={{ color: '#666', fontSize: 9 }}>
            Place tool + no tile selected, click a wall tile to add a door — the sprite (if shown) renders one tile north of it; hidden doors are marked with 🚪 here.
          </div>
        </div>
      </Field>

      {/* ── Upgrade levels ─────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #333', marginTop: 4, paddingTop: 10 }}>
        <Field label="Upgrade Kind">
          <select
            value={building.upgradeKind ?? ''}
            onChange={e => onUpdateBuilding(buildingIndex, { upgradeKind: e.target.value || undefined })}
            style={inputStyle}
          >
            <option value="">— none —</option>
            {UPGRADE_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="Max Level">
          <input
            type="number" min={0}
            value={building.maxLevel ?? buildingMaxLevel(building)}
            onChange={e => onUpdateBuilding(buildingIndex, { maxLevel: Math.max(0, Number(e.target.value)) })}
            style={numStyle}
          />
        </Field>
        <Field label="Editing Level">
          <LevelStepper level={activeLevel} max={buildingMaxLevel(building)} onChange={onSetActiveLevel} />
        </Field>
        <Field label="Requires Ownership">
          <input
            type="checkbox"
            checked={building.requiresOwnership ?? false}
            onChange={e => onUpdateBuilding(buildingIndex, { requiresOwnership: e.target.checked || undefined })}
            title="Door stays locked until purchased via Town Upgrades — e.g. a player house"
          />
        </Field>

        {/* Per-level look — base (level 0) edits the building; higher levels write
            a levelVisuals override that kicks in once the building is upgraded. */}
        {(() => {
          const baseRect = (building.rect ?? building.rects?.[0] ?? [0, 0, 0, 0]) as [number, number, number, number]
          const lv = (building.levelVisuals ?? []).find(v => v.minLevel === activeLevel)
          const wallValue = activeLevel === 0 ? (building.wall ?? '') : (lv?.wall ?? '')
          const roofValue = activeLevel === 0 ? (building.roof ?? '') : (lv?.roof ?? '')
          const rectValue = (activeLevel === 0 ? baseRect : (lv?.rect ?? baseRect)) as [number, number, number, number]
          const setWall = (w: string) => activeLevel === 0
            ? onUpdateBuilding(buildingIndex, { wall: (w || undefined) as WallMaterial | undefined })
            : onUpdateBuildingLevelVisual(buildingIndex, activeLevel, { wall: (w || undefined) as WallMaterial | undefined })
          const setRoof = (r: string) => activeLevel === 0
            ? onUpdateBuilding(buildingIndex, { roof: (r || undefined) as RoofMaterial | undefined })
            : onUpdateBuildingLevelVisual(buildingIndex, activeLevel, { roof: (r || undefined) as RoofMaterial | undefined })
          const setRectAt = (i: number, val: number) => {
            const next = [...rectValue] as [number, number, number, number]
            next[i] = val
            onUpdateBuildingLevelVisual(buildingIndex, activeLevel, { rect: next })
          }
          const inherit = (label: string) => activeLevel === 0 ? label : `— inherit base —`
          return (
            <div style={{ background: '#16161e', border: '1px solid #2a2a3a', borderRadius: 4, padding: 8, marginBottom: 8 }}>
              <div style={{ color: '#8af', fontSize: 10, marginBottom: 6 }}>
                {activeLevel === 0 ? 'Base look' : `Look at level ${activeLevel}`}
              </div>
              <Field label="Wall">
                <select value={wallValue} onChange={e => setWall(e.target.value)} style={inputStyle}>
                  <option value="">{inherit('— none —')}</option>
                  {WALL_MATERIALS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </Field>
              <Field label="Roof">
                <select value={roofValue} onChange={e => setRoof(e.target.value)} style={inputStyle}>
                  <option value="">{inherit('— none —')}</option>
                  {ROOF_MATERIALS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              {activeLevel > 0 && (
                <Field label="Footprint">
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    {(['x1', 'y1', 'x2', 'y2'] as const).map((lbl, i) => (
                      <span key={lbl} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        <label style={{ fontSize: 10, color: '#888' }}>{lbl}</label>
                        <input type="number" value={rectValue[i]} onChange={e => setRectAt(i, Number(e.target.value))} style={numStyle} />
                      </span>
                    ))}
                  </div>
                  {lv?.rect && (
                    <button
                      onClick={() => onUpdateBuildingLevelVisual(buildingIndex, activeLevel, { rect: undefined })}
                      style={{ marginTop: 4, padding: '2px 8px', background: '#2a2a3a', border: '1px solid #444', color: '#aaa', borderRadius: 3, fontSize: 10, cursor: 'pointer' }}
                    >Reset to base footprint</button>
                  )}
                </Field>
              )}
            </div>
          )
        })()}

        <div style={{ color: '#777', fontSize: 10, marginBottom: 8 }}>
          {(building.levelDecor ?? []).filter(d => (d.minLevel ?? 0) === activeLevel).length} decor item(s) added at {activeLevel === 0 ? 'base' : `level ${activeLevel}`}.
          {' '}Pick a tile and use the Place tool to add decor for this level. Items from lower levels stay visible; higher-level items are dimmed.
        </div>
      </div>

      <Field label="Building">
        <button
          onClick={() => onOpenBuildingEditor(buildingIndex)}
          style={{
            padding: '5px 8px', background: '#1e3a2e', border: '1px solid #3a8a5e',
            color: '#6da', cursor: 'pointer', borderRadius: 3, fontSize: 11, textAlign: 'left', width: '100%',
          }}
        >
          Edit building…
        </button>
      </Field>

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
                <select style={inputStyle} value={newFloor} onChange={e => setNewFloor(e.target.value)}>
                  {FLOOR_TILES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: '#888' }}>
                <input type="checkbox" checked={newPlayerDecor} onChange={e => setNewPlayerDecor(e.target.checked)} />
                Player decor (unfurnished — renders the player's placed furniture)
              </label>
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
  interiorId, interior, selectedEntity, allInteriors,
  activeLevel, levelMax, onSetActiveLevel, onUpdateDecorMinLevel, onUpdateDecorHideAtLevel,
  panelStyle, headerStyle, bodyStyle,
  onCloseInterior, onOpenInterior, onResizeInterior,
  onAddInteriorExit, onUpdateInteriorProps, onUpdateInteriorExit, onRemoveInteriorExit,
  onMoveEntity, onZlayerChange, onDelete, onReorderInteriorDecor, onUpdateDecorTileId,
}: {
  interiorId: string
  interior: RawInterior | undefined
  selectedEntity: SelectedEntity | null
  allInteriors: Record<string, RawInterior>
  activeLevel: number
  levelMax: number
  onSetActiveLevel: (level: number) => void
  onUpdateDecorMinLevel: (entity: SelectedEntity, minLevel: number | undefined) => void
  onUpdateDecorHideAtLevel: (entity: SelectedEntity, hideAtLevel: number | undefined) => void
  panelStyle: React.CSSProperties
  headerStyle: React.CSSProperties
  bodyStyle: React.CSSProperties
  onCloseInterior: () => void
  onOpenInterior: (id: string) => void
  onResizeInterior: (id: string, dir: 'top' | 'bottom' | 'left' | 'right', grow?: boolean) => void
  onAddInteriorExit: (id: string, exit: InteriorExit) => void
  onUpdateInteriorProps: (id: string, patch: Partial<RawInterior>) => void
  onUpdateInteriorExit: (id: string, index: number, patch: Partial<InteriorExit>) => void
  onRemoveInteriorExit: (id: string, index: number) => void
  onMoveEntity: (entity: SelectedEntity, tx: number, ty: number) => void
  onZlayerChange: (entity: SelectedEntity, z: Zlayer) => void
  onDelete: (entity: SelectedEntity) => void
  onReorderInteriorDecor?: (entity: SelectedEntity, direction: ReorderDirection) => void
  onUpdateDecorTileId?: (entity: SelectedEntity, tileId: string) => void
}) {
  const [showExitForm, setShowExitForm] = useState(false)
  const [exitTx, setExitTx]           = useState(0)
  const [exitTy, setExitTy]           = useState(0)
  const [exitTo, setExitTo]           = useState('')
  const [exitEntryTx, setExitEntryTx] = useState(1)
  const [exitEntryTy, setExitEntryTy] = useState(1)
  const [exitDir, setExitDir]         = useState<'' | 'up' | 'down' | 'left' | 'right' | 'front' | 'back'>('')

  const allInteriorIds = Object.keys(allInteriors)
  const otherInteriorIds = allInteriorIds.filter(id => id !== interiorId)
  const linkedFrom = otherInteriorIds.filter(id => allInteriors[id]?.exits?.some(e => e.toInteriorId === interiorId))

  function openExitForm() {
    setExitTx(0); setExitTy(0)
    setExitTo(otherInteriorIds[0] ?? '')
    setExitEntryTx(1); setExitEntryTy(1)
    setExitDir('')
    setShowExitForm(true)
  }

  function saveExit() {
    if (!exitTo) return
    const isWallDoor = exitDir === 'left' || exitDir === 'right' || exitDir === 'front' || exitDir === 'back'
    const exit: InteriorExit = {
      // Wall doors: tx/ty auto-set by state; stairs/undirected: use form values
      tx: isWallDoor ? 0 : exitTx,
      ty: isWallDoor ? 0 : exitTy,
      toInteriorId: exitTo,
      ...(exitDir ? { direction: exitDir } : {}),
    }
    onAddInteriorExit(interiorId, exit)
    setShowExitForm(false)
  }

  const resize = (dir: 'top' | 'bottom' | 'left' | 'right', grow = true) => onResizeInterior(interiorId, dir, grow)

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
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={btnSm} onClick={() => resize('top', false)}>− row top</button>
                  <button style={btnSm} onClick={() => resize('top')}>+ row top</button>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button style={btnSm} onClick={() => resize('left', false)}>− col left</button>
                    <button style={btnSm} onClick={() => resize('left')}>+ col left</button>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa', minWidth: 60, textAlign: 'center' }}>{interior.width} × {interior.height}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button style={btnSm} onClick={() => resize('right', false)}>− col right</button>
                    <button style={btnSm} onClick={() => resize('right')}>+ col right</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={btnSm} onClick={() => resize('bottom', false)}>− row bottom</button>
                  <button style={btnSm} onClick={() => resize('bottom')}>+ row bottom</button>
                </div>
              </div>
            </Field>

            <Field label="Floor">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <select
                  value={interior.floorTileId ?? ''}
                  onChange={e => onUpdateInteriorProps(interiorId, { floorTileId: e.target.value })}
                  style={{ width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }}
                >
                  {FLOOR_TILES.map(id => <option key={id} value={id}>{id}</option>)}
                </select>
                {interior.floorTileId && <TilePreview tileId={interior.floorTileId} />}
              </div>
            </Field>
            <Field label="Wall">
              <select
                value={interior.wallTileId ?? ''}
                onChange={e => onUpdateInteriorProps(interiorId, { wallTileId: e.target.value || undefined })}
                style={{ width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }}
              >
                <option value="">— none —</option>
                {WALL_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Music">
              <select
                value={interior.musicId ?? ''}
                onChange={e => onUpdateInteriorProps(interiorId, { musicId: e.target.value || undefined })}
                style={{ width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }}
              >
                <option value="">— town theme —</option>
                {BUILDING_MUSIC_IDS.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </Field>
            <Field label="Ambiance">
              <select
                value={interior.ambianceId ?? ''}
                onChange={e => onUpdateInteriorProps(interiorId, { ambianceId: e.target.value || undefined })}
                style={{ width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }}
              >
                <option value="">— none —</option>
                {AMBIANCE_IDS.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </Field>
            <Field label="Player Decor">
              <input
                type="checkbox"
                checked={interior.playerDecor ?? false}
                onChange={e => onUpdateInteriorProps(interiorId, { playerDecor: e.target.checked || undefined })}
                title="Unfurnished — renders the player's placed furniture (homeLayout.ts) at runtime"
              />
            </Field>
            <Field label="Editing Level">
              <LevelStepper level={activeLevel} max={levelMax} onChange={onSetActiveLevel} />
              <div style={{ color: '#777', fontSize: 10, marginTop: 4 }}>
                Decor, rooms & NPCs tagged above this level are dimmed. New decor placed now is tagged with {activeLevel === 0 ? 'base' : `level ${activeLevel}`}.
              </div>
            </Field>
            <Field label="Decor items"><span style={{ color: '#aaa' }}>{interior.decor.length} items</span></Field>

            {/* Exits */}
            <Field label={`Exits (${interior.exits?.length ?? 0})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
                {(interior.exits ?? []).map((exit, i) => {
                  const dirArrow = exit.direction === 'up' ? '↑' : exit.direction === 'down' ? '↓' : exit.direction === 'left' ? '←' : exit.direction === 'right' ? '→' : exit.direction === 'front' ? '▼' : exit.direction === 'back' ? '▲' : null
                  const isStairs = exit.direction === 'up' || exit.direction === 'down'
                  return (
                    <div key={i} style={{ background: '#16202e', border: '1px solid #2a3a5a', borderRadius: 3, padding: '3px 6px', fontSize: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: '#88aaee', fontFamily: 'monospace' }}>({exit.tx},{exit.ty})</span>
                        <span style={{ color: '#888' }}>→</span>
                        <button
                          onClick={() => onOpenInterior(exit.toInteriorId)}
                          style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'none', border: 'none', color: '#7af', cursor: 'pointer', fontSize: 10, padding: 0 }}
                          title={`Open ${exit.toInteriorId}`}
                        >{exit.toInteriorId}</button>
                        {dirArrow && <span style={{ color: '#f0c040', fontSize: 9 }}>{dirArrow}</span>}
                        <button style={{ ...btnSm, padding: '1px 5px', background: '#4a1a1a', borderColor: '#922', color: '#f88' }} onClick={() => onRemoveInteriorExit(interiorId, i)}>✕</button>
                      </div>
                      {isStairs && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3, paddingLeft: 2 }}>
                          <label style={{ color: '#888', fontSize: 9 }}>X</label>
                          <input type="number" value={exit.tx} min={0} onChange={e => onUpdateInteriorExit(interiorId, i, { tx: Number(e.target.value) })} style={{ ...numSm, width: 36 }} />
                          <label style={{ color: '#888', fontSize: 9 }}>Y</label>
                          <input type="number" value={exit.ty} min={0} onChange={e => onUpdateInteriorExit(interiorId, i, { ty: Number(e.target.value) })} style={{ ...numSm, width: 36 }} />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3, paddingLeft: 2 }}>
                        <label style={{ color: '#888', fontSize: 9 }} title="Room unavailable below this upgrade level">Min level</label>
                        <input
                          type="number" min={0} max={levelMax}
                          value={exit.minLevel ?? 0}
                          onChange={e => {
                            const v = Math.max(0, Number(e.target.value))
                            onUpdateInteriorExit(interiorId, i, { minLevel: v > 0 ? v : undefined })
                          }}
                          style={{ ...numSm, width: 36 }}
                        />
                      </div>
                      {(exit.minLevel ?? 0) > activeLevel && (
                        <div style={{ color: '#c97', fontSize: 9, paddingLeft: 2, marginTop: 2 }}>locked at current level</div>
                      )}
                    </div>
                  )
                })}
              </div>

              {!showExitForm ? (
                <button style={{ ...btnSm, background: '#1e2e1e', borderColor: '#3a5a3a', color: '#6d6' }} onClick={openExitForm}>+ Add doorway</button>
              ) : (
                <div style={{ background: '#12121e', border: '1px solid #2a2a5a', borderRadius: 4, padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <label style={{ color: '#888', fontSize: 10 }}>Direction</label>
                    <select style={{ ...inputFull, width: 'auto' }} value={exitDir} onChange={e => setExitDir(e.target.value as '' | 'up' | 'down' | 'left' | 'right' | 'front' | 'back')}>
                      <option value="">— none —</option>
                      <option value="front">front ▼ (bottom wall door)</option>
                      <option value="back">back ▲ (top wall door)</option>
                      <option value="left">left ◄ (side wall door)</option>
                      <option value="right">right ► (side wall door)</option>
                      <option value="up">up ▲ (stairs / ladder)</option>
                      <option value="down">down ▼ (stairs / ladder)</option>
                    </select>
                  </div>

                  {/* Stairs need an explicit tile; wall doors auto-position */}
                  {(exitDir === 'up' || exitDir === 'down' || exitDir === '') && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <label style={{ color: '#888', fontSize: 10 }}>Tile X</label>
                      <input type="number" style={numSm} value={exitTx} min={0} onChange={e => setExitTx(Number(e.target.value))} />
                      <label style={{ color: '#888', fontSize: 10 }}>Y</label>
                      <input type="number" style={numSm} value={exitTy} min={0} onChange={e => setExitTy(Number(e.target.value))} />
                    </div>
                  )}
                  {(exitDir === 'left' || exitDir === 'right' || exitDir === 'front' || exitDir === 'back') && (
                    <div style={{ color: '#666', fontSize: 10 }}>Position auto-set to wall centre · reverse door auto-added</div>
                  )}

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

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ flex: 1, padding: '3px 0', background: '#1a3a5a', border: '1px solid #3a7aaa', color: '#7af', borderRadius: 3, fontSize: 11, cursor: 'pointer' }} onClick={saveExit}>Save doorway</button>
                    <button style={{ padding: '3px 10px', background: '#2a2a2a', border: '1px solid #444', color: '#aaa', borderRadius: 3, fontSize: 11, cursor: 'pointer' }} onClick={() => setShowExitForm(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </Field>

            {linkedFrom.length > 0 && (
              <Field label="Linked from">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {linkedFrom.map(id => (
                    <button
                      key={id}
                      onClick={() => onOpenInterior(id)}
                      style={{ textAlign: 'left', background: '#16202e', border: '1px solid #2a3a5a', borderRadius: 3, padding: '3px 6px', fontSize: 10, color: '#7af', cursor: 'pointer' }}
                    >{id}</button>
                  ))}
                </div>
              </Field>
            )}

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
              maxLevel={levelMax}
              onMinLevel={ml => onUpdateDecorMinLevel(selectedEntity, ml)}
              onHideAtLevel={hl => onUpdateDecorHideAtLevel(selectedEntity, hl)}
              onMove={(tx, ty) => onMoveEntity(selectedEntity, tx, ty)}
              onZlayer={z => onZlayerChange(selectedEntity, z)}
              onDelete={() => onDelete(selectedEntity)}
              onTileChange={onUpdateDecorTileId ? tileId => onUpdateDecorTileId(selectedEntity, tileId) : undefined}
              onReorder={onReorderInteriorDecor ? dir => onReorderInteriorDecor(selectedEntity, dir) : undefined}
              listLength={interior.decor.length}
            />
          </div>
        )}
      </div>
    </div>
  )
}

type PathDecor = { tx: number; ty: number; tileId: string }

// Editable {tx,ty,tileId} decor list used for a blocked path's blocked/cleared states.
function PathDecorEditor({ label, decor, anchor, onChange }: {
  label: string
  decor: PathDecor[]
  anchor: [number, number]
  onChange: (d: PathDecor[]) => void
}) {
  const [pickingIdx, setPickingIdx] = useState<number | null>(null)
  const numSm: React.CSSProperties = { width: 40, padding: '2px 4px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }
  return (
    <Field label={label}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {decor.map((d, i) => (
          <div key={i} style={{ background: '#16161e', border: '1px solid #2a2a3a', borderRadius: 3, padding: 4 }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <div onClick={() => setPickingIdx(p => p === i ? null : i)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <TilePreview tileId={d.tileId} /><span style={{ fontSize: 10, color: '#666' }}>✎</span>
              </div>
              <label style={{ fontSize: 9, color: '#888' }}>X</label>
              <input type="number" value={d.tx} style={numSm} onChange={e => onChange(decor.map((x, j) => j === i ? { ...x, tx: Number(e.target.value) } : x))} />
              <label style={{ fontSize: 9, color: '#888' }}>Y</label>
              <input type="number" value={d.ty} style={numSm} onChange={e => onChange(decor.map((x, j) => j === i ? { ...x, ty: Number(e.target.value) } : x))} />
              <button style={{ marginLeft: 'auto', padding: '1px 5px', background: '#4a1a1a', border: '1px solid #922', color: '#f88', borderRadius: 3, fontSize: 10, cursor: 'pointer' }}
                onClick={() => onChange(decor.filter((_, j) => j !== i))}>✕</button>
            </div>
            {pickingIdx === i && <TilePicker current={d.tileId} onChange={tileId => onChange(decor.map((x, j) => j === i ? { ...x, tileId } : x))} onClose={() => setPickingIdx(null)} />}
          </div>
        ))}
        <button style={{ padding: '2px 8px', background: '#1e2e1e', border: '1px solid #3a5a3a', color: '#6d6', borderRadius: 3, fontSize: 10, cursor: 'pointer', alignSelf: 'flex-start' }}
          onClick={() => onChange([...decor, { tx: anchor[0], ty: anchor[1], tileId: 'barrel' }])}>+ Add decor</button>
      </div>
    </Field>
  )
}

function BlockedPathInspector({
  bp, onUpdate, onDelete, onPick, questOptions,
}: {
  bp: RawBlockedPath
  onUpdate: (patch: Partial<RawBlockedPath>) => void
  onDelete: () => void
  onPick?: () => void
  questOptions: RefOption[]
}) {
  const anchor = bp.blockedTiles[0] ?? [0, 0]
  return (
    <div>
      <Field label="ID"><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{bp.id}</span></Field>
      <Field label="Quest (cleared when complete)">
        <EntityRefPicker value={bp.questId} options={questOptions} placeholder="Search quests…"
          onChange={v => onUpdate({ questId: v })} />
      </Field>
      <Field label={`Blocked Tiles (${bp.blockedTiles.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {bp.blockedTiles.map(([tx, ty], i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', fontFamily: 'monospace', fontSize: 11, color: '#ff9977' }}>
              <span style={{ flex: 1 }}>[{tx}, {ty}]</span>
              <button
                onClick={() => onUpdate({ blockedTiles: bp.blockedTiles.filter((_, j) => j !== i) })}
                style={{ padding: '1px 5px', background: '#4a1a1a', border: '1px solid #922', color: '#f88', borderRadius: 3, fontSize: 10, cursor: 'pointer' }}
              >✕</button>
            </div>
          ))}
        </div>
        {onPick && <button style={BTN_PICK} onClick={onPick}>📍 Add tile from map</button>}
      </Field>
      <PathDecorEditor label="Blocked Decor (shown while blocked)" decor={(bp.blocked.decor ?? []) as PathDecor[]} anchor={anchor as [number, number]}
        onChange={d => onUpdate({ blocked: { ...bp.blocked, decor: d } })} />
      <PathDecorEditor label="Cleared Decor (shown once cleared)" decor={(bp.cleared.decor ?? []) as PathDecor[]} anchor={anchor as [number, number]}
        onChange={d => onUpdate({ cleared: { ...bp.cleared, decor: d } })} />
      <button
        onClick={onDelete}
        style={{ marginTop: 8, padding: '4px 10px', background: '#4a1a1a', border: '1px solid #922', color: '#f88', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}
      >Delete Blocked Path</button>
    </div>
  )
}

function LockedDoorInspector({
  door, onUpdate, onDelete,
}: {
  door: RawLockedDoor
  onUpdate: (patch: Partial<RawLockedDoor>) => void
  onDelete: () => void
}) {
  const [editLockedBy, setEditLockedBy] = useState(door.lockedBy)
  return (
    <div>
      <Field label="Building">
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#ffaa00' }}>{door.buildingId}</span>
      </Field>
      <Field label="Unlocked By (item key)">
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            value={editLockedBy}
            onChange={e => setEditLockedBy(e.target.value)}
            placeholder="e.g. barracks-key"
            style={{ flex: 1, padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11, fontFamily: 'monospace' }}
          />
          <button
            onClick={() => onUpdate({ lockedBy: editLockedBy })}
            style={{ padding: '3px 7px', background: '#1a3a1a', border: '1px solid #3a6a3a', color: '#8d8', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}
          >✓</button>
        </div>
      </Field>
      <button
        onClick={onDelete}
        style={{ marginTop: 8, padding: '4px 10px', background: '#4a1a1a', border: '1px solid #922', color: '#f88', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}
      >Remove Lock</button>
    </div>
  )
}

const ENVIRONMENTS = ['farmland', 'forest', 'coast', 'ruins', 'ashen', 'camp', 'citadel', 'vault']

function AreaInspector({
  area, onMove, onUpdate,
}: {
  area: { id: string; name: string; tx: number; ty: number; tw: number; th: number }
  onMove: (tx: number, ty: number) => void
  onUpdate: (patch: Partial<{ name: string; tw: number; th: number }>) => void
}) {
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444',
    color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box',
  }
  return (
    <div>
      <Field label="ID">
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{area.id}</span>
      </Field>
      <Field label="Name">
        <input value={area.name} onChange={e => onUpdate({ name: e.target.value })} style={inputStyle} />
      </Field>
      <Field label="Position">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: '#888' }}>X</label>
          {numInput(area.tx, tx => onMove(tx, area.ty))}
          <label style={{ fontSize: 11, color: '#888' }}>Y</label>
          {numInput(area.ty, ty => onMove(area.tx, ty))}
        </div>
      </Field>
      <Field label="Size (tiles)">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: '#888' }}>W</label>
          {numInput(area.tw, tw => onUpdate({ tw }))}
          <label style={{ fontSize: 11, color: '#888' }}>H</label>
          {numInput(area.th, th => onUpdate({ th }))}
        </div>
      </Field>
    </div>
  )
}

function TreasureInspector({ treasure, onUpdate, onMove, onDelete, onPick, buildingOptions }: {
  treasure: Treasure
  onUpdate: (patch: Partial<Treasure>) => void
  onMove: (tx: number, ty: number) => void
  onDelete: () => void
  onPick?: () => void
  buildingOptions: RefOption[]
}) {
  const [picking, setPicking] = useState<null | 'tile' | 'collected'>(null)
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444',
    color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box',
  }
  const reward = (treasure.reward ?? {}) as Record<string, unknown>
  const crystals = typeof reward.crystals === 'number' ? reward.crystals : 0
  return (
    <div>
      <Field label="ID">
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa' }}>{treasure.id}</span>
      </Field>
      <Field label="Title">
        <input style={inputStyle} value={treasure.title ?? ''} onChange={e => onUpdate({ title: e.target.value })} />
      </Field>
      <Field label="Tile">
        <div onClick={() => setPicking(p => p === 'tile' ? null : 'tile')} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <TilePreview tileId={treasure.tileId} /><span style={{ fontSize: 10, color: '#666' }}>✎</span>
        </div>
        {picking === 'tile' && <TilePicker current={treasure.tileId} onChange={tileId => onUpdate({ tileId })} onClose={() => setPicking(null)} />}
      </Field>
      <Field label="Collected Tile">
        <div onClick={() => setPicking(p => p === 'collected' ? null : 'collected')} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {treasure.collectedTileId ? <TilePreview tileId={treasure.collectedTileId} /> : <span style={{ color: '#888', fontSize: 11 }}>(none)</span>}
          <span style={{ fontSize: 10, color: '#666' }}>✎</span>
        </div>
        {picking === 'collected' && <TilePicker current={treasure.collectedTileId ?? ''} onChange={tileId => onUpdate({ collectedTileId: tileId })} onClose={() => setPicking(null)} />}
      </Field>
      <Field label="Building (interior, optional)">
        <EntityRefPicker value={treasure.buildingId ?? ''} options={buildingOptions} placeholder="Search buildings…"
          onChange={v => onUpdate({ buildingId: v || undefined })} />
      </Field>
      <Field label="Reward — crystals">
        {numInput(crystals, n => onUpdate({ reward: { ...reward, crystals: n } }))}
      </Field>
      <Field label="Position">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: '#888' }}>X</label>
          {numInput(treasure.tx, tx => onMove(tx, treasure.ty))}
          <label style={{ fontSize: 11, color: '#888' }}>Y</label>
          {numInput(treasure.ty, ty => onMove(treasure.tx, ty))}
        </div>
        {onPick && <button style={BTN_PICK} onClick={onPick}>📍 Pick on map</button>}
      </Field>
      <button onClick={onDelete} style={{ width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922', color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12, marginTop: 4 }}>
        Delete Treasure
      </button>
    </div>
  )
}

// ── Interactables ──────────────────────────────────────────────────────────────
const REACTION_TYPES = ['dialogue', 'screen', 'giveItem', 'quest', 'move', 'buy', 'buyPack', 'buyHubItem', 'dig', 'forage'] as const

function ReactionEditor({ reaction, onChange, questOptions, hubItemOptions }: {
  reaction: RawInteractableReaction
  onChange: (r: RawInteractableReaction) => void
  questOptions: RefOption[]
  hubItemOptions: RefOption[]
}) {
  const inp: React.CSSProperties = { width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box' }
  const numSm: React.CSSProperties = { width: 50, padding: '2px 4px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }
  const text = Array.isArray(reaction.text) ? reaction.text.join('\n') : (reaction.text ?? '')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <select value={reaction.type} onChange={e => onChange({ type: e.target.value })} style={inp}>
        {REACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      {reaction.type === 'dialogue' && (
        <>
          <input style={inp} placeholder="speaker name (optional)" value={reaction.speakerName ?? ''} onChange={e => onChange({ ...reaction, speakerName: e.target.value || undefined })} />
          <textarea style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} rows={3} placeholder="dialogue (one line per entry)" value={text}
            onChange={e => onChange({ ...reaction, text: e.target.value.includes('\n') ? e.target.value.split('\n') : e.target.value })} />
        </>
      )}

      {reaction.type === 'screen' && (
        <select style={inp} value={reaction.screen ?? ''} onChange={e => onChange({ ...reaction, screen: e.target.value })}>
          <option value="">— pick screen —</option>
          {SCREEN_IDS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      {reaction.type === 'quest' && (
        <>
          <EntityRefPicker value={reaction.questId ?? ''} options={questOptions} placeholder="Search quests…" onChange={v => onChange({ ...reaction, questId: v })} />
          <input style={inp} placeholder="speaker name (optional)" value={reaction.speakerName ?? ''} onChange={e => onChange({ ...reaction, speakerName: e.target.value || undefined })} />
        </>
      )}

      {reaction.type === 'move' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 10, color: '#888' }}>To X</label>
          <input type="number" style={numSm} value={reaction.to?.tx ?? 0} onChange={e => onChange({ ...reaction, to: { tx: Number(e.target.value), ty: reaction.to?.ty ?? 0 } })} />
          <label style={{ fontSize: 10, color: '#888' }}>Y</label>
          <input type="number" style={numSm} value={reaction.to?.ty ?? 0} onChange={e => onChange({ ...reaction, to: { tx: reaction.to?.tx ?? 0, ty: Number(e.target.value) } })} />
        </div>
      )}

      {reaction.type === 'giveItem' && (
        <>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <label style={{ fontSize: 10, color: '#888' }}>Crystals</label>
            <input type="number" style={numSm} value={reaction.crystals ?? 0} onChange={e => onChange({ ...reaction, crystals: Number(e.target.value) || undefined })} />
          </div>
          <input style={inp} placeholder="message (optional)" value={reaction.message ?? ''} onChange={e => onChange({ ...reaction, message: e.target.value || undefined })} />
          <input style={inp} placeholder="already-granted text (optional)" value={reaction.alreadyGrantedText ?? ''} onChange={e => onChange({ ...reaction, alreadyGrantedText: e.target.value || undefined })} />
          <div style={{ color: '#888', fontSize: 9 }}>Collectible (optional)</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <input style={inp} placeholder="id" value={reaction.collectible?.id ?? ''} onChange={e => onChange({ ...reaction, collectible: { id: e.target.value, name: reaction.collectible?.name ?? '', icon: reaction.collectible?.icon ?? '🎁', desc: reaction.collectible?.desc ?? '' } })} />
            <input style={inp} placeholder="name" value={reaction.collectible?.name ?? ''} onChange={e => onChange({ ...reaction, collectible: { id: reaction.collectible?.id ?? '', name: e.target.value, icon: reaction.collectible?.icon ?? '🎁', desc: reaction.collectible?.desc ?? '' } })} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <input style={{ ...inp, width: 50, flex: '0 0 50px' }} placeholder="icon" value={reaction.collectible?.icon ?? ''} onChange={e => onChange({ ...reaction, collectible: { id: reaction.collectible?.id ?? '', name: reaction.collectible?.name ?? '', icon: e.target.value, desc: reaction.collectible?.desc ?? '' } })} />
            <input style={inp} placeholder="desc" value={reaction.collectible?.desc ?? ''} onChange={e => onChange({ ...reaction, collectible: { id: reaction.collectible?.id ?? '', name: reaction.collectible?.name ?? '', icon: reaction.collectible?.icon ?? '🎁', desc: e.target.value } })} />
          </div>
        </>
      )}

      {reaction.type === 'buy' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 10, color: '#888' }}>Shop slot index</label>
          <input type="number" style={numSm} value={reaction.slotIndex ?? 0} onChange={e => onChange({ ...reaction, slotIndex: Number(e.target.value) })} />
        </div>
      )}

      {reaction.type === 'buyHubItem' && (
        <>
          <EntityRefPicker value={reaction.itemId ?? ''} options={hubItemOptions} placeholder="Search hub items…" onChange={v => onChange({ ...reaction, itemId: v })} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <label style={{ fontSize: 10, color: '#888' }}>Price</label>
            <input type="number" style={numSm} value={reaction.price ?? 0} onChange={e => onChange({ ...reaction, price: Number(e.target.value) })} />
            <select style={inp} value={reaction.currency ?? 'crystals'} onChange={e => onChange({ ...reaction, currency: e.target.value === 'tickets' ? 'tickets' : undefined })}>
              <option value="crystals">crystals</option>
              <option value="tickets">tickets</option>
            </select>
          </div>
          <input style={inp} placeholder="speaker name (optional)" value={reaction.speakerName ?? ''} onChange={e => onChange({ ...reaction, speakerName: e.target.value || undefined })} />
          <input style={inp} placeholder="prerequisite (optional)" value={reaction.prerequisite ?? ''} onChange={e => onChange({ ...reaction, prerequisite: e.target.value || undefined })} />
          <input style={inp} placeholder="locked text (optional)" value={reaction.lockedText ?? ''} onChange={e => onChange({ ...reaction, lockedText: e.target.value || undefined })} />
        </>
      )}

      {reaction.type === 'dig' && (
        <>
          <EntityRefPicker value={reaction.requiresItemId ?? ''} options={hubItemOptions} placeholder="Search hub items… (default: spade)" onChange={v => onChange({ ...reaction, requiresItemId: v || undefined })} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#ccc' }}>
            <input type="checkbox" checked={!!reaction.nightOnly} onChange={e => onChange({ ...reaction, nightOnly: e.target.checked || undefined })} />
            Night only
          </label>
          <input style={inp} placeholder="weather only (optional)" value={reaction.weatherOnly ?? ''} onChange={e => onChange({ ...reaction, weatherOnly: e.target.value || undefined })} />
          <select style={inp} value={reaction.lootTable ?? 'earth'} onChange={e => onChange({ ...reaction, lootTable: e.target.value as RawInteractableReaction['lootTable'] })}>
            <option value="earth">earth</option>
            <option value="hollow">hollow</option>
            <option value="rain">rain</option>
            <option value="fog">fog</option>
          </select>
        </>
      )}
    </div>
  )
}

function InteractableInspector({ it, onUpdate, onMove, onDelete, onPick, buildingOptions, questOptions, hubItemOptions }: {
  it: RawInteractable
  onUpdate: (patch: Partial<RawInteractable>) => void
  onMove: (tx: number, ty: number) => void
  onDelete: () => void
  onPick?: () => void
  buildingOptions: RefOption[]
  questOptions: RefOption[]
  hubItemOptions: RefOption[]
}) {
  const [pickingDecor, setPickingDecor] = useState<number | null>(null)
  const inp: React.CSSProperties = { width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box' }
  const numSm: React.CSSProperties = { width: 44, padding: '2px 4px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }
  const decor = it.decor ?? []
  const reactions = it.reactions ?? []
  return (
    <div>
      <Field label="ID">
        <input style={inp} value={it.id} onChange={e => onUpdate({ id: e.target.value })} />
      </Field>
      <Field label="Position (anchor)">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: '#888' }}>X</label>
          {numInput(it.tx, tx => onMove(tx, it.ty))}
          <label style={{ fontSize: 11, color: '#888' }}>Y</label>
          {numInput(it.ty, ty => onMove(it.tx, ty))}
        </div>
        {onPick && <button style={BTN_PICK} onClick={onPick}>📍 Pick on map</button>}
      </Field>
      <Field label="Building (interior, optional)">
        <EntityRefPicker value={it.building ?? ''} options={buildingOptions} placeholder="Search buildings…" onChange={v => onUpdate({ building: v || undefined })} />
      </Field>
      <Field label="Hit area (tiles)">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 10, color: '#888' }}>W</label>
          <input type="number" style={numSm} value={it.hitRect?.w ?? ''} placeholder="auto" onChange={e => onUpdate({ hitRect: e.target.value ? { w: Number(e.target.value), h: it.hitRect?.h ?? 1 } : undefined })} />
          <label style={{ fontSize: 10, color: '#888' }}>H</label>
          <input type="number" style={numSm} value={it.hitRect?.h ?? ''} placeholder="auto" onChange={e => onUpdate({ hitRect: e.target.value ? { w: it.hitRect?.w ?? 1, h: Number(e.target.value) } : undefined })} />
        </div>
      </Field>
      <Field label={`Decor tiles (${decor.length}) — offset from anchor`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {decor.map((d, i) => (
            <div key={i} style={{ background: '#16161e', border: '1px solid #2a2a3a', borderRadius: 3, padding: 4 }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {d.shopArtSlot != null ? (
                  <span style={{ fontSize: 10, color: '#8af', whiteSpace: 'nowrap' }} title="Renders today's live shop-stock art at runtime — not previewable here">🛒 shop slot #{d.shopArtSlot}</span>
                ) : d.spriteId != null ? (
                  <span style={{ fontSize: 10, color: '#8af', whiteSpace: 'nowrap' }} title={`web/public/sprites/${d.spriteId}.svg`}>🖼 {d.spriteId}</span>
                ) : (
                  <div onClick={() => setPickingDecor(p => p === i ? null : i)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <TilePreview tileId={d.tileId ?? ''} /><span style={{ fontSize: 10, color: '#666' }}>✎</span>
                  </div>
                )}
                <label style={{ fontSize: 9, color: '#888' }}>dx</label>
                <input type="number" style={numSm} value={d.dx} onChange={e => onUpdate({ decor: decor.map((x, j) => j === i ? { ...x, dx: Number(e.target.value) } : x) })} />
                <label style={{ fontSize: 9, color: '#888' }}>dy</label>
                <input type="number" style={numSm} value={d.dy} onChange={e => onUpdate({ decor: decor.map((x, j) => j === i ? { ...x, dy: Number(e.target.value) } : x) })} />
                <button style={{ marginLeft: 'auto', padding: '1px 5px', background: '#4a1a1a', border: '1px solid #922', color: '#f88', borderRadius: 3, fontSize: 10, cursor: 'pointer' }}
                  onClick={() => onUpdate({ decor: decor.filter((_, j) => j !== i) })}>✕</button>
              </div>
              {pickingDecor === i && d.shopArtSlot == null && d.spriteId == null && (
                <TilePicker current={d.tileId ?? ''} onChange={tileId => onUpdate({ decor: decor.map((x, j) => j === i ? { ...x, tileId } : x) })} onClose={() => setPickingDecor(null)} />
              )}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
                {(['solid', 'below', 'above'] as const).map(z => (
                  <button
                    key={z}
                    onClick={() => onUpdate({ decor: decor.map((x, j) => j === i ? { ...x, zlayer: z === 'solid' ? undefined : z } : x) })}
                    style={{
                      padding: '2px 6px', fontSize: 10, cursor: 'pointer',
                      background: (d.zlayer ?? 'solid') === z ? '#f0c040' : '#333',
                      color: (d.zlayer ?? 'solid') === z ? '#1a1a2e' : '#aaa',
                      border: 'none', borderRadius: 3,
                    }}
                  >
                    {z}
                  </button>
                ))}
                <button
                  disabled={i === 0}
                  title="Draw behind (move earlier in list)"
                  onClick={() => onUpdate({ decor: swap(decor, i, i - 1) })}
                  style={{ marginLeft: 'auto', padding: '2px 6px', background: '#1e2a1e', border: '1px solid #3a5a3a', color: '#8d8', borderRadius: 3, fontSize: 10, cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.4 : 1 }}
                >↓ Back</button>
                <button
                  disabled={i === decor.length - 1}
                  title="Draw in front (move later in list)"
                  onClick={() => onUpdate({ decor: swap(decor, i, i + 1) })}
                  style={{ padding: '2px 6px', background: '#1e2a4e', border: '1px solid #3a5a8e', color: '#8af', borderRadius: 3, fontSize: 10, cursor: i === decor.length - 1 ? 'default' : 'pointer', opacity: i === decor.length - 1 ? 0.4 : 1 }}
                >↑ Front</button>
              </div>
              <GlowControls
                glow={d.glow} glowRadius={d.glowRadius} pulse={d.pulse}
                onChange={patch => onUpdate({ decor: decor.map((x, j) => j === i ? { ...x, ...patch } : x) })}
              />
            </div>
          ))}
          <button style={{ padding: '2px 8px', background: '#1e2e1e', border: '1px solid #3a5a3a', color: '#6d6', borderRadius: 3, fontSize: 10, cursor: 'pointer', alignSelf: 'flex-start' }}
            onClick={() => onUpdate({ decor: [...decor, { dx: 0, dy: 0, tileId: 'signpost' }] })}>+ Add tile</button>
        </div>
      </Field>
      <Field label="Indicator condition (optional)">
        <input style={inp} value={it.indicator?.condition ?? ''} placeholder="e.g. unread-news"
          onChange={e => onUpdate({ indicator: e.target.value ? { condition: e.target.value, dx: it.indicator?.dx, dy: it.indicator?.dy } : undefined })} />
      </Field>
      <Field label={`Reactions (${reactions.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {reactions.map((r, i) => (
            <div key={i} style={{ background: '#12121e', border: '1px solid #2a2a4a', borderRadius: 4, padding: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: '#888' }}>#{i + 1}</span>
                <button style={{ padding: '0 6px', background: '#4a1a1a', border: '1px solid #922', color: '#f88', borderRadius: 3, fontSize: 10, cursor: 'pointer' }}
                  onClick={() => onUpdate({ reactions: reactions.filter((_, j) => j !== i) })}>✕</button>
              </div>
              <ReactionEditor reaction={r} questOptions={questOptions} hubItemOptions={hubItemOptions} onChange={nr => onUpdate({ reactions: reactions.map((x, j) => j === i ? nr : x) })} />
            </div>
          ))}
          <button style={{ padding: '2px 8px', background: '#1e2e1e', border: '1px solid #3a5a3a', color: '#6d6', borderRadius: 3, fontSize: 10, cursor: 'pointer', alignSelf: 'flex-start' }}
            onClick={() => onUpdate({ reactions: [...reactions, { type: 'dialogue', text: '' }] })}>+ Add reaction</button>
        </div>
      </Field>
      <button onClick={onDelete} style={{ width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922', color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12, marginTop: 6 }}>
        Delete Interactable
      </button>
    </div>
  )
}

function TownInspector({
  configData, onResizeMap, onUpdateMapProps, onUpdateConfig, onPickLocation,
}: {
  configData: RawMapConfig
  onResizeMap: (dir: 'n' | 's' | 'e' | 'w', grow: boolean) => void
  onUpdateMapProps: (patch: { townName?: string; environment?: string }) => void
  onUpdateConfig?: (patch: Partial<RawMapConfig>) => void
  onPickLocation?: (kind: PickKind, index?: number) => void
}) {
  const TILE = 32
  const tileW = configData.mapW / TILE
  const tileH = configData.mapH / TILE
  const btnSm: React.CSSProperties = {
    padding: '3px 8px', fontSize: 10, cursor: 'pointer', borderRadius: 3,
    background: '#1a2030', border: '1px solid #2a3050', color: '#88aaee',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444',
    color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box',
  }
  return (
    <div>
      <Field label="Town Name">
        <input
          value={configData.townName ?? ''}
          onChange={e => onUpdateMapProps({ townName: e.target.value })}
          style={inputStyle}
        />
      </Field>
      <Field label="Environment">
        <select
          value={(configData.environment as string | undefined) ?? ''}
          onChange={e => onUpdateMapProps({ environment: e.target.value || undefined })}
          style={{ ...inputStyle, padding: '3px 5px' }}
        >
          <option value="">— none —</option>
          {ENVIRONMENTS.map(env => <option key={env} value={env}>{env}</option>)}
        </select>
      </Field>
      <Field label="Map Size">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={btnSm} onClick={() => onResizeMap('n', false)}>− row N</button>
            <button style={btnSm} onClick={() => onResizeMap('n', true)}>+ row N</button>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button style={btnSm} onClick={() => onResizeMap('w', false)}>− col W</button>
              <button style={btnSm} onClick={() => onResizeMap('w', true)}>+ col W</button>
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#aaa', minWidth: 56, textAlign: 'center' }}>{tileW} × {tileH}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button style={btnSm} onClick={() => onResizeMap('e', false)}>− col E</button>
              <button style={btnSm} onClick={() => onResizeMap('e', true)}>+ col E</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={btnSm} onClick={() => onResizeMap('s', false)}>− row S</button>
            <button style={btnSm} onClick={() => onResizeMap('s', true)}>+ row S</button>
          </div>
        </div>
      </Field>

      {onUpdateConfig && <TownExtraSections configData={configData} onUpdateConfig={onUpdateConfig} onPickLocation={onPickLocation} inputStyle={inputStyle} />}
    </div>
  )
}

// Editors for the remaining town config: spawn & exits, terrain & spawn zones,
// weather & ambient sprites. Whole arrays/values are written via onUpdateConfig.
function TownExtraSections({ configData, onUpdateConfig, onPickLocation, inputStyle }: {
  configData: RawMapConfig
  onUpdateConfig: (patch: Partial<RawMapConfig>) => void
  onPickLocation?: (kind: PickKind, index?: number) => void
  inputStyle: React.CSSProperties
}) {
  const numSm: React.CSSProperties = { width: 42, padding: '2px 4px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }
  const addBtn: React.CSSProperties = { padding: '2px 8px', background: '#1e2e1e', border: '1px solid #3a5a3a', color: '#6d6', borderRadius: 3, fontSize: 10, cursor: 'pointer', alignSelf: 'flex-start' }
  const xBtn: React.CSSProperties = { padding: '1px 5px', background: '#4a1a1a', border: '1px solid #922', color: '#f88', borderRadius: 3, fontSize: 10, cursor: 'pointer' }
  const pickBtn: React.CSSProperties = { padding: '1px 6px', background: '#1e2a4e', border: '1px solid #3a4a8e', color: '#8af', borderRadius: 3, fontSize: 10, cursor: 'pointer' }
  const start = configData.avatarStart ?? { tx: 0, ty: 0 }
  const exits = configData.exitTiles ?? []
  const weather = (configData.weather ?? {}) as RawWeather
  const seasons = Object.entries(weather.bySeason ?? {})
  const ambient = configData.ambientNpcSprites ?? []
  const zones = configData.chickenZones ?? []
  const spawns = configData.npcSpawnTiles ?? []

  return (
    <>
      {/* Spawn & exits */}
      <Field label="Avatar Spawn">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 10, color: '#888' }}>X</label>
          <input type="number" style={numSm} value={start.tx} onChange={e => onUpdateConfig({ avatarStart: { tx: Number(e.target.value), ty: start.ty } })} />
          <label style={{ fontSize: 10, color: '#888' }}>Y</label>
          <input type="number" style={numSm} value={start.ty} onChange={e => onUpdateConfig({ avatarStart: { tx: start.tx, ty: Number(e.target.value) } })} />
          {onPickLocation && <button style={pickBtn} onClick={() => onPickLocation('avatarStart')}>📍 Pick</button>}
        </div>
      </Field>

      <Field label={`Exit Tiles (${exits.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {exits.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', background: '#16161e', border: '1px solid #2a2a3a', borderRadius: 3, padding: 4 }}>
              <input type="number" style={numSm} value={e.tx} onChange={ev => onUpdateConfig({ exitTiles: exits.map((x, j) => j === i ? { ...x, tx: Number(ev.target.value) } : x) })} />
              <input type="number" style={numSm} value={e.ty} onChange={ev => onUpdateConfig({ exitTiles: exits.map((x, j) => j === i ? { ...x, ty: Number(ev.target.value) } : x) })} />
              <select style={{ ...inputStyle, flex: 1, minWidth: 70 }} value={e.screen} onChange={ev => onUpdateConfig({ exitTiles: exits.map((x, j) => j === i ? { ...x, screen: ev.target.value } : x) })}>
                <option value="">— pick screen —</option>
                {SCREEN_IDS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {onPickLocation && <button style={pickBtn} onClick={() => onPickLocation('exitTile', i)}>📍</button>}
              <button style={xBtn} onClick={() => onUpdateConfig({ exitTiles: exits.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button style={addBtn} onClick={() => onUpdateConfig({ exitTiles: [...exits, { tx: start.tx, ty: start.ty, screen: '' }] })}>+ Add exit</button>
        </div>
      </Field>

      {/* Weather */}
      <Field label="Weather">
        <input style={{ ...inputStyle, marginBottom: 4 }} placeholder="type (e.g. rain, snow, fog)" value={weather.type ?? ''}
          onChange={e => onUpdateConfig({ weather: { ...weather, type: e.target.value || undefined } })} />
        <div style={{ color: '#888', fontSize: 9, margin: '2px 0' }}>Per-season overrides</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {seasons.map(([season, val], i) => (
            <div key={i} style={{ display: 'flex', gap: 4 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={season} placeholder="season" onChange={e => {
                const next = { ...(weather.bySeason ?? {}) }; delete next[season]; if (e.target.value) next[e.target.value] = val
                onUpdateConfig({ weather: { ...weather, bySeason: next } })
              }} />
              <input style={{ ...inputStyle, flex: 1 }} value={val} placeholder="weather" onChange={e => onUpdateConfig({ weather: { ...weather, bySeason: { ...(weather.bySeason ?? {}), [season]: e.target.value } } })} />
              <button style={xBtn} onClick={() => { const next = { ...(weather.bySeason ?? {}) }; delete next[season]; onUpdateConfig({ weather: { ...weather, bySeason: next } }) }}>✕</button>
            </div>
          ))}
          <button style={addBtn} onClick={() => onUpdateConfig({ weather: { ...weather, bySeason: { ...(weather.bySeason ?? {}), '': '' } } })}>+ Add season</button>
        </div>
      </Field>

      {/* Ambient NPC sprites */}
      <Field label={`Ambient NPC Sprites (${ambient.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ambient.map((slug, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <SpriteSearchPicker value={slug} onChange={s => onUpdateConfig({ ambientNpcSprites: ambient.map((x, j) => j === i ? s : x) })} />
              </div>
              <button style={xBtn} onClick={() => onUpdateConfig({ ambientNpcSprites: ambient.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button style={addBtn} onClick={() => onUpdateConfig({ ambientNpcSprites: [...ambient, 'hub-npc-elder'] })}>+ Add sprite</button>
        </div>
      </Field>

      {/* Chicken zones */}
      <Field label={`Chicken Zones (${zones.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {zones.map((z, i) => (
            <div key={i} style={{ background: '#16161e', border: '1px solid #2a2a3a', borderRadius: 3, padding: 4 }}>
              <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, color: '#888' }}>rect</span>
                {[0, 1, 2, 3].map(k => (
                  <input key={k} type="number" style={numSm} value={z.rect[k]} onChange={e => {
                    const rect = [...z.rect] as [number, number, number, number]; rect[k] = Number(e.target.value)
                    onUpdateConfig({ chickenZones: zones.map((x, j) => j === i ? { ...x, rect } : x) })
                  }} />
                ))}
                <button style={{ ...xBtn, marginLeft: 'auto' }} onClick={() => onUpdateConfig({ chickenZones: zones.filter((_, j) => j !== i) })}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginTop: 3 }}>
                <span style={{ fontSize: 9, color: '#888' }}>count</span>
                <input type="number" style={numSm} value={z.count ?? 0} onChange={e => onUpdateConfig({ chickenZones: zones.map((x, j) => j === i ? { ...x, count: Number(e.target.value) || undefined } : x) })} />
                <span style={{ fontSize: 9, color: '#888' }}>roost</span>
                <input type="number" style={numSm} value={z.roost?.[0] ?? ''} placeholder="x" onChange={e => onUpdateConfig({ chickenZones: zones.map((x, j) => j === i ? { ...x, roost: [Number(e.target.value), x.roost?.[1] ?? 0] } : x) })} />
                <input type="number" style={numSm} value={z.roost?.[1] ?? ''} placeholder="y" onChange={e => onUpdateConfig({ chickenZones: zones.map((x, j) => j === i ? { ...x, roost: [x.roost?.[0] ?? 0, Number(e.target.value)] } : x) })} />
              </div>
            </div>
          ))}
          <button style={addBtn} onClick={() => onUpdateConfig({ chickenZones: [...zones, { rect: [start.tx, start.ty, start.tx + 3, start.ty + 3], count: 3 }] })}>+ Add zone</button>
        </div>
      </Field>

      {/* NPC spawn tiles */}
      <Field label={`NPC Spawn Tiles (${spawns.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {spawns.map(([tx, ty], i) => (
            <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="number" style={numSm} value={tx} onChange={e => onUpdateConfig({ npcSpawnTiles: spawns.map((x, j) => j === i ? [Number(e.target.value), x[1]] : x) })} />
              <input type="number" style={numSm} value={ty} onChange={e => onUpdateConfig({ npcSpawnTiles: spawns.map((x, j) => j === i ? [x[0], Number(e.target.value)] : x) })} />
              <button style={xBtn} onClick={() => onUpdateConfig({ npcSpawnTiles: spawns.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button style={addBtn} onClick={() => onUpdateConfig({ npcSpawnTiles: [...spawns, [start.tx, start.ty]] })}>+ Add spawn tile</button>
        </div>
      </Field>

      {/* Pond tiles */}
      <PondEditor configData={configData} onUpdateConfig={onUpdateConfig} numSm={numSm} addBtn={addBtn} xBtn={xBtn} anchor={[start.tx, start.ty]} />
    </>
  )
}

function PondEditor({ configData, onUpdateConfig, numSm, addBtn, xBtn, anchor }: {
  configData: RawMapConfig
  onUpdateConfig: (patch: Partial<RawMapConfig>) => void
  numSm: React.CSSProperties
  addBtn: React.CSSProperties
  xBtn: React.CSSProperties
  anchor: [number, number]
}) {
  const ponds = configData.pondTiles ?? []
  const set = (next: typeof ponds) => onUpdateConfig({ pondTiles: next })
  return (
    <Field label={`Pond Tiles (${ponds.length})`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {ponds.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
            {p.rect ? (
              <>
                <span style={{ fontSize: 9, color: '#888' }}>rect</span>
                {[0, 1, 2, 3].map(k => (
                  <input key={k} type="number" style={numSm} value={p.rect![k]} onChange={e => { const rect = [...p.rect!]; rect[k] = Number(e.target.value); set(ponds.map((x, j) => j === i ? { rect } : x)) }} />
                ))}
              </>
            ) : (
              <>
                <span style={{ fontSize: 9, color: '#888' }}>tile</span>
                <input type="number" style={numSm} value={p.tile?.[0] ?? 0} onChange={e => set(ponds.map((x, j) => j === i ? { tile: [Number(e.target.value), p.tile?.[1] ?? 0] } : x))} />
                <input type="number" style={numSm} value={p.tile?.[1] ?? 0} onChange={e => set(ponds.map((x, j) => j === i ? { tile: [p.tile?.[0] ?? 0, Number(e.target.value)] } : x))} />
              </>
            )}
            <button style={{ ...xBtn, marginLeft: 'auto' }} onClick={() => set(ponds.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={addBtn} onClick={() => set([...ponds, { tile: [anchor[0], anchor[1]] }])}>+ Tile</button>
          <button style={addBtn} onClick={() => set([...ponds, { rect: [anchor[0], anchor[1], anchor[0] + 2, anchor[1] + 2] }])}>+ Rect</button>
        </div>
      </div>
    </Field>
  )
}

function MultiSelectPanel({
  entities, onDelete, onBatchZlayer, onBatchPathType, onSaveAsBundle,
}: {
  entities: SelectedEntity[]
  onDelete?: (e: SelectedEntity[]) => void
  onBatchZlayer?: (e: SelectedEntity[], z: Zlayer) => void
  onBatchPathType?: (e: SelectedEntity[], pt: string | undefined) => void
  onSaveAsBundle?: (bundleId: string) => Promise<void>
}) {
  const type = entities[0].type
  const decorTypes = ['exteriorDecor', 'interiorDecor', 'buildingLevelDecor', 'festivalDecor']
  const isDecor = decorTypes.includes(type)
  const isStreet = type === 'street'
  const [pathType, setPathType] = useState('')
  const [bundleId, setBundleId] = useState('')
  const [bundleSaveState, setBundleSaveState] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [bundleSaveError, setBundleSaveError] = useState('')

  const handleSaveAsBundle = async () => {
    if (!bundleId.trim() || !onSaveAsBundle) return
    setBundleSaveState('saving')
    setBundleSaveError('')
    try {
      await onSaveAsBundle(bundleId.trim())
      setBundleSaveState('ok')
      setTimeout(() => setBundleSaveState('idle'), 2000)
    } catch (e) {
      setBundleSaveState('error')
      setBundleSaveError(e instanceof Error ? e.message : String(e))
      setTimeout(() => setBundleSaveState('idle'), 4000)
    }
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ color: '#f0c040', fontWeight: 'bold', marginBottom: 8 }}>
        {entities.length} {type} selected
      </div>
      {isDecor && onBatchZlayer && (
        <Field label="Z-Layer (all)">
          <div style={{ display: 'flex', gap: 4 }}>
            {(['solid', 'below', 'above'] as Zlayer[]).map(z => (
              <button
                key={z}
                onClick={() => onBatchZlayer(entities, z)}
                style={{
                  padding: '3px 8px', fontSize: 11, cursor: 'pointer',
                  background: '#333', color: '#aaa', border: 'none', borderRadius: 3,
                }}
              >{z}</button>
            ))}
          </div>
        </Field>
      )}
      {isStreet && onBatchPathType && (
        <Field label="Path Type (all)">
          <select
            value={pathType}
            onChange={e => { setPathType(e.target.value); onBatchPathType(entities, e.target.value || undefined) }}
            style={{ width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }}
          >
            <option value="">— default —</option>
            {PATH_TILE_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
      )}
      {onSaveAsBundle && (
        <Field label="Save as Bundle">
          <input
            value={bundleId}
            onChange={e => setBundleId(e.target.value)}
            placeholder="bundle-id"
            style={{ width: '100%', padding: '3px 5px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11, boxSizing: 'border-box', fontFamily: 'monospace', marginBottom: 4 }}
          />
          {bundleSaveState === 'error' && (
            <div style={{ color: '#f66', fontSize: 10, marginBottom: 4 }}>{bundleSaveError}</div>
          )}
          <button
            onClick={handleSaveAsBundle}
            disabled={!bundleId.trim() || bundleSaveState === 'saving'}
            style={{
              width: '100%', padding: '5px 0', borderRadius: 3, fontSize: 11, cursor: bundleId.trim() ? 'pointer' : 'default',
              background: bundleSaveState === 'ok' ? '#1e4e1e' : '#1e2e4e',
              border: `1px solid ${bundleSaveState === 'ok' ? '#3a7a3a' : '#3a5a8e'}`,
              color: bundleSaveState === 'ok' ? '#8d8' : '#8af',
            }}
          >
            {bundleSaveState === 'saving' ? '…' : bundleSaveState === 'ok' ? '✓ Saved to bundles.json' : '⊞ Save as Bundle'}
          </button>
        </Field>
      )}
      {onDelete && (
        <button
          onClick={() => onDelete(entities)}
          style={{ width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922', color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12, marginTop: 4 }}
        >
          Delete all ({entities.length})
        </button>
      )}
    </div>
  )
}

function PondInspector({
  entry, onUpdate, onDelete, onConvertToStreet,
}: {
  entry: { rect?: number[]; tile?: number[] }
  onUpdate: (data: { rect?: number[]; tile?: number[] }) => void
  onDelete: () => void
  onConvertToStreet: () => void
}) {
  const r = entry.rect
  const t = entry.tile
  return (
    <div>
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
        onClick={onConvertToStreet}
        style={{ width: '100%', padding: '5px 0', background: '#1a2e3a', border: '1px solid #2a5a6a', color: '#6ad', cursor: 'pointer', borderRadius: 3, fontSize: 11, marginTop: 4 }}
      >
        Convert to Street
      </button>
      <button
        onClick={onDelete}
        style={{ width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922', color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12, marginTop: 4 }}
      >
        Delete Pond Entry
      </button>
    </div>
  )
}

function BridgeInspector({
  entry, onUpdate, onDelete,
}: {
  entry: { rect?: number[]; tile?: number[] }
  onUpdate: (data: { rect?: number[]; tile?: number[] }) => void
  onDelete: () => void
}) {
  const r = entry.rect
  const t = entry.tile
  return (
    <div>
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
        style={{ width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922', color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12, marginTop: 4 }}
      >
        Delete Bridge Entry
      </button>
    </div>
  )
}

function SpawnTileInspector({
  tile, onMove, onDelete,
}: {
  tile: [number, number]
  onMove: (tx: number, ty: number) => void
  onDelete: () => void
}) {
  return (
    <div>
      <Field label="Position">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: 11, color: '#888' }}>X</label>
          {numInput(tile[0], tx => onMove(tx, tile[1]))}
          <label style={{ fontSize: 11, color: '#888' }}>Y</label>
          {numInput(tile[1], ty => onMove(tile[0], ty))}
        </div>
      </Field>
      <button
        onClick={onDelete}
        style={{ width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922', color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12, marginTop: 4 }}
      >
        Delete Spawn Tile
      </button>
    </div>
  )
}

export function EntityInspector({
  selectedEntities, mapId, configData, activeInteriorId, activeBuildingIndex, activeLevel, viewMode,
  onSetActiveLevel, onUpdateBuilding, onResizeBuilding, onUpdateBuildingLevelVisual, onUpdateDecorMinLevel, onUpdateDecorHideAtLevel,
  onDelete, onMoveEntity, onZlayerChange, onUpdateGlow, onUpdatePickupGlow, onUpdatePickupExtraTiles, onDialogueChange,
  onOpenInterior, onCloseInterior, onOpenBuildingEditor, onCloseBuildingEditor, onUpdateStreetEntry,
  onResizeInterior, onAddInterior, onAddInteriorExit, onUpdateInteriorProps, onUpdateInteriorExit,
  onRemoveInteriorExit,
  questPickupItems,
  blockedPaths, onUpdateBlockedPath, onDeleteBlockedPath,
  onAddLockedDoor, onUpdateLockedDoor, onDeleteLockedDoor,
  onUpdateNpc, onUpdateAnimal,
  onUpdateTreasureTile, onUpdatePickupItemTile,
  onUpdateArea, onResizeMap, onUpdateMapProps, onPickLocation,
  onUpdateTreasure, onUpdateInteractable, onUpdateConfig,
  onAddTreasure, onAddInteractable, onAddBlockedPath,
  onDeleteEntities, onBatchUpdateZlayer, onBatchUpdateStreetPathType, onSaveAsBundle, onUpdateDecorTileId, onReorderDecor,
  onConvertDecorToInteractable,
  onConvertStreetToPond, onConvertPondToStreet,
  onUpdatePondEntry, onDeletePondTile,
  onUpdateBridgeEntry, onDeleteBridgeTile,
  onDeleteNpcSpawnTile,
}: Props) {
  // Existing sub-inspectors operate on a single entity; multi-select shows a
  // dedicated batch panel instead (handled below).
  const selectedEntity = selectedEntities[0] ?? null
  const [windowTilePickIndex, setWindowTilePickIndex] = useState<number | null>(null)
  // Reference options for the searchable id pickers in the inspectors.
  const buildingOpts = buildingRefOptions(mapId, configData.buildings ?? [])
  const allQuestOpts = allQuestOptions()
  const hubItemOpts = hubItemRefOptions()
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

  if (selectedEntities.length > 1) {
    const allExteriorDecor = selectedEntities.every(e => e.type === 'exteriorDecor')
    let saveAsBundleHandler: ((bundleId: string) => Promise<void>) | undefined
    if (allExteriorDecor && onSaveAsBundle) {
      const decorItems = selectedEntities
        .map(e => (configData.exteriorDecor ?? [])[e.index])
        .filter((d): d is RawDecorItem => !!d && !!d.tileId && !d.bundleID)
      if (decorItems.length > 0) {
        const txValues = decorItems.map(d => d.tx ?? 0)
        const tyValues = decorItems.map(d => d.ty ?? 0)
        const minTx = Math.min(...txValues)
        const maxTy = Math.max(...tyValues)
        const tiles: BundleTileRaw[] = decorItems.map(d => ({
          tileID: d.tileId!,
          x: (d.tx ?? 0) - minTx,
          y: maxTy - (d.ty ?? 0),
          ...(d.zlayer ? { zlayer: d.zlayer } : {}),
          ...(d.glow !== undefined ? { glow: d.glow } : {}),
          ...(d.glowRadius !== undefined ? { glowRadius: d.glowRadius } : {}),
          ...(d.pulse !== undefined ? { pulse: d.pulse } : {}),
        }))
        saveAsBundleHandler = (bundleId: string) => onSaveAsBundle(bundleId, tiles)
      }
    }
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Inspector</div>
        <div style={bodyStyle}>
          <MultiSelectPanel
            entities={selectedEntities}
            onDelete={onDeleteEntities}
            onBatchZlayer={onBatchUpdateZlayer}
            onBatchPathType={onBatchUpdateStreetPathType}
            onSaveAsBundle={saveAsBundleHandler}
          />
        </div>
      </div>
    )
  }

  // Entity types with their own dedicated inspector panel below — selecting one
  // of these inside an interior should reach that panel instead of the interior
  // overview (InteriorInspector) that would otherwise swallow the selection.
  const hasOwnInspectorPanel = selectedEntity?.type === 'treasure'
    || selectedEntity?.type === 'pickupItem'
    || selectedEntity?.type === 'animal'
    || selectedEntity?.type === 'npc'
    || selectedEntity?.type === 'interactable'

  if (viewMode === 'building' && activeBuildingIndex != null) {
    const b = (configData.buildings ?? [])[activeBuildingIndex]
    const levelMax = b ? buildingMaxLevel(b) : 5
    const sel = selectedEntity

    const closeBtn = (
      <button
        onClick={onCloseBuildingEditor}
        style={{ padding: '3px 8px', background: '#2a1a1a', border: '1px solid #6a3a3a', color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 11 }}
      >
        Close
      </button>
    )

    const levelSlider = b ? (
      <Field label="Level preview">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="range" min={0} max={levelMax} value={activeLevel}
            onChange={e => onSetActiveLevel(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 11, color: '#aaa', minWidth: 12 }}>{activeLevel}</span>
        </div>
        <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>
          {activeLevel === 0 ? 'Base (no upgrade)' : `Upgrade level ${activeLevel}`} — placed tiles tagged accordingly
        </div>
      </Field>
    ) : null

    let body: React.ReactNode = <div style={{ color: '#555', fontSize: 11 }}>No entity selected.</div>

    if (sel?.type === 'buildingDecor' && b?.decor?.[sel.index]) {
      const item = b.decor[sel.index]
      body = (
        <DecorInspector
          item={item}
          entity={sel}
          onMove={(tx, ty) => onMoveEntity(sel, tx, ty)}
          onZlayer={z => onZlayerChange(sel, z)}
          onGlow={onUpdateGlow ? patch => onUpdateGlow(sel, patch) : undefined}
          onMinLevel={v => onUpdateDecorMinLevel(sel, v)}
          onHideAtLevel={v => onUpdateDecorHideAtLevel(sel, v)}
          onTileChange={onUpdateDecorTileId ? (tid: string) => onUpdateDecorTileId(sel, tid) : undefined}
          onReorder={onReorderDecor ? dir => onReorderDecor(sel, dir) : undefined}
          listLength={b?.decor?.length}
          onDelete={() => onDelete(sel)}
        />
      )
    } else if (sel?.type === 'buildingLevelDecor' && b?.levelDecor?.[sel.index]) {
      const item = b.levelDecor[sel.index]
      body = (
        <DecorInspector
          item={item}
          entity={sel}
          onMove={(tx, ty) => onMoveEntity(sel, tx, ty)}
          onZlayer={z => onZlayerChange(sel, z)}
          onGlow={onUpdateGlow ? patch => onUpdateGlow(sel, patch) : undefined}
          onMinLevel={v => onUpdateDecorMinLevel(sel, v)}
          onHideAtLevel={v => onUpdateDecorHideAtLevel(sel, v)}
          onTileChange={onUpdateDecorTileId ? (tid: string) => onUpdateDecorTileId(sel, tid) : undefined}
          onReorder={onReorderDecor ? dir => onReorderDecor(sel, dir) : undefined}
          listLength={b?.levelDecor?.length}
          onDelete={() => onDelete(sel)}
        />
      )
    } else if (sel?.type === 'buildingWindow' && b?.windows?.[sel.index]) {
      const w = b.windows[sel.index]
      const allRects = (b.rects ?? (b.rect ? [b.rect] : [])) as [number, number, number, number][]
      const ox = Math.min(...allRects.map(r => r[0]))
      const oy = Math.max(...allRects.map(r => r[3]))
      const absTx = ox + w.tx
      const absTy = oy + w.ty + 1
      const pickingWindowTile = windowTilePickIndex === sel.index
      body = (
        <div>
          <Field label="Tile">
            <div onClick={() => setWindowTilePickIndex(pickingWindowTile ? null : sel.index)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }} title="Click to change tile">
              <TilePreview tileId={w.tileId} /><span style={{ fontSize: 10, color: '#666' }}>✎</span>
            </div>
            {pickingWindowTile && (
              <TilePicker
                current={w.tileId}
                onChange={tileId => onUpdateBuilding(activeBuildingIndex, { windows: (b.windows ?? []).map((x, i) => i === sel.index ? { ...x, tileId } : x) })}
                onClose={() => setWindowTilePickIndex(null)}
              />
            )}
          </Field>
          <Field label="Position">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: '#888' }}>X</label>
              {numInput(absTx, tx => onMoveEntity(sel, tx, absTy))}
              <label style={{ fontSize: 11, color: '#888' }}>Y</label>
              {numInput(absTy, ty => onMoveEntity(sel, absTx, ty))}
            </div>
          </Field>
          <button
            onClick={() => onDelete(sel)}
            style={{ width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922', color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12, marginTop: 6 }}
          >
            Delete Window
          </button>
        </div>
      )
    } else if (sel?.type === 'buildingDoor' && b?.doors?.[sel.index]) {
      const d = b.doors[sel.index]
      const allRects = (b.rects ?? (b.rect ? [b.rect] : [])) as [number, number, number, number][]
      const ox = Math.min(...allRects.map(r => r[0]))
      const oy = Math.max(...allRects.map(r => r[3]))
      const absTx = ox + d.tx
      const absTy = oy + d.ty
      body = (
        <div>
          <Field label="Position">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: '#888' }}>X</label>
              {numInput(absTx, tx => onMoveEntity(sel, tx, absTy))}
              <label style={{ fontSize: 11, color: '#888' }}>Y</label>
              {numInput(absTy, ty => onMoveEntity(sel, absTx, ty))}
            </div>
            <div style={{ color: '#666', fontSize: 9, marginTop: 2 }}>
              (X, Y) is where the player walks in. The door sprite (if shown) always renders one tile north of it.
            </div>
          </Field>
          <Field label="Links to interior (optional)">
            <EntityRefPicker
              value={d.buildingId ?? ''}
              options={buildingOpts}
              placeholder="Search buildings…"
              onChange={v => onUpdateBuilding(activeBuildingIndex, { doors: (b.doors ?? []).map((x, i) => i === sel.index ? { ...x, buildingId: v || undefined } : x) })}
            />
          </Field>
          <Field label="Appearance">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
              <input
                type="checkbox"
                checked={!d.hideSprite}
                onChange={e => onUpdateBuilding(activeBuildingIndex, { doors: (b.doors ?? []).map((x, i) => i === sel.index ? { ...x, hideSprite: e.target.checked ? undefined : true } : x) })}
              />
              Show door sprite
            </label>
            {!d.hideSprite && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={!d.hideSign}
                  onChange={e => onUpdateBuilding(activeBuildingIndex, { doors: (b.doors ?? []).map((x, i) => i === sel.index ? { ...x, hideSign: e.target.checked ? undefined : true } : x) })}
                />
                Show door sign
              </label>
            )}
          </Field>
          <button
            onClick={() => onDelete(sel)}
            style={{ width: '100%', padding: '6px 0', background: '#5a1a1a', border: '1px solid #922', color: '#f88', cursor: 'pointer', borderRadius: 3, fontSize: 12, marginTop: 6 }}
          >
            Delete Door
          </button>
        </div>
      )
    }

    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span>Building: {b?.id ?? `#${activeBuildingIndex}`}</span>
          {closeBtn}
        </div>
        <div style={bodyStyle}>
          <div style={{ color: '#777', fontSize: 10, marginBottom: 8 }}>
            Select tool to select/delete items. Place tool + tile to add decor, or no tile selected to toggle a door (any tile — shows a sprite one tile north by default; toggle it off in the door's inspector for a hidden trigger, marked with 🚪). Window tool + tile places a window.
          </div>
          {levelSlider}
          {b && (
            <Field label={`Doors (${(b.doors ?? []).length})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {(b.doors ?? []).map((d, i) => {
                  const doorRects = (b.rects ?? (b.rect ? [b.rect] : [])) as [number, number, number, number][]
                  const doorOx = Math.min(...doorRects.map(r => r[0]))
                  const doorOy = Math.max(...doorRects.map(r => r[3]))
                  const doorAbsTx = doorOx + d.tx
                  const doorAbsTy = doorOy + d.ty
                  const isThisSel = sel?.type === 'buildingDoor' && sel.index === i
                  return (
                    <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', background: isThisSel ? '#2a2410' : '#16161e', border: isThisSel ? '1px solid #f0c040' : '1px solid #2a2a3a', borderRadius: 3, padding: 4 }}>
                      <label style={{ fontSize: 9, color: '#888' }}>X</label>
                      <input type="number" style={{ width: 44, padding: '2px 4px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }} value={doorAbsTx} onChange={e => {
                        const doors = (b.doors ?? []).map((x, j) => j === i ? { ...x, tx: Number(e.target.value) - doorOx } : x)
                        onUpdateBuilding(activeBuildingIndex, { doors })
                      }} />
                      <label style={{ fontSize: 9, color: '#888' }}>Y</label>
                      <input type="number" style={{ width: 44, padding: '2px 4px', background: '#111', border: '1px solid #444', color: '#eee', borderRadius: 3, fontSize: 11 }} value={doorAbsTy} onChange={e => {
                        const doors = (b.doors ?? []).map((x, j) => j === i ? { ...x, ty: Number(e.target.value) - doorOy } : x)
                        onUpdateBuilding(activeBuildingIndex, { doors })
                      }} />
                      {d.buildingId && <span style={{ fontSize: 9, color: '#666', marginLeft: 4 }}>→ {d.buildingId}</span>}
                      <button
                        style={{ marginLeft: 'auto', padding: '1px 5px', background: '#4a1a1a', border: '1px solid #922', color: '#f88', borderRadius: 3, fontSize: 10, cursor: 'pointer' }}
                        onClick={() => onUpdateBuilding(activeBuildingIndex, { doors: (b.doors ?? []).filter((_, j) => j !== i) })}
                      >✕</button>
                    </div>
                  )
                })}
                {(b.doors ?? []).length === 0 && <div style={{ color: '#666', fontSize: 10 }}>No doors yet.</div>}
              </div>
            </Field>
          )}
          {body}
        </div>
      </div>
    )
  }

  if (viewMode === 'interior' && activeInteriorId && !hasOwnInspectorPanel) {
    const interior = configData.interiors?.[activeInteriorId]
    // Resolve the owning building so the level stepper matches what's reachable in-game.
    const ownerBuilding = (configData.buildings ?? []).find(b => {
      if (!b.id) return false
      if (activeInteriorId === b.id || activeInteriorId.startsWith(b.id)) return true
      return (b.doors ?? []).some(d => d.buildingId === activeInteriorId)
    })
    const levelMax = ownerBuilding ? buildingMaxLevel(ownerBuilding) : 3
    return (
      <InteriorInspector
        key={activeInteriorId}
        interiorId={activeInteriorId}
        interior={interior}
        selectedEntity={selectedEntity}
        allInteriors={configData.interiors ?? {}}
        activeLevel={activeLevel}
        levelMax={levelMax}
        onSetActiveLevel={onSetActiveLevel}
        onUpdateDecorMinLevel={onUpdateDecorMinLevel}
        onUpdateDecorHideAtLevel={onUpdateDecorHideAtLevel}
        panelStyle={panelStyle}
        headerStyle={headerStyle}
        bodyStyle={bodyStyle}
        onCloseInterior={onCloseInterior}
        onOpenInterior={onOpenInterior}
        onResizeInterior={onResizeInterior}
        onAddInteriorExit={onAddInteriorExit}
        onUpdateInteriorProps={onUpdateInteriorProps}
        onUpdateInteriorExit={onUpdateInteriorExit}
        onRemoveInteriorExit={onRemoveInteriorExit}
        onMoveEntity={onMoveEntity}
        onZlayerChange={onZlayerChange}
        onDelete={onDelete}
        onReorderInteriorDecor={onReorderDecor}
        onUpdateDecorTileId={onUpdateDecorTileId}
      />
    )
  }

  if (!selectedEntity) {
    const addBtn: React.CSSProperties = {
      flex: 1, padding: '5px 6px', background: '#1e2a4e', border: '1px solid #3a4a8e',
      color: '#8af', borderRadius: 3, fontSize: 11, cursor: 'pointer',
    }
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Town</div>
        <div style={bodyStyle}>
          {(onAddTreasure || onAddInteractable || onAddBlockedPath) && (
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #333' }}>
              <div style={{ color: '#888', fontSize: 10, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Create object</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {onAddTreasure && <button style={addBtn} onClick={onAddTreasure}>+ Add Treasure</button>}
                {onAddInteractable && <button style={addBtn} onClick={onAddInteractable}>+ Add Interactable</button>}
                {onAddBlockedPath && <button style={addBtn} onClick={onAddBlockedPath}>+ Add Road Block</button>}
              </div>
            </div>
          )}
          {onResizeMap && onUpdateMapProps ? (
            <TownInspector
              configData={configData}
              onResizeMap={onResizeMap}
              onUpdateMapProps={onUpdateMapProps}
              onUpdateConfig={onUpdateConfig}
              onPickLocation={onPickLocation}
            />
          ) : (
            <div style={{ color: '#555', fontSize: 11, marginTop: 20, textAlign: 'center' }}>
              Click an entity to inspect it.
            </div>
          )}
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
            onGlow={onUpdateGlow ? patch => onUpdateGlow(selectedEntity, patch) : undefined}
            onDelete={() => onDelete(selectedEntity)}
            onTileChange={onUpdateDecorTileId ? tileId => onUpdateDecorTileId(selectedEntity, tileId) : undefined}
            onReorder={onReorderDecor ? dir => onReorderDecor(selectedEntity, dir) : undefined}
            listLength={items.length}
            onConvertToInteractable={onConvertDecorToInteractable ? () => onConvertDecorToInteractable(selectedEntity) : undefined}
          />
        </div>
      </div>
    )
  }

  if (selectedEntity.type === 'buildingLevelDecor') {
    const building = (configData.buildings ?? [])[selectedEntity.buildingIndex]
    const item = building?.levelDecor?.[selectedEntity.index]
    if (!item) return null
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Level Decor — {building?.id ?? `#${selectedEntity.buildingIndex}`}</div>
        <div style={bodyStyle}>
          <DecorInspector
            item={item}
            entity={selectedEntity}
            maxLevel={building ? buildingMaxLevel(building) : undefined}
            onMinLevel={ml => onUpdateDecorMinLevel(selectedEntity, ml)}
            onHideAtLevel={hl => onUpdateDecorHideAtLevel(selectedEntity, hl)}
            onMove={(tx, ty) => onMoveEntity(selectedEntity, tx, ty)}
            onZlayer={z => onZlayerChange(selectedEntity, z)}
            onGlow={onUpdateGlow ? patch => onUpdateGlow(selectedEntity, patch) : undefined}
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
            buildingIds={(configData.buildings ?? []).map(b => b.id).filter((id): id is string => !!id)}
            onMove={(tx, ty) => onMoveEntity(selectedEntity, tx, ty)}
            onDelete={() => onDelete(selectedEntity)}
            onDialogueChange={d => onDialogueChange(selectedEntity.index, d)}
            onUpdate={partial => onUpdateNpc(selectedEntity.index, partial)}
            onPickLocation={onPickLocation ? () => onPickLocation('npc', selectedEntity.index) : undefined}
          />
        </div>
      </div>
    )
  }

  if (selectedEntity.type === 'animal') {
    const animal = (configData.animals ?? [])[selectedEntity.index]
    if (!animal) return null
    return (
      <div style={panelStyle}>
        <div style={{ ...headerStyle, color: '#88ffaa' }}>Animal</div>
        <div style={bodyStyle}>
          <AnimalInspector
            animal={animal}
            onMove={(tx, ty) => onMoveEntity(selectedEntity, tx, ty)}
            onDelete={() => onDelete(selectedEntity)}
            onUpdate={partial => onUpdateAnimal(selectedEntity.index, partial)}
            onPickLocation={onPickLocation ? () => onPickLocation('animal', selectedEntity.index) : undefined}
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
          {onUpdateTreasure ? (
            <TreasureInspector
              treasure={t}
              buildingOptions={buildingOpts}
              onUpdate={patch => onUpdateTreasure(selectedEntity.index, patch)}
              onMove={(tx, ty) => onMoveEntity(selectedEntity, tx, ty)}
              onDelete={() => onDelete(selectedEntity)}
              onPick={onPickLocation ? () => onPickLocation('treasure', selectedEntity.index) : undefined}
            />
          ) : (
            <QuestItemInspector
              label="Treasure" id={t.id} tileId={t.tileId} tx={t.tx} ty={t.ty}
              onMove={(tx, ty) => onMoveEntity(selectedEntity, tx, ty)}
              onDelete={() => onDelete(selectedEntity)}
              onTileChange={onUpdateTreasureTile ? tileId => onUpdateTreasureTile(selectedEntity.index, tileId) : undefined}
            />
          )}
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
            onTileChange={onUpdatePickupItemTile ? tileId => onUpdatePickupItemTile(selectedEntity.index, tileId) : undefined}
          />
          {onUpdatePickupGlow && (
            <GlowControls
              glow={p.glow} glowRadius={p.glowRadius} pulse={p.pulse}
              onChange={patch => onUpdatePickupGlow(selectedEntity.index, patch)}
            />
          )}
          {onUpdatePickupExtraTiles && (
            <ExtraTilesEditor
              tiles={p.extraTiles ?? []}
              onChange={tiles => onUpdatePickupExtraTiles(selectedEntity.index, tiles)}
            />
          )}
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
            onConvertToPond={onConvertStreetToPond ? () => onConvertStreetToPond(selectedEntity.index) : undefined}
          />
        </div>
      </div>
    )
  }

  if (selectedEntity.type === 'pondTile') {
    const entry = (configData.pondTiles ?? [])[selectedEntity.index]
    if (!entry) return null
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Pond Tile #{selectedEntity.index}</div>
        <div style={bodyStyle}>
          <PondInspector
            entry={entry}
            onUpdate={data => onUpdatePondEntry?.(selectedEntity.index, data)}
            onDelete={() => onDeletePondTile?.(selectedEntity.index)}
            onConvertToStreet={() => onConvertPondToStreet?.(selectedEntity.index)}
          />
        </div>
      </div>
    )
  }

  if (selectedEntity.type === 'bridgeTile') {
    const entry = (configData.bridgeTiles ?? [])[selectedEntity.index]
    if (!entry) return null
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Bridge Tile #{selectedEntity.index}</div>
        <div style={bodyStyle}>
          <BridgeInspector
            entry={entry}
            onUpdate={data => onUpdateBridgeEntry?.(selectedEntity.index, data)}
            onDelete={() => onDeleteBridgeTile?.(selectedEntity.index)}
          />
        </div>
      </div>
    )
  }

  if (selectedEntity.type === 'npcSpawnTile') {
    const tile = (configData.npcSpawnTiles ?? [])[selectedEntity.index]
    if (!tile) return null
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Spawn Tile #{selectedEntity.index}</div>
        <div style={bodyStyle}>
          <SpawnTileInspector
            tile={tile as [number, number]}
            onMove={(tx, ty) => onMoveEntity(selectedEntity, tx, ty)}
            onDelete={() => onDeleteNpcSpawnTile?.(selectedEntity.index)}
          />
        </div>
      </div>
    )
  }

  if (selectedEntity.type === 'building') {
    const buildings = configData.buildings ?? []
    const building = buildings[selectedEntity.index]
    if (!building) return null

    const buildingId = building.id
    const interiorIds: string[] = buildingId
      ? Object.keys(configData.interiors ?? {}).filter(id => {
          const doors = building.doors ?? []
          return doors.some(d => d.buildingId === id) || id.startsWith(buildingId)
        })
      : []
    const existingLock = buildingId ? (configData.lockedDoors ?? []).find(d => d.buildingId === buildingId) : undefined

    return (
      <div style={panelStyle}>
        <div style={headerStyle}>Building</div>
        <div style={bodyStyle}>
          <BuildingInspector
            building={building}
            buildingIndex={selectedEntity.index}
            activeLevel={activeLevel}
            onSetActiveLevel={onSetActiveLevel}
            onUpdateBuilding={onUpdateBuilding}
            onUpdateBuildingLevelVisual={onUpdateBuildingLevelVisual}
            onOpenInterior={onOpenInterior}
            onOpenBuildingEditor={onOpenBuildingEditor}
            interiorIds={interiorIds}
            existingInteriorIds={Object.keys(configData.interiors ?? {})}
            onAddInterior={onAddInterior}
            onResizeBuilding={onResizeBuilding}
          />
          {buildingId && !existingLock && (
            <div style={{ borderTop: '1px solid #333', marginTop: 10, paddingTop: 10 }}>
              <button
                onClick={() => onAddLockedDoor({ buildingId, lockedBy: '' })}
                style={{ padding: '4px 10px', background: '#2a1e0e', border: '1px solid #7a5a0a', color: '#ffaa44', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}
              >🔒 Add locked door</button>
            </div>
          )}
          {existingLock && (
            <div style={{ borderTop: '1px solid #333', marginTop: 10, paddingTop: 10 }}>
              <div style={{ color: '#ffaa00', fontSize: 11, marginBottom: 6 }}>🔒 Locked door</div>
              <LockedDoorInspector
                door={existingLock}
                onUpdate={patch => onUpdateLockedDoor((configData.lockedDoors ?? []).indexOf(existingLock), patch)}
                onDelete={() => onDeleteLockedDoor((configData.lockedDoors ?? []).indexOf(existingLock))}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  if (selectedEntity.type === 'blockedPath') {
    const bp = blockedPaths[selectedEntity.index]
    if (!bp) return null
    return (
      <div style={panelStyle}>
        <div style={{ ...headerStyle, color: '#ff9977' }}>Blocked Path</div>
        <div style={bodyStyle}>
          <BlockedPathInspector
            key={bp.id}
            bp={bp}
            questOptions={allQuestOpts}
            onUpdate={patch => onUpdateBlockedPath(selectedEntity.index, patch)}
            onDelete={() => onDeleteBlockedPath(selectedEntity.index)}
            onPick={onPickLocation ? () => onPickLocation('blockedTile', selectedEntity.index) : undefined}
          />
        </div>
      </div>
    )
  }

  if (selectedEntity.type === 'lockedDoor') {
    const door = (configData.lockedDoors ?? [])[selectedEntity.index]
    if (!door) return null
    return (
      <div style={panelStyle}>
        <div style={{ ...headerStyle, color: '#ffaa00' }}>🔒 Locked Door</div>
        <div style={bodyStyle}>
          <LockedDoorInspector
            key={door.buildingId}
            door={door}
            onUpdate={patch => onUpdateLockedDoor(selectedEntity.index, patch)}
            onDelete={() => onDeleteLockedDoor(selectedEntity.index)}
          />
        </div>
      </div>
    )
  }

  if (selectedEntity.type === 'area') {
    const area = (configData.areas ?? [])[selectedEntity.index]
    if (!area) return null
    return (
      <div style={panelStyle}>
        <div style={{ ...headerStyle, color: '#aa66ff' }}>Area</div>
        <div style={bodyStyle}>
          <AreaInspector
            area={area}
            onMove={(tx, ty) => onMoveEntity(selectedEntity, tx, ty)}
            onUpdate={patch => onUpdateArea?.(selectedEntity.index, patch)}
          />
        </div>
      </div>
    )
  }

  if (selectedEntity.type === 'interactable') {
    const it = (configData.interactables ?? [])[selectedEntity.index]
    if (!it || !onUpdateInteractable) return null
    return (
      <div style={panelStyle}>
        <div style={{ ...headerStyle, color: '#33ccee' }}>Interactable</div>
        <div style={bodyStyle}>
          <InteractableInspector
            it={it}
            buildingOptions={buildingOpts}
            questOptions={allQuestOpts}
            hubItemOptions={hubItemOpts}
            onUpdate={patch => onUpdateInteractable(selectedEntity.index, patch)}
            onMove={(tx, ty) => onMoveEntity(selectedEntity, tx, ty)}
            onDelete={() => onDelete(selectedEntity)}
            onPick={onPickLocation ? () => onPickLocation('interactable', selectedEntity.index) : undefined}
          />
        </div>
      </div>
    )
  }

  return null
}
