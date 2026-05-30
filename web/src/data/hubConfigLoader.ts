import rawConfig from './hubConfig.json'
import { BASE_CHIP_TILES } from './tiles/baseChipIndex'
import type { WallMaterial, RoofMaterial } from './tiles/buildingMaterials'

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
}

export interface InteriorDecor {
  tx: number
  ty: number
  tileId: number
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
}

// ── Helpers ────────────────────────────────────────────────────────────────────

type TileEntry = { rect: number[] } | { tile: number[] }

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

function resolveTileId(key: string): number {
  return (BASE_CHIP_TILES as Record<string, number>)[key] ?? 666
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

export const HUB_STREET_TILES   = expandTiles(rawConfig.streets   as TileEntry[])
export const HUB_BUILDING_TILES = expandTiles(rawConfig.buildings as TileEntry[])

type RawBuilding = { rect: number[]; id?: string; wall?: string; roof?: string }
export const HUB_BUILDINGS: HubBuilding[] = (rawConfig.buildings as RawBuilding[]).map(b => ({
  rect: b.rect as [number, number, number, number],
  id:   b.id,
  wall: b.wall as WallMaterial | undefined,
  roof: b.roof as RoofMaterial | undefined,
}))

export const EXTERIOR_DECOR = rawConfig.exteriorDecor.map(d => ({
  tx:     d.tx,
  ty:     d.ty,
  tileId: resolveTileId(d.tileId),
}))

type RawWindowEntry = { tx: number; ty: number; tileId: string }
export const HUB_WINDOWS = (rawConfig as unknown as { windows?: RawWindowEntry[] }).windows?.map(w => ({
  tx:     w.tx,
  ty:     w.ty,
  tileId: resolveTileId(w.tileId),
})) ?? []

type RawPondEntry = { rect?: number[]; tile?: number[] }
export const HUB_POND_TILES: [number, number][] = expandTiles(
  ((rawConfig as unknown as { pondTiles?: RawPondEntry[] }).pondTiles ?? []) as TileEntry[]
)

export const HUB_DOORS: HubDoor[] = rawConfig.doors

export const HUB_INTERIORS: Record<string, HubInterior> = Object.fromEntries(
  Object.entries(rawConfig.interiors).map(([id, raw]) => [
    id,
    {
      id,
      name:        raw.name,
      width:       raw.width,
      height:      raw.height,
      floorTileId: resolveTileId(raw.floorTileId),
      decor:       raw.decor.map(d => ({ tx: d.tx, ty: d.ty, tileId: resolveTileId(d.tileId) })),
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

export const NPC_SPAWN_TILES = rawConfig.npcSpawnTiles as [number, number][]

export const AMBIENT_NPC_SPRITES: string[] = (rawConfig as { ambientNpcSprites?: string[] }).ambientNpcSprites ?? []
