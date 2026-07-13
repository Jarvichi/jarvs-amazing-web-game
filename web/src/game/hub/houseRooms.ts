import { logError } from '../../logger'
import ROOM_SLOTS_DATA from '../../data/roomSlots.json'
import { BASE_CHIP_TILES } from '../../data/tiles/baseChipIndex'
import type { HubInterior, HubInteriorExit } from '../../data/hub/loader'

// Player-owned room slots: independently purchasable rooms (basement, first
// floor, left, right, rear) attached to a player house's main room. Unlike
// the tiered-upgrade-track/hand-authored-per-town rooms this replaces, each
// slot is a single shared template (this catalog) synthesized into a real
// HubInterior at runtime for whichever house/town bought it — adding a slot
// or a new player-house town needs no per-room JSON authoring.

const KEY_PREFIX = 'jarv_hub_house_rooms'

export interface RoomSlotExit {
  tx: number
  ty: number
  direction: 'left' | 'right' | 'front' | 'back' | 'up' | 'down'
  entryTx: number
  entryTy: number
}

export interface RoomSlotDef {
  id: string
  name: string
  price: number       // crystals
  floorTileId: string  // baseChipIndex.ts constant name
  /** The door/passage this slot punches into the main room. */
  mainExit: RoomSlotExit
  /** The door/passage back to the main room, inside the slot's own interior. */
  roomExit: RoomSlotExit
}

const ROOM_SLOT_CATALOG = ROOM_SLOTS_DATA as RoomSlotDef[]
const CHIP_TILES = BASE_CHIP_TILES as Record<string, number>

export function getRoomSlotDef(id: string): RoomSlotDef | undefined {
  return ROOM_SLOT_CATALOG.find(s => s.id === id)
}

export function getAllRoomSlotDefs(): RoomSlotDef[] {
  return ROOM_SLOT_CATALOG
}

// ── Purchased-slot persistence (per house, like homeLayout.ts/furniture.ts) ──

function storageKey(houseKey: string): string {
  return `${KEY_PREFIX}:${houseKey}`
}

function load(houseKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(houseKey))
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function save(houseKey: string, ids: string[]): void {
  try {
    localStorage.setItem(storageKey(houseKey), JSON.stringify(ids))
  } catch (e) {
    logError('house room slot save failed', { error: String(e) })
  }
}

export function getPurchasedSlotIds(houseKey: string): string[] {
  return load(houseKey)
}

export function hasPurchasedSlot(houseKey: string, slotId: string): boolean {
  return load(houseKey).includes(slotId)
}

/** Grants a room slot for this house. Idempotent — returns false if the slot
 *  id isn't in the catalog or is already owned. Caller (UI) handles the
 *  crystal spend, mirroring furniture.ts's grantFurniture. */
export function purchaseRoomSlot(houseKey: string, slotId: string): boolean {
  if (!getRoomSlotDef(slotId)) return false
  const owned = load(houseKey)
  if (owned.includes(slotId)) return false
  save(houseKey, [...owned, slotId])
  return true
}

// ── Dynamic interior/exit synthesis (pure — HubTownCanvas.tsx wires these in) ──

/** If `buildingId` is `<mainBuildingId>-<slotId>` for a real catalog slot,
 *  returns that slot's def — regardless of purchase state. */
export function parseSlotBuildingId(buildingId: string, mainBuildingId: string): RoomSlotDef | undefined {
  if (!buildingId.startsWith(`${mainBuildingId}-`)) return undefined
  const slotId = buildingId.slice(mainBuildingId.length + 1)
  return getRoomSlotDef(slotId)
}

/** The exit a purchased slot punches into the main player-house room. */
export function buildMainRoomExit(slot: RoomSlotDef, subInteriorId: string): HubInteriorExit {
  return {
    tx: slot.mainExit.tx,
    ty: slot.mainExit.ty,
    toInteriorId: subInteriorId,
    entryTx: slot.mainExit.entryTx,
    entryTy: slot.mainExit.entryTy,
    direction: slot.mainExit.direction,
    label: slot.name,
  }
}

/** Synthesizes a purchased slot's own interior — same shape/size/playerDecor
 *  convention as a hand-authored player-house room, generated from the
 *  shared catalog template instead of per-town JSON. */
export function synthesizeSlotInterior(mainBuildingId: string, mainName: string, slot: RoomSlotDef): HubInterior {
  const backExit: HubInteriorExit = {
    tx: slot.roomExit.tx,
    ty: slot.roomExit.ty,
    toInteriorId: mainBuildingId,
    entryTx: slot.roomExit.entryTx,
    entryTy: slot.roomExit.entryTy,
    direction: slot.roomExit.direction,
    label: 'Back',
  }
  return {
    id: `${mainBuildingId}-${slot.id}`,
    name: `${mainName} — ${slot.name}`,
    width: 10,
    height: 8,
    decor: [],
    floorTileId: CHIP_TILES[slot.floorTileId] ?? CHIP_TILES.woodFloor,
    playerDecor: true,
    exits: [backExit],
  }
}
