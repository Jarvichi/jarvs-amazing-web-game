import { MapId } from '../../data/hub/hubWorldFactory'
import type { WallMaterial, RoofMaterial } from '../../data/tiles/buildingMaterials'
import type { NpcActivity } from '../../data/hub/loader'


export type ToolMode = 'select' | 'place' | 'delete' | 'street' | 'pond' | 'spawn' | 'chickenZone' | 'area'
export type Zlayer = 'solid' | 'below' | 'above'
export type ViewMode = 'exterior' | 'interior'

// Entity kinds whose location can be set by clicking the map ("pick on map").
export type PickKind =
  | 'npc' | 'animal' | 'treasure' | 'interactable' | 'exitTile' | 'avatarStart' | 'blockedTile'


// Raw JSON shapes — matches what config.json actually stores
export interface RawDecorItem {
  tx?: number
  ty?: number
  tileId?: string
  zlayer?: Zlayer
  bundleID?: string
  comment?: string
  glow?: boolean        // emit a night light glow
  glowRadius?: number   // glow radius in tiles
  pulse?: boolean       // animate the glow radius
  minLevel?: number     // building upgrade level at which this decor first appears (0/undefined = base)
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
  upgradeKind?: string         // shared upgrade track key (shop/inn/…) — drives costs & default decor
  maxLevel?: number            // highest upgrade level this building can reach (defaults to its track length)
  levelDecor?: RawDecorItem[]  // per-building exterior decor revealed by upgrade level (each item carries minLevel)
}

export interface RawAnimal {
  id: string
  type: string           // 'cat' | 'dog' | 'bird' | 'fish' | 'butterfly' | 'rabbit' | 'chicken' | 'frog'
  variant?: string
  tx: number
  ty: number
  name?: string
  dialogue?: string[]
  questGive?: string
  questReceive?: string | string[]
  roam?: boolean
  areaRect?: [number, number, number, number]
  building?: string
  dialogueTree?: string
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
  dialogueTree?: string   // id of a branching dialogue tree (questDefs.json `dialogues`)
  minLevel?: number   // building upgrade level at which this NPC first appears (0/undefined = always)
  schedule?: Array<{
    startHour: number
    endHour: number
    activity?: NpcActivity
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
  musicId?: string
  ambianceId?: string
  exits?: Array<{
    tx: number
    ty: number
    toInteriorId: string
    entryTx?: number
    entryTy?: number
    direction?: 'up' | 'down' | 'left' | 'right' | 'front' | 'back'
    lockedBy?: string
    requiredQuest?: string
    minLevel?: number   // building upgrade level required before this room/exit is available (0/undefined = always)
    label?: string
  }>
}

export interface RawBlockedPath {
  id: string
  blockedTiles: [number, number][]
  questId: string
  blocked: { decor?: Array<{ tx: number; ty: number; tileId: string }>; npcs?: unknown[] }
  cleared: { decor?: Array<{ tx: number; ty: number; tileId: string }>; npcs?: unknown[] }
}

export interface RawLockedDoor {
  buildingId: string
  lockedBy: string
}

// Interactable objects (notice boards, signs, levers…) — `reactions` fire when
// the player interacts. Mirrors RawInteractable in data/hub/config.ts.
export interface RawInteractableDecor {
  dx: number
  dy: number
  tileId: string
  zlayer?: string
}

export interface RawInteractableReaction {
  type: string   // 'dialogue' | 'screen' | 'giveItem' | 'quest' | 'move'
  // dialogue
  speakerName?: string
  text?: string | string[]
  // screen
  screen?: string
  // giveItem
  collectible?: { id: string; name: string; icon: string; desc: string }
  consumables?: Array<{ id: string; quantity: number }>
  crystals?: number
  message?: string
  alreadyGrantedText?: string
  // quest
  questId?: string
  // move
  to?: { tx: number; ty: number }
}

export interface RawInteractable {
  id: string
  tx: number
  ty: number
  building?: string
  decor?: RawInteractableDecor[]
  hitRect?: { w: number; h: number }
  indicator?: { condition: string; dx?: number; dy?: number }
  reactions: RawInteractableReaction[]
}

export interface RawChickenZone {
  rect: [number, number, number, number]
  count?: number
  roost?: [number, number]
}

export interface RawWeather {
  type?: string
  bySeason?: Record<string, string>
}

export interface RawMapConfig {
  mapW: number
  mapH: number
  townName: string
  environment?: string
  weather?: RawWeather
  avatarStart: { tx: number; ty: number }
  exitTiles?: Array<{ tx: number; ty: number; screen: string }>
  areas?: Array<{ id: string; name: string; tx: number; ty: number; tw: number; th: number }>
  streets?: Array<{ rect?: number[]; tile?: number[]; pathType?: string }>
  buildings?: RawBuilding[]
  exteriorDecor?: RawDecorItem[]
  pondTiles?: Array<{ rect?: number[]; tile?: number[] }>
  interiors?: Record<string, RawInterior>
  npcs?: RawNpc[]
  animals?: RawAnimal[]
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
    glow?: boolean
    glowRadius?: number
    pulse?: boolean
  }>
  blockedPaths?: unknown[]
  lockedDoors?: RawLockedDoor[]
  interactables?: RawInteractable[]
  chickenZones?: RawChickenZone[]
  festivalDecor?: Array<{ festivalId: string; decor: RawDecorItem[] }>
}

export type SelectedEntity =
  | { type: 'exteriorDecor'; index: number }
  | { type: 'npc'; index: number }
  | { type: 'building'; index: number }
  | { type: 'buildingLevelDecor'; buildingIndex: number; index: number }
  | { type: 'street'; index: number }
  | { type: 'pondTile'; index: number }
  | { type: 'npcSpawnTile'; index: number }
  | { type: 'treasure'; index: number }
  | { type: 'pickupItem'; index: number }
  | { type: 'interiorDecor'; interiorId: string; index: number }
  | { type: 'blockedPath'; index: number }
  | { type: 'lockedDoor'; index: number }
  | { type: 'animal'; index: number }
  | { type: 'area'; index: number }
  | { type: 'interactable'; index: number }
  | { type: 'exitTile'; index: number }
  | { type: 'chickenZone'; index: number }
  | { type: 'festivalDecor'; festivalId: string; index: number }

export interface MapEditorState {
  mapId: MapId
  configData: RawMapConfig
  tool: ToolMode
  activeTileId: string | null
  activeBundleId: string | null
  activeZlayer: Zlayer
  viewMode: ViewMode
  activeInteriorId: string | null
  activeLevel: number
  /** Festival being previewed/authored in the editor (null = base / no festival). */
  previewFestivalId: string | null
  selectedEntities: SelectedEntity[]
  undoStack: RawMapConfig[]
  redoStack: RawMapConfig[]
  isDirty: boolean
}
