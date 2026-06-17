import { BASE_CHIP_TILES } from '../tiles/baseChipIndex'
import { WALL_TILES } from '../tiles/buildingMaterials'
import type { WallMaterial, RoofMaterial } from '../tiles/buildingMaterials'
import { expandBundleDecor, expandBundleWindows, expandBundleDoors } from '../bundles/bundleLoader'
import { DialogueTree, FriendshipDialogue, HubQuestDef, QuestInnRumour, RawQuestConfig, RelationshipDialogue } from './questDefs'
import { RawAnimal, RawConfig, RawInteractable } from './config'

const WALL_MATERIAL_NAMES = new Set<string>(Object.keys(WALL_TILES))

const T = 32

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
}

export interface HubDoor {
  buildingId: string
  tx: number
  ty: number
  hideSign?: boolean
  tyAdjust?: number  // tiles to shift the render position upward (0 = standard south-face)
}

export interface InteriorDecor {
  tx:      number
  ty:      number
  tileId:  number
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
  schedule?: NpcScheduleEntry[]
  homeBed?: { buildingId: string; tx: number; ty: number }
  /** Id of a branching dialogue tree (questDefs.json `dialogues`) to run on tap. */
  dialogueTree?: string
}

export type HubAnimalType =
  | 'cat' | 'dog' | 'bird' | 'fish'
  | 'butterfly' | 'rabbit' | 'chicken' | 'frog'

export interface HubAnimal {
  id: string
  type: HubAnimalType
  variant?: string
  tx: number
  ty: number
  name?: string
  dialogue?: string[]
  questGive?: string
  questReceive?: string | string[]
  roam?: boolean
  areaRect?: number[]
}

export interface HubPickupItem {
  id: string
  tx: number
  ty: number
  tileId: number
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
  questId: string
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
  tileId: number
  zlayer?: 'solid' | 'below' | 'above'
}

export type HubInteractableReaction =
  | { type: 'dialogue'; speakerName?: string; text: string | string[] }
  | { type: 'screen'; screen: string }
  | { type: 'giveItem'
      collectible?: { id: string; name: string; icon: string; desc: string }
      consumables?: Array<{ id: string; quantity: number }>
      crystals?: number
      message?: string
      alreadyGrantedText?: string }
  | { type: 'quest'; questId: string; speakerName?: string }
  | { type: 'move'; to: HubCoordinate; message?: string }

export interface HubInteractable {
  id: string
  tx: number
  ty: number
  building?: string
  decor?: HubInteractableDecor[]
  hitRect: { w: number; h: number }   // resolved: explicit → decor bounds → 1×1
  indicator?: { condition: string; dx: number; dy: number }
  reactions: HubInteractableReaction[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

type TileEntry = { rect: number[]; pathType?: string } | { tile: number[]; pathType?: string }

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

  AVATAR_START: HubCoordinate

  HUB_AREAS: HubArea[]

  HUB_STREET_GROUPS: HubStreetGroup[]

  HUB_STREET_TILES: [number, number][]

  HUB_BUILDINGS: HubBuilding[]
  HUB_BUILDING_TILES: [number, number][]
  EXTERIOR_DECOR: any[]
  HUB_WINDOWS: any[]
  HUB_POND_TILES: [number, number][]
  HUB_DOORS: HubDoor[]
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
  INN_RUMOURS?: QuestInnRumour[]
  FRIENDSHIP_DIALOGUE: FriendshipDialogue
  RELATIONSHIP_DIALOGUE: RelationshipDialogue
  HUB_PICKUP_ITEMS: HubPickupItem[]
  HUB_BLOCKED_PATHS: BlockedPath[]
  HUB_DIALOGUES: Record<string, DialogueTree>
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
type RawBuilding = {
  rect?: number[]; rects?: number[][];
  id?: string; wall?: string; roof?: string;
  bundleID?: string;
  upgradeKind?: string;
  doors?:   Array<{ tx: number; ty: number; buildingId?: string, hideSign?: boolean }>
  windows?: Array<{ tx: number; ty: number; tileId: string }>
  decor?:   Array<{ tx: number; ty: number; tileId?: string; bundleID?: string; zlayer?: string }>
}
const HUB_BUILDINGS: HubBuilding[] = (rawConfig.buildings as RawBuilding[]).flatMap(b => {
  const rectList = b.rects ?? (b.rect ? [b.rect] : [])
  return rectList.map(rect => ({
    rect: rect as [number, number, number, number],
    id:   b.id,
    wall: b.wall as WallMaterial | undefined,
    roof: b.roof as RoofMaterial | undefined,
    upgradeKind: b.upgradeKind,
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
for (const b of rawConfig.buildings as RawBuilding[]) {
  const rectList = b.rects ?? (b.rect ? [b.rect] : [])
  if (rectList.length === 0) continue
  const [ox, oy] = buildingOrigin(rectList)
  if (b.bundleID) {
    _nestedWindows.push(...expandBundleWindows(b.bundleID, ox, oy))
    _nestedDecor.push(...expandBundleDecor(b.bundleID, ox, oy))
    _nestedDoors.push(...expandBundleDoors(b.bundleID, b.id ?? '', ox, oy))
    continue
  }
  for (const d of b.doors ?? []) {
    const absTy = oy + d.ty
    // Find the rect whose south face (ty2+1) the door will match against.
    // If no rect has ty2+1 === absTy, find the nearest rect above and compute tyAdjust
    // so the renderer shifts the door tiles up by that amount.
    let storeTy  = absTy
    let tyAdjust = 0
    if (!rectList.some(r => r[3] + 1 === absTy)) {
      const candidate = rectList
        .map(r => r[3] + 1)
        .filter(ty2p1 => ty2p1 > absTy)
        .sort((a, b) => a - b)[0]
      if (candidate !== undefined) { storeTy = candidate; tyAdjust = candidate - absTy }
    }
    _nestedDoors.push({ buildingId: d.buildingId ?? b.id ?? '', tx: ox + d.tx, ty: storeTy, hideSign: d.hideSign, ...(tyAdjust ? { tyAdjust } : {}) })
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

type RawDecorEntry = { tx?: number; ty?: number; tileId?: string; bundleID?: string; comment?: string; zlayer?: string }
const EXTERIOR_DECOR = [
  ...(rawConfig.exteriorDecor as RawDecorEntry[]).flatMap(d => {
    if (d.tx == null || d.ty == null) return []
    if (d.bundleID) return expandBundleDecor(d.bundleID, d.tx, d.ty)
    if (d.tileId) return [{ tx: d.tx, ty: d.ty, tileId: resolveTileId(d.tileId), zlayer: d.zlayer }]
    return []
  }),
  ..._nestedDecor,
]

type RawWindowEntry = { tx: number; ty: number; tileId: string }
const HUB_WINDOWS = [
  ...((rawConfig as unknown as { windows?: RawWindowEntry[] }).windows ?? []).map(w => ({
    tx: w.tx, ty: w.ty, tileId: resolveTileId(w.tileId),
  })),
  ..._nestedWindows,
]

type RawPondEntry = { rect?: number[]; tile?: number[] }
const HUB_POND_TILES: [number, number][] = expandTiles(
  ((rawConfig as unknown as { pondTiles?: RawPondEntry[] }).pondTiles ?? []) as TileEntry[]
)

const HUB_DOORS: HubDoor[] = [...((rawConfig as unknown as { doors?: HubDoor[] }).doors ?? []), ..._nestedDoors]

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
        wallMaterial: wallTileIdStr && WALL_MATERIAL_NAMES.has(wallTileIdStr) ? wallTileIdStr as WallMaterial : undefined,
        decor:        (raw.decor as Array<{ tx: number; ty: number; tileId?: string; bundleID?: string; zlayer?: string }>).flatMap(d => {
          if (d.bundleID)
            return expandBundleDecor(d.bundleID, d.tx, d.ty).map(e => ({ ...e, zlayer: e.zlayer as InteriorDecor['zlayer'] }))
          return [{ tx: d.tx, ty: d.ty, tileId: resolveTileId(d.tileId ?? ''), zlayer: d.zlayer as InteriorDecor['zlayer'] }]
        }),
        exits: ((rawAny.exits ?? []) as HubInteriorExit[]),
        hours: rawAny.hours as HubInterior['hours'],
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
    dx:     d.dx,
    dy:     d.dy,
    tileId: resolveTileId(d.tileId),
    zlayer: d.zlayer as HubInteractableDecor['zlayer'],
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
  }
})

const HUB_ANIMALS: HubAnimal[] = (
  (rawConfig as unknown as { animals?: RawAnimal[] }).animals ?? []
).map(a => ({
  id:           a.id,
  type:         a.type as HubAnimalType,
  variant:      a.variant,
  tx:           a.tx,
  ty:           a.ty,
  name:         a.name,
  dialogue:     a.dialogue,
  questGive:    a.questGive,
  questReceive: a.questReceive,
  roam:         a.roam,
  areaRect:     a.areaRect,
}))

const HUB_CHICKEN_ZONES = (
  (rawConfig as unknown as { chickenZones?: { rect: number[]; count?: number; roost?: number[] }[] }).chickenZones ?? []
).map(z => ({
  rect: z.rect as [number, number, number, number],
  count: z.count,
  roost: z.roost ? (z.roost as [number, number]) : undefined,
}))

 const HUB_TOWN_NAME: string = (rawConfig as unknown as { townName?: string }).townName ?? 'Town'
const ENVIRONMENT: string = (rawConfig as unknown as { environment?: string }).environment ?? 'camp'

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
    HUB_AREAS,
    HUB_STREET_GROUPS,
    HUB_STREET_TILES: HUB_STREET_TILES,
    
    HUB_BUILDINGS,
    HUB_BUILDING_TILES,
    EXTERIOR_DECOR,
    HUB_WINDOWS,
    HUB_POND_TILES,
    HUB_DOORS,
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

const INN_RUMOURS = rawQuestConfig.innRumours || []

const FRIENDSHIP_DIALOGUE = rawQuestConfig.friendshipDialogue || {}

const RELATIONSHIP_DIALOGUE: RelationshipDialogue = rawQuestConfig.relationshipDialogue || {}

type RawBlockedPathNpc = { id: string; sprite: string; tx: number; ty: number; proximityDialogue?: { atDistance: number; text: string }[]; tapDialogue?: string }
type RawBlockedPathState = { decor?: Array<{ tx: number; ty: number; tileId?: string; bundleID?: string; zlayer?: string }>; npcs?: RawBlockedPathNpc[] }


type RawBlockedPath = { id: string; blockedTiles: [number, number][]; questId: string; blocked: RawBlockedPathState; cleared: RawBlockedPathState }

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
  id:           bp.id,
  blockedTiles: bp.blockedTiles,
  questId:      bp.questId,
  blocked:      resolveBlockedPathState(bp.blocked),
  cleared:      resolveBlockedPathState(bp.cleared),
}))

type RawPickup = { id: string; tx: number; ty: number; tileId: string; building?: string; questId?: string; chain?: string; requireTouch?: boolean }
const HUB_PICKUP_ITEMS: HubPickupItem[] = (
  (rawQuestConfig as unknown as { pickupItems?: RawPickup[] }).pickupItems ?? []
).map(p => ({
  id:           p.id,
  tx:           p.tx,
  ty:           p.ty,
  tileId:       resolveTileId(p.tileId),
  building:     p.building,
  questId:      p.questId,
  chain:        p.chain,
  requireTouch: p.requireTouch,
}))

const HUB_DIALOGUES: Record<string, DialogueTree> = Object.fromEntries(
  ((rawQuestConfig as unknown as { dialogues?: DialogueTree[] }).dialogues ?? []).map(d => [d.id, d])
)

  return {


    HUB_QUEST_DEFS,
    INN_RUMOURS,
    FRIENDSHIP_DIALOGUE,
    RELATIONSHIP_DIALOGUE,
    HUB_BLOCKED_PATHS,
    HUB_PICKUP_ITEMS,
    HUB_DIALOGUES,
  }
}