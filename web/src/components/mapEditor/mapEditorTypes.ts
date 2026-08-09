import { MapId } from '../../data/hub/hubWorldFactory'
import type { WallMaterial, RoofMaterial } from '../../data/tiles/buildingMaterials'
import type { NpcActivity } from '../../data/hub/loader'


export type ToolMode = 'select' | 'place' | 'delete' | 'street' | 'pond' | 'bridge' | 'spawn' | 'chickenZone' | 'area' | 'building' | 'buildingWindow'
export type Zlayer = 'solid' | 'below' | 'above'
export type ViewMode = 'exterior' | 'interior' | 'building'

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
  flame?: boolean       // render an animated flame layer above this tile (also emits glow by default)
  flameType?: string    // FlameType — plain string so JSON imports don't widen-fail
  flameColor?: string   // FlameColor — plain string so JSON imports don't widen-fail
  minLevel?: number     // building upgrade level at which this decor first appears (0/undefined = base)
  hideAtLevel?: number  // building upgrade level at which this decor disappears (undefined = never)
}

/** Per-level visual override for a building (footprint / wall / roof). */
export interface RawBuildingLevelVisual {
  minLevel: number
  rect?: [number, number, number, number]
  wall?: WallMaterial
  roof?: RoofMaterial
}

export interface RawBuildingDoor {
  tx: number
  ty: number
  buildingId?: string
  /** Hide the door-sign label at runtime (still walkable) — HubTownCanvas.tsx skips drawing the sign when true. */
  hideSign?: boolean
  /** Keep this door a fully invisible walk-in trigger (e.g. a hidden side/back
   *  entrance) instead of rendering door art (always one tile north of the
   *  entry tile). Doors render by default. */
  hideSprite?: boolean
  /** Hide the floating player-visible name label above the sign (the sign
   *  tile itself, if shown, is unaffected — see hideSign). Labels render by
   *  default whenever the door's linked interior has a name. */
  hideLabel?: boolean
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
  /** Free-text authoring label — never shown to players, just for editor bookkeeping. */
  comment?: string
  wall?: WallMaterial
  roof?: RoofMaterial
  bundleID?: string
  doors?: RawBuildingDoor[]
  windows?: RawBuildingWindow[]
  decor?: RawDecorItem[]
  upgradeKind?: string         // shared upgrade track key (shop/inn/…) — drives costs & reputation gates
  maxLevel?: number            // highest upgrade level this building can reach (defaults to its track length)
  levelDecor?: RawDecorItem[]  // per-building exterior decor revealed by upgrade level (each item carries minLevel)
  levelVisuals?: RawBuildingLevelVisual[]  // per-level footprint/wall/roof overrides
  requiresOwnership?: boolean  // door stays locked until purchased (getUpgradeLevel >= 1) — e.g. a player house
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
  conversationTopics?: string[]   // ordered ids of "Make Conversation" topics (questDefs.json `conversationTopics`)
  screen?: string   // opens a screen/modal (e.g. 'adopt-pet') via a dialogue choice, in addition to dialogue
  minLevel?: number   // building upgrade level at which this NPC first appears (0/undefined = always)
  hideAtLevel?: number // building upgrade level at which this NPC disappears (undefined = never)
  levelBuildingId?: string // exterior NPCs: building whose upgrade level gates this NPC's visibility
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
  playerDecor?: boolean  // render the player's placed furniture here at runtime (homeLayout.ts) — ships unfurnished
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
  /** Tile-atlas tile. Mutually exclusive with spriteId/shopArtSlot. */
  tileId?: string
  /** web/public/sprites/<spriteId>.svg — a fixed decorative sprite. */
  spriteId?: string
  /** Renders today's live shop-stock art for this shop's Nth for-sale slot
   *  (resolved at runtime from getTodaysShopItems — not previewable in the editor). */
  shopArtSlot?: number
  zlayer?: string
  glow?: boolean        // emit a night light glow
  glowRadius?: number   // glow radius in tiles
  pulse?: boolean       // animate the glow radius
  flame?: boolean       // render an animated flame layer above this tile (also emits glow by default)
  flameType?: string    // FlameType — plain string so JSON imports don't widen-fail
  flameColor?: string   // FlameColor — plain string so JSON imports don't widen-fail
}

export interface RawInteractableReaction {
  type: string   // 'dialogue' | 'screen' | 'giveItem' | 'quest' | 'move' | 'buy' | 'buyPack' | 'buyHubItem' | 'dig' | 'forage' | 'stokeFlame'
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
  // buy
  slotIndex?: number
  // buyHubItem
  itemId?: string
  price?: number
  currency?: 'crystals' | 'tickets'
  prerequisite?: string
  lockedText?: string
  // dig
  requiresItemId?: string
  nightOnly?: boolean
  weatherOnly?: string
  lootTable?: 'earth' | 'hollow' | 'rain' | 'fog' | 'wood'
  // stokeFlame
  fromFlameType?: string
  toFlameType?: string
  grantHubItem?: { itemId: string; count?: number }
  setFlag?: string
  alreadyDoneText?: string
  groupId?: string
  groupTotal?: number
  groupCompleteQuestStep?: { questId: string; stepKey: string }
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
  /** Once this interactable's one-time giveItem reaction has been granted
   *  (persisted via game/hub/interactables.ts), stop rendering it entirely —
   *  same as how collected HubTreasure entries disappear. For one-shot
   *  pickups/secrets rather than repeatable scenery/shops/quest givers. */
  hideOnceGranted?: boolean
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
  bridgeTiles?: Array<{ rect?: number[]; tile?: number[] }>
  interiors?: Record<string, RawInterior>
  npcs?: RawNpc[]
  animals?: RawAnimal[]
  doors?: Array<{ buildingId: string; tx: number; ty: number }>
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
  | { type: 'buildingDecor';      buildingIndex: number; index: number }
  | { type: 'buildingWindow';     buildingIndex: number; index: number }
  | { type: 'buildingDoor';       buildingIndex: number; index: number }
  | { type: 'street'; index: number }
  | { type: 'pondTile'; index: number }
  | { type: 'bridgeTile'; index: number }
  | { type: 'npcSpawnTile'; index: number }
  | { type: 'treasure'; index: number }
  | { type: 'pickupItem'; index: number }
  | { type: 'interiorDecor'; interiorId: string; index: number }
  | { type: 'interiorExit'; interiorId: string; index: number }
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
  activeBuildingIndex: number | null
  activeLevel: number
  /** Festival being previewed/authored in the editor (null = base / no festival). */
  previewFestivalId: string | null
  selectedEntities: SelectedEntity[]
  undoStack: RawMapConfig[]
  redoStack: RawMapConfig[]
  isDirty: boolean
}
