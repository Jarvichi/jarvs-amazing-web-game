// ─── Hub town reputation & building upgrades ────────────────────────────────
//
// Per-town reputation plus per-building upgrade levels, persisted to
// localStorage. Reputation is *earned by investing crystals*: each upgrade
// purchase spends crystals (the shared wallet in ../collection) and grants the
// town reputation, which in turn gates the higher upgrade tiers. Upgrade tracks
// and costs live in ../../data/hub/buildingUpgrades.json (keyed by building kind).
//
// Mirrors the store shape of friendship.ts / relationships.ts.

import { loadCrystals, saveCrystals } from '../collection'
import { logError } from '../../logger'
import {
  getUpgradeTrack,
  getReputationTier,
  type BuildingUpgradeLevel,
} from '../../data/hub/buildingUpgrades'
import { LOCATION_REGISTRY } from '../../data/hub/hubWorldFactory'

const KEY = 'jarv_hub_reputation'

interface TownState {
  /** Cumulative town reputation. */
  rep: number
  /** buildingId → purchased upgrade level (1-based count of bought levels). */
  levels: Record<string, number>
  /** YYYY-MM-DD of the last collected daily tribute. */
  tributeDay?: string
}

type Store = Record<string, TownState>

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch {
    return {}
  }
}

function save(data: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch (e) {
    logError('saveReputation failed', { error: String(e) })
  }
}

function townState(data: Store, town: string): TownState {
  return data[town] ?? { rep: 0, levels: {} }
}

// ── Reads ──────────────────────────────────────────────────────────────────

export function getTownReputation(town: string): number {
  return townState(load(), town).rep
}

export function getTownReputationTier(town: string): number {
  return getReputationTier(getTownReputation(town))
}

/** Map of buildingId → purchased upgrade level for a town. */
export function getTownUpgradeLevels(town: string): Record<string, number> {
  return { ...townState(load(), town).levels }
}

/** Purchased upgrade level for one building (0 = not upgraded). */
export function getUpgradeLevel(town: string, buildingId: string): number {
  return townState(load(), town).levels[buildingId] ?? 0
}

// ── Player-house dynamic pricing ─────────────────────────────────────────────
//
// Unlike every other upgrade kind, `playerHouse` cost isn't a static
// per-level number from buildingUpgrades.json — it scales with how many
// player houses the player already owns *across every town*, not just the
// one they're buying in. This is a real-estate-style "each house costs more
// than the last" curve, so it lives here rather than in the generic catalog.

/** Crystal cost of the player's *next* player-house purchase, based on how
 *  many they already own across every town. Doubles the running cost each
 *  additional house: 2500, 10000, 25000, 55000, 115000, ... */
function playerHousePrice(ownedCount: number): number {
  const n = ownedCount + 1 // 1-indexed: the house about to be purchased
  return 7500 * 2 ** (n - 1) - 5000
}

/** Count of player-house buildings currently owned (purchased) across every town. */
export function countOwnedPlayerHouses(): number {
  let count = 0
  for (const { locationData } of Object.values(LOCATION_REGISTRY)) {
    const t = locationData.HUB_TOWN_NAME
    for (const b of locationData.HUB_BUILDINGS) {
      if (b.id && b.upgradeKind === 'playerHouse' && getUpgradeLevel(t, b.id) >= 1) count++
    }
  }
  return count
}

// ── Next-upgrade query ───────────────────────────────────────────────────────

export interface NextUpgrade {
  /** The next level definition, or null when the track is maxed/empty. */
  def: BuildingUpgradeLevel | null
  /** Current purchased level. */
  level: number
  /** Total levels in this building's track. */
  total: number
  /** Crystal cost of the next level (0 when none). */
  cost: number
  /** Reputation required for the next level. */
  repRequired: number
  /** True when the next level is blocked by insufficient town reputation. */
  repLocked: boolean
  /** True when every level has been purchased. */
  maxed: boolean
}

export function nextUpgrade(town: string, buildingId: string, kind: string | undefined): NextUpgrade {
  const track = getUpgradeTrack(kind)
  const data = load()
  const state = townState(data, town)
  const level = state.levels[buildingId] ?? 0
  const total = track.length

  if (level >= total || total === 0) {
    return { def: null, level, total, cost: 0, repRequired: 0, repLocked: false, maxed: total > 0 }
  }

  const def = track[level]
  const cost = kind === 'playerHouse' ? playerHousePrice(countOwnedPlayerHouses()) : def.cost
  return {
    def: { ...def, cost },
    level,
    total,
    cost,
    repRequired: def.repRequired,
    repLocked: state.rep < def.repRequired,
    maxed: false,
  }
}

// ── Purchase ─────────────────────────────────────────────────────────────────

export type PurchaseResult =
  | { ok: true; newLevel: number; newRep: number; spent: number; def: BuildingUpgradeLevel }
  | { ok: false; reason: 'maxed' | 'rep-locked' | 'insufficient-crystals' }

/**
 * Attempt to buy the next upgrade level for a building. Validates the town
 * reputation gate and the crystal balance, then deducts crystals, increments
 * the level, and grants reputation. All-or-nothing.
 */
export function purchaseUpgrade(town: string, buildingId: string, kind: string | undefined): PurchaseResult {
  const next = nextUpgrade(town, buildingId, kind)
  if (next.maxed || !next.def) return { ok: false, reason: 'maxed' }
  if (next.repLocked) return { ok: false, reason: 'rep-locked' }

  const balance = loadCrystals()
  if (balance < next.cost) return { ok: false, reason: 'insufficient-crystals' }

  // Deduct crystals first, then persist the new level + reputation.
  saveCrystals(balance - next.cost)

  const data = load()
  const state = townState(data, town)
  const newLevel = (state.levels[buildingId] ?? 0) + 1
  const newRep = state.rep + next.def.repReward
  data[town] = { rep: newRep, levels: { ...state.levels, [buildingId]: newLevel } }
  save(data)

  return { ok: true, newLevel, newRep, spent: next.cost, def: next.def }
}

// ── Services ─────────────────────────────────────────────────────────────────
//
// A building's `upgradeKind` lives in the town config (not in this store), so to
// resolve which catalog services are unlocked we need a buildingId→kind lookup.
// HubWorld registers one from the active location bundle; other systems then
// read services without importing the loader.

let _kindResolver: ((town: string, buildingId: string) => string | undefined) | null = null

/** Register how to resolve a building's `upgradeKind` (set by HubWorld on load). */
export function setUpgradeKindResolver(
  fn: ((town: string, buildingId: string) => string | undefined) | null,
): void {
  _kindResolver = fn
}

/** All service ids unlocked across a town's purchased upgrade levels. */
export function getUnlockedServices(town: string): string[] {
  if (!_kindResolver) return []
  const state = townState(load(), town)
  const out: string[] = []
  for (const [buildingId, level] of Object.entries(state.levels)) {
    const track = getUpgradeTrack(_kindResolver(town, buildingId))
    for (let i = 0; i < Math.min(level, track.length); i++) {
      if (track[i].service) out.push(track[i].service!)
    }
  }
  return out
}

/** True when a given service id is unlocked anywhere in the town. */
export function hasTownService(town: string, serviceId: string): boolean {
  return getUnlockedServices(town).includes(serviceId)
}

// ── Daily town tribute ───────────────────────────────────────────────────────
//
// The first concrete service payoff: a town pays a small daily crystal stipend
// scaled by the services its buildings have unlocked, claimable once per day.
// This makes every catalog `service` worth something and gives reputation a
// tangible return on the crystals invested.

const TRIBUTE_BASE = 10
const TRIBUTE_PER_SERVICE = 8

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Crystals the town would pay today (0 when nothing is unlocked). */
export function tributeAmount(town: string): number {
  const services = getUnlockedServices(town).length
  if (services === 0) return 0
  return TRIBUTE_BASE + services * TRIBUTE_PER_SERVICE
}

/** True when today's tribute has not yet been collected and is non-zero. */
export function tributeAvailable(town: string): boolean {
  if (tributeAmount(town) <= 0) return false
  return townState(load(), town).tributeDay !== today()
}

/**
 * Collect today's tribute: credits crystals (shared wallet), marks the day, and
 * returns the amount. Returns 0 if already collected or nothing is unlocked.
 */
export function collectTribute(town: string): number {
  if (!tributeAvailable(town)) return 0
  const amount = tributeAmount(town)
  saveCrystals(loadCrystals() + amount)
  const data = load()
  const state = townState(data, town)
  data[town] = { ...state, tributeDay: today() }
  save(data)
  return amount
}
