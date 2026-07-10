import { logError } from '../../logger'

const KEY = 'jarv_hub_home_layout'

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

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Store) : { placed: [] }
  } catch {
    return { placed: [] }
  }
}

function save(data: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch (e) {
    logError('home layout save failed', { error: String(e) })
  }
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < HOME_GRID_COLS && y >= 0 && y < HOME_GRID_ROWS
}

function isOccupied(placed: PlacedFurniture[], x: number, y: number, excludeId?: string): boolean {
  return placed.some(p => p.x === x && p.y === y && p.id !== excludeId)
}

export function loadHomeLayout(): PlacedFurniture[] {
  return load().placed
}

export function isHomeLayoutEmpty(): boolean {
  return loadHomeLayout().length === 0
}

/** Places a new piece of furniture at (x, y). Returns null if out of bounds or the cell is occupied. */
export function placeFurniture(itemId: string, x: number, y: number, rotation: 0 | 90 | 180 | 270 = 0): PlacedFurniture | null {
  if (!inBounds(x, y)) return null
  const data = load()
  if (isOccupied(data.placed, x, y)) return null

  const id = `${itemId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const piece: PlacedFurniture = { id, itemId, x, y, rotation }
  save({ placed: [...data.placed, piece] })
  return piece
}

/** Moves an existing placement to (x, y). Returns false if the id is unknown, the target is out of
 *  bounds, or occupied by a different piece (moving onto its own current cell is allowed). */
export function moveFurniture(id: string, x: number, y: number, rotation?: 0 | 90 | 180 | 270): boolean {
  if (!inBounds(x, y)) return false
  const data = load()
  const piece = data.placed.find(p => p.id === id)
  if (!piece) return false
  if (isOccupied(data.placed, x, y, id)) return false

  piece.x = x
  piece.y = y
  if (rotation !== undefined) piece.rotation = rotation
  save(data)
  return true
}

/** Removes a placed piece by its instance id. Returns false if the id is unknown. */
export function removeFurniture(id: string): boolean {
  const data = load()
  const next = data.placed.filter(p => p.id !== id)
  if (next.length === data.placed.length) return false
  save({ placed: next })
  return true
}
