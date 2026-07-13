import { logError } from '../../logger'
import { getFurnitureDef, ownsFurniture } from './furniture'

const KEY_PREFIX = 'jarv_hub_home_layout'

export const HOME_GRID_COLS = 8
export const HOME_GRID_ROWS = 6

export interface PlacedFurniture {
  id: string       // instance id (unique per placement, not the catalog itemId)
  itemId: string   // furniture catalog id (opaque here; the catalog lives elsewhere)
  x: number         // grid column, 0-indexed
  y: number         // grid row, 0-indexed
  rotation: 0 | 90 | 180 | 270
}

interface Store {
  placed: PlacedFurniture[]
}

function storageKey(houseKey: string): string {
  return `${KEY_PREFIX}:${houseKey}`
}

function load(houseKey: string): Store {
  try {
    // 'default' (no real owned house known) falls back to the pre-per-house
    // unscoped key once, so furniture placed before this scoping existed isn't orphaned.
    const raw = localStorage.getItem(storageKey(houseKey))
      ?? (houseKey === 'default' ? localStorage.getItem(KEY_PREFIX) : null)
    return raw ? (JSON.parse(raw) as Store) : { placed: [] }
  } catch {
    return { placed: [] }
  }
}

function save(houseKey: string, data: Store): void {
  try {
    localStorage.setItem(storageKey(houseKey), JSON.stringify(data))
  } catch (e) {
    logError('home layout save failed', { error: String(e) })
  }
}

/** The footprint a piece occupies, accounting for rotation swapping width/height. */
function footprintFor(itemId: string, rotation: 0 | 90 | 180 | 270): { w: number; h: number } {
  const def = getFurnitureDef(itemId)
  const { w, h } = def?.footprint ?? { w: 1, h: 1 }
  return rotation === 90 || rotation === 270 ? { w: h, h: w } : { w, h }
}

function inBounds(x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && y >= 0 && x + w <= HOME_GRID_COLS && y + h <= HOME_GRID_ROWS
}

function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

// DECORATE cells permanently reserved for the basement/first-floor room-slot
// passage markers (houseRooms.ts's roomSlots catalog: world tx=3,ty=3 and
// tx=6,ty=3, offset -1/-1 into DECORATE-grid coordinates) — furniture can't
// be placed on top of them, in every house, whether or not those slots have
// actually been purchased. Simpler than tracking per-house slot ownership
// here, at the cost of 2 permanently-unusable cells out of 48.
const RESERVED_CELLS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 2, y: 2 }, // basement marker
  { x: 5, y: 2 }, // first-floor marker
]

function overlapsReserved(x: number, y: number, w: number, h: number): boolean {
  return RESERVED_CELLS.some(c => overlaps(x, y, w, h, c.x, c.y, 1, 1))
}

function isOccupied(placed: PlacedFurniture[], x: number, y: number, w: number, h: number, excludeId?: string): boolean {
  return placed.some(p => {
    if (p.id === excludeId) return false
    const pf = footprintFor(p.itemId, p.rotation)
    return overlaps(x, y, w, h, p.x, p.y, pf.w, pf.h)
  })
}

export function loadHomeLayout(houseKey: string): PlacedFurniture[] {
  return load(houseKey).placed
}

export function isHomeLayoutEmpty(houseKey: string): boolean {
  return loadHomeLayout(houseKey).length === 0
}

/** Places a new piece of furniture at (x, y). Returns null if the item isn't in the catalog or
 *  isn't owned, the placement is out of bounds, or its footprint overlaps an existing piece. */
export function placeFurniture(houseKey: string, itemId: string, x: number, y: number, rotation: 0 | 90 | 180 | 270 = 0): PlacedFurniture | null {
  if (!getFurnitureDef(itemId) || !ownsFurniture(itemId)) return null
  const { w, h } = footprintFor(itemId, rotation)
  if (!inBounds(x, y, w, h) || overlapsReserved(x, y, w, h)) return null
  const data = load(houseKey)
  if (isOccupied(data.placed, x, y, w, h)) return null

  const id = `${itemId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const piece: PlacedFurniture = { id, itemId, x, y, rotation }
  save(houseKey, { placed: [...data.placed, piece] })
  return piece
}

/** Moves an existing placement to (x, y). Returns false if the id is unknown, the target is out of
 *  bounds, or its footprint overlaps a different piece (moving onto its own current cell is allowed). */
export function moveFurniture(houseKey: string, id: string, x: number, y: number, rotation?: 0 | 90 | 180 | 270): boolean {
  const data = load(houseKey)
  const piece = data.placed.find(p => p.id === id)
  if (!piece) return false

  const nextRotation = rotation ?? piece.rotation
  const { w, h } = footprintFor(piece.itemId, nextRotation)
  if (!inBounds(x, y, w, h) || overlapsReserved(x, y, w, h)) return false
  if (isOccupied(data.placed, x, y, w, h, id)) return false

  piece.x = x
  piece.y = y
  piece.rotation = nextRotation
  save(houseKey, data)
  return true
}

/** Removes a placed piece by its instance id. Returns false if the id is unknown. */
export function removeFurniture(houseKey: string, id: string): boolean {
  const data = load(houseKey)
  const next = data.placed.filter(p => p.id !== id)
  if (next.length === data.placed.length) return false
  save(houseKey, { placed: next })
  return true
}
