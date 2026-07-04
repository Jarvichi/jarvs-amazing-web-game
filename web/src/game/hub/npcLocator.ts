import type { HubArea, HubLocationBundle, HubNpc } from '../../data/hub/loader'
import { getNpcLocation } from './hubNpcSchedule'

const T = 32

export interface NpcPlace {
  /** Human-readable current location (area or building name). */
  name: string
  /** Current tile position. */
  tx: number
  ty: number
  /** Set when the NPC is currently inside a building interior. */
  interiorId?: string
}

/** Name of the area whose rect contains the centre of tile (tx, ty), or null. */
export function areaNameForTile(tx: number, ty: number, areas: HubArea[]): string | null {
  const px = tx * T + T / 2
  const py = ty * T + T / 2
  const area = areas.find(a => px >= a.x && px < a.x + a.w && py >= a.y && py < a.y + a.h)
  return area?.name ?? null
}

/**
 * World-map tile to point at for a building interior. Interior schedule/base
 * coordinates are local to the interior grid, not the town map, so for map pins we
 * use the building's exterior position: its door (entrance) if known, otherwise the
 * footprint centre. Some interiors are "virtual" sub-rooms (an inn's upstairs floor,
 * a keep's crypt, ...) with no footprint/door of their own — only reachable via a
 * parent interior's `exits`. For those we walk up to the owning interior instead.
 * Returns null if no real building can be found anywhere up the chain.
 */
export function buildingWorldTile(buildingId: string, loc: HubLocationBundle): { tx: number; ty: number } | null {
  const seen = new Set<string>()
  let current = buildingId
  while (!seen.has(current)) {
    seen.add(current)
    const door = loc.HUB_DOORS.find(d => d.buildingId === current)
    if (door) return { tx: door.tx, ty: door.ty }
    const building = loc.HUB_BUILDINGS.find(b => b.id === current)
    if (building) {
      const [tx1, ty1, tx2, ty2] = building.rect
      return { tx: Math.round((tx1 + tx2) / 2), ty: Math.round((ty1 + ty2) / 2) }
    }
    const parent = Object.entries(loc.HUB_INTERIORS)
      .find(([id, interior]) => id !== current && interior.exits?.some(e => e.toInteriorId === current))
    if (!parent) return null
    current = parent[0]
  }
  return null
}

/**
 * Resolve where an NPC is *right now* (for the given game hour), returning both a
 * display name and tile coordinates. Falls back to the NPC's base position/building
 * when no schedule entry applies.
 */
export function resolveNpcPlace(npc: HubNpc, gameHour: number, loc: HubLocationBundle): NpcPlace {
  const sched = getNpcLocation(npc, gameHour)

  const interior = (buildingId: string, localTx: number, localTy: number): NpcPlace => {
    // Map to the building's exterior position; fall back to local coords only if the
    // building isn't placed on the map (shouldn't normally happen).
    const world = buildingWorldTile(buildingId, loc)
    return {
      name: loc.HUB_INTERIORS[buildingId]?.name ?? 'a building',
      tx: world?.tx ?? localTx,
      ty: world?.ty ?? localTy,
      interiorId: buildingId,
    }
  }

  if (sched?.type === 'interior') return interior(sched.buildingId, sched.tx, sched.ty)
  if (sched?.type === 'exterior') {
    return { name: areaNameForTile(sched.tx, sched.ty, loc.HUB_AREAS) ?? loc.HUB_TOWN_NAME, tx: sched.tx, ty: sched.ty }
  }

  // No schedule entry for this hour — use the NPC's base placement.
  if (npc.building) return interior(npc.building, npc.tx, npc.ty)
  return { name: areaNameForTile(npc.tx, npc.ty, loc.HUB_AREAS) ?? loc.HUB_TOWN_NAME, tx: npc.tx, ty: npc.ty }
}
