import charactersData from '../data/characters.json'

const CHARACTERS_KEY = 'jarv_characters'

interface CharacterState {
  count: number
  lastChoice: string | null
}

type CharacterStore = Record<string, CharacterState>

function loadStore(): CharacterStore {
  try {
    const raw = localStorage.getItem(CHARACTERS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveStore(store: CharacterStore): void {
  try { localStorage.setItem(CHARACTERS_KEY, JSON.stringify(store)) } catch { /* ignore */ }
}

export function getCharacterState(id: string): CharacterState {
  return loadStore()[id] ?? { count: 0, lastChoice: null }
}

export function recordCharacterEncounter(id: string, choiceKey?: string): void {
  const store = loadStore()
  const current = store[id] ?? { count: 0, lastChoice: null }
  store[id] = { count: current.count + 1, lastChoice: choiceKey ?? current.lastChoice }
  saveStore(store)
}

export interface CharacterChoice {
  label:    string
  response: string
  effect:   { type: string; amount?: number; rarity?: string; itemId?: string }
}

export interface CharacterStage {
  greeting: string
  choices?: CharacterChoice[]
}

type CharacterDef = {
  name: string
  title: string
  icon: string
  encounters: CharacterStage[]
  epilogue?: CharacterStage[]
  encounterChance?: number
}

const catalog = charactersData as Record<string, CharacterDef>

export function getCharacterDef(id: string): CharacterDef | null {
  return catalog[id] ?? null
}

export function getCharacterStage(id: string): CharacterStage {
  const def = catalog[id]
  if (!def) return { greeting: '' }
  const { count } = getCharacterState(id)
  if (count < def.encounters.length) return def.encounters[count]
  if (def.epilogue && def.epilogue.length > 0) {
    return def.epilogue[(count - def.encounters.length) % def.epilogue.length]
  }
  return def.encounters[def.encounters.length - 1]
}

export function getCharacterEncounterChance(id: string): number {
  return catalog[id]?.encounterChance ?? 1
}

export function getCharacterIds(): string[] {
  return Object.keys(catalog)
}
