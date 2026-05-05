// ─── City Builder ─────────────────────────────────────────────────────────────
// Persistent idle city: place owned structures on a grid. Spawn buildings show
// their unit walking around the city view. Resources are produced and consumed
// each tick. Happiness is driven by food availability and city defence.

import { logError } from '../logger'
import { CardRarity } from './types'

// ── Constants ─────────────────────────────────────────────────────────────────

export const CITY_COLS  = 6
export const CITY_ROWS  = 4
export const CITY_CELLS = CITY_COLS * CITY_ROWS

/** Each grid cell is this many pixels wide/tall in the overlay. */
export const CELL_PX = 72

/** Max minutes of offline accumulation counted (8 hours). */
const MAX_OFFLINE_MINUTES = 480

/** Income per minute for spawn buildings. */
export const INCOME_SPAWN: Record<CardRarity, number> = { common: 2, uncommon: 4, rare: 6, epic: 8, legendary: 10 }
/** Income per minute for utility buildings. */
export const INCOME_UTILITY: Record<CardRarity, number> = { common: 1, uncommon: 3, rare: 5, epic: 7, legendary: 8 }
/** Income per minute for wall / no-effect structures. */
export const INCOME_WALL: Record<CardRarity, number> = { common: 0, uncommon: 1, rare: 1, epic: 2, legendary: 2 }

/** Happiness regeneration per minute toward the target value. */
const HAPPINESS_REGEN = 15
/** Happiness drain per minute away from target when conditions not met (~50 min to fully despawn). */
const HAPPINESS_DRAIN = 2

/** Level-up costs: index = target level (1-based). Beyond the table, the last entry repeats. */
export const LEVEL_UP_COSTS = [50000, 100000, 250000, 500000, 1000000]

// ── Resource constants ────────────────────────────────────────────────────────

/** Defence value contributed by walls (per rarity). */
const WALL_DEFENSE: Record<CardRarity, number> = { common: 5, uncommon: 10, rare: 20, epic: 30, legendary: 40 }
/** Defence value contributed by spawn buildings (per rarity). */
const SPAWN_DEFENSE: Record<CardRarity, number> = { common: 3, uncommon: 6, rare: 12, epic: 18, legendary: 25 }

/** Wheat consumed per minute by a spawn building (units need feeding). */
const FOOD_CONSUME_RATE: Record<CardRarity, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 }

/** Resource cost to place a spawner of a given rarity. */
export const SPAWNER_PLACE_COST: Record<CardRarity, Partial<ResourceStock>> = {
  common:    { wheat: 20 },
  uncommon:  { wheat: 30, wood: 10 },
  rare:      { wheat: 50, wood: 20, ore: 10 },
  epic:      { wheat: 65, wood: 30, ore: 15 },
  legendary: { wheat: 80, wood: 40, ore: 20 },
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

export interface CityState {
  grid:       (CityCell | undefined)[]
  gold:       number
  resources:  ResourceStock
  lastTick:   number
  cardLevels: Record<string, number>
  /** cellIndex → happiness 0–100 (only meaningful for spawn buildings). */
  happiness:  Record<number, number>
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'jarv_city_builder'

function emptyResources(): ResourceStock {
  return { wheat: 0, wood: 0, ore: 0, bread: 0, planks: 0, metal: 0 }
}

function defaultState(): CityState {
  return {
    grid:       Array(CITY_CELLS).fill(undefined),
    gold:       500,
    resources:  { wheat: 300, wood: 300, ore: 150, bread: 0, planks: 0, metal: 0 },
    lastTick:   Date.now(),
    cardLevels: {},
    happiness:  {},
  }
}

export function loadCityState(): CityState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as Partial<CityState>
    const savedResources = (parsed.resources ?? {}) as Partial<ResourceStock>
    return {
      grid:       parsed.grid       ?? Array(CITY_CELLS).fill(undefined),
      gold:       parsed.gold       ?? 0,
      resources:  {
        wheat:  savedResources.wheat  ?? 0,
        wood:   savedResources.wood   ?? 0,
        ore:    savedResources.ore    ?? 0,
        bread:  savedResources.bread  ?? 0,
        planks: savedResources.planks ?? 0,
        metal:  savedResources.metal  ?? 0,
      },
      lastTick:   parsed.lastTick   ?? Date.now(),
      cardLevels: parsed.cardLevels ?? {},
      happiness:  parsed.happiness  ?? {},
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
  return (state.cardLevels[cardName] ?? 0) + 1
}

// ── Structure classification ──────────────────────────────────────────────────

export function getStructureKind(cell: CityCell): StructureKind {
  if (cell.spawnedUnitName) return 'spawn'
  return 'utility'
}

/** Returns grid indices of the 4 orthogonally adjacent cells (no diagonals, no wrap). */
export function getNeighbourIndices(index: number): number[] {
  const row = Math.floor(index / CITY_COLS)
  const col = index % CITY_COLS
  const result: number[] = []
  if (col > 0)             result.push(index - 1)
  if (col < CITY_COLS - 1) result.push(index + 1)
  if (row > 0)             result.push(index - CITY_COLS)
  if (row < CITY_ROWS - 1) result.push(index + CITY_COLS)
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
    } else if (!cell.spawnedUnitName && WALL_DEFENSE[cell.rarity] !== undefined) {
      // Determine if it's actually a wall by checking income table (walls earn 0 base)
      const incomeIfWall = INCOME_WALL[cell.rarity]
      const incomeIfUtil = INCOME_UTILITY[cell.rarity]
      // A cell is wall-like if its income would be 0 for common rarity and hasn't a spawn
      // We detect walls by checking if the cell has no produced resource and no spawner
      const produces = getBuildingProduces(cell.cardName)
      const isResourceProducer = Object.values(produces).some(v => (v ?? 0) > 0)
      if (!isResourceProducer && incomeIfWall < incomeIfUtil) {
        total += wallDefense(cell, hasSpawners)
      }
    }
  }
  return total
}

export function cityPopulation(state: CityState): number {
  let count = 0
  for (let i = 0; i < state.grid.length; i++) {
    const cell = state.grid[i]
    if (cell?.spawnedUnitName && (state.happiness[i] ?? 100) > 0) count++
  }
  return count
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
      const masteryMult = masteryOutputMultiplier(state.cardLevels[cell.cardName] ?? 0)
      const produces = getBuildingProduces(cell.cardName)
      for (const [res, rate] of Object.entries(produces) as [ResourceType, number][]) {
        if (rate > 0) newResources[res] = (newResources[res] ?? 0) + rate * masteryMult * minutes
      }
    }

    // Spawners consume food (wheat) — more units at higher mastery means more consumption
    if (cell.spawnedUnitName && happy) {
      const unitCount = spawnerUnitCount(state, cell.cardName)
      const consume = FOOD_CONSUME_RATE[cell.rarity] * unitCount * minutes
      newResources.wheat = Math.max(0, (newResources.wheat ?? 0) - consume)
    }
  }

  // Base happiness target from food and defence (applies to all spawners)
  const foodScore    = Math.min(100, (newResources.wheat / population) * 5)
  const defenseScore = Math.min(100, (defense / population) * 8)
  const baseTarget   = Math.round(foodScore * 0.6 + defenseScore * 0.4)

  for (let i = 0; i < state.grid.length; i++) {
    const cell = state.grid[i]
    if (!cell?.spawnedUnitName) continue

    // Wants affinity unit next door; falls back to same unit type if no affinity defined
    const wantedNeighbour = cell.affinityWith ?? cell.spawnedUnitName
    const affinityMet = getNeighbourIndices(i).some(ni => {
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

  // Clamp resources
  for (const key of Object.keys(newResources) as ResourceType[]) {
    newResources[key] = Math.max(0, newResources[key])
  }

  return {
    ...state,
    gold:      Math.max(0, state.gold + Math.floor(goldEarned)),
    resources: newResources,
    lastTick:  now,
    happiness: newHappy,
  }
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
  return state.cardLevels[cardName] ?? 0
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
    cardLevels: { ...state.cardLevels, [cardName]: current + 1 },
  }
}

// ── Resource helpers ──────────────────────────────────────────────────────────

export function resourceProductionRate(state: CityState): Partial<ResourceStock> {
  const rates: Partial<ResourceStock> = {}
  for (const cell of state.grid) {
    if (!cell || cell.spawnedUnitName) continue
    const masteryMult = masteryOutputMultiplier(state.cardLevels[cell.cardName] ?? 0)
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
