import React, { useEffect, useRef, useState } from 'react'
import { UselessItem, loadInventory } from '../../game/dailyLogin'
import { loadEarnedRelics, getRelicDef, RelicDef } from '../../game/relics'
import { OverlayScreen } from '../ui/OverlayScreen'
import { HomeGrid } from './home-shelf/HomeGrid'
import { FurniturePicker } from './home-shelf/FurniturePicker'
import { PieceActionBar } from './home-shelf/PieceActionBar'
import {
  PlacedFurniture, loadHomeLayout, placeFurniture, moveFurniture, removeFurniture,
} from '../../game/hub/homeLayout'
import {
  FurnitureDef, getFurnitureDef, getAllFurnitureDefs, getOwnedFurnitureIds, grantFurniture,
} from '../../game/hub/furniture'
import { loadCrystals, saveCrystals } from '../../game/collection'

interface Props {
  onBack: () => void
  /** Which owned house's furniture layout to edit — opaque key (e.g. `${town}:${buildingId}`).
   *  Falls back to a shared 'default' bucket when no specific house is known. */
  houseKey?: string
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

const REMOVE_ARM_MS = 2500

export function HomeShelf({ onBack, houseKey = 'default' }: Props) {
  const [tab, setTab] = useState<'shelf' | 'decorate'>('shelf')

  // ── Shelf tab (existing, unchanged) ──
  const items  = loadInventory()
  const relics = loadEarnedRelics()
    .map(name => getRelicDef(name))
    .filter((r): r is RelicDef => !!r)

  const relicEntries:    ShelfEntry[] = relics.map(r => ({ kind: 'relic' as const, relic: r }))
  const keepsakeEntries: ShelfEntry[] = items.filter(i => i.isKeepsake).map(i => ({ kind: 'item' as const, item: i }))
  const junkEntries:     ShelfEntry[] = items.filter(i => !i.isKeepsake).map(i => ({ kind: 'item' as const, item: i }))

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
  const [placed, setPlaced] = useState<PlacedFurniture[]>(() => loadHomeLayout(houseKey))
  const [ownedIds, setOwnedIds] = useState<string[]>(() => getOwnedFurnitureIds())
  const [crystals, setCrystals] = useState(() => loadCrystals())
  const [armedItemId, setArmedItemId] = useState<string | null>(null)
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null)
  const [moveArmed, setMoveArmed] = useState(false)
  const [removeArmedId, setRemoveArmedId] = useState<string | null>(null)
  const [pendingBuy, setPendingBuy] = useState<FurnitureDef | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const removeArmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const selectedPiece = selectedPieceId ? placed.find(p => p.id === selectedPieceId) ?? null : null
  const selectedDef = selectedPiece ? getFurnitureDef(selectedPiece.itemId) : null

  function handlePickFurniture(itemId: string) {
    setSelectedPieceId(null)
    setMoveArmed(false)
    if (ownedIds.includes(itemId)) {
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

  function handleCellTap(x: number, y: number) {
    if (moveArmed && selectedPieceId) {
      if (moveFurniture(houseKey, selectedPieceId, x, y)) {
        setPlaced(loadHomeLayout(houseKey))
        setMoveArmed(false)
      } else {
        showMessage("That won't fit there.")
      }
      return
    }
    if (armedItemId) {
      const piece = placeFurniture(houseKey, armedItemId, x, y)
      if (piece) {
        setPlaced(loadHomeLayout(houseKey))
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
    if (moveFurniture(houseKey, selectedPiece.id, selectedPiece.x, selectedPiece.y, rotation)) {
      setPlaced(loadHomeLayout(houseKey))
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
      removeFurniture(houseKey, selectedPieceId)
      setPlaced(loadHomeLayout(houseKey))
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

  // While a piece is armed to move, hide it from the grid so its own cells
  // read as empty/tappable (matching moveFurniture's own self-exclusion).
  const displayedPlaced = moveArmed && selectedPieceId
    ? placed.filter(p => p.id !== selectedPieceId)
    : placed

  return (
    <OverlayScreen
      title="HOME"
      onBack={onBack}
      right={tab === 'decorate' ? <span className="crystal-count">💎 {crystals.toLocaleString()}</span> : undefined}
    >
      <div className="hoa-tabs">
        <button className={`hoa-tab${tab === 'shelf' ? ' hoa-tab--active' : ''}`} onClick={() => setTab('shelf')}>SHELF</button>
        <button className={`hoa-tab${tab === 'decorate' ? ' hoa-tab--active' : ''}`} onClick={() => setTab('decorate')}>DECORATE</button>
      </div>

      {tab === 'shelf' && (
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

      {tab === 'decorate' && (
        <div className="shelf-room">
          {message && <div className="home-decorate-msg">{message}</div>}
          {armedItemId && !message && (
            <div className="home-decorate-hint">Tap an empty spot to place {getFurnitureDef(armedItemId)?.name ?? 'it'}.</div>
          )}
          {moveArmed && !message && (
            <div className="home-decorate-hint">Tap an empty spot to move it there.</div>
          )}

          <HomeGrid
            placed={displayedPlaced}
            getDef={getFurnitureDef}
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
        </div>
      )}

      {detail && (
        <div className="shelf-modal-backdrop" onClick={() => setDetail(null)}>
          <div className="shelf-modal" onClick={e => e.stopPropagation()}>
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
          </div>
        </div>
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
    </OverlayScreen>
  )
}
