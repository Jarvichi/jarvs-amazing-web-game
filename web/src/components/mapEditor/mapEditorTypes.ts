import type { WallMaterial, RoofMaterial } from '../../data/tiles/buildingMaterials'

export type MapId = 'hub' | 'town2' | 'castle'
export type ToolMode = 'select' | 'place' | 'delete'
export type Zlayer = 'solid' | 'below' | 'above'
export type ViewMode = 'exterior' | 'interior'

// Raw JSON shapes — matches what config.json actually stores
export interface RawDecorItem {
  tx?: number
  ty?: number
  tileId?: string
  zlayer?: Zlayer
  bundleID?: string
  comment?: string
}

export interface RawBuildingDoor {
  tx: number
  ty: number
  buildingId?: string
}

export interface RawBuildingWindow {
  tx: number
  ty: number
  tileId: string
}

export interface RawBuilding {
  rect?: [number, number, number, number]
  rects?: [number, number, number, number][]
  id?: string
  wall?: WallMaterial
  roof?: RoofMaterial
  bundleID?: string
  doors?: RawBuildingDoor[]
  windows?: RawBuildingWindow[]
  decor?: RawDecorItem[]
}

export interface RawNpc {
  id: string
  name: string
  sprite: string
  tx: number
  ty: number
  dialogue: string[]
  building?: string
  questGive?: string
  questReceive?: string | string[]
  isGhost?: boolean
  schedule?: Array<{
    startHour: number
    endHour: number
    location:
      | { type: 'exterior'; tx: number; ty: number }
      | { type: 'interior'; buildingId: string; tx: number; ty: number }
  }>
  homeBed?: { buildingId: string; tx: number; ty: number }
  innRumours?: Array<{ id: string; text: string }>
}

export interface RawInterior {
  name: string
  width: number
  height: number
  floorTileId: string
  wallTileId?: string
  wallMaterial?: string
  decor: RawDecorItem[]
  hours?: { open: number; close: number } | 'always'
  exits?: Array<{
    tx: number
    ty: number
    toInteriorId: string
    entryTx?: number
    entryTy?: number
    direction?: 'up' | 'down'
    lockedBy?: string
    requiredQuest?: string
    label?: string
  }>
}

export interface RawMapConfig {
  mapW: number
  mapH: number
  townName: string
  avatarStart: [number, number]
  exitTiles?: Array<{ tx: number; ty: number; screen: string }>
  areas?: Array<{ id: string; name: string; tx: number; ty: number; tw: number; th: number }>
  streets?: Array<{ rect?: number[]; tile?: number[]; pathType?: string }>
  buildings?: RawBuilding[]
  exteriorDecor?: RawDecorItem[]
  pondTiles?: Array<{ rect?: number[]; tile?: number[] }>
  interiors?: Record<string, RawInterior>
  npcs?: RawNpc[]
  doors?: Array<{ buildingId: string; tx: number; ty: number; tyAdjust?: number }>
  npcSpawnTiles?: [number, number][]
  ambientNpcSprites?: string[]
  treasures?: Array<{
    id: string
    tx: number
    ty: number
    tileId: string
    title: string
    buildingId?: string
    collectedTileId?: string
    reward: Record<string, unknown>
  }>
  pickupItems?: Array<{
    id: string
    tx: number
    ty: number
    tileId: string
    building?: string
    questId?: string
    chain?: string
    requireTouch?: boolean
  }>
  blockedPaths?: unknown[]
  lockedDoors?: unknown[]
}

export type SelectedEntity =
  | { type: 'exteriorDecor'; index: number }
  | { type: 'npc'; index: number }
  | { type: 'building'; index: number }
  | { type: 'street'; index: number }
  | { type: 'interiorDecor'; interiorId: string; index: number }

export interface MapEditorState {
  mapId: MapId
  configData: RawMapConfig
  tool: ToolMode
  activeTileId: string | null
  activeBundleId: string | null
  activeZlayer: Zlayer
  viewMode: ViewMode
  activeInteriorId: string | null
  selectedEntity: SelectedEntity | null
  undoStack: RawMapConfig[]
  redoStack: RawMapConfig[]
  isDirty: boolean
}
