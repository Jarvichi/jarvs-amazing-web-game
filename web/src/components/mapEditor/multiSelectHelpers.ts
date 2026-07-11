import type { SelectedEntity, RawMapConfig, Zlayer } from './mapEditorTypes'

export function isSameType(a: SelectedEntity, b: SelectedEntity): boolean {
  return a.type === b.type
}

export function isSameEntityRef(a: SelectedEntity, b: SelectedEntity): boolean {
  if (a.type !== b.type) return false
  if ('index' in a && 'index' in b && (a as {index:number}).index !== (b as {index:number}).index) return false
  if (a.type === 'interiorDecor' && b.type === 'interiorDecor' && a.interiorId !== b.interiorId) return false
  if (a.type === 'buildingLevelDecor' && b.type === 'buildingLevelDecor' && a.buildingIndex !== b.buildingIndex) return false
  if (a.type === 'festivalDecor' && b.type === 'festivalDecor' && a.festivalId !== b.festivalId) return false
  return true
}

export function toggleInSelection(entities: SelectedEntity[], entity: SelectedEntity): SelectedEntity[] {
  const idx = entities.findIndex(e => isSameEntityRef(e, entity))
  if (idx >= 0) return entities.filter((_, i) => i !== idx)
  if (entities.length > 0 && !isSameType(entities[0], entity)) return entities
  return [...entities, entity]
}

export function nextAreaId(areas: { id: string }[]): string {
  const ids = new Set(areas.map(a => a.id))
  let n = 1
  while (ids.has(`area-${n}`)) n++
  return `area-${n}`
}

export function nextBuildingId(buildings: { id?: string }[]): string {
  const ids = new Set(buildings.map(b => b.id))
  let n = 1
  while (ids.has(`building-${n}`)) n++
  return `building-${n}`
}

export function convertStreetToPond(
  config: RawMapConfig, index: number,
): { config: RawMapConfig; pondIndex: number } | null {
  const streets = config.streets ?? []
  const entry = streets[index]
  if (!entry) return null
  const { pathType: _dropped, ...rest } = entry as { pathType?: string; rect?: number[]; tile?: number[] }
  const pondTiles = [...(config.pondTiles ?? []), rest]
  return {
    config: { ...config, streets: streets.filter((_, i) => i !== index), pondTiles },
    pondIndex: pondTiles.length - 1,
  }
}

export function convertPondToStreet(
  config: RawMapConfig, index: number,
): { config: RawMapConfig; streetIndex: number } | null {
  const pondTiles = config.pondTiles ?? []
  const entry = pondTiles[index]
  if (!entry) return null
  const streets = [...(config.streets ?? []), entry]
  return {
    config: { ...config, pondTiles: pondTiles.filter((_, i) => i !== index), streets },
    streetIndex: streets.length - 1,
  }
}

function indexSet(entities: SelectedEntity[], type: string): Set<number> {
  return new Set(
    entities.filter(e => e.type === type && 'index' in e).map(e => (e as { index: number }).index),
  )
}

export function applyDeleteEntities(config: RawMapConfig, entities: SelectedEntity[]): RawMapConfig {
  let c = config

  const extDecor = indexSet(entities, 'exteriorDecor')
  if (extDecor.size) c = { ...c, exteriorDecor: (c.exteriorDecor ?? []).filter((_, i) => !extDecor.has(i)) }

  const streets = indexSet(entities, 'street')
  if (streets.size) c = { ...c, streets: (c.streets ?? []).filter((_, i) => !streets.has(i)) }

  const ponds = indexSet(entities, 'pondTile')
  if (ponds.size) c = { ...c, pondTiles: (c.pondTiles ?? []).filter((_, i) => !ponds.has(i)) }

  const bridges = indexSet(entities, 'bridgeTile')
  if (bridges.size) c = { ...c, bridgeTiles: (c.bridgeTiles ?? []).filter((_, i) => !bridges.has(i)) }

  const spawns = indexSet(entities, 'npcSpawnTile')
  if (spawns.size) c = { ...c, npcSpawnTiles: (c.npcSpawnTiles ?? []).filter((_, i) => !spawns.has(i)) }

  const npcs = indexSet(entities, 'npc')
  if (npcs.size) c = { ...c, npcs: (c.npcs ?? []).filter((_, i) => !npcs.has(i)) }

  const animals = indexSet(entities, 'animal')
  if (animals.size) c = { ...c, animals: (c.animals ?? []).filter((_, i) => !animals.has(i)) }

  const areas = indexSet(entities, 'area')
  if (areas.size) c = { ...c, areas: (c.areas ?? []).filter((_, i) => !areas.has(i)) }

  const chickens = indexSet(entities, 'chickenZone')
  if (chickens.size) c = { ...c, chickenZones: (c.chickenZones ?? []).filter((_, i) => !chickens.has(i)) }

  const interactables = indexSet(entities, 'interactable')
  if (interactables.size) c = { ...c, interactables: (c.interactables ?? []).filter((_, i) => !interactables.has(i)) }

  const exitTiles = indexSet(entities, 'exitTile')
  if (exitTiles.size) c = { ...c, exitTiles: (c.exitTiles ?? []).filter((_, i) => !exitTiles.has(i)) }

  const treasures = indexSet(entities, 'treasure')
  if (treasures.size) c = { ...c, treasures: (c.treasures ?? []).filter((_, i) => !treasures.has(i)) }

  // buildingLevelDecor / buildingDecor / buildingWindow / buildingDoor — group by buildingIndex
  type BldArrayKey = 'levelDecor' | 'decor' | 'windows' | 'doors'
  const bldMaps: Record<BldArrayKey, Map<number, Set<number>>> = {
    levelDecor: new Map(), decor: new Map(), windows: new Map(), doors: new Map(),
  }
  for (const e of entities) {
    if (e.type === 'buildingLevelDecor') {
      if (!bldMaps.levelDecor.has(e.buildingIndex)) bldMaps.levelDecor.set(e.buildingIndex, new Set())
      bldMaps.levelDecor.get(e.buildingIndex)!.add(e.index)
    } else if (e.type === 'buildingDecor') {
      if (!bldMaps.decor.has(e.buildingIndex)) bldMaps.decor.set(e.buildingIndex, new Set())
      bldMaps.decor.get(e.buildingIndex)!.add(e.index)
    } else if (e.type === 'buildingWindow') {
      if (!bldMaps.windows.has(e.buildingIndex)) bldMaps.windows.set(e.buildingIndex, new Set())
      bldMaps.windows.get(e.buildingIndex)!.add(e.index)
    } else if (e.type === 'buildingDoor') {
      if (!bldMaps.doors.has(e.buildingIndex)) bldMaps.doors.set(e.buildingIndex, new Set())
      bldMaps.doors.get(e.buildingIndex)!.add(e.index)
    }
  }
  const anyBld = Object.values(bldMaps).some(m => m.size > 0)
  if (anyBld) {
    const buildings = [...(c.buildings ?? [])]
    const allBldIdxs = new Set([
      ...bldMaps.levelDecor.keys(), ...bldMaps.decor.keys(),
      ...bldMaps.windows.keys(),    ...bldMaps.doors.keys(),
    ])
    for (const bIdx of allBldIdxs) {
      let b = buildings[bIdx]
      if (!b) continue
      if (bldMaps.levelDecor.has(bIdx)) b = { ...b, levelDecor: (b.levelDecor ?? []).filter((_, i) => !bldMaps.levelDecor.get(bIdx)!.has(i)) }
      if (bldMaps.decor.has(bIdx))      b = { ...b, decor:      (b.decor      ?? []).filter((_, i) => !bldMaps.decor.get(bIdx)!.has(i)) }
      if (bldMaps.windows.has(bIdx))    b = { ...b, windows:    (b.windows    ?? []).filter((_, i) => !bldMaps.windows.get(bIdx)!.has(i)) }
      if (bldMaps.doors.has(bIdx))      b = { ...b, doors:      (b.doors      ?? []).filter((_, i) => !bldMaps.doors.get(bIdx)!.has(i)) }
      buildings[bIdx] = b
    }
    c = { ...c, buildings }
  }

  // interiorDecor — group by interiorId
  const roomMap = new Map<string, Set<number>>()
  for (const e of entities) {
    if (e.type !== 'interiorDecor') continue
    if (!roomMap.has(e.interiorId)) roomMap.set(e.interiorId, new Set())
    roomMap.get(e.interiorId)!.add(e.index)
  }
  if (roomMap.size) {
    let interiors = { ...c.interiors }
    for (const [roomId, idxs] of roomMap) {
      const room = interiors[roomId]
      if (!room) continue
      interiors = { ...interiors, [roomId]: { ...room, decor: room.decor.filter((_, i) => !idxs.has(i)) } }
    }
    c = { ...c, interiors }
  }

  // festivalDecor — group by festivalId
  const festMap = new Map<string, Set<number>>()
  for (const e of entities) {
    if (e.type !== 'festivalDecor') continue
    if (!festMap.has(e.festivalId)) festMap.set(e.festivalId, new Set())
    festMap.get(e.festivalId)!.add(e.index)
  }
  if (festMap.size) {
    c = {
      ...c,
      festivalDecor: (c.festivalDecor ?? []).map(g => {
        const idxs = festMap.get(g.festivalId)
        return idxs ? { ...g, decor: g.decor.filter((_, i) => !idxs.has(i)) } : g
      }),
    }
  }

  return c
}

export function applyBatchUpdateZlayer(
  config: RawMapConfig, entities: SelectedEntity[], zlayer: Zlayer,
): RawMapConfig {
  let c = config
  const extIdx = indexSet(entities, 'exteriorDecor')
  if (extIdx.size) c = { ...c, exteriorDecor: (c.exteriorDecor ?? []).map((d, i) => extIdx.has(i) ? { ...d, zlayer } : d) }

  const bldMap = new Map<number, Set<number>>()
  for (const e of entities) {
    if (e.type !== 'buildingLevelDecor') continue
    if (!bldMap.has(e.buildingIndex)) bldMap.set(e.buildingIndex, new Set())
    bldMap.get(e.buildingIndex)!.add(e.index)
  }
  if (bldMap.size) {
    const buildings = [...(c.buildings ?? [])]
    for (const [bIdx, idxs] of bldMap) {
      const b = buildings[bIdx]
      if (!b) continue
      buildings[bIdx] = { ...b, levelDecor: (b.levelDecor ?? []).map((d, i) => idxs.has(i) ? { ...d, zlayer } : d) }
    }
    c = { ...c, buildings }
  }

  const roomMap = new Map<string, Set<number>>()
  for (const e of entities) {
    if (e.type !== 'interiorDecor') continue
    if (!roomMap.has(e.interiorId)) roomMap.set(e.interiorId, new Set())
    roomMap.get(e.interiorId)!.add(e.index)
  }
  if (roomMap.size) {
    let interiors = { ...c.interiors }
    for (const [roomId, idxs] of roomMap) {
      const room = interiors[roomId]
      if (!room) continue
      interiors = { ...interiors, [roomId]: { ...room, decor: room.decor.map((d, i) => idxs.has(i) ? { ...d, zlayer } : d) } }
    }
    c = { ...c, interiors }
  }

  const festMap = new Map<string, Set<number>>()
  for (const e of entities) {
    if (e.type !== 'festivalDecor') continue
    if (!festMap.has(e.festivalId)) festMap.set(e.festivalId, new Set())
    festMap.get(e.festivalId)!.add(e.index)
  }
  if (festMap.size) {
    c = {
      ...c,
      festivalDecor: (c.festivalDecor ?? []).map(g => {
        const idxs = festMap.get(g.festivalId)
        return idxs ? { ...g, decor: g.decor.map((d, i) => idxs.has(i) ? { ...d, zlayer } : d) } : g
      }),
    }
  }
  return c
}

export function applyBatchUpdateStreetPathType(
  config: RawMapConfig, entities: SelectedEntity[], pathType: string | undefined,
): RawMapConfig {
  const idxs = indexSet(entities, 'street')
  if (!idxs.size) return config
  const streets = (config.streets ?? []).map((s, i) => {
    if (!idxs.has(i)) return s
    const next = { ...s, pathType }
    if (!pathType) delete next.pathType
    return next
  })
  return { ...config, streets }
}
