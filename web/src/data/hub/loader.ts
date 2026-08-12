import { BASE_CHIP_TILES } from '../tiles/baseChipIndex'
import { WALL_TILES, ROOF_TILES } from '../tiles/buildingMaterials'
import type { WallMaterial, RoofMaterial } from '../tiles/buildingMaterials'
import { expandBundleDecor, expandBundleWindows, expandBundleDoors } from '../bundles/bundleLoader'
import { ConversationTopicDef, DialogueTree, FriendshipDialogue, HubQuestDef, RawQuestConfig, RelationshipDialogue } from './questDefs'
import { FlameColor, FlameType, RawAnimal, RawConfig, RawInteractable } from './config'
export type { FlameColor, FlameType } from './config'
import rollbar from '../../rollbar'
import type { MapId } from './mapIds'

const WALL_MATERIAL_NAMES = new Set<string>(Object.keys(WALL_TILES))
const ROOF_MATERIAL_NAMES = new Set<string>(Object.keys(ROOF_TILES))

// Used when a town config references a wall/roof material name that doesn't exist
// (typo'd or stale) — keeps the building rendering instead of crashing the canvas.
const DEFAULT_WALL_MATERIAL: WallMaterial = 'brick'
const DEFAULT_ROOF_MATERIAL: RoofMaterial = 'woodRoof'

/** Validates a wall material name from raw JSON, falling back + logging if it's unrecognized. */
function resolveWallMaterial(value: string | undefined, townName: string, context: string): WallMaterial | undefined {
  if (value == null) return undefined
  if (WALL_MATERIAL_NAMES.has(value)) return value as WallMaterial
  const message = `[hub loader] ${townName}: unsupported wall material "${value}" (${context}) — falling back to "${DEFAULT_WALL_MATERIAL}"`
  console.error(message)
  rollbar.error(message)
  return DEFAULT_WALL_MATERIAL
}

/** Validates a roof material name from raw JSON, falling back + logging if it's unrecognized. */
function resolveRoofMaterial(value: string | undefined, townName: string, context: string): RoofMaterial | undefined {
  if (value == null) return undefined
  if (ROOF_MATERIAL_NAMES.has(value)) return value as RoofMaterial
  const message = `[hub loader] ${townName}: unsupported roof material "${value}" (${context}) — falling back to "${DEFAULT_ROOF_MATERIAL}"`
  console.error(message)
  rollbar.error(message)
  return DEFAULT_ROOF_MATERIAL
}

const T = 32

/**
 * Shared visibility predicate for level-gated items (decor / NPCs). An item is
 * visible while `minLevel <= level` and (if set) `level < hideAtLevel`. This lets
 * an author retire an item as its upgraded replacement appears.
 */
export function isVisibleAtLevel(
  item: { minLevel?: number; hideAtLevel?: number },
  level: number,
): boolean {
  if ((item.minLevel ?? 0) > level) return false
  if (item.hideAtLevel != null && level >= item.hideAtLevel) return false
  return true
}

/**
 * Resolves which building's upgrade level gates a given interior's minLevel
 * content. Prefers an exact door-target → owner lookup (HUB_INTERIOR_OWNERS
 * — a door's target interior id is not always the owning building's own id,
 * e.g. Ravenwatch's "home-building" door → interior "home"). Falls back to
 * the id-prefix guess for genuine sub-rooms (reached only via an internal
 * exit, no door of their own, authored with the parent building's own id as
 * their id prefix — e.g. "townhall-office" under "townhall").
 */
export function resolveUpgradeLevelKey(
  interiorId: string,
  buildings: Pick<HubBuilding, 'id' | 'upgradeKind'>[],
  interiorOwners: Record<string, string>,
): string {
  return interiorOwners[interiorId]
    ?? buildings.find(b => b.id && interiorId.startsWith(b.id) && b.upgradeKind)?.id
    ?? interiorId
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HubArea {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
}

export interface HubBuilding {
  rect: [number, number, number, number]
  id?: string
  wall?: WallMaterial
  roof?: RoofMaterial
  /** Upgrade track key (buildingUpgrades.json); set = building is upgradeable. */
  upgradeKind?: string
  /** Entry is blocked (door "locked") until getUpgradeLevel(town, id) >= 1 — i.e. purchased. */
  requiresOwnership?: boolean
  /** Per-building exterior decor revealed/retired by upgrade level (absolute tx/ty). */
  levelDecor?: Array<{ tx: number; ty: number; tileId: number; zlayer?: 'solid' | 'below' | 'above'; minLevel?: number; hideAtLevel?: number }>
  /**
   * Per-level visual overrides (footprint/wall/roof). Sorted ascending by
   * minLevel. The highest entry whose minLevel <= currentLevel wins; omitted
   * fields inherit from the base building.
   */
  levelVisuals?: Array<{ minLevel: number; rect?: [number, number, number, number]; wall?: WallMaterial; roof?: RoofMaterial }>
}

export interface HubDoor {
  buildingId: string
  tx: number
  ty: number
  hideSign?: boolean
  /** Keep this door a fully invisible walk-in trigger. Doors render by default
   *  (one tile north of the entry tile). */
  hideSprite?: boolean
  /** Hide the floating player-visible name label above the sign. */
  hideLabel?: boolean
  /** Entry is blocked until this quest id has status 'completed'. Mirrors
   *  HubInteriorExit.requiredQuest for the exterior-door case. */
  requiredQuest?: string
}

export interface DecorGlow {
  glow?:       boolean   // emit a night light glow (reuses the night overlay)
  glowRadius?: number    // glow radius in tiles
  pulse?:      boolean   // animate the glow radius
  flame?:      boolean   // render an animated flame layer above this tile (also emits glow by default)
  flameType?:  FlameType   // default 'medium'
  flameColor?: FlameColor  // default 'normal'
}

export interface InteriorDecor extends DecorGlow {
  tx:      number
  ty:      number
  tileId:  number
  minLevel?: number   // building upgrade level at which this decor first appears (0/undefined = base)
  hideAtLevel?: number // building upgrade level at which this decor disappears (undefined = never)
  zlayer?: 'solid' | 'below' | 'above'
  // solid (default): not walkable, renders below avatar
  // below: walkable, renders below avatar (rugs, floor markings)
  // above: walkable, renders above avatar (hanging items, backdrop shelves)
}

export interface HubInteriorExit {
  tx: number
  ty: number
  toInteriorId: string
  entryTx?: number
  entryTy?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'front' | 'back'
  lockedBy?: string
  requiredQuest?: string
  minLevel?: number   // building upgrade level required before this room/exit is available
  label?: string
}

export interface HubInterior {
  id: string
  name: string
  width: number
  height: number
  decor: InteriorDecor[]
  floorTileId?: number
  wallMaterial?: WallMaterial
  exits?: HubInteriorExit[]
  hours?: { open: number; close: number } | 'always'
  /** Interior music track id (BUILDING_MUSIC_TRACKS) — swaps town theme while inside. */
  musicId?: string
  /** Ambiance bed id (AMBIANCE_TRACKS) — layered under the music while inside. */
  ambianceId?: string
  /** Render the player's placed furniture (homeLayout.ts) here at runtime — see furnitureTiles.ts. */
  playerDecor?: boolean
  /** Render this room unlit except near the avatar's own torch and any
   *  glow-flagged decor — a dedicated interior-scoped punch-hole overlay,
   *  independent of the exterior day/night cycle (see HubTownCanvas.tsx). */
  dark?: boolean
  /** Sub-rectangles subtracted from the width×height box — see
   *  computeInteriorShape (game/hub/interiorShape.ts), which HubTownCanvas.tsx
   *  uses to trace the resulting floor/wall sets. */
  carve?: Array<{ tx: number; ty: number; w: number; h: number }>
}

/** Visible activity an NPC performs while at a scheduled location. */
export type NpcActivity = 'work' | 'eat' | 'idle-chat' | 'sleep' | 'sweep' | 'fish'

export interface NpcScheduleEntry {
  startHour: number
  endHour: number
  /** Optional activity shown via a pose-swap sprite while at this location. */
  activity?: NpcActivity
  location:
    | { type: 'exterior'; tx: number; ty: number }
    | { type: 'interior'; buildingId: string; tx: number; ty: number }
    /** Not physically present in this town right now — away visiting `town`.
     *  Requires a matching HubNpc record (same id) authored in that town's
     *  own config.json, resolving them present there for the same hours. */
    | { type: 'travel'; town: MapId }
}

export interface HubNpc {
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
  innRumours?: Array<{ id: string; text: string }>
  isGhost?: boolean
  minLevel?: number   // building upgrade level at which this NPC first appears (0/undefined = always)
  hideAtLevel?: number // building upgrade level at which this NPC disappears (undefined = never)
  /** For exterior NPCs: id of the building whose upgrade level gates this NPC's visibility. */
  levelBuildingId?: string
  schedule?: NpcScheduleEntry[]
  homeBed?: { buildingId: string; tx: number; ty: number }
  /** Optional activity-specific dialogue pools. When the NPC's current schedule
   *  activity (getNpcActivity) has a non-empty entry here, those lines are
   *  cycled instead of the flat `dialogue` array. */
  dialogueByActivity?: Partial<Record<NpcActivity, string[]>>
  /** Line shown when tapped while the schedule has this NPC sleeping.
   *  Defaults to a generic "fast asleep" narration. */
  sleepDialogue?: string
  /** Lines cycled INSTEAD of `dialogue` once campaign 1 is complete
   *  (isCampaignComplete('c1')) — how the world acknowledges the sealed
   *  Fracture. Activity pools (dialogueByActivity) still take precedence. */
  postCampaignDialogue?: string[]
  /** Id of a branching dialogue tree (questDefs.json `dialogues`) to run on tap. */
  dialogueTree?: string
  /** Ordered ids (questDefs.json `conversationTopics`) offered as topic choices
   *  when "🗣️ Make conversation" is tapped. Empty/absent falls back to the
   *  flat legacy "Always good to catch up" line. */
  conversationTopics?: string[]
  /** Hub-item id (hubItems.json) that grants a bonus friendship/relationship boost when gifted. */
  favoriteGiftItemId?: string
  /** Relationship track ('ally' | 'rival' | 'romance') the favorite-gift bonus applies to. Defaults to 'ally'. */
  favoriteGiftTrack?: string
  /** Hub-item ids (hubItems.json) this NPC dislikes being gifted — costs friendship instead of gaining it. */
  dislikedGiftItemIds?: string[]
  /** Ids of other same-town NPCs this NPC dislikes — befriending one raises this NPC's own 'rival' track. */
  dislikes?: string[]
}

export type HubAnimalType =
  | 'cat' | 'dog' | 'bird' | 'fish'
  | 'butterfly' | 'rabbit' | 'chicken' | 'frog'

export interface HubAnimal {
  id: string
  type: HubAnimalType
  variant?: string
  pattern?: string
  tx: number
  ty: number
  name?: string
  dialogue?: string[]
  questGive?: string
  questReceive?: string | string[]
  roam?: boolean
  areaRect?: number[]
  dialogueTree?: string
}

export interface HubPickupItem extends DecorGlow {
  id: string
  tx: number
  ty: number
  tileId: number
  extraTiles?: Array<{ dx: number; dy: number; tileId: number }>
  building?: string
  questId?: string
  chain?: string
  requireTouch?: boolean
}

export interface BlockedPathNpc {
  id: string
  sprite: string
  tx: number
  ty: number
  proximityDialogue?: { atDistance: number; text: string }[]
  tapDialogue?: string
}

export interface BlockedPathState {
  decor?: { tx: number; ty: number; tileId: number; zlayer?: string }[]
  npcs?: BlockedPathNpc[]
}

export interface BlockedPath {
  id: string
  blockedTiles: [number, number][]
  /** Exactly one of questId/unlockedByInteractable should be set. */
  questId?: string
  /** Alternative gate: cleared once this interactable id has been granted (see interactables.ts). */
  unlockedByInteractable?: string
  blocked: BlockedPathState
  cleared: BlockedPathState
}

export interface HubLockedDoor {
  buildingId: string
  lockedBy: string
}

export interface HubTreasureReward {
  crystals?:    number
  collectible?: { id: string; name: string; icon: string; desc: string }
  consumables?: Array<{ id: string; quantity: number }>
}

export interface HubTreasure {
  id:               string
  tx:               number
  ty:               number
  tileId:           number
  collectedTileId?: number   // if set, swap to this tile on collect; if absent, hide the sprite
  title:            string
  reward:           HubTreasureReward
  buildingId?:      string   // if set, this treasure lives inside the named interior
}

export interface HubInteractableDecor {
  dx: number
  dy: number
  /** Resolved tile-atlas id. Mutually exclusive with spriteId/shopArtSlot. */
  tileId?: number
  /** web/public/sprites/<spriteId>.svg — a fixed decorative sprite. */
  spriteId?: string
  /** Renders today's live shop-stock art (card/augment/consumable, dispatched
   *  by grant.kind) for this shop's Nth for-sale slot. */
  shopArtSlot?: number
  zlayer?: 'solid' | 'below' | 'above'
  glow?: boolean        // emit a night light glow
  glowRadius?: number   // glow radius in tiles
  pulse?: boolean       // animate the glow radius
  flame?: boolean        // render an animated flame layer above this tile (also emits glow by default)
  flameType?: FlameType   // default 'medium'
  flameColor?: FlameColor // default 'normal'
}

export type HubInteractableReaction =
  | { type: 'dialogue'; speakerName?: string; text: string | string[] }
  | { type: 'screen'; screen: string }
  | { type: 'giveItem'
      collectible?: { id: string; name: string; icon: string; desc: string; lore?: string }
      consumables?: Array<{ id: string; quantity: number }>
      crystals?: number
      /** Hub-item id (hubItems.json) + count to grant, e.g. a secret 'material' gift item. */
      hubItem?: { itemId: string; count?: number }
      message?: string
      alreadyGrantedText?: string }
  | { type: 'quest'; questId: string; speakerName?: string }
  | { type: 'move'; to: HubCoordinate; message?: string }
  | { type: 'buy'; slotIndex: number }
  | { type: 'buyPack' }
  /** Always-available hub-item purchase (no daily stock rotation). itemId must
   *  exist in web/src/data/hubItems.json; unique items re-offer as "already
   *  owned" once bought. `prerequisite` (§14 syntax, incl. reputation:<tier>)
   *  gates the offer; unmet shows `lockedText`. */
  | { type: 'buyHubItem'; itemId: string; price: number; currency?: 'crystals' | 'tickets'; speakerName?: string; prerequisite?: string; lockedText?: string }
  /** Once-per-day dig spot: gated on holding the required tool hub-item
   *  (default 'spade'); `nightOnly` spots open after dark only; `weatherOnly`
   *  spots only work while the town's weather matches (e.g. rain barrels).
   *  lootTable 'earth' (default) rolls worms/crystals/trinket; 'hollow'
   *  rolls glowcaps/crystals/fireflies; 'rain' always yields rainwater;
   *  'fog' always yields grave-moss. */
  | { type: 'dig'; requiresItemId?: string; nightOnly?: boolean; weatherOnly?: string; lootTable?: 'earth' | 'hollow' | 'rain' | 'fog' }
  /** Once-per-day forage spot — overlays an ordinary tree/bush/flower decor
   *  tile. No tool/night/weather gating (unlike `dig`); rolls wild-berries,
   *  crystals, or a rare four-leaf-clover collectible by default. `lootTable`
   *  'wood' instead always yields a log — for log-pile style gather spots. */
  | { type: 'forage'; lootTable?: 'wood' }
  /** Consumes `requiresItemId` to move a flame decor entry owned by this same
   *  interactable from fromFlameType (default 'flicker') to toFlameType — e.g.
   *  feeding a log to a dying campfire to build it into a roaring blaze, or a
   *  log to an unlit brazier (fromFlameType 'unlit') to light it.
   *  Already at/past toFlameType shows alreadyDoneText instead. Optionally
   *  grants a hub-item and/or sets a dialogue flag (checkPrerequisite's
   *  `flag:` syntax) on success, e.g. to gate a follow-up quest.
   *  groupId/groupTotal/groupCompleteQuestStep together support "light every
   *  member of this group today" challenges: each successful stoke records
   *  this interactable under groupId (web/src/game/hub/groupChallenges.ts,
   *  same once-per-real-day shape as the flame state itself — the whole group
   *  count lapses back to zero if not finished before the day ends); once
   *  groupTotal distinct members have been recorded today, the given quest
   *  step is incremented by 1, e.g. to make a quest turn-in-ready. */
  | { type: 'stokeFlame'; requiresItemId: string; fromFlameType?: FlameType; toFlameType: FlameType
      grantHubItem?: { itemId: string; count?: number }; setFlag?: string; alreadyDoneText?: string
      groupId?: string; groupTotal?: number; groupCompleteQuestStep?: { questId: string; stepKey: string } }

export interface HubInteractable {
  id: string
  tx: number
  ty: number
  building?: string
  decor?: HubInteractableDecor[]
  hitRect: { w: number; h: number }   // resolved: explicit → decor bounds → 1×1
  indicator?: { condition: string; dx: number; dy: number }
  reactions: HubInteractableReaction[]
  /** Stop rendering this interactable entirely once its one-time giveItem
   *  reaction has been granted (see game/hub/interactables.ts). */
  hideOnceGranted?: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

type TileEntry = { rect: number[]; pathType?: string; nonWalkable?: boolean } | { tile: number[]; pathType?: string; nonWalkable?: boolean }

export interface HubStreetGroup {
  pathType?: string
  tiles: [number, number][]
}

export interface HubExitTile {
  tx: number
  ty: number
  screen: string
}

const NOT_FOUND_TILE_ID = 0
function resolveTileId(key: string): number {
  return (BASE_CHIP_TILES as Record<string, number>)[key] ?? NOT_FOUND_TILE_ID
}


export interface HubCoordinate {  tx: number;  ty: number}

export interface HubLocationBundle {
  MAP_W: number
  MAP_H: number
  HUB_TOWN_NAME: string
  ENVIRONMENT: string
  WEATHER?: import('../../game/hub/weather').WeatherConfig

  AVATAR_START: HubCoordinate

  HUB_AREAS: HubArea[]

  HUB_STREET_GROUPS: HubStreetGroup[]

  HUB_STREET_TILES: [number, number][]
  HUB_STREET_NONWALKABLE_TILES: [number, number][]

  HUB_BUILDINGS: HubBuilding[]
  HUB_BUILDING_TILES: [number, number][]
  EXTERIOR_DECOR: any[]
  HUB_FESTIVAL_DECOR: Array<{ festivalId: string; decor: any[] }>
  HUB_WINDOWS: any[]
  HUB_POND_TILES: [number, number][]
  HUB_POND_GROUPS: HubStreetGroup[]
  HUB_BRIDGE_TILES: [number, number][]
  HUB_DOORS: HubDoor[]
  /** interiorId → id of the upgradeKind building whose level gates that
   *  interior's minLevel-tagged decor/exits (see resolveUpgradeLevelKey). */
  HUB_INTERIOR_OWNERS: Record<string, string>
  HUB_INTERIORS: Record<string, HubInterior>
  HUB_NPCS: HubNpc[]
  EXTERIOR_NPCS: HubNpc[]
  INTERIOR_NPCS: Record<string, HubNpc[]>
  NPC_SPAWN_TILES: [number, number][]
  AMBIENT_NPC_SPRITES: string[]
  HUB_LOCKED_DOORS: HubLockedDoor[]
  HUB_TREASURES: HubTreasure[]
  HUB_INTERACTABLES: HubInteractable[]
  HUB_ANIMALS: HubAnimal[]
  HUB_CHICKEN_ZONES: { rect: [number, number, number, number]; count?: number; roost?: [number, number] }[]
  EXIT_TILES: HubExitTile[]


}

export interface HubQuestBundle {
  HUB_QUEST_DEFS: HubQuestDef[]
  FRIENDSHIP_DIALOGUE: FriendshipDialogue
  RELATIONSHIP_DIALOGUE: RelationshipDialogue
  HUB_PICKUP_ITEMS: HubPickupItem[]
  HUB_BLOCKED_PATHS: BlockedPath[]
  HUB_DIALOGUES: Record<string, DialogueTree>
  HUB_CONVERSATION_TOPICS: Record<string, ConversationTopicDef>
}

export function createHubLocationData(
  rawConfig: RawConfig,
): HubLocationBundle {

function expandTiles(entries: TileEntry[]): [number, number][] {
  const out: [number, number][] = []
  for (const e of entries) {
    if ('rect' in e) {
      const [tx1, ty1, tx2, ty2] = e.rect
      for (let tx = tx1; tx <= tx2; tx++)
        for (let ty = ty1; ty <= ty2; ty++)
          out.push([tx, ty])
    } else {
      out.push(e.tile as [number, number])
    }
  }
  return out
}

function groupStreets(entries: TileEntry[]): HubStreetGroup[] {
  const map = new Map<string, [number, number][]>()
  for (const e of entries) {
    const key = e.pathType ?? ''
    if (!map.has(key)) map.set(key, [])
    const tiles = map.get(key)!
    if ('rect' in e) {
      const [tx1, ty1, tx2, ty2] = e.rect
      for (let tx = tx1; tx <= tx2; tx++)
        for (let ty = ty1; ty <= ty2; ty++)
          tiles.push([tx, ty])
    } else {
      tiles.push(e.tile as [number, number])
    }
  }
  return Array.from(map.entries()).map(([key, tiles]) => ({ pathType: key || undefined, tiles }))
}


function buildingOrigin(rectList: number[][]): [number, number] {
  const tx1 = Math.min(...rectList.map(r => r[0]))
  const ty2 = Math.max(...rectList.map(r => r[3]))
  return [tx1, ty2]
}

// ── Exports ────────────────────────────────────────────────────────────────────

const MAP_W = rawConfig.mapW
const MAP_H = rawConfig.mapH
const AVATAR_START = rawConfig.avatarStart

const HUB_TOWN_NAME: string = (rawConfig as unknown as { townName?: string }).townName ?? 'Town'

const HUB_AREAS: HubArea[] = rawConfig.areas.map(a => ({
  id:   a.id,
  name: a.name,
  x:    a.tx * T,
  y:    a.ty * T,
  w:    a.tw * T,
  h:    a.th * T,
}))

const HUB_STREET_GROUPS: HubStreetGroup[] = groupStreets(rawConfig.streets as TileEntry[])
const HUB_STREET_TILES:  [number, number][] = HUB_STREET_GROUPS.flatMap(g => g.tiles)
// Street tiles authored "nonWalkable" still render as normal path art
// (they're part of HUB_STREET_GROUPS/HUB_STREET_TILES above) but are
// reported separately so the hub can subtract them from the walkable set —
// decorative-only path, e.g. a painted crosswalk that shouldn't be routable.
const HUB_STREET_NONWALKABLE_TILES: [number, number][] = expandTiles(
  (rawConfig.streets as TileEntry[]).filter(e => e.nonWalkable)
)
type RawBuilding = {
  rect?: number[]; rects?: number[][];
  id?: string; wall?: string; roof?: string;
  bundleID?: string;
  upgradeKind?: string;
  requiresOwnership?: boolean;
  doors?:   Array<{ tx: number; ty: number; buildingId?: string, hideSign?: boolean, hideSprite?: boolean, hideLabel?: boolean }>
  windows?: Array<{ tx: number; ty: number; tileId: string }>
  decor?:   Array<{ tx: number; ty: number; tileId?: string; bundleID?: string; zlayer?: string }>
  levelDecor?: Array<{ tx?: number; ty?: number; tileId?: string; zlayer?: string; minLevel?: number; hideAtLevel?: number }>
  levelVisuals?: Array<{ minLevel: number; rect?: number[]; wall?: string; roof?: string }>
}
const HUB_BUILDINGS: HubBuilding[] = (rawConfig.buildings as RawBuilding[]).flatMap(b => {
  const rectList = b.rects ?? (b.rect ? [b.rect] : [])
  // Resolve per-building level decor once (attach to the first rect only so a
  // multi-rect building does not render duplicates).
  const levelDecor = (b.levelDecor ?? []).flatMap(d =>
    d.tx == null || d.ty == null || !d.tileId
      ? []
      : [{ tx: d.tx, ty: d.ty, tileId: resolveTileId(d.tileId), zlayer: d.zlayer as 'solid' | 'below' | 'above' | undefined, minLevel: d.minLevel, hideAtLevel: d.hideAtLevel }],
  )
  // Per-level visuals attach to the first rect only (variants own a full footprint).
  const levelVisuals = (b.levelVisuals ?? [])
    .map(v => ({
      minLevel: v.minLevel,
      rect: v.rect && v.rect.length === 4 ? (v.rect as [number, number, number, number]) : undefined,
      wall: resolveWallMaterial(v.wall, HUB_TOWN_NAME, `building "${b.id ?? '?'}" levelVisuals[minLevel=${v.minLevel}]`),
      roof: resolveRoofMaterial(v.roof, HUB_TOWN_NAME, `building "${b.id ?? '?'}" levelVisuals[minLevel=${v.minLevel}]`),
    }))
    .sort((a, c) => a.minLevel - c.minLevel)
  return rectList.map((rect, i) => ({
    rect: rect as [number, number, number, number],
    id:   b.id,
    wall: resolveWallMaterial(b.wall, HUB_TOWN_NAME, `building "${b.id ?? '?'}"`),
    roof: resolveRoofMaterial(b.roof, HUB_TOWN_NAME, `building "${b.id ?? '?'}"`),
    upgradeKind: b.upgradeKind,
    requiresOwnership: b.requiresOwnership,
    ...(i === 0 && levelDecor.length ? { levelDecor } : {}),
    ...(i === 0 && levelVisuals.length ? { levelVisuals } : {}),
  }))
})

const HUB_BUILDING_TILES: [number, number][] = HUB_BUILDINGS.flatMap(b => {
  const [tx1, ty1, tx2, ty2] = b.rect
  const tiles: [number, number][] = []
  for (let tx = tx1; tx <= tx2; tx++)
    for (let ty = ty1; ty <= ty2; ty++)
      tiles.push([tx, ty])
  return tiles
})

// Expand nested doors/windows/decor from building definitions (relative → absolute coords)
const _nestedDoors:   HubDoor[]                                              = []
const _nestedWindows: { tx: number; ty: number; tileId: number }[]           = []
const _nestedDecor:   { tx: number; ty: number; tileId: number; zlayer?: string }[] = []
// interiorId → id of the upgradeKind building whose upgrade level gates that
// interior's minLevel-tagged decor/exits. A door's target interior id is not
// always the owning building's own id (e.g. Ravenwatch's "home-building"
// door leads to interior "home") — this preserves that association from
// config.json before it's discarded, so resolveUpgradeLevelKey can resolve
// the correct building instead of guessing via id-prefix.
const _interiorOwners: Record<string, string> = {}
function recordInteriorOwner(interiorId: string, buildingId: string | undefined, upgradeKind: string | undefined) {
  if (!buildingId || !upgradeKind) return
  if (_interiorOwners[interiorId] && _interiorOwners[interiorId] !== buildingId) {
    const message = `[hub loader] ${HUB_TOWN_NAME}: interior "${interiorId}" claimed as a door target by both "${_interiorOwners[interiorId]}" and "${buildingId}" — upgrade-level gating will use whichever loaded last`
    console.error(message)
    rollbar.error(message)
  }
  _interiorOwners[interiorId] = buildingId
}
for (const b of rawConfig.buildings as RawBuilding[]) {
  const rectList = b.rects ?? (b.rect ? [b.rect] : [])
  if (rectList.length === 0) continue
  const [ox, oy] = buildingOrigin(rectList)
  if (b.bundleID) {
    _nestedWindows.push(...expandBundleWindows(b.bundleID, ox, oy))
    _nestedDecor.push(...expandBundleDecor(b.bundleID, ox, oy))
    const bundleDoors = expandBundleDoors(b.bundleID, b.id ?? '', ox, oy)
    _nestedDoors.push(...bundleDoors)
    for (const d of bundleDoors) recordInteriorOwner(d.buildingId, b.id, b.upgradeKind)
    continue
  }
  for (const d of b.doors ?? []) {
    // The authored position is used as-is, anywhere relative to the building —
    // the door sprite always renders one tile north of it (see
    // buildingRender.ts) unless hideSprite keeps it a fully invisible trigger.
    const targetId = d.buildingId ?? b.id ?? ''
    _nestedDoors.push({ buildingId: targetId, tx: ox + d.tx, ty: oy + d.ty, hideSign: d.hideSign, hideSprite: d.hideSprite, hideLabel: d.hideLabel })
    recordInteriorOwner(targetId, b.id, b.upgradeKind)
  }
  for (const w of b.windows ?? [])
    _nestedWindows.push({ tx: ox + w.tx, ty: oy + w.ty, tileId: resolveTileId(w.tileId) })
  for (const d of b.decor ?? []) {
    if (d.bundleID)
      _nestedDecor.push(...expandBundleDecor(d.bundleID, ox + d.tx, oy + d.ty))
    else if (d.tileId)
      _nestedDecor.push({ tx: ox + d.tx, ty: oy + d.ty, tileId: resolveTileId(d.tileId), zlayer: d.zlayer })
  }
}

type RawDecorEntry = { tx?: number; ty?: number; tileId?: string; bundleID?: string; comment?: string; zlayer?: string; glow?: boolean; glowRadius?: number; pulse?: boolean; flame?: boolean; flameType?: FlameType; flameColor?: FlameColor }
const EXTERIOR_DECOR = [
  ...(rawConfig.exteriorDecor as RawDecorEntry[]).flatMap(d => {
    if (d.tx == null || d.ty == null) return []
    if (d.bundleID) return expandBundleDecor(d.bundleID, d.tx, d.ty)
    if (d.tileId) return [{ tx: d.tx, ty: d.ty, tileId: resolveTileId(d.tileId), zlayer: d.zlayer, glow: d.glow, glowRadius: d.glowRadius, pulse: d.pulse, flame: d.flame, flameType: d.flameType, flameColor: d.flameColor }]
    return []
  }),
  ..._nestedDecor,
]

// Date-gated festival decor groups — resolved like EXTERIOR_DECOR; the renderer
// shows the group whose festivalId matches the active festival (hubCalendar).
type RawFestivalGroup = { festivalId: string; decor: RawDecorEntry[] }
const HUB_FESTIVAL_DECOR: Array<{ festivalId: string; decor: typeof EXTERIOR_DECOR }> = (
  (rawConfig as unknown as { festivalDecor?: RawFestivalGroup[] }).festivalDecor ?? []
).map(g => ({
  festivalId: g.festivalId,
  decor: (g.decor ?? []).flatMap(d => {
    if (d.tx == null || d.ty == null) return []
    if (d.bundleID) return expandBundleDecor(d.bundleID, d.tx, d.ty)
    if (d.tileId) return [{ tx: d.tx, ty: d.ty, tileId: resolveTileId(d.tileId), zlayer: d.zlayer, glow: d.glow, glowRadius: d.glowRadius, pulse: d.pulse, flame: d.flame, flameType: d.flameType, flameColor: d.flameColor }]
    return []
  }),
}))

type RawWindowEntry = { tx: number; ty: number; tileId: string }
const HUB_WINDOWS = [
  ...((rawConfig as unknown as { windows?: RawWindowEntry[] }).windows ?? []).map(w => ({
    tx: w.tx, ty: w.ty, tileId: resolveTileId(w.tileId),
  })),
  ..._nestedWindows,
]

type RawPondEntry = { rect?: number[]; tile?: number[]; pathType?: string }
const HUB_POND_GROUPS: HubStreetGroup[] = groupStreets(
  ((rawConfig as unknown as { pondTiles?: RawPondEntry[] }).pondTiles ?? []) as TileEntry[]
)
const HUB_POND_TILES: [number, number][] = HUB_POND_GROUPS.flatMap(g => g.tiles)

const HUB_BRIDGE_TILES: [number, number][] = expandTiles(
  ((rawConfig as unknown as { bridgeTiles?: RawPondEntry[] }).bridgeTiles ?? []) as TileEntry[]
)

const HUB_DOORS: HubDoor[] = [...((rawConfig as unknown as { doors?: HubDoor[] }).doors ?? []), ..._nestedDoors]
const HUB_INTERIOR_OWNERS: Record<string, string> = _interiorOwners

const HUB_INTERIORS: Record<string, HubInterior> = Object.fromEntries(
  Object.entries(rawConfig.interiors).map(([id, raw]) => {
    const rawAny = raw
    const wallTileIdStr = rawAny.wallTileId as string | undefined
    return [
      id,
      {
        id,
        name:         raw.name,
        width:        raw.width,
        height:       raw.height,
        floorTileId:  resolveTileId(raw.floorTileId),
        wallMaterial: resolveWallMaterial(wallTileIdStr, HUB_TOWN_NAME, `interior "${id}" wallTileId`),
        decor:        (raw.decor as Array<{ tx: number; ty: number; tileId?: string; bundleID?: string; zlayer?: string; minLevel?: number; hideAtLevel?: number }>).flatMap(d => {
          if (d.bundleID)
            return expandBundleDecor(d.bundleID, d.tx, d.ty).map(e => ({ ...e, zlayer: e.zlayer as InteriorDecor['zlayer'], minLevel: d.minLevel, hideAtLevel: d.hideAtLevel }))
          return [{ tx: d.tx, ty: d.ty, tileId: resolveTileId(d.tileId ?? ''), zlayer: d.zlayer as InteriorDecor['zlayer'], minLevel: d.minLevel, hideAtLevel: d.hideAtLevel }]
        }),
        exits: ((rawAny.exits ?? []) as HubInteriorExit[]),
        hours: rawAny.hours as HubInterior['hours'],
        musicId:    rawAny.musicId as string | undefined,
        ambianceId: rawAny.ambianceId as string | undefined,
        playerDecor: rawAny.playerDecor as boolean | undefined,
        dark:        rawAny.dark as boolean | undefined,
        carve:       rawAny.carve as Array<{ tx: number; ty: number; w: number; h: number }> | undefined,
      } satisfies HubInterior,
    ]
  })
)

const HUB_NPCS: HubNpc[] = rawConfig.npcs as HubNpc[]

const EXTERIOR_NPCS = HUB_NPCS.filter(n => !n.building)

const INTERIOR_NPCS: Record<string, HubNpc[]> = HUB_NPCS
  .filter(n => !!n.building)
  .reduce<Record<string, HubNpc[]>>((acc, n) => {
    const key = n.building!
    if (!acc[key]) acc[key] = []
    acc[key].push(n)
    return acc
  }, {})

const NPC_SPAWN_TILES: [number, number][] = [
  ...(rawConfig.npcSpawnTiles as [number, number][]),
  ...HUB_DOORS.map(d => [d.tx, d.ty] as [number, number]),
]

const AMBIENT_NPC_SPRITES: string[] = (rawConfig as { ambientNpcSprites?: string[] }).ambientNpcSprites ?? []







type RawLockedDoor = { buildingId: string; lockedBy: string }
const HUB_LOCKED_DOORS: HubLockedDoor[] = (
  (rawConfig as unknown as { lockedDoors?: RawLockedDoor[] }).lockedDoors ?? []
)



type RawTreasure = { id: string; tx: number; ty: number; tileId: string; collectedTileId?: string; title: string; reward: HubTreasureReward; buildingId?: string }
 const HUB_TREASURES: HubTreasure[] = (
  (rawConfig as unknown as { treasures?: RawTreasure[] }).treasures ?? []
).map(t => ({
  ...t,
  tileId:           resolveTileId(t.tileId),
  collectedTileId:  t.collectedTileId ? resolveTileId(t.collectedTileId) : undefined,
}))

const HUB_INTERACTABLES: HubInteractable[] = (
  (rawConfig as unknown as { interactables?: RawInteractable[] }).interactables ?? []
).map(i => {
  const decor: HubInteractableDecor[] | undefined = i.decor?.map(d => ({
    dx:          d.dx,
    dy:          d.dy,
    tileId:      (d.spriteId || d.shopArtSlot != null) ? undefined : resolveTileId(d.tileId ?? ''),
    spriteId:    d.spriteId,
    shopArtSlot: d.shopArtSlot,
    zlayer:      d.zlayer as HubInteractableDecor['zlayer'],
    glow:        d.glow,
    glowRadius:  d.glowRadius,
    pulse:       d.pulse,
    flame:       d.flame,
    flameType:   d.flameType as FlameType | undefined,
    flameColor:  d.flameColor as FlameColor | undefined,
  }))
  // Hit area: explicit rect → owned-decor bounds → single tile
  const hitRect = i.hitRect ?? (decor && decor.length > 0
    ? { w: Math.max(...decor.map(d => d.dx)) + 1, h: Math.max(...decor.map(d => d.dy)) + 1 }
    : { w: 1, h: 1 })
  return {
    id:        i.id,
    tx:        i.tx,
    ty:        i.ty,
    building:  i.building,
    decor,
    hitRect,
    indicator: i.indicator ? { condition: i.indicator.condition, dx: i.indicator.dx ?? 0, dy: i.indicator.dy ?? 0 } : undefined,
    reactions: i.reactions as unknown as HubInteractableReaction[],
    hideOnceGranted: i.hideOnceGranted,
  }
})

const HUB_ANIMALS: HubAnimal[] = (
  (rawConfig as unknown as { animals?: RawAnimal[] }).animals ?? []
).map(a => ({
  id:           a.id,
  type:         a.type as HubAnimalType,
  variant:      a.variant,
  pattern:      a.pattern,
  tx:           a.tx,
  ty:           a.ty,
  name:         a.name,
  dialogue:     a.dialogue,
  questGive:    a.questGive,
  questReceive: a.questReceive,
  roam:         a.roam,
  areaRect:     a.areaRect,
  dialogueTree: a.dialogueTree,
}))

const HUB_CHICKEN_ZONES = (
  (rawConfig as unknown as { chickenZones?: { rect: number[]; count?: number; roost?: number[] }[] }).chickenZones ?? []
).map(z => ({
  rect: z.rect as [number, number, number, number],
  count: z.count,
  roost: z.roost ? (z.roost as [number, number]) : undefined,
}))

const ENVIRONMENT: string = (rawConfig as unknown as { environment?: string }).environment ?? 'camp'
const WEATHER = (rawConfig as unknown as { weather?: import('../../game/hub/weather').WeatherConfig }).weather

type RawExitTile = { tx: number; ty: number; screen: string }
 const HUB_EXIT_TILES: HubExitTile[] = (
  (rawConfig as unknown as { exitTiles?: RawExitTile[] }).exitTiles ?? []
)


// export interface HubQuestStep {
//   key: string
//   type: 'collect' | 'deliver'
//   pickupIds?: string[]
//   targetNpcId?: string
//   required: number
//   chain?: string
// }

// export interface HubQuestReward {
//   crystals?: number
//   collectible?: { id: string; name: string; icon: string; desc: string }
//   card?: { name: string; count?: number }
//   friendship?: Record<string, number>
//   unlock?: string
// }

// export interface HubQuestDef {
//   id: string
//   title: string
//   type: 'fetch' | 'chain' | 'lost-items'
//   giverNpcId: string
//   receiverNpcId: string
//   prerequisite?: string
//   offerDialogue: string
//   activeDialogue: string | Record<string, string>
//   completeDialogue: string
//   steps: HubQuestStep[]
//   reward: HubQuestReward
//   availableHours?: { start: number; end: number }
// }




  return {
    MAP_W,
    MAP_H,
    AVATAR_START,
    HUB_TOWN_NAME,
    ENVIRONMENT,
    WEATHER,
    HUB_AREAS,
    HUB_STREET_GROUPS,
    HUB_STREET_TILES: HUB_STREET_TILES,
    HUB_STREET_NONWALKABLE_TILES,

    HUB_BUILDINGS,
    HUB_BUILDING_TILES,
    EXTERIOR_DECOR,
    HUB_FESTIVAL_DECOR,
    HUB_WINDOWS,
    HUB_POND_TILES,
    HUB_POND_GROUPS,
    HUB_BRIDGE_TILES,
    HUB_DOORS,
    HUB_INTERIOR_OWNERS,
    HUB_INTERIORS,
    HUB_NPCS,
    EXTERIOR_NPCS,
    INTERIOR_NPCS,
    NPC_SPAWN_TILES,
    AMBIENT_NPC_SPRITES,

    HUB_LOCKED_DOORS,
    HUB_TREASURES,
    HUB_INTERACTABLES,
    HUB_ANIMALS,
    HUB_CHICKEN_ZONES,
    EXIT_TILES: HUB_EXIT_TILES,

  }
}

export function createHubQuestData(
  
  rawQuestConfig: RawQuestConfig
): HubQuestBundle {

const HUB_QUEST_DEFS: HubQuestDef[] = rawQuestConfig.quests as unknown as HubQuestDef[] || {}

const FRIENDSHIP_DIALOGUE = rawQuestConfig.friendshipDialogue || {}

const RELATIONSHIP_DIALOGUE: RelationshipDialogue = rawQuestConfig.relationshipDialogue || {}

type RawBlockedPathNpc = { id: string; sprite: string; tx: number; ty: number; proximityDialogue?: { atDistance: number; text: string }[]; tapDialogue?: string }
type RawBlockedPathState = { decor?: Array<{ tx: number; ty: number; tileId?: string; bundleID?: string; zlayer?: string }>; npcs?: RawBlockedPathNpc[] }


type RawBlockedPath = { id: string; blockedTiles: [number, number][]; questId?: string; unlockedByInteractable?: string; blocked: RawBlockedPathState; cleared: RawBlockedPathState }

function resolveBlockedPathState(raw: RawBlockedPathState): BlockedPathState {
  return {
    decor: (raw.decor ?? []).flatMap(d => {
      if (d.bundleID) return expandBundleDecor(d.bundleID, d.tx, d.ty)
      return [{ tx: d.tx, ty: d.ty, tileId: resolveTileId(d.tileId ?? ''), zlayer: d.zlayer }]
    }),
    npcs: raw.npcs ?? [],
  }
}

const HUB_BLOCKED_PATHS: BlockedPath[] = (
  (rawQuestConfig as unknown as { blockedPaths?: RawBlockedPath[] }).blockedPaths ?? []
).map(bp => ({
  id:                    bp.id,
  blockedTiles:          bp.blockedTiles,
  questId:               bp.questId,
  unlockedByInteractable: bp.unlockedByInteractable,
  blocked:               resolveBlockedPathState(bp.blocked),
  cleared:               resolveBlockedPathState(bp.cleared),
}))

type RawPickup = { id: string; tx: number; ty: number; tileId: string; extraTiles?: Array<{ dx: number; dy: number; tileId: string }>; building?: string; questId?: string; chain?: string; requireTouch?: boolean; glow?: boolean; glowRadius?: number; pulse?: boolean }
const HUB_PICKUP_ITEMS: HubPickupItem[] = (
  (rawQuestConfig as unknown as { pickupItems?: RawPickup[] }).pickupItems ?? []
).map(p => ({
  id:           p.id,
  tx:           p.tx,
  ty:           p.ty,
  tileId:       resolveTileId(p.tileId),
  extraTiles:   p.extraTiles?.map(t => ({ dx: t.dx, dy: t.dy, tileId: resolveTileId(t.tileId) })),
  building:     p.building,
  questId:      p.questId,
  chain:        p.chain,
  requireTouch: p.requireTouch,
  glow:         p.glow,
  glowRadius:   p.glowRadius,
  pulse:        p.pulse,
}))

const HUB_DIALOGUES: Record<string, DialogueTree> = Object.fromEntries(
  ((rawQuestConfig as unknown as { dialogues?: DialogueTree[] }).dialogues ?? []).map(d => [d.id, d])
)

const HUB_CONVERSATION_TOPICS: Record<string, ConversationTopicDef> = Object.fromEntries(
  ((rawQuestConfig as unknown as { conversationTopics?: ConversationTopicDef[] }).conversationTopics ?? []).map(t => [t.id, t])
)

  return {


    HUB_QUEST_DEFS,
    FRIENDSHIP_DIALOGUE,
    RELATIONSHIP_DIALOGUE,
    HUB_BLOCKED_PATHS,
    HUB_PICKUP_ITEMS,
    HUB_DIALOGUES,
    HUB_CONVERSATION_TOPICS,
  }
}