import { getPetAccessoryDef, type AccessorySlot } from '../../data/petAccessories'

const KEY = 'jarv_hub_pet'

const MAX_TREATS_PER_DAY = 2
const TREAT_INTERACTIONS_REQUIRED = 3

export interface PetRecord {
  type:    string  // 'dog'/'cat'; kept generic for future pet types
  variant: string  // palette key from ANIMAL_SPECS[type].palette
  name:    string
  pattern?: string  // coat pattern id from petPatterns.ts, if any
}

interface TreatState {
  date:  string  // YYYY-MM-DD
  count: number
}

interface AccessoryState {
  owned:    string[]                                // accessory ids owned
  equipped: Partial<Record<AccessorySlot, string>>   // slot -> accessory id
}

interface Store {
  pet:            PetRecord | null
  treats?:        TreatState
  accessories?:   AccessoryState
  affectionCount?: number
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

const DEFAULT_NAME_BY_TYPE: Record<string, string> = { dog: 'Pup', cat: 'Kitty' }

/** Adopts a pet, replacing any currently active one. Preserves the daily treat count. */
export function adoptPet(type: string, variant: string, name: string, pattern?: string): PetRecord {
  const data = load()
  const pet: PetRecord = {
    type, variant, name: name.trim() || DEFAULT_NAME_BY_TYPE[type] || 'Pup',
    ...(pattern && pattern !== 'none' ? { pattern } : {}),
  }
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

/** How many Pet/Belly-Rubs/Brush interactions the pet has had since its last treat. */
export function getAffectionCount(): number {
  return load().affectionCount ?? 0
}

/** How many more interactions are needed before a treat can be given. */
export function getAffectionRemaining(): number {
  return Math.max(0, TREAT_INTERACTIONS_REQUIRED - getAffectionCount())
}

/** Records a Pet/Belly-Rubs/Brush interaction, counting toward the next treat. */
export function recordAffection(): void {
  const data = load()
  save({ ...data, affectionCount: (data.affectionCount ?? 0) + 1 })
}

export function canGiveTreat(): boolean {
  return hasActivePet() && getTreatsRemainingToday() > 0 && getAffectionCount() >= TREAT_INTERACTIONS_REQUIRED
}

/** Records that a treat was given, decrementing today's remaining count and
 *  resetting the interaction counter toward the next treat. */
export function recordTreatGiven(): void {
  const data = load()
  const today = todayKey()
  const count = data.treats && data.treats.date === today ? data.treats.count + 1 : 1
  save({ ...data, treats: { date: today, count }, affectionCount: 0 })
}

function loadAccessories(): AccessoryState {
  return load().accessories ?? { owned: [], equipped: {} }
}

export function getOwnedAccessoryIds(): string[] {
  return loadAccessories().owned
}

export function ownsAccessory(id: string): boolean {
  return loadAccessories().owned.includes(id)
}

/** Grants an accessory (idempotent). Returns true if newly granted. */
export function grantAccessory(id: string): boolean {
  const data = load()
  const accessories = data.accessories ?? { owned: [], equipped: {} }
  if (accessories.owned.includes(id)) return false
  accessories.owned = [...accessories.owned, id]
  save({ ...data, accessories })
  return true
}

/** The currently-equipped accessory id, if any (any slot). */
export function getEquippedAccessoryId(): string | null {
  const equipped = loadAccessories().equipped
  return Object.values(equipped)[0] ?? null
}

/**
 * Equips an owned accessory. For now, exactly one accessory can be equipped
 * at a time overall, so equipping one clears every other slot first — that
 * single line is the only change needed to later support wearing one
 * accessory per slot simultaneously. Returns false if the accessory isn't
 * owned or doesn't exist in the catalog.
 */
export function equipAccessory(id: string): boolean {
  const def = getPetAccessoryDef(id)
  if (!def || !ownsAccessory(id)) return false
  const data = load()
  const accessories = data.accessories ?? { owned: [], equipped: {} }
  accessories.equipped = { [def.slot]: id }
  save({ ...data, accessories })
  return true
}

export function unequipAccessory(id: string): void {
  const def = getPetAccessoryDef(id)
  if (!def) return
  const data = load()
  const accessories = data.accessories ?? { owned: [], equipped: {} }
  if (accessories.equipped[def.slot] !== id) return
  const equipped = { ...accessories.equipped }
  delete equipped[def.slot]
  save({ ...data, accessories: { ...accessories, equipped } })
}
