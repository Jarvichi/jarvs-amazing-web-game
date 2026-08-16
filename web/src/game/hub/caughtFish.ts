import { logError } from '../../logger'

const KEY = 'jarv_caught_fish'

/** An individual landed fish, kept as its own record (not a stack count) so
 *  its specific size/weight/star-rating survive past the catch screen —
 *  used by Dockmaster Corwin's appraisal grid. */
export interface CaughtFish {
  id: string
  locale: string
  tier: string
  tierIcon: string
  name: string
  weightGrams: number
  lengthCm: number
  stars: number
}

let counter = Date.now()

function load(): CaughtFish[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw) as CaughtFish[]
  } catch {
    return []
  }
}

function save(list: CaughtFish[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch (e) {
    logError('caughtFish save failed', { error: String(e) })
  }
}

export function addCaughtFish(fish: Omit<CaughtFish, 'id'>): CaughtFish {
  const entry: CaughtFish = { ...fish, id: `catch-${++counter}` }
  const list = load()
  list.push(entry)
  save(list)
  return entry
}

export function getCaughtFish(): CaughtFish[] {
  return load()
}

export function removeCaughtFish(id: string): boolean {
  const list = load()
  const idx = list.findIndex(f => f.id === id)
  if (idx === -1) return false
  list.splice(idx, 1)
  save(list)
  return true
}
