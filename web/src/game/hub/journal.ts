import { logError } from '../../logger'
import { interactableStoreKey } from './interactables'
import type { AnimalType } from './animals'

const KEY = 'jarv_hub_journal'

interface JournalData {
  npcs: string[]
  animalTypes: string[]
  animalVariants: Record<string, string[]>
  areas: string[]
}

function emptyData(): JournalData {
  return { npcs: [], animalTypes: [], animalVariants: {}, areas: [] }
}

function load(): JournalData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyData()
    const parsed = JSON.parse(raw) as Partial<JournalData>
    return {
      npcs: parsed.npcs ?? [],
      animalTypes: parsed.animalTypes ?? [],
      animalVariants: parsed.animalVariants ?? {},
      areas: parsed.areas ?? [],
    }
  } catch {
    return emptyData()
  }
}

function save(data: JournalData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch (e) {
    logError('journal save failed', { error: String(e) })
  }
}

// ── People met ───────────────────────────────────────────────────────────────

/** Record that a named NPC has been talked to. Returns true if newly recorded. */
export function recordNpcMet(npcId: string): boolean {
  const data = load()
  if (data.npcs.includes(npcId)) return false
  data.npcs.push(npcId)
  save(data)
  return true
}

export function hasMetNpc(npcId: string): boolean {
  return load().npcs.includes(npcId)
}

export function getMetNpcIds(): Set<string> {
  return new Set(load().npcs)
}

// ── Animals seen ─────────────────────────────────────────────────────────────

/** Record that an animal species (and optionally a named colour variant) has been
 *  seen. Returns true if this added new information (species or variant). */
export function recordAnimalSeen(type: AnimalType, variant?: string): boolean {
  const data = load()
  let changed = false
  if (!data.animalTypes.includes(type)) {
    data.animalTypes.push(type)
    changed = true
  }
  if (variant) {
    const seen = data.animalVariants[type] ?? []
    if (!seen.includes(variant)) {
      data.animalVariants[type] = [...seen, variant]
      changed = true
    }
  }
  if (changed) save(data)
  return changed
}

export function hasSeenAnimal(type: AnimalType): boolean {
  return load().animalTypes.includes(type)
}

export function getSeenAnimalVariants(type: AnimalType): Set<string> {
  return new Set(load().animalVariants[type] ?? [])
}

export function getSeenAnimalTypes(): Set<AnimalType> {
  return new Set(load().animalTypes as AnimalType[])
}

// ── Places discovered ────────────────────────────────────────────────────────
// Areas are keyed via interactableStoreKey's "<town>:<id>" convention since area
// ids are not guaranteed unique across towns (e.g. Ravenwatch's bare "market").

/** Record that a named area has been entered. Returns true if newly recorded. */
export function recordAreaSeen(town: string, areaId: string): boolean {
  const data = load()
  const key = interactableStoreKey(town, areaId)
  if (data.areas.includes(key)) return false
  data.areas.push(key)
  save(data)
  return true
}

export function hasSeenArea(town: string, areaId: string): boolean {
  return load().areas.includes(interactableStoreKey(town, areaId))
}

export function getSeenAreaKeys(): Set<string> {
  return new Set(load().areas)
}
