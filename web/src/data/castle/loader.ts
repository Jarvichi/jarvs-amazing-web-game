import rawConfig from './config.json'
import rawQuestConfig from './questDefs.json'
import { BASE_CHIP_TILES } from '../tiles/baseChipIndex'
import { WALL_TILES } from '../tiles/buildingMaterials'
import type { WallMaterial, RoofMaterial } from '../tiles/buildingMaterials'
import type {
  HubArea, HubBuilding, HubDoor, InteriorDecor, HubInterior,
  HubInteriorExit, HubNpc, HubPickupItem, BlockedPath, BlockedPathState,
  HubLockedDoor, HubTreasure, HubTreasureReward, HubStreetGroup,
} from '../hub/loader'
import type { HubLocationData, HubExitTile } from '../hub/locationTypes'
import type { HubQuestDef } from '../hub/questDefs'

const WALL_MATERIAL_NAMES = new Set<string>(Object.keys(WALL_TILES))
const T = 32

function resolveTileId(key: string): number {
  return (BASE_CHIP_TILES as Record<string, number>)[key] ?? 666
}

type TileEntry = { rect: number[]; pathType?: string } | { tile: number[]; pathType?: string }

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

const MAP_W = rawConfig.mapW
const MAP_H = rawConfig.mapH
const AVATAR_START = rawConfig.avatarStart as [number, number]
const TOWN_NAME: string = (rawConfig as unknown as { townName?: string }).townName ?? 'Castle'

const HUB_AREAS: HubArea[] = rawConfig.areas.map(a => ({
  id:   a.id,
  name: a.name,
  x:    a.tx * T,
  y:    a.ty * T,
  w:    a.tw * T,
  h:    a.th * T,
}))

const HUB_STREET_GROUPS: HubStreetGroup[] = groupStreets(rawConfig.streets as TileEntry[])
const HUB_STREET_TILES: [number, number][] = HUB_STREET_GROUPS.flatMap(g => g.tiles)

type RawBuilding = {
  rect?: number[]; rects?: number[][];
  id?: string; wall?: string; roof?: string;
  doors?:   Array<{ tx: number; ty: number; buildingId?: string }>
  windows?: Array<{ tx: number; ty: number; tileId: string }>
  decor?:   Array<{ tx: number; ty: number; tileId: string; zlayer?: string }>
}

const HUB_BUILDINGS: HubBuilding[] = (rawConfig.buildings as RawBuilding[]).flatMap(b => {
  const rectList = b.rects ?? (b.rect ? [b.rect] : [])
  return rectList.map(rect => ({
    rect: rect as [number, number, number, number],
    id:   b.id,
    wall: b.wall as WallMaterial | undefined,
    roof: b.roof as RoofMaterial | undefined,
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

const _nestedDoors:   HubDoor[] = []
const _nestedWindows: { tx: number; ty: number; tileId: number }[] = []
const _nestedDecor:   { tx: number; ty: number; tileId: number; zlayer?: string }[] = []

for (const b of rawConfig.buildings as RawBuilding[]) {
  const rectList = b.rects ?? (b.rect ? [b.rect] : [])
  if (rectList.length === 0) continue
  const [ox, oy] = buildingOrigin(rectList)
  for (const d of b.doors ?? []) {
    const absTy = oy + d.ty
    let storeTy  = absTy
    let tyAdjust = 0
    if (!rectList.some(r => r[3] + 1 === absTy)) {
      const candidate = rectList
        .map(r => r[3] + 1)
        .filter(ty2p1 => ty2p1 > absTy)
        .sort((a, b) => a - b)[0]
      if (candidate !== undefined) { storeTy = candidate; tyAdjust = candidate - absTy }
    }
    _nestedDoors.push({ buildingId: d.buildingId ?? b.id ?? '', tx: ox + d.tx, ty: storeTy, ...(tyAdjust ? { tyAdjust } : {}) })
  }
  for (const w of b.windows ?? [])
    _nestedWindows.push({ tx: ox + w.tx, ty: oy + w.ty, tileId: resolveTileId(w.tileId) })
  for (const d of b.decor ?? [])
    _nestedDecor.push({ tx: ox + d.tx, ty: oy + d.ty, tileId: resolveTileId(d.tileId), zlayer: d.zlayer })
}

type RawDecorEntry = { tx?: number; ty?: number; tileId?: string; comment?: string; zlayer?: string }
const EXTERIOR_DECOR = [
  ...(rawConfig.exteriorDecor as RawDecorEntry[])
    .filter((d): d is { tx: number; ty: number; tileId: string; zlayer?: string } => d.tx != null && d.ty != null && d.tileId != null)
    .map(d => ({ tx: d.tx, ty: d.ty, tileId: resolveTileId(d.tileId), zlayer: d.zlayer })),
  ..._nestedDecor,
]

const HUB_WINDOWS = [..._nestedWindows]
const HUB_POND_TILES: [number, number][] = []
const HUB_DOORS: HubDoor[] = _nestedDoors

const HUB_INTERIORS: Record<string, HubInterior> = Object.fromEntries(
  Object.entries(rawConfig.interiors).map(([id, raw]) => {
    const rawAny = raw as Record<string, unknown>
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
        decor:        (raw.decor as Array<{ tx: number; ty: number; tileId: string; zlayer?: string }>).map(d => ({
          tx:     d.tx,
          ty:     d.ty,
          tileId: resolveTileId(d.tileId),
          zlayer: d.zlayer as InteriorDecor['zlayer'],
        })),
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

const NPC_SPAWN_TILES: [number, number][] = HUB_DOORS.map(d => [d.tx, d.ty] as [number, number])
const AMBIENT_NPC_SPRITES: string[] = []

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

const HUB_BLOCKED_PATHS: BlockedPath[] = []
const HUB_LOCKED_DOORS: HubLockedDoor[] = []
const HUB_TREASURES: HubTreasure[] = []

type RawExitTile = { tx: number; ty: number; screen: string }
const EXIT_TILES: HubExitTile[] = (
  (rawConfig as unknown as { exitTiles?: RawExitTile[] }).exitTiles ?? []
)

export const CASTLE_QUEST_DEFS: HubQuestDef[] = (rawQuestConfig as unknown as { quests: HubQuestDef[] }).quests

export const CASTLE_LOCATION_DATA: HubLocationData = {
  MAP_W,
  MAP_H,
  AVATAR_START,
  TOWN_NAME,
  HUB_AREAS,
  HUB_STREET_GROUPS,
  HUB_STREET_TILES,
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
  HUB_PICKUP_ITEMS,
  HUB_BLOCKED_PATHS,
  HUB_LOCKED_DOORS,
  HUB_TREASURES,
  EXIT_TILES,
}
