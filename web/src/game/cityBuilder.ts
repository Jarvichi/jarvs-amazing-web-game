// ─── City Builder ─────────────────────────────────────────────────────────────
// Persistent idle city: place owned structures on a grid. Spawn buildings show
// their unit walking around the city view. Resources are produced and consumed
// each tick. Happiness is driven by food availability and city defence.

import { logError } from '../logger'
import { getMasteryXp, loadCollection, masteryLevel } from './collection'
import { CardRarity } from './types'

// ── Constants ─────────────────────────────────────────────────────────────────

export const CITY_COLS  = 6
export const CITY_ROWS  = 4
export const CITY_CELLS = CITY_COLS * CITY_ROWS
export const MAX_CITY_ROWS = 8

/** Each grid cell is this many pixels wide/tall in the overlay. */
export const CELL_PX = 72

/** Max minutes of offline accumulation counted (8 hours). */
const MAX_OFFLINE_MINUTES = 480

/** Income per minute for spawn buildings. */
export const INCOME_SPAWN: Record<CardRarity, number> = { common: 2, uncommon: 4, rare: 6, epic: 8, legendary: 10, mythic: 15, shiny: 10, holofoil: 10, glass: 10 }
/** Income per minute for utility buildings. */
export const INCOME_UTILITY: Record<CardRarity, number> = { common: 1, uncommon: 3, rare: 5, epic: 7, legendary: 8, mythic: 12, shiny: 8, holofoil: 8, glass: 8 }
/** Income per minute for wall / no-effect structures. */
export const INCOME_WALL: Record<CardRarity, number> = { common: 0, uncommon: 1, rare: 1, epic: 2, legendary: 2, mythic: 3, shiny: 2, holofoil: 2, glass: 2 }

/** Happiness regeneration per minute toward the target value. */
const HAPPINESS_REGEN = 15
/** Happiness drain per minute away from target when conditions not met (~24 hrs to fully despawn). */
const HAPPINESS_DRAIN = 0.07

/** Level-up costs: index = target level (1-based). Beyond the table, the last entry repeats. */
export const LEVEL_UP_COSTS = [50000, 100000, 250000, 500000, 1000000]

// ── Resource constants ────────────────────────────────────────────────────────

/** Defence value contributed by walls (per rarity). */
const WALL_DEFENSE: Record<CardRarity, number> = { common: 5, uncommon: 10, rare: 20, epic: 30, legendary: 40, mythic: 60, shiny: 40, holofoil: 40, glass: 40 }
/** Defence value contributed by spawn buildings (per rarity) — intentionally small; fortifications carry the load. */
const SPAWN_DEFENSE: Record<CardRarity, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6, shiny: 5, holofoil: 5, glass: 5 }

/** Wheat consumed per minute by a spawn building (units need feeding). */
const FOOD_CONSUME_RATE: Record<CardRarity, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6, shiny: 5, holofoil: 5, glass: 5 }

/** Bread consumed per minute per spawner unit — quality food above the wheat baseline. */
const BREAD_CONSUME_RATE = 0.5
/** Wood consumed per minute per spawner unit — maintenance / heating. */
const WOOD_CONSUME_RATE  = 0.3
/** Wood consumption multiplier in winter (heating demand). */
const WINTER_WOOD_MULT   = 1.8
/** Happiness target bonus (points) when bread coverage ≥ 80%. */
const BREAD_HAPPY_BONUS  = 20
/** Happiness target penalty (points) when wood supply covers < 50% of demand. */
const WOOD_SHORTAGE_PENALTY = 15

/**
 * Buildings that convert an input resource into their output resource.
 * Values are per-minute consumption rates, matching BUILDING_RESOURCE_CONFIG.
 * e.g. Windmill produces 2 bread/min and consumes 2 wheat/min.
 */
const BUILDING_CONVERSION_COST: Record<string, Partial<ResourceStock>> = {
  'Windmill': { wheat: 2 },
}

/** Returns the per-unit input cost for a conversion building (empty if none). */
export function getBuildingConsumes(name: string): Partial<ResourceStock> {
  return BUILDING_CONVERSION_COST[name] ?? {}
}

/** Resource cost to place a spawner of a given rarity. */
export const SPAWNER_PLACE_COST: Record<CardRarity, Partial<ResourceStock>> = {
  common:    { wheat: 20 },
  uncommon:  { wheat: 30, wood: 10 },
  rare:      { wheat: 50, wood: 20, ore: 10 },
  epic:      { wheat: 65, wood: 30, ore: 15 },
  legendary: { wheat: 80, wood: 40, ore: 20 },
  mythic:    { wheat: 100, wood: 60, ore: 30 },
  shiny:     { wheat: 80, wood: 40, ore: 20 },
  holofoil:  { wheat: 80, wood: 40, ore: 20 },
  glass:     { wheat: 80, wood: 40, ore: 20 },
}

/** Icons for each resource type (used in UI). */
export const RESOURCE_ICONS: Record<ResourceType, string> = {
  wheat:  '🌾',
  wood:   '🪵',
  ore:    '⛏',
  bread:  '🍞',
  planks: '🪚',
  metal:  '⚔',
}

// ── Fortification constants ───────────────────────────────────────────────────

/** Build time in minutes per rarity. Legendary = 3 days; others scaled proportionally. */
export const FORT_BUILD_MINUTES: Record<CardRarity, number> = {
  common:    432,   // ~7 h
  uncommon:  864,   // ~14 h
  rare:     1728,   // ~1.2 days
  epic:     3024,   // ~2.1 days
  legendary: 4320,  // 3 days
  mythic:    6912,  // ~4.8 days
  shiny:     4320,
  holofoil:  4320,
  glass:     4320,
}

/** Max HP for a fortification of each rarity. */
export const FORT_MAX_HP: Record<CardRarity, number> = {
  common: 50, uncommon: 100, rare: 200, epic: 350, legendary: 500,
  mythic: 800, shiny: 500, holofoil: 500, glass: 500,
}

/** Defense value contributed by a fortification at full HP. */
export const FORT_DEFENSE: Record<CardRarity, number> = {
  common: 10, uncommon: 20, rare: 40, epic: 60, legendary: 80,
  mythic: 120, shiny: 80, holofoil: 80, glass: 80,
}

/** Gold + resource cost to build a fortification of each rarity. */
export const FORT_PLACE_COST: Record<CardRarity, { gold: number } & Partial<ResourceStock>> = {
  common:    { gold: 1000,   wood: 25 },
  uncommon:  { gold: 3500,   wood: 50,  ore: 20 },
  rare:      { gold: 12000,  wood: 120, ore: 50 },
  epic:      { gold: 40000,  wood: 250, ore: 120, planks: 35 },
  legendary: { gold: 100000, wood: 500, ore: 250, planks: 100 },
  mythic:    { gold: 500000, wood: 1000, ore: 500, planks: 250 },
  shiny:     { gold: 100000, wood: 500, ore: 250, planks: 100 },
  holofoil:  { gold: 100000, wood: 500, ore: 250, planks: 100 },
  glass:     { gold: 100000, wood: 500, ore: 250, planks: 100 },
}

/** HP repaired per minute per fortification (1 HP every 5 minutes). */
const FORT_REPAIR_RATE = 0.2
/** Wood cost per 20 HP repaired. */
const FORT_REPAIR_WOOD_PER_HP = 1 / 20

/** Number of attacks a fortification can survive before permanent destruction. */
export const FORT_MAX_ATTACKS: Record<CardRarity, number> = {
  common: 5, uncommon: 8, rare: 12, epic: 18, legendary: 25,
  mythic: 40, shiny: 25, holofoil: 25, glass: 25,
}

/** Gold cost to hire additional builders (index = number of extras already hired). */
export const BUILDER_HIRE_COSTS = [1_000_000, 5_000_000, 10_000_000, 20_000_000, 40_000_000, 80_000_000, 160_000_000, 320_000_000]

/** Default and max number of builders. */
export const DEFAULT_BUILDER_COUNT = 2
export const MAX_BUILDER_COUNT = 10

// ── Attack constants ──────────────────────────────────────────────────────────

/** Base attack interval in ms (6 hours). */
const BASE_ATTACK_INTERVAL_MS = 6 * 3600 * 1000
/** Random extra time added to each interval (up to 2 hours). */
const ATTACK_INTERVAL_JITTER_MS = 2 * 3600 * 1000

// ── Expansion costs: current rows → cost to add one more row ─────────────────

export const EXPANSION_COSTS: Record<number, { gold: number; resources: Partial<ResourceStock> }> = {
  4: { gold: 500_000,    resources: { wood: 2000,  ore: 1000, planks: 500   } },
  5: { gold: 2_000_000,  resources: { wood: 5000,  ore: 2500, planks: 1500  } },
  6: { gold: 5_000_000,  resources: { wood: 8000,  ore: 4000, planks: 3000  } },
  7: { gold: 15_000_000, resources: { wood: 10000, ore: 6000, planks: 5000  } },
}

/** Hard cap on total fortifications (prevents unlimited stacking). */
export const MAX_TOTAL_FORTS = 12

// ── Disaster events ──────────────────────────────────────────────────────────

export type DisasterType = 'fire' | 'plague'

export interface Disaster {
  type:          DisasterType
  affectedCells: number[]   // grid cell indices currently on fire (fire only)
  startedAt:     number     // Unix ms — when the disaster began
  severity:      number     // 0–100; fire = cells spread so far; plague = intensity
}

const FIRE_SPREAD_INTERVAL_MIN = 45   // fire spreads every 45 game-minutes
const FIRE_MAX_CELLS           = 3    // hard cap on fire spread
const FIRE_DURATION_MIN        = 180  // fire burns out on its own after 3 hrs
const FIRE_EXTINGUISH_WOOD     = 40   // wood cost per burning cell to extinguish
const PLAGUE_MAX_SEVERITY      = 100
const PLAGUE_GROW_RATE         = 0.4  // severity gained per game-minute (reaches 100 in ~250 min)
const PLAGUE_DRAIN_PER_MIN     = 0.08 // happiness drained per resident per game-minute at severity 100
const PLAGUE_CURE_BREAD_BASE   = 20   // bread to cure, scaled by severity
const PLAGUE_CURE_DURATION_MIN = 300  // plague fades naturally after 5 hrs
const DISASTER_CHANCE_PER_HOUR = 0.04 // ~4% per real hour ≈ once per ~25 hrs on average

// Deterministic trait per spawner cell — mirrors makeWalker in CityBuilder.tsx (unitIndex = 0).
const TRAIT_ORDER = ['brave', 'glutton', 'industrious', 'sociable', 'reclusive'] as const

export function getCellTrait(
  cell: CityCell, cellIndex: number,
): 'brave' | 'glutton' | 'industrious' | 'sociable' | 'reclusive' {
  const code = cell.spawnedUnitName?.charCodeAt(0) ?? 0
  return TRAIT_ORDER[(cellIndex * 13 + code) % 5]
}

/** Wood cost to extinguish current fire; brave residents in burning buildings discount by 15 each. */
export function fireExtinguishCost(state: CityState): number {
  if (state.activeDisaster?.type !== 'fire') return 0
  const cells      = state.activeDisaster.affectedCells
  const baseCost   = cells.length * FIRE_EXTINGUISH_WOOD
  const braveDiscount = cells.filter(ci => {
    const cell = state.grid[ci]
    return cell?.spawnedUnitName && getCellTrait(cell, ci) === 'brave'
  }).length * 15
  return Math.max(0, baseCost - braveDiscount)
}

/** Bread cost to cure current plague (scales with severity). */
export function plagueCureCost(state: CityState): number {
  if (state.activeDisaster?.type !== 'plague') return 0
  return Math.max(10, Math.ceil(state.activeDisaster.severity / PLAGUE_MAX_SEVERITY * PLAGUE_CURE_BREAD_BASE * 3))
}

export function extinguishFire(state: CityState): CityState {
  if (state.activeDisaster?.type !== 'fire') return state
  const cost = fireExtinguishCost(state)
  if (state.resources.wood < cost) return state
  const braveCount = state.activeDisaster.affectedCells.filter(ci => {
    const cell = state.grid[ci]
    return cell?.spawnedUnitName && getCellTrait(cell, ci) === 'brave'
  }).length
  const heroNote = braveCount > 0 ? ` (${braveCount} brave resident${braveCount > 1 ? 's' : ''} helped!)` : ''
  let next = addChronicleEvent(state, `🚒 Fire extinguished — spent ${cost} wood${heroNote}`)
  next = {
    ...next,
    resources:      { ...next.resources, wood: next.resources.wood - cost },
    activeDisaster: null,
    nextDisasterAt: Date.now() + (12 + Math.random() * 24) * 3_600_000,
  }
  return next
}

export function curePlague(state: CityState): CityState {
  if (state.activeDisaster?.type !== 'plague') return state
  const cost = plagueCureCost(state)
  if (state.resources.bread < cost) return state
  let next = addChronicleEvent(state, `💊 Plague cured — spent ${cost} bread`)
  next = {
    ...next,
    resources:      { ...next.resources, bread: next.resources.bread - cost },
    activeDisaster: null,
    nextDisasterAt: Date.now() + (12 + Math.random() * 24) * 3_600_000,
  }
  return next
}

// ── City districts ────────────────────────────────────────────────────────────

export type DistrictType = 'none' | 'agricultural' | 'military' | 'commercial' | 'industrial'

export interface DistrictDef {
  icon:    string
  label:   string
  color:   string   // CSS background tint for the row
  goldMult?:       number  // additive multiplier on gold income
  prodMult?:       number  // additive multiplier on resource production
  defBonus?:       number  // additive multiplier on defense contribution
}

export const DISTRICT_INFO: Record<DistrictType, DistrictDef> = {
  none:         { icon: '—',  label: 'Unzoned',      color: 'transparent' },
  agricultural: { icon: '🌾', label: 'Agricultural', color: 'rgba(180,150,0,0.55)',  prodMult: 0.15 },
  military:     { icon: '🛡', label: 'Military',     color: 'rgba(40,120,200,0.55)', defBonus: 0.10 },
  commercial:   { icon: '💰', label: 'Commercial',   color: 'rgba(200,160,0,0.55)',  goldMult: 0.15 },
  industrial:   { icon: '⚙',  label: 'Industrial',   color: 'rgba(120,120,140,0.55)', prodMult: 0.10 },
}

const DISTRICT_CYCLE: DistrictType[] = ['none', 'agricultural', 'military', 'commercial', 'industrial']

export function cycleDistrict(current: DistrictType): DistrictType {
  const idx = DISTRICT_CYCLE.indexOf(current)
  return DISTRICT_CYCLE[(idx + 1) % DISTRICT_CYCLE.length]
}

export function getRowDistrict(state: CityState, row: number): DistrictType {
  return (state.zones?.[row] as DistrictType | undefined) ?? 'none'
}

export function setRowDistrict(state: CityState, row: number, zone: DistrictType): CityState {
  const zones = [...(state.zones ?? [])]
  while (zones.length <= row) zones.push('none')
  zones[row] = zone
  return { ...state, zones }
}

// ── Storage caps ─────────────────────────────────────────────────────────────

export const STORAGE_BASE_CAPS: ResourceStock = {
  wheat: 500, wood: 300, ore: 200, bread: 300, planks: 200, metal: 150,
}
const STORAGE_PER_WAREHOUSE = 200  // added to all caps per warehouse building placed
const WAREHOUSE_PATTERN = /warehouse|barn|granary|silo|storehouse|vault/i

export function calculateStorageCaps(state: CityState): ResourceStock {
  let bonus = 0
  for (const cell of state.grid) {
    if (cell && !cell.spawnedUnitName && WAREHOUSE_PATTERN.test(cell.cardName)) {
      bonus += STORAGE_PER_WAREHOUSE
    }
  }
  const caps = { ...STORAGE_BASE_CAPS }
  for (const k of Object.keys(caps) as ResourceType[]) caps[k] += bonus
  return caps
}

// ── Stats history ─────────────────────────────────────────────────────────────

const HISTORY_MAX         = 144          // 24 h at 10-min resolution
const HISTORY_INTERVAL_MS = 10 * 60_000  // sample at most once per 10 minutes

export interface HistorySample {
  t:        number   // Unix ms timestamp
  gold:     number
  pop:      number
  def:      number
  wheat:    number
  wood:     number
  ore:      number
  bread:    number
  planks:   number
  metal:    number
  attacked?: boolean
}

// ── Seasonal cycles ───────────────────────────────────────────────────────────

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export interface SeasonInfo {
  name:   string
  icon:   string
  /** Additive wheat production modifier (e.g. 0.1 = +10%). */
  wheat:  number
  /** Additive wood production modifier. */
  wood:   number
  /** Additive ore production modifier. */
  ore:    number
  /** Additive happiness regen modifier. */
  regen:  number
  /** Additive wheat consumption modifier for spawners (positive = more hungry). */
  hunger: number
  flavour: string
}

export const SEASON_INFO: Record<Season, SeasonInfo> = {
  spring: { name: 'Spring', icon: '🌸', wheat: 0.10, wood: 0,    ore: 0,    regen:  0.15, hunger:  0,    flavour: 'Mild weather, good harvests' },
  summer: { name: 'Summer', icon: '☀️', wheat: 0.30, wood: 0,    ore: 0,    regen:  0,    hunger:  0.10, flavour: 'Bountiful wheat, hungry residents' },
  autumn: { name: 'Autumn', icon: '🍂', wheat: 0,    wood: 0.25, ore: 0.25, regen:  0,    hunger:  0,    flavour: 'Rich timber and ore yields' },
  winter: { name: 'Winter', icon: '❄️', wheat:-0.20, wood: 0,    ore: 0,    regen: -0.10, hunger:  0.15, flavour: 'Cold reduces food supply' },
}

/** Returns the current season based on the real-world month. */
export function currentSeason(now = Date.now()): Season {
  const month = new Date(now).getMonth()  // 0 = Jan
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'autumn'
  return 'winter'
}

// ── Resource building config ──────────────────────────────────────────────────

/**
 * Map of building name → resource production per minute.
 * Buildings not listed here fall back to keyword matching in getBuildingResourceConfig.
 */
const BUILDING_RESOURCE_CONFIG: Record<string, Partial<ResourceStock>> = {
  // ── Core buildings (always available, built with gold) ──
  'Windmill':    { bread: 2 },
  'Bakery':      { bread: 1.5 },
  'Quarry':      { ore: 2, planks: 1 },
  'Granary':     {},           // storage handled by WAREHOUSE_PATTERN; no per-tick produce
  'Watchtower':  {},           // defense handled as wall-type (non-spawner, non-producer)
  // ── Card buildings ──
  'Farm':            { wheat: 3 },
  'Canopy Farm':     { wheat: 4 },
  'Bloom Garden':    { wheat: 2 },
  'Scout Garden':    { wheat: 2 },
  'Drift Garden':    { wheat: 2 },
  'Pixie Garden':    { wheat: 3 },
  'Oasis Well':      { wheat: 2 },
  'Ancient Spring':  { wheat: 1 },
  'Lumber Camp':     { wood: 3 },
  'Blacksmith':      { metal: 1 },
  'Stone Mason':     { planks: 2 },
  'Cryo Forge':      { metal: 1 },
  'Clockwork Forge': { metal: 2 },
  'Titan Forge':     { metal: 2 },
  'Glacial Forge':   { metal: 1 },
  'Golem Forge':     { metal: 2 },
  'Arcane Forge':    { metal: 1 },
  'Automaton Forge': { metal: 2 },
}

/** Keyword patterns for resource production fallback (checked in order). */
const KEYWORD_RESOURCE: Array<{ pattern: RegExp; produces: Partial<ResourceStock> }> = [
  { pattern: /farm/i,       produces: { wheat: 2 } },
  { pattern: /garden|orchard/i, produces: { wheat: 2 } },
  { pattern: /forge|smith/i, produces: { metal: 1 } },
  { pattern: /mason|quarry|stone/i, produces: { planks: 1, ore: 1 } },
  { pattern: /lumber|sawmill|timber/i, produces: { wood: 3 } },
  { pattern: /mill|bakery/i, produces: { bread: 1 } },
  { pattern: /mine|iron hall/i, produces: { ore: 2 } },
]

export function getBuildingProduces(name: string): Partial<ResourceStock> {
  if (BUILDING_RESOURCE_CONFIG[name]) return BUILDING_RESOURCE_CONFIG[name]
  for (const { pattern, produces } of KEYWORD_RESOURCE) {
    if (pattern.test(name)) return produces
  }
  return {}
}

// ── Adjacency synergy rules ───────────────────────────────────────────────────

interface SynergyRule {
  /** Resource this building must produce to be eligible. */
  needs: ResourceType
  /** Resource a neighbour must produce to activate the synergy. */
  feeds: ResourceType
  /** Additive production multiplier bonus (e.g. 0.5 = +50%). */
  bonus: number
  label: string
}

const SYNERGY_RULES: SynergyRule[] = [
  { needs: 'bread',  feeds: 'wheat', bonus: 0.5, label: '🌾 Farm nearby: +50% bread'   },
  { needs: 'metal',  feeds: 'wood',  bonus: 0.5, label: '🪵 Lumber nearby: +50% metal'  },
  { needs: 'planks', feeds: 'ore',   bonus: 0.5, label: '⛏ Mine nearby: +50% planks'   },
]

/** Additive gold income bonus for a spawn building adjacent to a food producer. */
const SPAWN_FOOD_ADJACENCY_BONUS = 0.2  // +20% gold income

/**
 * Returns active synergy bonuses for a resource-producing building.
 * Each entry is an additive multiplier on that resource's output.
 */
export function getCellSynergyBonuses(
  state: CityState,
  cellIndex: number,
): Array<{ resource: ResourceType; multiplier: number; label: string }> {
  const cell = state.grid[cellIndex]
  if (!cell) return []
  const gridRows = state.rows ?? CITY_ROWS
  const neighbours = getNeighbourIndices(cellIndex, gridRows)
    .map(ni => state.grid[ni])
    .filter((nb): nb is CityCell => nb != null)
  const produces = getBuildingProduces(cell.cardName)
  const bonuses: Array<{ resource: ResourceType; multiplier: number; label: string }> = []
  for (const rule of SYNERGY_RULES) {
    if ((produces[rule.needs] ?? 0) > 0) {
      if (neighbours.some(nb => (getBuildingProduces(nb.cardName)[rule.feeds] ?? 0) > 0)) {
        bonuses.push({ resource: rule.needs, multiplier: rule.bonus, label: rule.label })
      }
    }
  }
  return bonuses
}

/**
 * Additive gold income bonus for a spawn building that has a food producer
 * as an orthogonal neighbour.
 */
export function getCellIncomeBonus(state: CityState, cellIndex: number): number {
  const cell = state.grid[cellIndex]
  if (!cell?.spawnedUnitName) return 0
  const gridRows = state.rows ?? CITY_ROWS
  const hasFoodNeighbour = getNeighbourIndices(cellIndex, gridRows).some(ni => {
    const nb = state.grid[ni]
    return nb && (getBuildingProduces(nb.cardName).wheat ?? 0) > 0
  })
  return hasFoodNeighbour ? SPAWN_FOOD_ADJACENCY_BONUS : 0
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ResourceType = 'wheat' | 'wood' | 'ore' | 'bread' | 'planks' | 'metal'
export type ResourceStock = Record<ResourceType, number>

export type StructureKind = 'spawn' | 'utility' | 'wall'

export interface CityCell {
  cardName:          string
  rarity:            CardRarity
  /** Name of the unit this building spawns (from structureEffect.spawn), if any. */
  spawnedUnitName?:  string
  /** Unit name this walker wants as an affinity friend (stored at placement). */
  affinityWith?:     string
}

export interface Fortification {
  cardName:     string
  rarity:       CardRarity
  hp:           number
  maxHp:        number
  attacksTaken: number
}

export interface BuildQueueEntry {
  cardName:     string
  rarity:       CardRarity
  completesAt:  number
}

export interface AttackEvent {
  at:                  number
  power:               number
  defense:             number
  outcome:             'repelled' | 'partial' | 'defeated'
  stolenGold:          number
  goldEarned:          number   // loot dropped by attacker on successful defence
  destroyedBuildings:  string[]
  count?:              number   // set when summarising multiple missed attacks
}

export type TradeDirection = 'sell' | 'buy'

export interface TradeOffer {
  resource:   ResourceType
  direction:  TradeDirection
  /** Amount of resource traded. */
  amount:     number
  /** Gold received (sell) or paid (buy). */
  gold:       number
  expiresAt:  number
}

export interface ActiveCaravan {
  offer:       TradeOffer
  returnsAt:   number
}

export interface CityState {
  grid:           (CityCell | undefined)[]
  gold:           number
  resources:      ResourceStock
  lastTick:       number
  // cardLevels:     Record<string, number>
  /** cellIndex → happiness 0–100 (only meaningful for spawn buildings). */
  happiness:      Record<number, number>
  /** Dynamic grid height; starts at CITY_ROWS (4). */
  rows:           number
  /** Timestamp when the next attack will occur. */
  nextAttackAt:   number
  /** Wall/moat fortifications outside the building grid. */
  fortifications: Fortification[]
  /** Fortifications currently under construction. */
  builderQueue:   BuildQueueEntry[]
  /** Number of available builders (default 2). */
  builderCount:   number
  /** Most recent attack result (shown as notification). */
  lastAttack:     AttackEvent | null
  /** Temporary defense bonus from actively patrolling residents. */
  patrolBonus?:   number
  /** Chronological log of notable city events, newest first (max 50). */
  chronicle:      string[]
  /** IDs of milestones already awarded (prevents duplicate rewards). */
  completedMilestones: string[]
  /** Total number of attacks processed (used for milestone checks). */
  attacksProcessed: number
  /** Current trade offer available to dispatch (null = generating). */
  tradeOffer:    TradeOffer | null
  /** Caravan currently away on a trade mission. */
  activeCaravan: ActiveCaravan | null
  /** Periodic economy snapshots for the Stats dashboard (newest last, max 144). */
  history:       HistorySample[]
  /** District zone per row (indexed by row number). */
  zones:         DistrictType[]
  /** Active disaster (fire or plague), if any. */
  activeDisaster: Disaster | null
  /** Timestamp when the next disaster may be triggered. */
  nextDisasterAt: number
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'jarv_city_builder'

function emptyResources(): ResourceStock {
  return { wheat: 0, wood: 0, ore: 0, bread: 0, planks: 0, metal: 0 }
}

function defaultState(): CityState {
  return {
    grid:           Array(CITY_CELLS).fill(undefined),
    gold:           500,
    resources:      { wheat: 300, wood: 300, ore: 150, bread: 0, planks: 0, metal: 0 },
    lastTick:       Date.now(),
    // cardLevels:     {},
    happiness:      {},
    rows:           CITY_ROWS,
    nextAttackAt:   Date.now() + BASE_ATTACK_INTERVAL_MS + Math.random() * ATTACK_INTERVAL_JITTER_MS,
    fortifications: [],
    builderQueue:   [],
    builderCount:   DEFAULT_BUILDER_COUNT,
    lastAttack:          null,
    chronicle:           [],
    completedMilestones: [],
    attacksProcessed:    0,
    tradeOffer:          null,
    activeCaravan:       null,
    history:             [],
    zones:               [],
    activeDisaster:      null,
    nextDisasterAt:      Date.now() + (18 + Math.random() * 12) * 3_600_000,
  }
}

export function loadCityState(): CityState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as Partial<CityState>
    const savedResources = (parsed.resources ?? {}) as Partial<ResourceStock>
    const rows = parsed.rows ?? CITY_ROWS
    const cells = CITY_COLS * rows
    const savedGrid = parsed.grid ?? Array(cells).fill(undefined)
    const grid = savedGrid.length < cells
      ? [...savedGrid, ...Array(cells - savedGrid.length).fill(undefined)]
      : savedGrid
    return {
      grid,
      gold:           parsed.gold       ?? 0,
      resources:  {
        wheat:  savedResources.wheat  ?? 0,
        wood:   savedResources.wood   ?? 0,
        ore:    savedResources.ore    ?? 0,
        bread:  savedResources.bread  ?? 0,
        planks: savedResources.planks ?? 0,
        metal:  savedResources.metal  ?? 0,
      },
      lastTick:       parsed.lastTick   ?? Date.now(),
      // cardLevels:     parsed.cardLevels ?? {},
      happiness:      parsed.happiness  ?? {},
      rows,
      nextAttackAt:   parsed.nextAttackAt ?? Date.now() + BASE_ATTACK_INTERVAL_MS,
      fortifications: (parsed.fortifications ?? []).map(f => ({
        ...f,
        attacksTaken: (f as Fortification).attacksTaken ?? 0,
      })),
      builderQueue:   parsed.builderQueue ?? [],
      builderCount:   parsed.builderCount ?? DEFAULT_BUILDER_COUNT,
      lastAttack:     parsed.lastAttack ?? null,
      chronicle:           parsed.chronicle ?? [],
      completedMilestones: parsed.completedMilestones ?? [],
      attacksProcessed:    parsed.attacksProcessed ?? 0,
      tradeOffer:          parsed.tradeOffer ?? null,
      activeCaravan:       parsed.activeCaravan ?? null,
      history:             parsed.history ?? [],
      zones:               (parsed.zones ?? []) as DistrictType[],
      activeDisaster:      parsed.activeDisaster ?? null,
      nextDisasterAt:      parsed.nextDisasterAt ?? Date.now() + (18 + Math.random() * 12) * 3_600_000,
    }
  } catch (err) {
    logError('loadCityState failed', err as Record<string, unknown>)
    return defaultState()
  }
}

export function saveCityState(state: CityState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    logError('saveCityState failed', err as Record<string, unknown>)
  }
}

// ── Chronicle helpers ─────────────────────────────────────────────────────────

const CHRONICLE_MAX = 50

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function addChronicleEvent(state: CityState, msg: string): CityState {
  const entry = `[${fmtTime(Date.now())}] ${msg}`
  const chronicle = [entry, ...(state.chronicle ?? [])].slice(0, CHRONICLE_MAX)
  return { ...state, chronicle }
}

// ── Milestones ────────────────────────────────────────────────────────────────

export interface MilestoneDef {
  id:              string
  label:           string
  icon:            string
  description:     string
  condition:       (state: CityState) => boolean
  goldReward:      number
  resourceReward?: Partial<ResourceStock>
}

export const MILESTONES: MilestoneDef[] = [
  {
    id: 'first_building', label: 'First Steps', icon: '🏛',
    description: 'Place your first building',
    condition: s => s.grid.some(c => c != null),
    goldReward: 500,
  },
  {
    id: 'population_10', label: 'Growing City', icon: '👥',
    description: 'Reach a population of 10',
    condition: s => cityPopulation(s) >= 10,
    goldReward: 5000,
  },
  {
    id: 'first_fort', label: 'Fortified', icon: '🧱',
    description: 'Complete your first fortification',
    condition: s => s.fortifications.length > 0,
    goldReward: 2000,
    resourceReward: { wood: 50 },
  },
  {
    id: 'gold_100k', label: 'Prosperous', icon: '🪙',
    description: 'Accumulate 100,000 gold',
    condition: s => s.gold >= 100000,
    goldReward: 10000,
  },
  {
    id: 'five_attacks', label: 'Battle-Hardened', icon: '⚔',
    description: 'Survive 5 attacks',
    condition: s => (s.attacksProcessed ?? 0) >= 5,
    goldReward: 25000,
  },
  {
    id: 'all_resources', label: 'Self-Sufficient', icon: '🌾',
    description: 'Produce all 6 resource types',
    condition: s => {
      const types: ResourceType[] = ['wheat', 'wood', 'ore', 'bread', 'planks', 'metal']
      return types.every(r => s.grid.some(c => c && !c.spawnedUnitName && (getBuildingProduces(c.cardName)[r] ?? 0) > 0))
    },
    goldReward: 5000,
  },
  {
    id: 'max_expansion', label: 'Metropolis', icon: '🏙',
    description: `Expand the city to ${MAX_CITY_ROWS} rows`,
    condition: s => (s.rows ?? CITY_ROWS) >= MAX_CITY_ROWS,
    goldReward: 50000,
  },
]

/**
 * Checks all milestones and awards any newly completed ones.
 * Returns the updated state and the list of newly completed milestone IDs.
 */
export function checkMilestones(state: CityState): { state: CityState; newlyCompleted: MilestoneDef[] } {
  const completed = new Set(state.completedMilestones ?? [])
  const newlyCompleted: MilestoneDef[] = []
  let next = state

  for (const m of MILESTONES) {
    if (completed.has(m.id)) continue
    if (!m.condition(next)) continue

    // Award reward
    let gold = next.gold + m.goldReward
    let resources = { ...next.resources }
    if (m.resourceReward) {
      for (const [res, amt] of Object.entries(m.resourceReward) as [ResourceType, number][]) {
        resources[res] = (resources[res] ?? 0) + amt
      }
    }
    const chronicle = addChronicleEvent(next, `${m.icon} Milestone: ${m.label} — +${m.goldReward.toLocaleString()} gold!`).chronicle
    next = {
      ...next,
      gold,
      resources,
      chronicle,
      completedMilestones: [...(next.completedMilestones ?? []), m.id],
    }
    newlyCompleted.push(m)
  }

  return { state: next, newlyCompleted }
}

// ── Mastery helpers ───────────────────────────────────────────────────────────

/** Resource output multiplier for a building at the given mastery level: 2^level. */
export function masteryOutputMultiplier(level: number): number {
  return Math.pow(2, level)
}

/** How many units a spawner should field: mastery 0 → 1, mastery N → N+1. */
export function spawnerUnitCount(state: CityState, cardName: string): number {
  return (getCardMasteryLevel(cardName) ?? 0) + 1
}

export function getCardMasteryLevel(cardName: string): number {
    const col = loadCollection()
    const currentXp = getMasteryXp(col, cardName)
    const currentLvl = masteryLevel(currentXp)
    return currentLvl
}

// ── Structure classification ──────────────────────────────────────────────────

export function getStructureKind(cell: CityCell): StructureKind {
  if (cell.spawnedUnitName) return 'spawn'
  return 'utility'
}

/** Returns true if a card is a pure defence structure (not spawner, not resource producer). */
export function isDefenceCard(cardName: string, isSpawner: boolean): boolean {
  if (isSpawner) return false
  const p = getBuildingProduces(cardName)
  return !Object.values(p).some(v => (v ?? 0) > 0)
}

/** Returns grid indices of the 4 orthogonally adjacent cells (no diagonals, no wrap). */
export function getNeighbourIndices(index: number, rows?: number): number[] {
  const gridRows = rows ?? CITY_ROWS
  const cols = CITY_COLS
  const row = Math.floor(index / cols)
  const col = index % cols
  const result: number[] = []
  if (col > 0)          result.push(index - 1)
  if (col < cols - 1)   result.push(index + 1)
  if (row > 0)          result.push(index - cols)
  if (row < gridRows-1) result.push(index + cols)
  return result
}

function cellIncomeRate(cell: CityCell, happy: boolean, unitCount: number): number {
  const kind = getStructureKind(cell)
  if (kind === 'spawn') {
    return happy ? INCOME_SPAWN[cell.rarity] * unitCount : 0
  }
  return INCOME_UTILITY[cell.rarity]
}

/** Defence value a wall contributes (full if city has any spawners, half otherwise). */
function wallDefense(cell: CityCell, cityHasSpawners: boolean): number {
  const base = WALL_DEFENSE[cell.rarity]
  return cityHasSpawners ? Math.round(base * 1.5) : base
}

// ── City aggregate stats ──────────────────────────────────────────────────────

export function cityDefense(state: CityState): number {
  const hasSpawners = state.grid.some(c => c?.spawnedUnitName)
  let total = 0
  let militaryBonus = 0
  for (let i = 0; i < state.grid.length; i++) {
    const cell = state.grid[i]
    if (!cell) continue
    const row = Math.floor(i / CITY_COLS)
    const isMilitary = getRowDistrict(state, row) === 'military'
    if (cell.spawnedUnitName) {
      const contrib = SPAWN_DEFENSE[cell.rarity]
      total += contrib
      if (isMilitary) militaryBonus += contrib * (DISTRICT_INFO.military.defBonus ?? 0)
    } else {
      const produces = getBuildingProduces(cell.cardName)
      const isResourceProducer = Object.values(produces).some(v => (v ?? 0) > 0)
      if (!isResourceProducer) {
        const contrib = wallDefense(cell, hasSpawners)
        total += contrib
        if (isMilitary) militaryBonus += contrib * (DISTRICT_INFO.military.defBonus ?? 0)
      }
    }
  }

  // Add fortification defense (scales with current HP)
  for (const fort of state.fortifications ?? []) {
    const hpFraction = fort.maxHp > 0 ? fort.hp / fort.maxHp : 0
    total += Math.round(FORT_DEFENSE[fort.rarity] * hpFraction)
  }

  return total + Math.round(militaryBonus) + (state.patrolBonus ?? 0)
}

export function cityPopulation(state: CityState): number {
  let count = 0
  for (let i = 0; i < state.grid.length; i++) {
    const cell = state.grid[i]
    if (cell?.spawnedUnitName && (state.happiness[i] ?? 100) > 0) count++
  }
  return count
}

// ── Attack resolution ─────────────────────────────────────────────────────────

function processAttack(state: CityState): CityState {
  const defense = cityDefense(state)
  const occupiedCount = state.grid.filter(c => c != null).length
  const power = 20 + occupiedCount * 3 + Math.floor(Math.random() * 25)

  let newGold = state.gold
  const newResources = { ...state.resources }
  const newGrid = [...state.grid]
  const newForts = state.fortifications.map(f => ({ ...f }))

  const ratio = defense / Math.max(power, 1)
  let outcome: 'repelled' | 'partial' | 'defeated'
  let stolenGold = 0
  const destroyedBuildings: string[] = []
  let fortDmg: number

  let goldEarned = 0
  if (ratio >= 1.0) {
    outcome = 'repelled'
    fortDmg = 5 + Math.floor(Math.random() * 10)
    goldEarned = 10000 + Math.floor(Math.random() * 15001)
    newGold += goldEarned
  } else if (ratio >= 0.6) {
    outcome = 'partial'
    fortDmg = 15 + Math.floor(Math.random() * 20)
    stolenGold = Math.floor(newGold * (0.08 + Math.random() * 0.07))
    newGold -= stolenGold
    for (const res of Object.keys(newResources) as ResourceType[]) {
      newResources[res] = Math.floor(newResources[res] * 0.85)
    }
  } else {
    outcome = 'defeated'
    fortDmg = 35 + Math.floor(Math.random() * 30)
    stolenGold = Math.floor(newGold * (0.20 + Math.random() * 0.15))
    newGold -= stolenGold
    for (const res of Object.keys(newResources) as ResourceType[]) {
      newResources[res] = Math.floor(newResources[res] * 0.65)
    }
    // Destroy 1–2 occupied buildings — always protect the last farm
    const farmIndices = new Set(
      newGrid.map((c, i) => ({ c, i })).filter(({ c }) => c && (getBuildingProduces(c.cardName).wheat ?? 0) > 0).map(({ i }) => i)
    )
    const occupied = newGrid
      .map((cell, i) => ({ cell, i }))
      .filter(({ cell }) => cell != null)
    const toDestroy = Math.min(occupied.length, 1 + Math.floor(Math.random() * 2))
    const shuffled = [...occupied].sort(() => Math.random() - 0.5)
    let farmsLeft = farmIndices.size
    for (const { cell, i } of shuffled) {
      if (destroyedBuildings.length >= toDestroy) break
      if (farmIndices.has(i) && farmsLeft <= 1) continue  // spare the last farm
      if (farmIndices.has(i)) farmsLeft--
      destroyedBuildings.push(cell!.cardName)
      newGrid[i] = undefined
    }
  }

  // Mercy floor: raiders always leave at least 100 gold and 100 of each resource
  newGold = Math.max(100, newGold)
  for (const res of Object.keys(newResources) as ResourceType[]) {
    newResources[res] = Math.max(100, newResources[res])
  }

  // Apply damage to fortifications and track attack count
  for (const fort of newForts) {
    fort.hp = Math.max(0, fort.hp - fortDmg)
    fort.attacksTaken = (fort.attacksTaken ?? 0) + 1
  }

  // Remove permanently destroyed forts (exceeded max attacks)
  const survivingForts = newForts.filter(f => f.attacksTaken < FORT_MAX_ATTACKS[f.rarity])

  const nextInterval = BASE_ATTACK_INTERVAL_MS + Math.random() * ATTACK_INTERVAL_JITTER_MS

  const event: AttackEvent = {
    at: state.nextAttackAt,
    power,
    defense,
    outcome,
    stolenGold,
    goldEarned,
    destroyedBuildings,
  }

  const attackMsg =
    outcome === 'repelled' ? `⚔ Attack repelled — +${goldEarned.toLocaleString()} gold earned` :
    outcome === 'partial'  ? `⚠ City raided — ${stolenGold.toLocaleString()} gold stolen` :
    `💀 City defeated — ${stolenGold.toLocaleString()} gold stolen${destroyedBuildings.length > 0 ? `, lost: ${destroyedBuildings.join(', ')}` : ''}`

  const stateWithChronicle = addChronicleEvent(state, attackMsg)

  return {
    ...stateWithChronicle,
    gold:             Math.max(0, newGold),
    resources:        newResources,
    grid:             newGrid,
    fortifications:   survivingForts,
    nextAttackAt:     state.nextAttackAt + nextInterval,
    lastAttack:       event,
    attacksProcessed: (state.attacksProcessed ?? 0) + 1,
  }
}

// ── Offline tick ──────────────────────────────────────────────────────────────

function processDisaster(
  state: CityState,
  now: number,
  minutes: number,
  happinessSnapshot: Record<number, number>,
): CityState {
  let s = state

  if (!s.activeDisaster) {
    // Maybe trigger a new disaster (never during an active attack countdown < 2h)
    const msToAttack = s.nextAttackAt - now
    const safeFromAttack = msToAttack > 2 * 3_600_000 || msToAttack < 0
    if (safeFromAttack && now >= s.nextDisasterAt) {
      const occupiedCells = s.grid.map((c, i) => c ? i : -1).filter(i => i >= 0)
      if (occupiedCells.length > 0) {
        const type: DisasterType = Math.random() < 0.5 ? 'fire' : 'plague'
        const disaster: Disaster = {
          type,
          affectedCells: type === 'fire' ? [occupiedCells[Math.floor(Math.random() * occupiedCells.length)]] : [],
          startedAt:     now,
          severity:      0,
        }
        s = addChronicleEvent(s, type === 'fire'
          ? `🔥 Fire has broken out in the city!`
          : `☠ Plague is spreading through the city!`)
        s = { ...s, activeDisaster: disaster }
      }
    }
    return s
  }

  const { type, affectedCells, startedAt, severity } = s.activeDisaster
  const elapsedMin = (now - startedAt) / 60_000

  if (type === 'fire') {
    // Auto-extinguish after duration limit
    if (elapsedMin >= FIRE_DURATION_MIN) {
      s = addChronicleEvent(s, '🔥 The fire burned out on its own.')
      return { ...s, activeDisaster: null, nextDisasterAt: now + (12 + Math.random() * 24) * 3_600_000 }
    }

    // Industrial zones have abundant dry materials — fire spreads 40% faster there
    let newAffected = [...affectedCells]
    const hasIndustrialCell = newAffected.some(ci => getRowDistrict(s, Math.floor(ci / CITY_COLS)) === 'industrial')
    const spreadInterval    = hasIndustrialCell ? FIRE_SPREAD_INTERVAL_MIN * 0.6 : FIRE_SPREAD_INTERVAL_MIN
    const spreadCount       = Math.floor(elapsedMin / spreadInterval)
    while (newAffected.length < Math.min(spreadCount + 1, FIRE_MAX_CELLS)) {
      // Pick an unaffected neighbour of any burning cell
      const candidates: number[] = []
      for (const ci of newAffected) {
        for (const ni of getNeighbourIndices(ci, s.rows ?? CITY_ROWS)) {
          if (s.grid[ni] && !newAffected.includes(ni)) candidates.push(ni)
        }
      }
      if (candidates.length === 0) break
      const next = candidates[Math.floor(Math.random() * candidates.length)]
      newAffected.push(next)
      s = addChronicleEvent(s, `🔥 Fire spread to ${s.grid[next]?.cardName ?? 'a building'}`)
    }

    // Drain happiness for affected buildings (fire terrifies residents)
    const newHappy = { ...s.happiness }
    for (const ci of newAffected) {
      const current = newHappy[ci] ?? 100
      newHappy[ci] = Math.max(0, current - 3 * minutes)
    }

    s = { ...s, happiness: newHappy, activeDisaster: { type: 'fire', startedAt, affectedCells: newAffected, severity: newAffected.length } }

  } else {
    // Plague
    if (elapsedMin >= PLAGUE_CURE_DURATION_MIN) {
      s = addChronicleEvent(s, '☠ The plague finally subsided on its own.')
      return { ...s, activeDisaster: null, nextDisasterAt: now + (12 + Math.random() * 24) * 3_600_000 }
    }

    // Military zones enforce quarantine discipline — slows plague growth by up to 50%
    let militarySpawners = 0, totalSpawners = 0
    for (let i = 0; i < s.grid.length; i++) {
      if (s.grid[i]?.spawnedUnitName) {
        totalSpawners++
        if (getRowDistrict(s, Math.floor(i / CITY_COLS)) === 'military') militarySpawners++
      }
    }
    const milFraction = totalSpawners > 0 ? militarySpawners / totalSpawners : 0
    const growRate    = PLAGUE_GROW_RATE * (1 - milFraction * 0.5)
    const newSeverity = Math.min(PLAGUE_MAX_SEVERITY, severity + growRate * minutes)

    // Drain happiness across all spawn buildings proportional to severity
    const newHappy = { ...s.happiness }
    for (let i = 0; i < s.grid.length; i++) {
      if (s.grid[i]?.spawnedUnitName) {
        const drain = PLAGUE_DRAIN_PER_MIN * (newSeverity / PLAGUE_MAX_SEVERITY) * minutes
        newHappy[i] = Math.max(0, (newHappy[i] ?? 100) - drain)
      }
    }

    // Sociable residents spread plague panic to adjacent spawn buildings
    for (let i = 0; i < s.grid.length; i++) {
      const cell = s.grid[i]
      if (cell?.spawnedUnitName && getCellTrait(cell, i) === 'sociable') {
        for (const ni of getNeighbourIndices(i, s.rows ?? CITY_ROWS)) {
          if (s.grid[ni]?.spawnedUnitName) {
            const extra = 0.03 * (newSeverity / PLAGUE_MAX_SEVERITY) * minutes
            newHappy[ni] = Math.max(0, (newHappy[ni] ?? 100) - extra)
          }
        }
      }
    }

    // Glutton residents panic-eat extra bread when plague is active
    let gluttonDrain = 0
    for (let i = 0; i < s.grid.length; i++) {
      const cell = s.grid[i]
      if (cell?.spawnedUnitName && getCellTrait(cell, i) === 'glutton') {
        gluttonDrain += 0.05 * (newSeverity / PLAGUE_MAX_SEVERITY) * minutes
      }
    }
    const breadLost = Math.round(gluttonDrain)

    s = {
      ...s,
      resources:      { ...s.resources, bread: Math.max(0, s.resources.bread - breadLost) },
      happiness:      newHappy,
      activeDisaster: { type: 'plague', affectedCells: [], startedAt, severity: newSeverity },
    }
  }

  return s
}

export function tickCity(state: CityState): CityState {
  const now     = Date.now()
  const elapsed = now - state.lastTick
  const minutes = Math.min(elapsed / 60_000, MAX_OFFLINE_MINUTES)

  const season = currentSeason(now)
  const si = SEASON_INFO[season]

  const newResources = { ...state.resources }
  let goldEarned = 0
  const newHappy = { ...state.happiness }

  const defense   = cityDefense(state)
  const population = Math.max(cityPopulation(state), 1)

  // Deferred bread from conversion buildings (applied after loop with wheat-efficiency check)
  let breadConversionPending = 0
  let wheatConversionCost    = 0

  for (let i = 0; i < state.grid.length; i++) {
    const cell = state.grid[i]
    if (!cell) continue

    const happy = (newHappy[i] ?? 100) > 0
    const unitCount = cell.spawnedUnitName ? spawnerUnitCount(state, cell.cardName) : 1

    // District zone bonus for this cell's row
    const cellRow     = Math.floor(i / CITY_COLS)
    const cellDistrict = getRowDistrict(state, cellRow)
    const distInfo    = DISTRICT_INFO[cellDistrict]

    // Gold income (with adjacency bonus for spawn buildings near food, and commercial district)
    const incomeBonus   = cell.spawnedUnitName ? getCellIncomeBonus(state, i) : 0
    const distGoldMult  = 1 + (distInfo.goldMult ?? 0)
    goldEarned += cellIncomeRate(cell, happy, unitCount) * (1 + incomeBonus) * distGoldMult * minutes

    // Resource production (utility/non-spawner buildings that produce resources)
    if (!cell.spawnedUnitName) {
      const masteryMult = masteryOutputMultiplier(getCardMasteryLevel(cell.cardName) ?? 0)
      const produces = getBuildingProduces(cell.cardName)
      const synergies = getCellSynergyBonuses(state, i)
      const synergyMap: Partial<Record<ResourceType, number>> = {}
      for (const s of synergies) synergyMap[s.resource] = (synergyMap[s.resource] ?? 0) + s.multiplier
      const distProdMult = 1 + (distInfo.prodMult ?? 0)
      for (const [res, rate] of Object.entries(produces) as [ResourceType, number][]) {
        if (rate > 0) {
          const synergyMult = 1 + (synergyMap[res as ResourceType] ?? 0)
          // Season modifier: wheat/wood/ore get seasonal multipliers
          const seasonMult = res === 'wheat' ? 1 + si.wheat
                           : res === 'wood'  ? 1 + si.wood
                           : res === 'ore'   ? 1 + si.ore
                           : 1
          const amount = rate * masteryMult * synergyMult * Math.max(0, seasonMult) * distProdMult * minutes
          // Conversion buildings: defer bread production — it depends on wheat availability
          if (BUILDING_CONVERSION_COST[cell.cardName] && res === 'bread') {
            breadConversionPending += amount
            const wheatRate = BUILDING_CONVERSION_COST[cell.cardName].wheat ?? 0
            wheatConversionCost += wheatRate * masteryMult * synergyMult * Math.max(0, seasonMult) * distProdMult * minutes
          } else {
            newResources[res] = (newResources[res] ?? 0) + amount
          }
        }
      }
    }

    // Spawners consume food (wheat) — more in summer/winter
    if (cell.spawnedUnitName && happy) {
      const unitCount = spawnerUnitCount(state, cell.cardName)
      const hungerMult = 1 + si.hunger
      const consume = FOOD_CONSUME_RATE[cell.rarity] * unitCount * hungerMult * minutes
      newResources.wheat = Math.max(0, (newResources.wheat ?? 0) - consume)
    }
  }

  // ── Wheat → bread conversion (Windmill and any future conversion buildings) ──
  if (breadConversionPending > 0) {
    const eff = wheatConversionCost > 0
      ? Math.min(1, (newResources.wheat ?? 0) / wheatConversionCost)
      : 1
    newResources.bread = (newResources.bread ?? 0) + breadConversionPending * eff
    newResources.wheat = Math.max(0, (newResources.wheat ?? 0) - wheatConversionCost * eff)
  }

  // ── Resident resource consumption (bread & wood) ──────────────────────────
  let totalBreadDemand = 0
  let totalWoodDemand  = 0
  for (let i = 0; i < state.grid.length; i++) {
    const cell = state.grid[i]
    if (!cell?.spawnedUnitName || (newHappy[i] ?? 100) <= 0) continue
    const uCount   = spawnerUnitCount(state, cell.cardName)
    totalBreadDemand += BREAD_CONSUME_RATE * uCount * minutes
    const woodMult   = season === 'winter' ? WINTER_WOOD_MULT : 1
    totalWoodDemand  += WOOD_CONSUME_RATE * uCount * woodMult * minutes
  }

  const breadConsumed  = Math.min(newResources.bread ?? 0, totalBreadDemand)
  const woodConsumed   = Math.min(newResources.wood  ?? 0, totalWoodDemand)
  const breadCoverage  = totalBreadDemand > 0 ? breadConsumed / totalBreadDemand : 1
  const woodShort      = totalWoodDemand  > 0 && woodConsumed < totalWoodDemand * 0.5
  newResources.bread   = Math.max(0, (newResources.bread ?? 0) - breadConsumed)
  newResources.wood    = Math.max(0, (newResources.wood  ?? 0) - woodConsumed)

  // ── Base happiness target from food, defence, bread quality, wood supply ──
  const foodScore    = Math.min(100, (newResources.wheat / population) * 5)
  const defenseScore = Math.min(100, (defense / population) * 8)
  const breadScore   = Math.round(breadCoverage * BREAD_HAPPY_BONUS)
  const woodScore    = woodShort ? -WOOD_SHORTAGE_PENALTY : 0
  const baseTarget   = Math.min(100, Math.max(0, Math.round(foodScore * 0.6 + defenseScore * 0.4) + breadScore + woodScore))

  const gridRows = state.rows ?? CITY_ROWS
  for (let i = 0; i < state.grid.length; i++) {
    const cell = state.grid[i]
    if (!cell?.spawnedUnitName) continue

    const wantedNeighbour = cell.affinityWith ?? cell.spawnedUnitName
    const affinityMet = getNeighbourIndices(i, gridRows).some(ni => {
      const nc = state.grid[ni]
      return nc?.spawnedUnitName === wantedNeighbour && (state.happiness[ni] ?? 100) > 0
    })
    const cellTarget  = affinityMet ? baseTarget : 0

    const current = newHappy[i] ?? 100
    const seasonRegen = HAPPINESS_REGEN * (1 + si.regen)
    if (current < cellTarget) {
      newHappy[i] = Math.min(cellTarget, current + seasonRegen * minutes)
    } else if (current > cellTarget) {
      newHappy[i] = Math.max(0, current - HAPPINESS_DRAIN * minutes)
    }
  }

  // Repair fortifications using wood (1 HP every 5 minutes = 0.2 HP/min)
  const newForts = state.fortifications.map(f => ({ ...f }))
  for (const fort of newForts) {
    if (fort.hp < fort.maxHp && newResources.wood > 0) {
      const toRepair = Math.min(fort.maxHp - fort.hp, FORT_REPAIR_RATE * minutes)
      const woodCost = toRepair * FORT_REPAIR_WOOD_PER_HP
      if (newResources.wood >= woodCost) {
        fort.hp = Math.min(fort.maxHp, fort.hp + toRepair)
        newResources.wood = Math.max(0, newResources.wood - woodCost)
      }
    }
  }

  // Process builder queue: move completed forts into fortifications
  const now2 = now
  const remainingQueue = state.builderQueue.filter(e => e.completesAt > now2)
  const completedBuilds = state.builderQueue.filter(e => e.completesAt <= now2)
  const completedFortNames: string[] = []
  for (const entry of completedBuilds) {
    if (newForts.length < MAX_TOTAL_FORTS) {
      newForts.push({
        cardName:     entry.cardName,
        rarity:       entry.rarity,
        hp:           FORT_MAX_HP[entry.rarity],
        maxHp:        FORT_MAX_HP[entry.rarity],
        attacksTaken: 0,
      })
      completedFortNames.push(entry.cardName)
    }
  }

  // Clamp resources to [0, storageCap]
  const storageCaps = calculateStorageCaps(state)
  for (const key of Object.keys(newResources) as ResourceType[]) {
    newResources[key] = Math.max(0, Math.min(newResources[key], storageCaps[key]))
  }

  let result: CityState = {
    ...state,
    gold:           Math.max(0, state.gold + Math.floor(goldEarned)),
    resources:      newResources,
    lastTick:       now,
    happiness:      newHappy,
    fortifications: newForts,
    builderQueue:   remainingQueue,
  }

  for (const name of completedFortNames) {
    result = addChronicleEvent(result, `🏗 ${name} construction complete`)
  }

  // Process trade routes (caravan returns, new offer generation)
  result = processTrade(result, now)

  // Process any pending attacks — batch if more than one was missed while offline
  if (now >= result.nextAttackAt) {
    // Count how many attacks are overdue
    let probe = result.nextAttackAt
    let missedCount = 0
    while (probe <= now) {
      missedCount++
      probe += BASE_ATTACK_INTERVAL_MS  // rough estimate for counting
      if (missedCount > 50) break       // safety cap
    }

    if (missedCount <= 1) {
      // Single attack — show it normally
      result = processAttack(result)
    } else {
      // Multiple missed attacks — batch them and show a summary
      let totalStolenGold = 0
      let totalGoldEarned = 0
      const allDestroyed: string[] = []
      let worstOutcome: AttackEvent['outcome'] = 'repelled'
      let lastPower = 0
      let lastDefense = 0

      for (let i = 0; i < missedCount; i++) {
        if (result.nextAttackAt > now) break
        result = processAttack(result)
        const ev = result.lastAttack!
        totalStolenGold += ev.stolenGold
        totalGoldEarned += ev.goldEarned
        allDestroyed.push(...ev.destroyedBuildings)
        if (ev.outcome === 'defeated' || (ev.outcome === 'partial' && worstOutcome === 'repelled')) {
          worstOutcome = ev.outcome
        }
        lastPower   = ev.power
        lastDefense = ev.defense
      }

      // Replace lastAttack with a summary event
      result = {
        ...result,
        lastAttack: {
          at:                 now,
          power:              lastPower,
          defense:            lastDefense,
          outcome:            worstOutcome,
          stolenGold:         totalStolenGold,
          goldEarned:         totalGoldEarned,
          destroyedBuildings: allDestroyed,
          count:              missedCount,
        },
      }
    }
  }

  // ── Disaster processing ────────────────────────────────────────────────────
  result = processDisaster(result, now, minutes, newHappy)

  const { state: resultWithMilestones } = checkMilestones(result)

  // Append a history sample at most once per HISTORY_INTERVAL_MS
  const hist = resultWithMilestones.history ?? []
  const lastSampleAt = hist.length > 0 ? hist[hist.length - 1].t : 0
  if (now - lastSampleAt >= HISTORY_INTERVAL_MS) {
    const attacked = resultWithMilestones.lastAttack != null &&
      resultWithMilestones.lastAttack.at > (state.lastTick ?? 0)
    const sample: HistorySample = {
      t:       now,
      gold:    resultWithMilestones.gold,
      pop:     cityPopulation(resultWithMilestones),
      def:     cityDefense(resultWithMilestones),
      wheat:   Math.floor(resultWithMilestones.resources.wheat),
      wood:    Math.floor(resultWithMilestones.resources.wood),
      ore:     Math.floor(resultWithMilestones.resources.ore),
      bread:   Math.floor(resultWithMilestones.resources.bread),
      planks:  Math.floor(resultWithMilestones.resources.planks),
      metal:   Math.floor(resultWithMilestones.resources.metal),
      attacked,
    }
    const history = [...hist, sample].slice(-HISTORY_MAX)
    return { ...resultWithMilestones, history }
  }
  return resultWithMilestones
}

// ── Grid helpers ──────────────────────────────────────────────────────────────

export function placeCard(state: CityState, index: number, cell: CityCell): CityState {
  const grid = [...state.grid]
  grid[index] = cell
  const happiness = { ...state.happiness }
  if (cell.spawnedUnitName) happiness[index] = 100

  // Deduct placement cost for spawners
  let resources = { ...state.resources }
  if (cell.spawnedUnitName) {
    const cost = SPAWNER_PLACE_COST[cell.rarity]
    for (const [res, amount] of Object.entries(cost) as [ResourceType, number][]) {
      resources[res] = Math.max(0, (resources[res] ?? 0) - amount)
    }
  }

  const placed = addChronicleEvent({ ...state, grid, happiness, resources }, `🏛 ${cell.cardName} placed`)
  return checkMilestones(placed).state
}

/** Invite a vacant unit back into their building, restoring partial happiness. */
export function reoccupyBuilding(state: CityState, index: number): CityState {
  const cell = state.grid[index]
  if (!cell?.spawnedUnitName) return state
  if ((state.happiness[index] ?? 100) > 0) return state
  const next = { ...state, happiness: { ...state.happiness, [index]: 50 } }
  return addChronicleEvent(next, `🏠 ${cell.spawnedUnitName} moved back into ${cell.cardName}`)
}

export function removeCard(state: CityState, index: number): CityState {
  const cell = state.grid[index]
  const grid = [...state.grid]
  grid[index] = undefined
  const happiness = { ...state.happiness }
  delete happiness[index]
  const next = { ...state, grid, happiness }
  return cell ? addChronicleEvent(next, `🔨 ${cell.cardName} demolished`) : next
}

// ── Fortification helpers ─────────────────────────────────────────────────────

export function canAffordFortification(state: CityState, rarity: CardRarity): boolean {
  const cost = FORT_PLACE_COST[rarity]
  if (state.gold < cost.gold) return false
  for (const res of Object.keys(state.resources) as ResourceType[]) {
    if ((cost[res] ?? 0) > 0 && state.resources[res] < (cost[res] as number)) return false
  }
  return true
}

/** Returns true if a builder slot is free (queue not full). */
export function canQueueFortification(state: CityState): boolean {
  return state.builderQueue.length < (state.builderCount ?? DEFAULT_BUILDER_COUNT) &&
    (state.fortifications.length + state.builderQueue.length) < MAX_TOTAL_FORTS
}

export function addFortification(state: CityState, cardName: string, rarity: CardRarity): CityState | null {
  if (!canQueueFortification(state)) return null
  if (!canAffordFortification(state, rarity)) return null
  const cost = FORT_PLACE_COST[rarity]
  const newResources = { ...state.resources }
  for (const res of Object.keys(newResources) as ResourceType[]) {
    newResources[res] = Math.max(0, newResources[res] - ((cost[res] as number) ?? 0))
  }
  const buildMinutes = FORT_BUILD_MINUTES[rarity]
  const completesAt = Date.now() + buildMinutes * 60_000
  const entry: BuildQueueEntry = { cardName, rarity, completesAt }
  const next = {
    ...state,
    gold:         state.gold - cost.gold,
    resources:    newResources,
    builderQueue: [...state.builderQueue, entry],
  }
  return addChronicleEvent(next, `🧱 ${cardName} fortification queued`)
}

/** Cost to hire the next extra builder (beyond DEFAULT_BUILDER_COUNT). */
export function nextBuilderCost(state: CityState): number | null {
  const extras = (state.builderCount ?? DEFAULT_BUILDER_COUNT) - DEFAULT_BUILDER_COUNT
  if (extras >= BUILDER_HIRE_COSTS.length) return null
  if ((state.builderCount ?? DEFAULT_BUILDER_COUNT) >= MAX_BUILDER_COUNT) return null
  return BUILDER_HIRE_COSTS[extras]
}

export function buyBuilder(state: CityState): CityState | null {
  const cost = nextBuilderCost(state)
  if (cost === null || state.gold < cost) return null
  return {
    ...state,
    gold:         state.gold - cost,
    builderCount: (state.builderCount ?? DEFAULT_BUILDER_COUNT) + 1,
  }
}

export function removeFortification(state: CityState, index: number): CityState {
  const fortifications = state.fortifications.filter((_, i) => i !== index)
  return { ...state, fortifications }
}

// ── City expansion ────────────────────────────────────────────────────────────

export function canAffordExpansion(state: CityState): boolean {
  const rows = state.rows ?? CITY_ROWS
  const cost = EXPANSION_COSTS[rows]
  if (!cost) return false
  if (rows >= MAX_CITY_ROWS) return false
  if (state.gold < cost.gold) return false
  for (const [res, amt] of Object.entries(cost.resources) as [ResourceType, number][]) {
    if ((state.resources[res] ?? 0) < amt) return false
  }
  return true
}

export function expandCity(state: CityState): CityState | null {
  const rows = state.rows ?? CITY_ROWS
  if (rows >= MAX_CITY_ROWS) return null
  const cost = EXPANSION_COSTS[rows]
  if (!cost) return null
  if (!canAffordExpansion(state)) return null

  const newRows = rows + 1
  const newCells = CITY_COLS * newRows
  const newGrid = [...state.grid, ...Array(newCells - state.grid.length).fill(undefined)]
  const newResources = { ...state.resources, gold: state.gold }
  for (const [res, amt] of Object.entries(cost.resources) as [ResourceType, number][]) {
    newResources[res] = Math.max(0, (state.resources[res] ?? 0) - amt)
  }

  const next = {
    ...state,
    rows:      newRows,
    grid:      newGrid,
    gold:      state.gold - cost.gold,
    resources: newResources,
  }
  return addChronicleEvent(next, `🏙 City expanded to ${newRows} rows`)
}

// ── Affordability ─────────────────────────────────────────────────────────────

export function canAffordPlacement(state: CityState, rarity: CardRarity): boolean {
  const cost = SPAWNER_PLACE_COST[rarity]
  for (const [res, amount] of Object.entries(cost) as [ResourceType, number][]) {
    if ((state.resources[res] ?? 0) < amount) return false
  }
  return true
}

// ── Core buildings ────────────────────────────────────────────────────────────

/** A building that is always available to place (no card required), purchased with gold. */
export interface CoreBuilding {
  name:     string
  goldCost: number
  hint:     string
  rarity:   CardRarity
}

export const CORE_BUILDINGS: CoreBuilding[] = [
  { name: 'Windmill',   goldCost:  500, rarity: 'common',   hint: 'Grinds wheat into bread (2/min). Needs 2 wheat/min — output ×1.5 next to a Farm.' },
  { name: 'Bakery',     goldCost:  750, rarity: 'uncommon', hint: 'Bakes bread directly (1.5/min). No wheat cost — pure gold investment.' },
  { name: 'Granary',    goldCost:  600, rarity: 'common',   hint: 'Extends all resource storage caps by 200.' },
  { name: 'Watchtower', goldCost:  800, rarity: 'common',   hint: 'Garrisoned lookout. Contributes to city defense.' },
  { name: 'Quarry',     goldCost:  700, rarity: 'common',   hint: 'Mines raw ore and cuts stone into planks.' },
]

export function canAffordCoreBuild(state: CityState, building: CoreBuilding): boolean {
  return state.gold >= building.goldCost
}

export function placeCoreBuild(state: CityState, index: number, building: CoreBuilding): CityState {
  if (!canAffordCoreBuild(state, building)) return state
  const cell: CityCell = { cardName: building.name, rarity: building.rarity }
  return placeCard({ ...state, gold: state.gold - building.goldCost }, index, cell)
}

// ── Rate helpers ──────────────────────────────────────────────────────────────

export function goldIncomeRate(state: CityState): number {
  let total = 0
  for (let i = 0; i < state.grid.length; i++) {
    const cell = state.grid[i]
    if (!cell) continue
    const happy = (state.happiness[i] ?? 100) > 0
    const unitCount = cell.spawnedUnitName ? spawnerUnitCount(state, cell.cardName) : 1
    total += cellIncomeRate(cell, happy, unitCount)
  }
  return total
}

export function goldNetRate(state: CityState): number {
  return goldIncomeRate(state)
}

// ── Trade routes ──────────────────────────────────────────────────────────────

/** New offer every 4 hours; caravan returns after 2 hours. */
const TRADE_OFFER_INTERVAL_MS = 4 * 3600 * 1000
const CARAVAN_RETURN_MS       = 2 * 3600 * 1000

function generateTradeOffer(now: number): TradeOffer {
  const resources: ResourceType[] = ['wheat', 'wood', 'ore', 'bread', 'planks', 'metal']
  const resource  = resources[Math.floor(Math.random() * resources.length)]
  const direction: TradeDirection = Math.random() < 0.6 ? 'sell' : 'buy'
  // Base amounts and gold values per resource
  const BASE: Record<ResourceType, { amount: number; goldPerUnit: number }> = {
    wheat:  { amount: 100, goldPerUnit: 20  },
    wood:   { amount: 80,  goldPerUnit: 25  },
    ore:    { amount: 60,  goldPerUnit: 35  },
    bread:  { amount: 50,  goldPerUnit: 50  },
    planks: { amount: 40,  goldPerUnit: 60  },
    metal:  { amount: 30,  goldPerUnit: 80  },
  }
  const { amount, goldPerUnit } = BASE[resource]
  const jitter = 0.8 + Math.random() * 0.4  // ±20% variance
  const finalAmount = Math.round(amount * jitter)
  const finalGold   = Math.round(finalAmount * goldPerUnit * (direction === 'sell' ? 1 : 0.7))
  return {
    resource,
    direction,
    amount:    finalAmount,
    gold:      finalGold,
    expiresAt: now + TRADE_OFFER_INTERVAL_MS,
  }
}

export function dispatchCaravan(state: CityState): CityState | null {
  const offer = state.tradeOffer
  if (!offer || state.activeCaravan) return null
  if (Date.now() > offer.expiresAt) return null

  let newGold      = state.gold
  const newRes     = { ...state.resources }

  if (offer.direction === 'sell') {
    if (newRes[offer.resource] < offer.amount) return null
    newRes[offer.resource] = Math.max(0, newRes[offer.resource] - offer.amount)
  } else {
    if (newGold < offer.gold) return null
    newGold -= offer.gold
  }

  const caravan: ActiveCaravan = { offer, returnsAt: Date.now() + CARAVAN_RETURN_MS }
  const next: CityState = {
    ...state,
    gold:          newGold,
    resources:     newRes,
    tradeOffer:    null,
    activeCaravan: caravan,
  }
  return addChronicleEvent(next, `🐪 Caravan dispatched — trading ${offer.amount} ${offer.resource}`)
}

/** Processes caravan return and new offer generation inside tickCity. */
function processTrade(state: CityState, now: number): CityState {
  let next = state

  // Resolve returning caravan
  if (next.activeCaravan && now >= next.activeCaravan.returnsAt) {
    const { offer } = next.activeCaravan
    const newRes = { ...next.resources }
    let newGold  = next.gold
    if (offer.direction === 'sell') {
      newGold += offer.gold
    } else {
      newRes[offer.resource] = (newRes[offer.resource] ?? 0) + offer.amount
    }
    const msg = offer.direction === 'sell'
      ? `🐪 Caravan returned — +${offer.gold.toLocaleString()} gold from selling ${offer.amount} ${offer.resource}`
      : `🐪 Caravan returned — +${offer.amount} ${offer.resource} delivered`
    next = addChronicleEvent({ ...next, gold: newGold, resources: newRes, activeCaravan: null }, msg)
  }

  // Generate new offer if none present and not waiting on a caravan
  if (!next.tradeOffer && !next.activeCaravan) {
    next = { ...next, tradeOffer: generateTradeOffer(now) }
  }

  // Expire stale offer
  if (next.tradeOffer && now > next.tradeOffer.expiresAt) {
    next = { ...next, tradeOffer: generateTradeOffer(now) }
  }

  return next
}

// ── Card levelling ────────────────────────────────────────────────────────────

export function getCardLevel(state: CityState, cardName: string): number {
  return getCardMasteryLevel(cardName) ?? 0
}

export function levelUpCost(currentLevel: number): number {
  return LEVEL_UP_COSTS[Math.min(currentLevel, LEVEL_UP_COSTS.length - 1)]
}

export function levelUpCard(state: CityState, cardName: string, masteryLvl: number): CityState | null {
  const current = getCardLevel(state, cardName)
  const cost    = levelUpCost(masteryLvl)
  if (state.gold < cost) return null
  return {
    ...state,
    gold:       state.gold - cost,
  }
}

// ── Resource helpers ──────────────────────────────────────────────────────────

export function resourceProductionRate(state: CityState): Partial<ResourceStock> {
  const rates: Partial<ResourceStock> = {}
  const si = SEASON_INFO[currentSeason()]
  for (let i = 0; i < state.grid.length; i++) {
    const cell = state.grid[i]
    if (!cell || cell.spawnedUnitName) continue
    const masteryMult = masteryOutputMultiplier(getCardMasteryLevel(cell.cardName) ?? 0)
    const produces = getBuildingProduces(cell.cardName)
    const synergies = getCellSynergyBonuses(state, i)
    const synergyMap: Partial<Record<ResourceType, number>> = {}
    for (const s of synergies) synergyMap[s.resource] = (synergyMap[s.resource] ?? 0) + s.multiplier
    for (const [res, rate] of Object.entries(produces) as [ResourceType, number][]) {
      const synergyMult = 1 + (synergyMap[res as ResourceType] ?? 0)
      const seasonMult = res === 'wheat' ? 1 + si.wheat
                       : res === 'wood'  ? 1 + si.wood
                       : res === 'ore'   ? 1 + si.ore
                       : 1
      rates[res] = (rates[res] ?? 0) + rate * masteryMult * synergyMult * Math.max(0, seasonMult)
    }
  }
  return rates
}

export function resourceConsumptionRate(state: CityState): Partial<ResourceStock> {
  const season = currentSeason()
  const si     = SEASON_INFO[season]
  const rates: Partial<ResourceStock> = {}

  for (let i = 0; i < state.grid.length; i++) {
    const cell = state.grid[i]
    if (!cell) continue
    const happy = (state.happiness[i] ?? 100) > 0

    if (cell.spawnedUnitName && happy) {
      const unitCount  = spawnerUnitCount(state, cell.cardName)
      const hungerMult = 1 + si.hunger
      // Wheat (base food)
      rates.wheat = (rates.wheat ?? 0) + FOOD_CONSUME_RATE[cell.rarity] * unitCount * hungerMult
      // Bread (quality food)
      rates.bread = (rates.bread ?? 0) + BREAD_CONSUME_RATE * unitCount
      // Wood (heating/maintenance — higher in winter)
      const woodMult = season === 'winter' ? WINTER_WOOD_MULT : 1
      rates.wood  = (rates.wood  ?? 0) + WOOD_CONSUME_RATE * unitCount * woodMult
    }

    // Conversion building wheat input (per-minute rate from BUILDING_CONVERSION_COST)
    if (!cell.spawnedUnitName && BUILDING_CONVERSION_COST[cell.cardName]) {
      const wheatRate = BUILDING_CONVERSION_COST[cell.cardName].wheat ?? 0
      rates.wheat = (rates.wheat ?? 0) + wheatRate
    }
  }

  return rates
}
