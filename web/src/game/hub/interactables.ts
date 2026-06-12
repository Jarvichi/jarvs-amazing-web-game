import { logError } from '../../logger'

const GRANTS_KEY = 'jarv_hub_interactable_grants'
const MOVES_KEY  = 'jarv_hub_interactable_moves'

export interface InteractablePosition { tx: number; ty: number }

// Grants and moves are keyed "<townName>:<interactableId>" so interactable ids
// only need to be unique within a single location.
export function interactableStoreKey(townName: string, id: string): string {
  return `${townName}:${id}`
}

function loadGrants(): Set<string> {
  try {
    const raw = localStorage.getItem(GRANTS_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

export function isInteractableGranted(key: string): boolean {
  return loadGrants().has(key)
}

export function markInteractableGranted(key: string): void {
  const grants = loadGrants()
  grants.add(key)
  try {
    localStorage.setItem(GRANTS_KEY, JSON.stringify([...grants]))
  } catch (e) {
    logError('markInteractableGranted failed', { key, error: String(e) })
  }
}

export function getInteractableMoves(): Record<string, InteractablePosition> {
  try {
    const raw = localStorage.getItem(MOVES_KEY)
    return raw ? JSON.parse(raw) as Record<string, InteractablePosition> : {}
  } catch {
    return {}
  }
}

export function setInteractableMove(key: string, pos: InteractablePosition): void {
  const moves = getInteractableMoves()
  moves[key] = pos
  try {
    localStorage.setItem(MOVES_KEY, JSON.stringify(moves))
  } catch (e) {
    logError('setInteractableMove failed', { key, error: String(e) })
  }
}
