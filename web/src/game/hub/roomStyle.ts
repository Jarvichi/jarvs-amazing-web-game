import { logError } from '../../logger'
import { BASE_CHIP_TILES } from '../../data/tiles/baseChipIndex'
import type { WallMaterial } from '../../data/tiles/buildingMaterials'

// Per-room floor/wall customization, chosen from the DECORATE tab's STYLE
// view. Keyed the same way as homeLayout.ts/houseRooms.ts: `houseKey` is
// `${town}:${buildingId}` for a main room or `${town}:${buildingId}-${slotId}`
// for a purchased room slot, so every room styles independently.

const KEY_PREFIX = 'jarv_hub_room_style'
const CHIP_TILES = BASE_CHIP_TILES as Record<string, number>

export interface RoomStyle {
  floorTileId?: string  // baseChipIndex.ts constant name, e.g. "woodFloor"
  wallMaterial?: WallMaterial
}

/** Same shape, with floorTileId resolved to the numeric id HubInterior expects. */
export interface ResolvedRoomStyle {
  floorTileId?: number
  wallMaterial?: WallMaterial
}

function storageKey(houseKey: string): string {
  return `${KEY_PREFIX}:${houseKey}`
}

export function getRoomStyle(houseKey: string): RoomStyle {
  try {
    const raw = localStorage.getItem(storageKey(houseKey))
    return raw ? (JSON.parse(raw) as RoomStyle) : {}
  } catch {
    return {}
  }
}

function save(houseKey: string, style: RoomStyle): void {
  try {
    localStorage.setItem(storageKey(houseKey), JSON.stringify(style))
  } catch (e) {
    logError('room style save failed', { error: String(e) })
  }
}

export function setRoomFloor(houseKey: string, floorTileId: string): void {
  save(houseKey, { ...getRoomStyle(houseKey), floorTileId })
}

export function setRoomWall(houseKey: string, wallMaterial: WallMaterial): void {
  save(houseKey, { ...getRoomStyle(houseKey), wallMaterial })
}

/** Resolves the stored style for rendering — HubTownCanvas.tsx applies this
 *  as an override onto the room's HubInterior. */
export function getResolvedRoomStyle(houseKey: string): ResolvedRoomStyle {
  const style = getRoomStyle(houseKey)
  return {
    floorTileId: style.floorTileId ? CHIP_TILES[style.floorTileId] : undefined,
    wallMaterial: style.wallMaterial,
  }
}
