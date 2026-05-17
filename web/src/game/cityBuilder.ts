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
/** Happiness drain per minute away from target when conditions not met (~50 min to fully despawn). */
const HAPPINESS_DRAIN = 2

/** Level-up costs: index = target level (1-based). Beyond the table, the last entry repeats. */
export const LEVEL_UP_COSTS = [50000, 100000, 250000, 500000, 1000000]

// ── Resource constants ────────────────────────────────────────────────────────

/** Defence value contributed by walls (per rarity). */
const WALL_DEFENSE: Record<CardRarity, number> = { common: 5, uncommon: 10, rare: 20, epic: 30, legendary: 40, mythic: 60, shiny: 40, holofoil: 40, glass: 40 }
/** Defence value contributed by spawn buildings (per rarity) — intentionally small; fortifications carry the load. */
const SPAWN_DEFENSE: Record<CardRarity, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6, shiny: 5, holofoil: 5, glass: 5 }

/** Wheat consumed per minute by a spawn building (units need feeding). */
const FOOD_CONSUME_RATE: Record<CardRarity, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6, shiny: 5, holofoil: 5, glass: 5 }

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

// ── Resource building config ──────────────────────────────────────────────────

/**
 * Map of building name → resource production per minute.
 * Buildings not listed here fall back to keyword matching in getBuildingResourceConfig.
 */
const BUILDING_RESOURCE_CONFIG: Record<string, Partial<ResourceStock>> = {
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
    lastAttack:     null,
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
  for (const cell of state.grid) {
    if (!cell) continue
    if (cell.spawnedUnitName) {
      total += SPAWN_DEFENSE[cell.rarity]
    } else {
      const produces = getBuildingProduces(cell.cardName)
      const isResourceProducer = Object.values(produces).some(v => (v ?? 0) > 0)
      if (!isResourceProducer) {
        total += wallDefense(cell, hasSpawners)
      }
    }
  }

  // Add fortification defense (scales with current HP)
  for (const fort of state.fortifications ?? []) {
    const hpFraction = fort.maxHp > 0 ? fort.hp / fort.maxHp : 0
    total += Math.round(FORT_DEFENSE[fort.rarity] * hpFraction)
  }

  return total + (state.patrolBonus ?? 0)
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

  return {
    ...state,
    gold:           Math.max(0, newGold),
    resources:      newResources,
    grid:           newGrid,
    fortifications: survivingForts,
    nextAttackAt:   state.nextAttackAt + nextInterval,
    lastAttack:     event,
  }
}

// ── Offline tick ──────────────────────────────────────────────────────────────

export function tickCity(state: CityState): CityState {
  const now     = Date.now()
  const elapsed = now - state.lastTick
  const minutes = Math.min(elapsed / 60_000, MAX_OFFLINE_MINUTES)

  const newResources = { ...state.resources }
  let goldEarned = 0
  const newHappy = { ...state.happiness }

  const defense   = cityDefense(state)
  const population = Math.max(cityPopulation(state), 1)

  for (let i = 0; i < state.grid.length; i++) {
    const cell = state.grid[i]
    if (!cell) continue

    const happy = (newHappy[i] ?? 100) > 0
    const unitCount = cell.spawnedUnitName ? spawnerUnitCount(state, cell.cardName) : 1

    // Gold income
    goldEarned += cellIncomeRate(cell, happy, unitCount) * minutes

    // Resource production (utility/non-spawner buildings that produce resources)
    if (!cell.spawnedUnitName) {
      const masteryMult = masteryOutputMultiplier(getCardMasteryLevel(cell.cardName) ?? 0)
      const produces = getBuildingProduces(cell.cardName)
      for (const [res, rate] of Object.entries(produces) as [ResourceType, number][]) {
        if (rate > 0) newResources[res] = (newResources[res] ?? 0) + rate * masteryMult * minutes
      }
    }

    // Spawners consume food (wheat)
    if (cell.spawnedUnitName && happy) {
      const unitCount = spawnerUnitCount(state, cell.cardName)
      const consume = FOOD_CONSUME_RATE[cell.rarity] * unitCount * minutes
      newResources.wheat = Math.max(0, (newResources.wheat ?? 0) - consume)
    }
  }

  // Base happiness target from food and defence
  const foodScore    = Math.min(100, (newResources.wheat / population) * 5)
  const defenseScore = Math.min(100, (defense / population) * 8)
  const baseTarget   = Math.round(foodScore * 0.6 + defenseScore * 0.4)

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
    if (current < cellTarget) {
      newHappy[i] = Math.min(cellTarget, current + HAPPINESS_REGEN * minutes)
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
  for (const entry of completedBuilds) {
    if (newForts.length < MAX_TOTAL_FORTS) {
      newForts.push({
        cardName:     entry.cardName,
        rarity:       entry.rarity,
        hp:           FORT_MAX_HP[entry.rarity],
        maxHp:        FORT_MAX_HP[entry.rarity],
        attacksTaken: 0,
      })
    }
  }

  // Clamp resources
  for (const key of Object.keys(newResources) as ResourceType[]) {
    newResources[key] = Math.max(0, newResources[key])
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

  return result
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

  return { ...state, grid, happiness, resources }
}

export function removeCard(state: CityState, index: number): CityState {
  const grid = [...state.grid]
  grid[index] = undefined
  const happiness = { ...state.happiness }
  delete happiness[index]
  return { ...state, grid, happiness }
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
  return {
    ...state,
    gold:         state.gold - cost.gold,
    resources:    newResources,
    builderQueue: [...state.builderQueue, entry],
  }
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

  return {
    ...state,
    rows:      newRows,
    grid:      newGrid,
    gold:      state.gold - cost.gold,
    resources: newResources,
  }
}

// ── Affordability ─────────────────────────────────────────────────────────────

export function canAffordPlacement(state: CityState, rarity: CardRarity): boolean {
  const cost = SPAWNER_PLACE_COST[rarity]
  for (const [res, amount] of Object.entries(cost) as [ResourceType, number][]) {
    if ((state.resources[res] ?? 0) < amount) return false
  }
  return true
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
  for (const cell of state.grid) {
    if (!cell || cell.spawnedUnitName) continue
    const masteryMult = masteryOutputMultiplier(getCardMasteryLevel(cell.cardName) ?? 0)
    const produces = getBuildingProduces(cell.cardName)
    for (const [res, rate] of Object.entries(produces) as [ResourceType, number][]) {
      rates[res] = (rates[res] ?? 0) + rate * masteryMult
    }
  }
  return rates
}

export function resourceConsumptionRate(state: CityState): Partial<ResourceStock> {
  const rates: Partial<ResourceStock> = {}
  for (let i = 0; i < state.grid.length; i++) {
    const cell = state.grid[i]
    if (!cell?.spawnedUnitName) continue
    const happy = (state.happiness[i] ?? 100) > 0
    if (!happy) continue
    const unitCount = spawnerUnitCount(state, cell.cardName)
    rates.wheat = (rates.wheat ?? 0) + FOOD_CONSUME_RATE[cell.rarity] * unitCount
  }
  return rates
}
