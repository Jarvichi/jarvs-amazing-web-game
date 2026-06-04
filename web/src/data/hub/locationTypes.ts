import type {
  HubArea, HubBuilding, HubStreetGroup, HubDoor, HubInterior,
  HubNpc, HubPickupItem, BlockedPath, HubLockedDoor, HubTreasure,
} from './loader'

export interface HubExitTile {
  tx: number
  ty: number
  screen: string
}

export interface HubLocationData {
  MAP_W:              number
  MAP_H:              number
  AVATAR_START:       [number, number]
  TOWN_NAME:          string
  HUB_AREAS:          HubArea[]
  HUB_STREET_GROUPS:  HubStreetGroup[]
  HUB_STREET_TILES:   [number, number][]
  HUB_BUILDINGS:      HubBuilding[]
  HUB_BUILDING_TILES: [number, number][]
  EXTERIOR_DECOR:     { tx: number; ty: number; tileId: number; zlayer?: string }[]
  HUB_WINDOWS:        { tx: number; ty: number; tileId: number }[]
  HUB_POND_TILES:     [number, number][]
  HUB_DOORS:          HubDoor[]
  HUB_INTERIORS:      Record<string, HubInterior>
  HUB_NPCS:           HubNpc[]
  EXTERIOR_NPCS:      HubNpc[]
  INTERIOR_NPCS:      Record<string, HubNpc[]>
  NPC_SPAWN_TILES:    [number, number][]
  AMBIENT_NPC_SPRITES: string[]
  HUB_PICKUP_ITEMS:   HubPickupItem[]
  HUB_BLOCKED_PATHS:  BlockedPath[]
  HUB_LOCKED_DOORS:   HubLockedDoor[]
  HUB_TREASURES:      HubTreasure[]
  EXIT_TILES:         HubExitTile[]
}
