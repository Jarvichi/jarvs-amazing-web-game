// ─── City Builder ─────────────────────────────────────────────────────────────
// Persistent idle city: place owned structures on a grid. Spawn buildings show
// their unit walking around the city view. Units need wages (gold); if unaffordable
// their happiness drops and their building earns at half rate.

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

/** Income per minute for spawn buildings (offset by wage). */
const INCOME_SPAWN: Record<CardRarity, number> = { common: 2, uncommon: 4, rare: 6, legendary: 10 }
/** Income per minute for utility buildings (mana / heal / attack auras / etc.). */
const INCOME_UTILITY: Record<CardRarity, number> = { common: 1, uncommon: 3, rare: 5, legendary: 8 }
/** Income per minute for wall / no-effect structures. */
const INCOME_WALL: Record<CardRarity, number> = { common: 0, uncommon: 1, rare: 1, legendary: 2 }
/** Wage drained per minute per spawned unit. */
const WAGE_SPAWN: Record<CardRarity, number> = { common: 1, uncommon: 2, rare: 3, legendary: 5 }

/** Happiness regeneration per minute when wages are affordable. */
const HAPPINESS_REGEN = 15
/** Happiness drain per minute when wages cannot be paid. */
const HAPPINESS_DRAIN = 20

/** Level-up costs: index = target level (1-based). cost[0] = cost to reach lvl 1, etc. */
export const LEVEL_UP_COSTS = [50000, 100000, 250000, 500000, 100000]
export const MAX_CARD_LEVEL  = LEVEL_UP_COSTS.length

export const LEVEL_ATK_BONUS    = 1
export const LEVEL_MAX_HP_BONUS = 2

// ── Types ─────────────────────────────────────────────────────────────────────

export type StructureKind = 'spawn' | 'utility' | 'wall'

export interface CityCell {
  cardName:          string
  rarity:            CardRarity
  /** Name of the unit that this building spawns (from structureEffect.spawn), if any. */
  spawnedUnitName?:  string
}

export interface CityState {
  grid:       (CityCell | undefined)[]
  gold:       number
  lastTick:   number
  cardLevels: Record<string, number>
  /** cellIndex → happiness 0–100 (only meaningful for spawn buildings). */
  happiness:  Record<number, number>
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'jarv_city_builder'

function defaultState(): CityState {
  return {
    grid:       Array(CITY_CELLS).fill(undefined),
    gold:       0,
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
    return {
      grid:       parsed.grid       ?? Array(CITY_CELLS).fill(undefined),
      gold:       parsed.gold       ?? 0,
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

// ── Structure classification ──────────────────────────────────────────────────

export function getStructureKind(cell: CityCell): StructureKind {
  if (cell.spawnedUnitName) return 'spawn'
  return 'utility'
}

function cellIncomeRate(cell: CityCell, happy: boolean): number {
  const kind = getStructureKind(cell)
  const base = kind === 'spawn'
    ? INCOME_SPAWN[cell.rarity]
    : kind === 'wall'
    ? INCOME_WALL[cell.rarity]
    : INCOME_UTILITY[cell.rarity]
  if (kind === 'spawn' && !happy) return base * 0.5
  return base
}

// ── Offline tick ──────────────────────────────────────────────────────────────

export function tickCity(state: CityState): CityState {
  const now     = Date.now()
  const elapsed = now - state.lastTick
  const minutes = Math.min(elapsed / 60_000, MAX_OFFLINE_MINUTES)

  let goldEarned  = 0
  let wagesOwed   = 0
  const newHappy  = { ...state.happiness }

  // Calculate totals
  for (let i = 0; i < state.grid.length; i++) {
    const cell = state.grid[i]
    if (!cell) continue
    const happy = (newHappy[i] ?? 100) > 0
    goldEarned += cellIncomeRate(cell, happy) * minutes
    if (cell.spawnedUnitName && happy) {
      wagesOwed += WAGE_SPAWN[cell.rarity] * minutes
    }
  }

  const canPayWages = state.gold + Math.floor(goldEarned) >= Math.floor(wagesOwed)

  // Update happiness
  for (let i = 0; i < state.grid.length; i++) {
    const cell = state.grid[i]
    if (!cell?.spawnedUnitName) continue
    const current = newHappy[i] ?? 100
    if (canPayWages) {
      newHappy[i] = Math.min(100, current + HAPPINESS_REGEN * minutes)
    } else {
      newHappy[i] = Math.max(0, current - HAPPINESS_DRAIN * minutes)
    }
  }

  const goldDelta = Math.floor(goldEarned) - (canPayWages ? Math.floor(wagesOwed) : 0)

  return {
    ...state,
    gold:      Math.max(0, state.gold + goldDelta),
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
  return { ...state, grid, happiness }
}

export function removeCard(state: CityState, index: number): CityState {
  const grid = [...state.grid]
  grid[index] = undefined
  const happiness = { ...state.happiness }
  delete happiness[index]
  return { ...state, grid, happiness }
}

// ── Rate helpers ──────────────────────────────────────────────────────────────

export function goldIncomeRate(state: CityState): number {
  let total = 0
  for (let i = 0; i < state.grid.length; i++) {
    const cell = state.grid[i]
    if (!cell) continue
    const happy = (state.happiness[i] ?? 100) > 0
    total += cellIncomeRate(cell, happy)
  }
  return total
}

export function goldWageRate(state: CityState): number {
  let total = 0
  for (let i = 0; i < state.grid.length; i++) {
    const cell = state.grid[i]
    if (!cell?.spawnedUnitName) continue
    total += WAGE_SPAWN[cell.rarity]
  }
  return total
}

export function goldNetRate(state: CityState): number {
  return goldIncomeRate(state) - goldWageRate(state)
}

// ── Card levelling ────────────────────────────────────────────────────────────

export function getCardLevel(state: CityState, cardName: string): number {
  return state.cardLevels[cardName] ?? 0
}

export function levelUpCost(currentLevel: number): number | null {
  if (currentLevel >= MAX_CARD_LEVEL) return null
  return LEVEL_UP_COSTS[currentLevel]
}

export function levelUpCard(state: CityState, cardName: string): CityState | null {
  const current = getCardLevel(state, cardName)
  const cost    = levelUpCost(current)
  if (cost === null || state.gold < cost) return null
  return {
    ...state,
    gold:       state.gold - cost,
    cardLevels: { ...state.cardLevels, [cardName]: current + 1 },
  }
}

// ── Battle stat bonus helpers ─────────────────────────────────────────────────

export function getCardBonuses(cardName: string): { atk: number; maxHp: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { atk: 0, maxHp: 0 }
    const state = JSON.parse(raw) as Partial<CityState>
    const level = (state.cardLevels ?? {})[cardName] ?? 0
    return {
      atk:   level * LEVEL_ATK_BONUS,
      maxHp: level * LEVEL_MAX_HP_BONUS,
    }
  } catch {
    return { atk: 0, maxHp: 0 }
  }
}
