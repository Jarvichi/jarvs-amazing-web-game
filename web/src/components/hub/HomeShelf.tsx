import React, { useEffect, useRef, useState } from 'react'
import { UselessItem, loadInventory } from '../../game/dailyLogin'
import { loadEarnedRelics, getRelicDef, RelicDef } from '../../game/relics'
import { OverlayScreen } from '../ui/OverlayScreen'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { Panel } from '../ui/Panel'
import { HomeGrid } from './home-shelf/HomeGrid'
import { FurniturePicker } from './home-shelf/FurniturePicker'
import { PieceActionBar } from './home-shelf/PieceActionBar'
import {
  PlacedFurniture, loadHomeLayout, placeFurniture, moveFurniture, removeFurniture,
} from '../../game/hub/homeLayout'
import {
  FurnitureDef, getFurnitureDef, getAllFurnitureDefs, getOwnedFurnitureIds, grantFurniture,
} from '../../game/hub/furniture'
import {
  RoomSlotDef, getAllRoomSlotDefs, getRoomSlotDef, getPurchasedSlotIds, purchaseRoomSlot,
} from '../../game/hub/houseRooms'
import { RoomStyle, getRoomStyle, setRoomFloor, setRoomWall } from '../../game/hub/roomStyle'
import { isShelfDecorId, shelfItemDisplayId, shelfRelicDisplayId } from '../../game/hub/shelfDecor'
import { loadCrystals, saveCrystals } from '../../game/collection'
import { FLOOR_TILES } from '../../data/tiles/floorTiles'
import { BASE_CHIP_TILES } from '../../data/tiles/baseChipIndex'
import { WALL_TILES, WallMaterial } from '../../data/tiles/buildingMaterials'
import { TileStylePicker, TileStyleOption } from './home-shelf/TileStylePicker'

interface Props {
  onBack: () => void
  /** The MAIN room's key for the owned house being edited — opaque, e.g.
   *  `${town}:${mainBuildingId}` (never a sub-room id, even if the player
   *  opened this from inside one — HubWorld.tsx resolves that). Falls back
   *  to a shared 'default' bucket when no specific house is known (e.g.
   *  Ravenwatch's Steward Maren, a SHELF-only entry point). A purchased
   *  room slot's own furniture layout lives at `${houseKey}-${slotId}`,
   *  selected via the DECORATE tab's room picker. */
  houseKey?: string
  /** Which tab to open on — defaults to 'shelf' (e.g. Ravenwatch's Steward Maren).
   *  The in-house 🛋 DECORATE button passes 'decorate' to skip straight past SHELF. */
  initialTab?: 'shelf' | 'decorate' | 'rooms'
}

type ShelfEntry =
  | { kind: 'item';  item: UselessItem }
  | { kind: 'relic'; relic: RelicDef }

const SLOTS_PER_ROW = 6

/** Pads a list of entries to a full number of rows, filling the remainder with empty slots. */
function buildRows(entries: ShelfEntry[], minRows = 0): Array<Array<ShelfEntry | null>> {
  const minSlots = Math.max(SLOTS_PER_ROW * minRows, Math.ceil(entries.length / SLOTS_PER_ROW) * SLOTS_PER_ROW)
  const slots: Array<ShelfEntry | null> = [
    ...entries,
    ...Array(minSlots - entries.length).fill(null),
  ]
  const rows: Array<Array<ShelfEntry | null>> = []
  for (let i = 0; i < slots.length; i += SLOTS_PER_ROW)
    rows.push(slots.slice(i, i + SLOTS_PER_ROW))
  return rows
}

const ROTATION_ORDER = [0, 90, 180, 270] as const
function nextRotation(r: 0 | 90 | 180 | 270): 0 | 90 | 180 | 270 {
  return ROTATION_ORDER[(ROTATION_ORDER.indexOf(r) + 1) % ROTATION_ORDER.length]
}

/** "darkStoneFloor" -> "Dark Stone Floor" */
function humanizeCamelCase(id: string): string {
  const spaced = id.replace(/([a-z])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** A shelf item/relic reused as a placeable — always "owned" (it's already on
 *  the shelf) and always a plain 1x1, so it fits FurnitureDef/FurniturePicker
 *  as-is without any special-casing in the picker or grid components. */
function shelfPlaceableDef(id: string, name: string, icon: string): FurnitureDef {
  return { id, name, icon, desc: '', footprint: { w: 1, h: 1 }, price: 0 }
}

const CHIP_TILES = BASE_CHIP_TILES as Record<string, number>
const WALL_MATERIALS = Object.keys(WALL_TILES) as WallMaterial[]
const FLOOR_OPTIONS: TileStyleOption[] = FLOOR_TILES.map(id => ({
  key: id, tileNumericId: CHIP_TILES[id], label: humanizeCamelCase(id),
}))
const WALL_OPTIONS: TileStyleOption[] = WALL_MATERIALS.map(m => ({
  key: m, tileNumericId: WALL_TILES[m].middleTop, label: humanizeCamelCase(m),
}))

const REMOVE_ARM_MS = 2500
const STYLE_PRICE = 150

type PendingStyleBuy = { kind: 'floor'; tileId: string } | { kind: 'wall'; material: WallMaterial }

export function HomeShelf({ onBack, houseKey = 'default', initialTab = 'shelf' }: Props) {
  const [tab, setTab] = useState<'shelf' | 'decorate' | 'rooms'>(initialTab)
  // DECORATE (like ROOMS) only makes sense tied to a real owned house — a
  // stray 'decorate' tab with no house context would edit an orphaned
  // 'default' bucket that isn't shown anywhere in the world.
  const effectiveTab = tab === 'decorate' && houseKey === 'default' ? 'shelf' : tab

  // ── Shelf tab (existing, unchanged) ──
  const items  = loadInventory()
  const relics = loadEarnedRelics()
    .map(name => getRelicDef(name))
    .filter((r): r is RelicDef => !!r)

  const relicEntries:    ShelfEntry[] = relics.map(r => ({ kind: 'relic' as const, relic: r }))
  const keepsakeEntries: ShelfEntry[] = items.filter(i => i.isKeepsake).map(i => ({ kind: 'item' as const, item: i }))
  const junkEntries:     ShelfEntry[] = items.filter(i => !i.isKeepsake).map(i => ({ kind: 'item' as const, item: i }))

  // Anything on the shelf (relics, keepsakes, odds & ends) can also be placed
  // in the DECORATE grid as a 1x1 display piece — already owned, nothing to buy.
  const shelfDecorDefs: FurnitureDef[] = [
    ...relics.map(r => shelfPlaceableDef(shelfRelicDisplayId(r.name), r.name, r.icon)),
    ...items.map(i => shelfPlaceableDef(shelfItemDisplayId(i.id), i.name, i.icon)),
  ]
  const shelfDecorIds = shelfDecorDefs.map(d => d.id)

  const isEmpty = relicEntries.length === 0 && keepsakeEntries.length === 0 && junkEntries.length === 0

  const sections: Array<{ label: string; rows: Array<Array<ShelfEntry | null>> }> = isEmpty
    ? [{ label: '', rows: buildRows([], 3) }]
    : [
        { label: 'RELICS',       rows: buildRows(relicEntries) },
        { label: 'KEEPSAKES',    rows: buildRows(keepsakeEntries) },
        { label: 'ODDS & ENDS',  rows: buildRows(junkEntries) },
      ].filter(s => s.rows.length > 0)

  const [detail, setDetail] = useState<ShelfEntry | null>(null)

  // ── Decorate tab ──
  // A purchased room slot's furniture is a fully independent layout, keyed
  // `${houseKey}-${slotId}` (matching the interior id HubTownCanvas.tsx
  // synthesizes for it) — 'main' (the sentinel for houseKey itself) plus one
  // entry per purchased slot. Switching rooms reloads `placed` for the newly
  // selected key; it doesn't refetch on every render, so handleSelectRoom is
  // the only place that changes which room's layout is being edited.
  const [selectedRoomId, setSelectedRoomId] = useState<string>('main')
  const roomHouseKey = selectedRoomId === 'main' ? houseKey : `${houseKey}-${selectedRoomId}`
  const [placed, setPlaced] = useState<PlacedFurniture[]>(() => loadHomeLayout(roomHouseKey))
  const [ownedIds, setOwnedIds] = useState<string[]>(() => getOwnedFurnitureIds())
  const [crystals, setCrystals] = useState(() => loadCrystals())
  const [armedItemId, setArmedItemId] = useState<string | null>(null)
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null)
  const [moveArmed, setMoveArmed] = useState(false)
  const [removeArmedId, setRemoveArmedId] = useState<string | null>(null)
  const [pendingBuy, setPendingBuy] = useState<FurnitureDef | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [decorateView, setDecorateView] = useState<'furniture' | 'style'>('furniture')
  const [roomStyle, setRoomStyleState] = useState<RoomStyle>(() => getRoomStyle(roomHouseKey))
  const [pendingStyleBuy, setPendingStyleBuy] = useState<PendingStyleBuy | null>(null)
  const removeArmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Rooms tab ──
  const [purchasedSlotIds, setPurchasedSlotIds] = useState<string[]>(() => getPurchasedSlotIds(houseKey))
  const [pendingRoomBuy, setPendingRoomBuy] = useState<RoomSlotDef | null>(null)

  function clearRemoveArm() {
    if (removeArmTimeoutRef.current) { clearTimeout(removeArmTimeoutRef.current); removeArmTimeoutRef.current = null }
    setRemoveArmedId(null)
  }

  // A remove request is disarmed whenever the selection changes, so "confirm"
  // state never leaks onto a different piece.
  useEffect(() => { clearRemoveArm() }, [selectedPieceId])
  useEffect(() => () => clearRemoveArm(), [])

  function showMessage(text: string) {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current)
    setMessage(text)
    messageTimeoutRef.current = setTimeout(() => { messageTimeoutRef.current = null; setMessage(null) }, 2200)
  }

  /** Resolves either a furniture.json catalog id or a shelf-decor id (see shelfDecor.ts). */
  function getPlaceableDef(itemId: string): FurnitureDef | undefined {
    return getFurnitureDef(itemId) ?? shelfDecorDefs.find(d => d.id === itemId)
  }

  const selectedPiece = selectedPieceId ? placed.find(p => p.id === selectedPieceId) ?? null : null
  const selectedDef = selectedPiece ? getPlaceableDef(selectedPiece.itemId) : null

  function handlePickFurniture(itemId: string) {
    setSelectedPieceId(null)
    setMoveArmed(false)
    if (isShelfDecorId(itemId) || ownedIds.includes(itemId)) {
      setArmedItemId(prev => (prev === itemId ? null : itemId))
      return
    }
    const def = getFurnitureDef(itemId)
    if (def) setPendingBuy(def)
  }

  function handleCancelBuy() {
    setPendingBuy(null)
  }

  function handleConfirmBuy() {
    if (!pendingBuy) return
    if (crystals < pendingBuy.price) {
      showMessage("That's more crystals than you have.")
      return
    }
    const next = crystals - pendingBuy.price
    saveCrystals(next)
    setCrystals(next)
    grantFurniture(pendingBuy.id)
    setOwnedIds(getOwnedFurnitureIds())
    setArmedItemId(pendingBuy.id)
    setPendingBuy(null)
  }

  function handlePickRoomSlot(slot: RoomSlotDef) {
    if (!purchasedSlotIds.includes(slot.id)) setPendingRoomBuy(slot)
  }

  function handleCancelRoomBuy() {
    setPendingRoomBuy(null)
  }

  function handleConfirmRoomBuy() {
    if (!pendingRoomBuy) return
    if (crystals < pendingRoomBuy.price) {
      showMessage("That's more crystals than you have.")
      return
    }
    const next = crystals - pendingRoomBuy.price
    saveCrystals(next)
    setCrystals(next)
    purchaseRoomSlot(houseKey, pendingRoomBuy.id)
    setPurchasedSlotIds(getPurchasedSlotIds(houseKey))
    setPendingRoomBuy(null)
  }

  function handleCellTap(x: number, y: number) {
    if (moveArmed && selectedPieceId) {
      if (moveFurniture(roomHouseKey, selectedPieceId, x, y)) {
        setPlaced(loadHomeLayout(roomHouseKey))
        setMoveArmed(false)
      } else {
        showMessage("That won't fit there.")
      }
      return
    }
    if (armedItemId) {
      const piece = placeFurniture(roomHouseKey, armedItemId, x, y)
      if (piece) {
        setPlaced(loadHomeLayout(roomHouseKey))
        setArmedItemId(null)
      } else {
        showMessage("That won't fit there.")
      }
    }
  }

  function handlePieceTap(id: string) {
    setArmedItemId(null)
    setSelectedPieceId(prev => (prev === id ? null : id))
    setMoveArmed(false)
  }

  function handleRotate() {
    if (!selectedPiece) return
    const rotation = nextRotation(selectedPiece.rotation)
    if (moveFurniture(roomHouseKey, selectedPiece.id, selectedPiece.x, selectedPiece.y, rotation)) {
      setPlaced(loadHomeLayout(roomHouseKey))
    } else {
      showMessage("Can't rotate — no room.")
    }
  }

  function handleMove() {
    setMoveArmed(true)
  }

  function handleRemove() {
    if (!selectedPieceId) return
    if (removeArmedId === selectedPieceId) {
      removeFurniture(roomHouseKey, selectedPieceId)
      setPlaced(loadHomeLayout(roomHouseKey))
      setSelectedPieceId(null)
      return
    }
    if (removeArmTimeoutRef.current) clearTimeout(removeArmTimeoutRef.current)
    setRemoveArmedId(selectedPieceId)
    removeArmTimeoutRef.current = setTimeout(() => {
      removeArmTimeoutRef.current = null
      setRemoveArmedId(null)
    }, REMOVE_ARM_MS)
  }

  function handleSelectRoom(roomId: string) {
    if (roomId === selectedRoomId) return
    setSelectedRoomId(roomId)
    const nextHouseKey = roomId === 'main' ? houseKey : `${houseKey}-${roomId}`
    setPlaced(loadHomeLayout(nextHouseKey))
    setRoomStyleState(getRoomStyle(nextHouseKey))
    setArmedItemId(null)
    setSelectedPieceId(null)
    setMoveArmed(false)
  }

  function handlePickFloor(tileId: string) {
    if (roomStyle.floorTileId !== tileId) setPendingStyleBuy({ kind: 'floor', tileId })
  }

  function handlePickWall(material: WallMaterial) {
    if (roomStyle.wallMaterial !== material) setPendingStyleBuy({ kind: 'wall', material })
  }

  function handleCancelStyleBuy() {
    setPendingStyleBuy(null)
  }

  function handleConfirmStyleBuy() {
    if (!pendingStyleBuy) return
    if (crystals < STYLE_PRICE) {
      showMessage("That's more crystals than you have.")
      setPendingStyleBuy(null)
      return
    }
    const next = crystals - STYLE_PRICE
    saveCrystals(next)
    setCrystals(next)
    if (pendingStyleBuy.kind === 'floor') setRoomFloor(roomHouseKey, pendingStyleBuy.tileId)
    else setRoomWall(roomHouseKey, pendingStyleBuy.material)
    setRoomStyleState(getRoomStyle(roomHouseKey))
    setPendingStyleBuy(null)
  }

  // While a piece is armed to move, hide it from the grid so its own cells
  // read as empty/tappable (matching moveFurniture's own self-exclusion).
  const displayedPlaced = moveArmed && selectedPieceId
    ? placed.filter(p => p.id !== selectedPieceId)
    : placed

  return (
    <OverlayScreen
      title="HOME"
      onBack={onBack}
      right={effectiveTab !== 'shelf' ? <span className="crystal-count">💎 {crystals.toLocaleString()}</span> : undefined}
    >
      <div className="hoa-tabs">
        <button className={`hoa-tab${effectiveTab === 'shelf' ? ' hoa-tab--active' : ''}`} onClick={() => setTab('shelf')}>SHELF</button>
        {houseKey !== 'default' && (
          <button className={`hoa-tab${effectiveTab === 'decorate' ? ' hoa-tab--active' : ''}`} onClick={() => setTab('decorate')}>DECORATE</button>
        )}
        {houseKey !== 'default' && (
          <button className={`hoa-tab${effectiveTab === 'rooms' ? ' hoa-tab--active' : ''}`} onClick={() => setTab('rooms')}>ROOMS</button>
        )}
      </div>

      {effectiveTab === 'shelf' && (
        <div className="shelf-room">
          {isEmpty && (
            <div className="shelf-empty-msg">Your shelves are bare. Collect items to fill them.</div>
          )}
          {sections.map((section, sectioni) => (
            <div key={sectioni}>
              {section.label && <div className="shelf-section-label">{section.label}</div>}
              {section.rows.map((row, ri) => (
                <div key={ri} className="shelf-row">
                  <div className="shelf-items">
                    {row.map((entry, si) => (
                      <button
                        key={si}
                        className={`shelf-slot${entry ? ' shelf-slot--filled' : ' shelf-slot--empty'}`}
                        onClick={() => entry && setDetail(entry)}
                        disabled={!entry}
                        aria-label={entry ? (entry.kind === 'item' ? entry.item.name : entry.relic.name) : 'Empty slot'}
                      >
                        {entry ? (
                          <>
                            <span className="shelf-slot-icon">
                              {entry.kind === 'item' ? entry.item.icon : entry.relic.icon}
                            </span>
                            <span className="shelf-slot-name">
                              {entry.kind === 'item' ? entry.item.name : entry.relic.name}
                            </span>
                          </>
                        ) : (
                          <span className="shelf-slot-dust" />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="shelf-plank" />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {effectiveTab === 'decorate' && (
        <div className="shelf-room">
          {houseKey !== 'default' && purchasedSlotIds.length > 0 && (
            <div className="hoa-tabs">
              <button
                className={`hoa-tab${selectedRoomId === 'main' ? ' hoa-tab--active' : ''}`}
                onClick={() => handleSelectRoom('main')}
              >
                Main Room
              </button>
              {purchasedSlotIds.map(id => {
                const slot = getRoomSlotDef(id)
                return slot && (
                  <button
                    key={id}
                    className={`hoa-tab${selectedRoomId === id ? ' hoa-tab--active' : ''}`}
                    onClick={() => handleSelectRoom(id)}
                  >
                    {slot.name}
                  </button>
                )
              })}
            </div>
          )}
          {houseKey !== 'default' && (
            <div className="hoa-tabs">
              <button
                className={`hoa-tab${decorateView === 'furniture' ? ' hoa-tab--active' : ''}`}
                onClick={() => setDecorateView('furniture')}
              >
                Furnish
              </button>
              <button
                className={`hoa-tab${decorateView === 'style' ? ' hoa-tab--active' : ''}`}
                onClick={() => setDecorateView('style')}
              >
                Style
              </button>
            </div>
          )}
          {message && <div className="home-decorate-msg">{message}</div>}

          {decorateView === 'furniture' ? (
            <>
              {armedItemId && !message && (
                <div className="home-decorate-hint">Tap an empty spot to place {getPlaceableDef(armedItemId)?.name ?? 'it'}.</div>
              )}
              {moveArmed && !message && (
                <div className="home-decorate-hint">Tap an empty spot to move it there.</div>
              )}

              <HomeGrid
                placed={displayedPlaced}
                getDef={getPlaceableDef}
                selectedId={selectedPieceId}
                tappable={!!armedItemId || moveArmed}
                onCellTap={handleCellTap}
                onPieceTap={handlePieceTap}
              />

              {selectedPiece && selectedDef && (
                <PieceActionBar
                  pieceName={selectedDef.name}
                  removeArmed={removeArmedId === selectedPiece.id}
                  onRotate={handleRotate}
                  onMove={handleMove}
                  onRemove={handleRemove}
                />
              )}

              <FurniturePicker
                defs={getAllFurnitureDefs()}
                ownedIds={ownedIds}
                armedId={armedItemId}
                onPick={handlePickFurniture}
              />

              {shelfDecorDefs.length > 0 && (
                <>
                  <div className="shelf-section-label">FROM THE SHELF</div>
                  <FurniturePicker
                    defs={shelfDecorDefs}
                    ownedIds={shelfDecorIds}
                    armedId={armedItemId}
                    onPick={handlePickFurniture}
                  />
                </>
              )}
            </>
          ) : (
            <>
              <div className="shelf-section-label">FLOOR</div>
              <TileStylePicker
                options={FLOOR_OPTIONS}
                selectedKey={roomStyle.floorTileId}
                price={STYLE_PRICE}
                onPick={handlePickFloor}
              />
              <div className="shelf-section-label">WALLS</div>
              <TileStylePicker
                options={WALL_OPTIONS}
                selectedKey={roomStyle.wallMaterial}
                price={STYLE_PRICE}
                onPick={id => handlePickWall(id as WallMaterial)}
              />
            </>
          )}
        </div>
      )}

      {effectiveTab === 'rooms' && (
        <div className="shelf-room">
          <div className="town-directory__list">
            {getAllRoomSlotDefs().map(slot => {
              const owned = purchasedSlotIds.includes(slot.id)
              return (
                <div key={slot.id} className="town-directory__row">
                  <div className="town-directory__info">
                    <span className="town-directory__name">{slot.name}</span>
                    {!owned && <span className="town-directory__place">💎 {slot.price.toLocaleString()}</span>}
                  </div>
                  <button
                    className="action-btn action-btn--gold town-upgrades__btn"
                    disabled={owned}
                    onClick={() => handlePickRoomSlot(slot)}
                  >
                    {owned ? 'Built' : `Buy · 💎 ${slot.price.toLocaleString()}`}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {detail && (
        <ModalBackdrop onClose={() => setDetail(null)} title={detail.kind === 'item' ? detail.item.name : detail.relic.name}>
          <Panel elevation="floating" className="shelf-modal">
            <div className="shelf-modal-icon">
              {detail.kind === 'item' ? detail.item.icon : detail.relic.icon}
            </div>
            <div className="shelf-modal-name">
              {detail.kind === 'item' ? detail.item.name : detail.relic.name}
            </div>
            {detail.kind === 'relic' && (
              <div className="shelf-modal-tag">RELIC</div>
            )}
            {detail.kind === 'item' && detail.item.id.startsWith('broken-relic-') && (
              <div className="shelf-modal-tag shelf-modal-tag--broken">BROKEN RELIC</div>
            )}
            <div className="shelf-modal-desc">
              {detail.kind === 'item' ? detail.item.desc : detail.relic.desc}
            </div>
            {detail.kind === 'item' && detail.item.lore && (
              <div className="shelf-modal-lore">"{detail.item.lore}"</div>
            )}
            {detail.kind === 'item' && detail.item.acquiredDate && (
              <div className="shelf-modal-date">Acquired: {detail.item.acquiredDate}</div>
            )}
            <button className="action-btn" onClick={() => setDetail(null)}>CLOSE</button>
          </Panel>
        </ModalBackdrop>
      )}

      {pendingBuy && (
        <div className="shop-confirm-backdrop" onClick={handleCancelBuy}>
          <div className="shop-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="shop-confirm-title">{pendingBuy.icon} {pendingBuy.name}</div>
            <div className="shop-confirm-body">
              Buy for {pendingBuy.price} 💎? You have {crystals.toLocaleString()} 💎.
            </div>
            <div className="shop-confirm-actions">
              <button className="action-btn" onClick={handleCancelBuy}>Cancel</button>
              <button
                className={`action-btn action-btn--gold shop-card-buy-btn${crystals < pendingBuy.price ? ' shop-card-buy-btn--poor' : ''}`}
                onClick={handleConfirmBuy}
              >
                Buy for {pendingBuy.price} 💎
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingRoomBuy && (
        <div className="shop-confirm-backdrop" onClick={handleCancelRoomBuy}>
          <div className="shop-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="shop-confirm-title">{pendingRoomBuy.name}</div>
            <div className="shop-confirm-body">
              Build for {pendingRoomBuy.price.toLocaleString()} 💎? You have {crystals.toLocaleString()} 💎.
            </div>
            <div className="shop-confirm-actions">
              <button className="action-btn" onClick={handleCancelRoomBuy}>Cancel</button>
              <button
                className={`action-btn action-btn--gold shop-card-buy-btn${crystals < pendingRoomBuy.price ? ' shop-card-buy-btn--poor' : ''}`}
                onClick={handleConfirmRoomBuy}
              >
                Build for {pendingRoomBuy.price.toLocaleString()} 💎
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingStyleBuy && (
        <div className="shop-confirm-backdrop" onClick={handleCancelStyleBuy}>
          <div className="shop-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="shop-confirm-title">
              {humanizeCamelCase(pendingStyleBuy.kind === 'floor' ? pendingStyleBuy.tileId : pendingStyleBuy.material)}
            </div>
            <div className="shop-confirm-body">
              Change {pendingStyleBuy.kind} for {STYLE_PRICE} 💎? You have {crystals.toLocaleString()} 💎.
            </div>
            <div className="shop-confirm-actions">
              <button className="action-btn" onClick={handleCancelStyleBuy}>Cancel</button>
              <button
                className={`action-btn action-btn--gold shop-card-buy-btn${crystals < STYLE_PRICE ? ' shop-card-buy-btn--poor' : ''}`}
                onClick={handleConfirmStyleBuy}
              >
                Change for {STYLE_PRICE} 💎
              </button>
            </div>
          </div>
        </div>
      )}
    </OverlayScreen>
  )
}
