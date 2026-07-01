const KEY = 'jarv_hub_pet'

export interface PetRecord {
  type:    string  // 'dog' for now; kept generic for future pet types
  variant: string  // palette key from ANIMAL_SPECS[type].palette
  name:    string
}

interface Store {
  pet: PetRecord | null
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Store) : { pet: null }
  } catch {
    return { pet: null }
  }
}

function save(data: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch { /* ignore */ }
}

export function getActivePet(): PetRecord | null {
  return load().pet
}

export function hasActivePet(): boolean {
  return getActivePet() != null
}

/** Adopts a pet, replacing any currently active one. */
export function adoptPet(type: string, variant: string, name: string): PetRecord {
  const pet: PetRecord = { type, variant, name: name.trim() || 'Pup' }
  save({ pet })
  return pet
}

/** Renames the active pet. No-op (returns null) if there is no active pet. */
export function renamePet(name: string): PetRecord | null {
  const data = load()
  if (!data.pet) return null
  data.pet = { ...data.pet, name: name.trim() || data.pet.name }
  save(data)
  return data.pet
}

export function dismissPet(): void {
  save({ pet: null })
}
