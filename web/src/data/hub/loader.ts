import rawConfig from './config.json'
import rawQuestConfig from './questDefs.json'
import { BASE_CHIP_TILES } from '../tiles/baseChipIndex'
import type { WallMaterial, RoofMaterial } from '../tiles/buildingMaterials'

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
}

export interface HubDoor {
  buildingId: string
  tx: number
  ty: number
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

export interface HubInterior {
  id: string
  name: string
  width: number
  height: number
  decor: InteriorDecor[]
  floorTileId?: number
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

// ── Helpers ────────────────────────────────────────────────────────────────────

type TileEntry = { rect: number[]; pathType?: string } | { tile: number[]; pathType?: string }

export interface HubStreetGroup {
  pathType?: string
  tiles: [number, number][]
}

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

function resolveTileId(key: string): number {
  return (BASE_CHIP_TILES as Record<string, number>)[key] ?? 666
}

function buildingOrigin(rectList: number[][]): [number, number] {
  const tx1 = Math.min(...rectList.map(r => r[0]))
  const ty2 = Math.max(...rectList.map(r => r[3]))
  return [tx1, ty2]
}

// ── Exports ────────────────────────────────────────────────────────────────────

export const MAP_W = rawConfig.mapW
export const MAP_H = rawConfig.mapH
export const AVATAR_START = rawConfig.avatarStart as [number, number]

export const HUB_AREAS: HubArea[] = rawConfig.areas.map(a => ({
  id:   a.id,
  name: a.name,
  x:    a.tx * T,
  y:    a.ty * T,
  w:    a.tw * T,
  h:    a.th * T,
}))

export const HUB_STREET_GROUPS: HubStreetGroup[] = groupStreets(rawConfig.streets as TileEntry[])
export const HUB_STREET_TILES:  [number, number][] = HUB_STREET_GROUPS.flatMap(g => g.tiles)
type RawBuilding = {
  rect?: number[]; rects?: number[][];
  id?: string; wall?: string; roof?: string;
  doors?:   Array<{ tx: number; ty: number; buildingId?: string }>
  windows?: Array<{ tx: number; ty: number; tileId: string }>
  decor?:   Array<{ tx: number; ty: number; tileId: string; zlayer?: string }>
}
export const HUB_BUILDINGS: HubBuilding[] = (rawConfig.buildings as RawBuilding[]).flatMap(b => {
  const rectList = b.rects ?? (b.rect ? [b.rect] : [])
  return rectList.map(rect => ({
    rect: rect as [number, number, number, number],
    id:   b.id,
    wall: b.wall as WallMaterial | undefined,
    roof: b.roof as RoofMaterial | undefined,
  }))
})

export const HUB_BUILDING_TILES: [number, number][] = HUB_BUILDINGS.flatMap(b => {
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
    _nestedDoors.push({ buildingId: d.buildingId ?? b.id ?? '', tx: ox + d.tx, ty: storeTy, ...(tyAdjust ? { tyAdjust } : {}) })
  }
  for (const w of b.windows ?? [])
    _nestedWindows.push({ tx: ox + w.tx, ty: oy + w.ty, tileId: resolveTileId(w.tileId) })
  for (const d of b.decor ?? [])
    _nestedDecor.push({ tx: ox + d.tx, ty: oy + d.ty, tileId: resolveTileId(d.tileId), zlayer: d.zlayer })
}

type RawDecorEntry = { tx?: number; ty?: number; tileId?: string; comment?: string; zlayer?: string }
export const EXTERIOR_DECOR = [
  ...(rawConfig.exteriorDecor as RawDecorEntry[])
    .filter((d): d is { tx: number; ty: number; tileId: string; zlayer?: string } => d.tx != null && d.ty != null && d.tileId != null)
    .map(d => ({ tx: d.tx, ty: d.ty, tileId: resolveTileId(d.tileId), zlayer: d.zlayer })),
  ..._nestedDecor,
]

type RawWindowEntry = { tx: number; ty: number; tileId: string }
export const HUB_WINDOWS = [
  ...((rawConfig as unknown as { windows?: RawWindowEntry[] }).windows ?? []).map(w => ({
    tx: w.tx, ty: w.ty, tileId: resolveTileId(w.tileId),
  })),
  ..._nestedWindows,
]

type RawPondEntry = { rect?: number[]; tile?: number[] }
export const HUB_POND_TILES: [number, number][] = expandTiles(
  ((rawConfig as unknown as { pondTiles?: RawPondEntry[] }).pondTiles ?? []) as TileEntry[]
)

export const HUB_DOORS: HubDoor[] = [...((rawConfig as unknown as { doors?: HubDoor[] }).doors ?? []), ..._nestedDoors]

export const HUB_INTERIORS: Record<string, HubInterior> = Object.fromEntries(
  Object.entries(rawConfig.interiors).map(([id, raw]) => [
    id,
    {
      id,
      name:        raw.name,
      width:       raw.width,
      height:      raw.height,
      floorTileId: resolveTileId(raw.floorTileId),
      decor:       (raw.decor as Array<{ tx: number; ty: number; tileId: string; zlayer?: string }>).map(d => ({
        tx: d.tx, ty: d.ty, tileId: resolveTileId(d.tileId), zlayer: d.zlayer as InteriorDecor['zlayer'],
      })),
    } satisfies HubInterior,
  ])
)

export const HUB_NPCS: HubNpc[] = rawConfig.npcs as HubNpc[]

export const EXTERIOR_NPCS = HUB_NPCS.filter(n => !n.building)

export const INTERIOR_NPCS: Record<string, HubNpc[]> = HUB_NPCS
  .filter(n => !!n.building)
  .reduce<Record<string, HubNpc[]>>((acc, n) => {
    const key = n.building!
    ;(acc[key] ??= []).push(n)
    return acc
  }, {})

export const NPC_SPAWN_TILES: [number, number][] = [
  ...(rawConfig.npcSpawnTiles as [number, number][]),
  ...HUB_DOORS.map(d => [d.tx, d.ty] as [number, number]),
]

export const AMBIENT_NPC_SPRITES: string[] = (rawConfig as { ambientNpcSprites?: string[] }).ambientNpcSprites ?? []

type RawPickup = { id: string; tx: number; ty: number; tileId: string; building?: string; questId?: string; chain?: string; requireTouch?: boolean }
export const HUB_PICKUP_ITEMS: HubPickupItem[] = (
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

type RawBlockedPathNpc = { id: string; sprite: string; tx: number; ty: number; proximityDialogue?: { atDistance: number; text: string }[]; tapDialogue?: string }
type RawBlockedPathState = { decor?: Array<{ tx: number; ty: number; tileId: string; zlayer?: string }>; npcs?: RawBlockedPathNpc[] }
type RawBlockedPath = { id: string; blockedTiles: [number, number][]; questId: string; blocked: RawBlockedPathState; cleared: RawBlockedPathState }

function resolveBlockedPathState(raw: RawBlockedPathState): BlockedPathState {
  return {
    decor: (raw.decor ?? []).map(d => ({ tx: d.tx, ty: d.ty, tileId: resolveTileId(d.tileId), zlayer: d.zlayer })),
    npcs:  raw.npcs ?? [],
  }
}

export const HUB_BLOCKED_PATHS: BlockedPath[] = (
  (rawQuestConfig as unknown as { blockedPaths?: RawBlockedPath[] }).blockedPaths ?? []
).map(bp => ({
  id:           bp.id,
  blockedTiles: bp.blockedTiles,
  questId:      bp.questId,
  blocked:      resolveBlockedPathState(bp.blocked),
  cleared:      resolveBlockedPathState(bp.cleared),
}))

type RawLockedDoor = { buildingId: string; lockedBy: string }
export const HUB_LOCKED_DOORS: HubLockedDoor[] = (
  (rawConfig as unknown as { lockedDoors?: RawLockedDoor[] }).lockedDoors ?? []
)

export interface HubTreasureReward {
  crystals?:    number
  collectible?: { id: string; name: string; icon: string; desc: string }
}

export interface HubTreasure {
  id:               string
  tx:               number
  ty:               number
  tileId:           number
  collectedTileId?: number   // if set, swap to this tile on collect; if absent, hide the sprite
  title:            string
  reward:           HubTreasureReward
}

type RawTreasure = { id: string; tx: number; ty: number; tileId: string; collectedTileId?: string; title: string; reward: HubTreasureReward }
export const HUB_TREASURES: HubTreasure[] = (
  (rawConfig as unknown as { treasures?: RawTreasure[] }).treasures ?? []
).map(t => ({
  ...t,
  tileId:           resolveTileId(t.tileId),
  collectedTileId:  t.collectedTileId ? resolveTileId(t.collectedTileId) : undefined,
}))
