import { logError } from '../../logger'

const BOUNTY_KEY = 'jarv_hub_bounties'
const BOUNTY_SEED_KEY = 'jarv_hub_bounty_seed'

export type BountyType = 'collect' | 'talk' | 'win'

export interface BountyStep {
  key: string
  type: BountyType
  description: string
  required: number
  /** For collect bounties: pickup ids to spawn (optional, can be generic). */
  pickupIds?: string[]
  /** For talk bounties: target npc id. */
  targetNpcId?: string
}

export interface BountyReward {
  crystals: number
  collectible?: { id: string; name: string; icon: string; desc: string }
  consumables?: Array<{ id: string; quantity: number }>
}

export interface BountyDef {
  id: string
  title: string
  steps: BountyStep[]
  reward: BountyReward
}

export type BountyStatus = 'available' | 'active' | 'completed' | 'turned-in'

export interface BountySave {
  status: BountyStatus
  progress: Record<string, number>
  acceptedAt?: number
  completedAt?: number
  turnedInAt?: number
}

type BountyStore = Record<string, BountySave>

function loadStore(): BountyStore {
  try {
    const raw = localStorage.getItem(BOUNTY_KEY)
    return raw ? (JSON.parse(raw) as BountyStore) : {}
  } catch {
    return {}
  }
}

function saveStore(store: BountyStore): void {
  try {
    localStorage.setItem(BOUNTY_KEY, JSON.stringify(store))
  } catch (e) {
    logError('saveStore failed', { error: String(e) })
  }
}

/** Return a daily seed string based on local calendar date. */
export function getDailySeed(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** Return a weekly seed string (Monday-based). */
export function getWeeklySeed(): string {
  const d = new Date()
  const day = d.getDay() || 7 // 1..7
  const monday = new Date(d)
  monday.setDate(d.getDate() - day + 1)
  return `${monday.getFullYear()}-${monday.getMonth() + 1}-${monday.getDate()}`
}

/** Persisted seed so we know when to rotate. */
export function getStoredSeed(): string | null {
  try {
    return localStorage.getItem(BOUNTY_SEED_KEY)
  } catch {
    return null
  }
}

export function setStoredSeed(seed: string): void {
  try {
    localStorage.setItem(BOUNTY_SEED_KEY, seed)
  } catch (e) {
    logError('setStoredSeed failed', { error: String(e) })
  }
}

/** Clear all bounty state (used on rotation). */
export function clearAllBounties(): void {
  try {
    localStorage.removeItem(BOUNTY_KEY)
  } catch (e) {
    logError('clearAllBounties failed', { error: String(e) })
  }
}

export function getBountyState(bountyId: string): BountySave {
  return loadStore()[bountyId] ?? { status: 'available', progress: {} }
}

export function setBountyStatus(bountyId: string, status: BountyStatus): void {
  const store = loadStore()
  const entry = store[bountyId] ?? { status: 'available', progress: {} }
  entry.status = status
  if (status === 'active' && !entry.acceptedAt) entry.acceptedAt = Date.now()
  if (status === 'completed' && !entry.completedAt) entry.completedAt = Date.now()
  if (status === 'turned-in' && !entry.turnedInAt) entry.turnedInAt = Date.now()
  store[bountyId] = entry
  saveStore(store)
}

export function incrementBountyProgress(bountyId: string, key: string, by = 1): void {
  const store = loadStore()
  const entry = store[bountyId] ?? { status: 'active', progress: {} }
  entry.progress[key] = (entry.progress[key] ?? 0) + by
  store[bountyId] = entry
  saveStore(store)
}

export function getBountyProgress(bountyId: string, key: string): number {
  return loadStore()[bountyId]?.progress[key] ?? 0
}

export function isBountyReadyToComplete(def: BountyDef): boolean {
  const state = getBountyState(def.id)
  if (state.status !== 'active') return false
  return def.steps.every(step => (state.progress[step.key] ?? 0) >= step.required)
}

export function loadAllBountyStates(): BountyStore {
  return loadStore()
}

/** Seedable pseudo-random generator (mulberry32). */
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Hash a string to a 32-bit integer. */
function cyrb128(str: string): number {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  return (h1 ^ h2 ^ h3 ^ h4) >>> 0
}

/** Shuffle an array using a seedable PRNG. */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const rng = mulberry32(cyrb128(seed))
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Pick N bounties from templates using a daily seed. */
export function pickDailyBounties(templates: BountyDef[], count: number, seed?: string): BountyDef[] {
  const dailySeed = seed ?? getDailySeed()
  const shuffled = seededShuffle(templates, dailySeed)
  return shuffled.slice(0, count)
}
