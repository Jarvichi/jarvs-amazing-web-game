const KEY = 'jarv_hub_pet'

const MAX_TREATS_PER_DAY = 2

export interface PetRecord {
  type:    string  // 'dog' for now; kept generic for future pet types
  variant: string  // palette key from ANIMAL_SPECS[type].palette
  name:    string
}

interface TreatState {
  date:  string  // YYYY-MM-DD
  count: number
}

interface Store {
  pet:    PetRecord | null
  treats?: TreatState
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

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getActivePet(): PetRecord | null {
  return load().pet
}

export function hasActivePet(): boolean {
  return getActivePet() != null
}

/** Adopts a pet, replacing any currently active one. Preserves the daily treat count. */
export function adoptPet(type: string, variant: string, name: string): PetRecord {
  const data = load()
  const pet: PetRecord = { type, variant, name: name.trim() || 'Pup' }
  save({ ...data, pet })
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

/** Dismisses the active pet. Preserves the daily treat count. */
export function dismissPet(): void {
  const data = load()
  save({ ...data, pet: null })
}

/** How many treats can still be given today (resets to the max on a new day). */
export function getTreatsRemainingToday(): number {
  const data = load()
  if (!data.treats || data.treats.date !== todayKey()) return MAX_TREATS_PER_DAY
  return Math.max(0, MAX_TREATS_PER_DAY - data.treats.count)
}

export function canGiveTreat(): boolean {
  return hasActivePet() && getTreatsRemainingToday() > 0
}

/** Records that a treat was given, decrementing today's remaining count. */
export function recordTreatGiven(): void {
  const data = load()
  const today = todayKey()
  const count = data.treats && data.treats.date === today ? data.treats.count + 1 : 1
  save({ ...data, treats: { date: today, count } })
}
