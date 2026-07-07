export interface RawTileCoord {tile: readonly number[]}
export interface RawTileRectCoord {  rect: readonly number[]}
export interface RawTileRectsCoord {rects: readonly number[][]}

export interface RawRectTileEntry extends RawTileRectCoord {
  pathType?: string
}
export interface RawSingleTileEntry extends RawTileCoord {
  pathType?: string
}

export type RawTileEntry =
  | RawRectTileEntry
  | RawSingleTileEntry

export interface RawArea {
  id: string
  name: string
  tx: number
  ty: number
  tw: number
  th: number
}

export interface RawDoor {
  tx: number
  ty: number
  buildingId?: string
  hideSign?: boolean
}

export interface RawWindow {
  tx: number
  ty: number
  tileId: string
}

export interface RawDecor {
  tx?: number
  ty?: number
  tileId?: string
  bundleID?: string
  zlayer?: string
  comment?: string
  glow?: boolean        // emit a night light glow (reuses the night overlay)
  glowRadius?: number   // glow radius in tiles
  pulse?: boolean       // animate the glow radius
  minLevel?: number     // building upgrade level at which this item first appears (0/undefined = base)
  hideAtLevel?: number  // building upgrade level at which this item disappears (undefined = never)
}

export interface RawCoordinate {  tx: number
  ty: number}


export interface BaseBuilding {
  id?: string
  wall?: string
  roof?: string
  bundleID?: string
  comment?: string

  /** Upgrade track key (buildingUpgrades.json). Tags the building as upgradeable. */
  upgradeKind?: string

  /** Highest upgrade level this building can reach (defaults to its track length). */
  maxLevel?: number

  doors?: RawDoor[]
  windows?: RawWindow[]
  decor?: RawDecor[]

  /** Per-building exterior decor revealed/retired by upgrade level (absolute tx/ty). */
  levelDecor?: RawDecor[]

  /**
   * Per-level visual overrides. As the building is upgraded, the highest entry
   * whose `minLevel <= currentLevel` replaces the base footprint/wall/roof.
   * Omitted fields inherit from the base building.
   */
  levelVisuals?: Array<{ minLevel: number; rect?: RawTileRectCoord['rect']; wall?: string; roof?: string }>
}

export interface RawBuildingRect extends BaseBuilding {
  rect?: RawTileRectCoord
}
export interface RawBuildingRects extends BaseBuilding {
  rects?: RawTileRectsCoord
}

export type RawBuilding = RawBuildingRect | RawBuildingRects


export type RawPondEntry = RawTileRectCoord | RawTileCoord

export interface RawExitTile {
  tx: number
  ty: number
  screen: string
}



export interface OpenAndCloseTime {
  open: number
  close: number
}

export interface RawInterior {
  name: string
  width: number
  height: number

  floorTileId: string
  wallTileId?: string

  decor: RawDecor[]

  exits?: Array<{
    tx: number
    ty: number
    toInteriorId: string
    entryTx?: number
    entryTy?: number
    direction?: string //'up' | 'down'
    lockedBy?: string
    requiredQuest?: string
    label?: string
  }>

  hours?: string | OpenAndCloseTime

  /** Interior music track id (see BUILDING_MUSIC_TRACKS in sound.ts). */
  musicId?: string
  /** Ambiance bed id (see AMBIANCE_TRACKS in sound.ts). */
  ambianceId?: string
}


export interface RawExteriorNPCLocation {
        type: string
        readonly  isExterior?: true
        tx: number
        ty: number
}

export interface RawInteriorNPCLocation {
          type: string
        readonly  isExterior?: false
        buildingId: string
        tx: number
        ty: number
}

export interface RawNpcScheduleEntry {
  startHour: number
  endHour: number
  /** Loose raw type; the typed `NpcActivity` union lives in loader.ts. */
  activity?: string

  location: RawExteriorNPCLocation | RawInteriorNPCLocation
}

export interface RawNpc {
  id: string
  name: string
  sprite: string

  tx: number
  ty: number

  dialogue: string[]

  screen?: string
  building?: string

  questGive?: string
  questReceive?: string | string[]

  innRumours?: Array<{
    id: string
    text: string
  }>

  isGhost?: boolean

  minLevel?: number        // building upgrade level at which this NPC first appears (0/undefined = always)
  hideAtLevel?: number     // building upgrade level at which this NPC disappears (undefined = never)
  /** For exterior NPCs: id of the building whose upgrade level gates this NPC's visibility. */
  levelBuildingId?: string

  schedule?: RawNpcScheduleEntry[]

  homeBed?: {
    buildingId: string
    tx: number
    ty: number
  }

  /** Hub-item id (hubItems.json) that grants a bonus friendship/relationship boost when gifted. */
  favoriteGiftItemId?: string
  /** Relationship track the favorite-gift bonus applies to. Defaults to 'ally' if favoriteGiftItemId is set. */
  favoriteGiftTrack?: string
  /** Hub-item ids (hubItems.json) this NPC dislikes being gifted — costs friendship instead of gaining it. */
  dislikedGiftItemIds?: string[]

  /** Ids of other same-town NPCs this NPC dislikes — befriending one raises this NPC's own 'rival' track. */
  dislikes?: string[]
}

export interface RawLockedDoor {
  buildingId: string
  lockedBy: string
}

export interface RawTreasureReward {
  crystals?: number

  collectible?: {
    id: string
    name: string
    icon: string
    desc: string
  }

  consumables?: Array<{
    id: string
    quantity: number
  }>
}

export interface RawTreasure {
  id: string

  tx: number
  ty: number

  tileId: string
  collectedTileId?: string

  title: string
  reward: RawTreasureReward

  buildingId?: string
}

export interface RawInteractableDecor {
  dx: number
  dy: number
  /** Tile-atlas tile, e.g. "crate". Mutually exclusive with spriteId/shopArtSlot. */
  tileId?: string
  /** web/public/sprites/<spriteId>.svg — a fixed decorative sprite, for decor
   *  that isn't in the tile atlas and isn't live shop-stock art. */
  spriteId?: string
  /** Renders today's live shop-stock art (card face / augment slot icon /
   *  consumable emoji badge) for this shop's Nth for-sale slot; the kind is
   *  resolved from getTodaysShopItems()[slot].grant.kind at render time. */
  shopArtSlot?: number
  zlayer?: string
}

export interface RawInteractableReaction {
  // 'dialogue' | 'screen' | 'giveItem' | 'quest' | 'move' | 'buy' | 'buyPack' — plain
  // string so JSON imports don't widen-fail; loader.ts casts to the parsed union
  type: string

  // dialogue
  speakerName?: string
  text?: string | string[]

  // screen
  screen?: string

  // giveItem
  collectible?: {
    id: string
    name: string
    icon: string
    desc: string
    lore?: string
  }
  consumables?: Array<{
    id: string
    quantity: number
  }>
  crystals?: number
  hubItem?: {
    itemId: string
    count?: number
  }
  message?: string
  alreadyGrantedText?: string

  // quest
  questId?: string

  // move
  to?: RawCoordinate

  // buy — slotIndex into the building's live getTodaysShopItems() stock
  slotIndex?: number
}

export interface RawInteractable {
  id: string

  tx: number
  ty: number

  building?: string

  decor?: RawInteractableDecor[]
  hitRect?: { w: number; h: number }

  indicator?: {
    condition: string
    dx?: number
    dy?: number
  }

  reactions: RawInteractableReaction[]
}

export interface RawAnimal {
  id: string
  type: string                       // 'cat' | 'dog' | 'bird' | 'fish'
  variant?: string                   // palette key (e.g. "orange") or hex ("#e8923c")
  pattern?: string                   // coat pattern id (petPatterns.ts), cats/dogs only
  tx: number
  ty: number
  name?: string
  dialogue?: string[]
  questGive?: string
  questReceive?: string | string[]
  roam?: boolean                     // default false for placed animals
  areaRect?: number[]  // [tx, ty, w, h] roam bounds (JSON infers number[])
  dialogueTree?: string              // id of a branching dialogue tree (questDefs.json `dialogues`)
}

export interface RawConfig {
  mapW: number
  mapH: number

  townName?: string
  environment?: string

  /** Optional per-town weather (loose raw shape; typed `WeatherConfig` at the loader output). */
  weather?: { type?: string; bySeason?: Record<string, string> }

  /** Optional date-gated festival decor groups (rendered when that festival is active). */
  festivalDecor?: Array<{ festivalId: string; decor: RawDecor[] }>

  avatarStart:RawCoordinate

  exitTiles?: RawExitTile[]

  areas: RawArea[]

  streets: RawTileEntry[]

  buildings: RawBuilding[]

  exteriorDecor: RawDecor[]

  pondTiles?: RawPondEntry[]

  interiors: Record<string, RawInterior>

  npcs: RawNpc[]

  // Loose raw shape: JSON imports infer number[][]; loader.ts casts to the
  // strict [number, number][] tuple on output.
  npcSpawnTiles: number[][]

  windows?: RawWindow[]

  doors?: RawDoor[]

  ambientNpcSprites?: string[]

  lockedDoors?: RawLockedDoor[]

  treasures?: RawTreasure[]

  interactables?: RawInteractable[]

  animals?: RawAnimal[]

  /** Fenced pens that chickens are confined to. */
  chickenZones?: { rect: number[]; count?: number; roost?: number[] }[]
}