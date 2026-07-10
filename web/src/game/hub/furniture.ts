import { logError } from '../../logger'
import FURNITURE_DATA from '../../data/furniture.json'

const KEY = 'jarv_hub_furniture_owned'

export interface FurnitureDef {
  id: string
  name: string
  icon: string
  desc: string
  footprint: { w: number; h: number }
  price: number  // crystals
}

const FURNITURE_CATALOG = FURNITURE_DATA as FurnitureDef[]

export function getFurnitureDef(id: string): FurnitureDef | undefined {
  return FURNITURE_CATALOG.find(f => f.id === id)
}

export function getAllFurnitureDefs(): FurnitureDef[] {
  return FURNITURE_CATALOG
}

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function save(owned: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(owned))
  } catch (e) {
    logError('furniture ownership save failed', { error: String(e) })
  }
}

export function getOwnedFurnitureIds(): string[] {
  return load()
}

export function ownsFurniture(id: string): boolean {
  return load().includes(id)
}

/** Grants ownership of a catalog piece. Idempotent — returns false if already owned or the id is unknown. */
export function grantFurniture(id: string): boolean {
  if (!getFurnitureDef(id)) return false
  const owned = load()
  if (owned.includes(id)) return false
  save([...owned, id])
  return true
}
