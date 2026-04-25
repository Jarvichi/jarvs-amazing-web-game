// ─── City Builder ─────────────────────────────────────────────────────────────
// Persistent idle city: place owned units/buildings on a grid, collect gold
// over time, spend gold to permanently level up cards.

import { logError } from '../logger'
import { CardRarity } from './types'

// ── Constants ─────────────────────────────────────────────────────────────────

export const CITY_COLS = 6
export const CITY_ROWS = 4
export const CITY_CELLS = CITY_COLS * CITY_ROWS

/** Max minutes of offline accumulation counted (8 hours). */
const MAX_OFFLINE_MINUTES = 480

/** Gold generated per minute per cell, keyed by rarity. */
const GOLD_PER_MIN_UNIT: Record<CardRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  legendary: 5,
}
const GOLD_PER_MIN_STRUCTURE: Record<CardRarity, number> = {
  common: 3,
  uncommon: 5,
  rare: 7,
  legendary: 12,
}

/** Level-up costs: index = target level (1-based). cost[0] = cost to reach lvl 1, etc. */
export const LEVEL_UP_COSTS = [50000, 100000, 250000, 500000, 100000] // 
export const MAX_CARD_LEVEL  = LEVEL_UP_COSTS.length

/** Stat bonuses applied per level (cumulative). */
export const LEVEL_ATK_BONUS    = 1   // per level
export const LEVEL_MAX_HP_BONUS = 2   // per level

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CityCell {
  cardName:  string
  cardType:  'unit' | 'structure'
  rarity:    CardRarity
}

export interface CityState {
  /** Sparse map: cellIndex → CityCell (undefined = empty). */
  grid:    (CityCell | undefined)[]
  gold:    number
  /** timestamp (ms) of last tick calculation. */
  lastTick: number
  /** cardName → level (1-based; absent = level 0). */
  cardLevels: Record<string, number>
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'jarv_city_builder'

function defaultState(): CityState {
  return {
    grid:       Array(CITY_CELLS).fill(undefined),
    gold:       0,
    lastTick:   Date.now(),
    cardLevels: {},
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

// ── Offline tick ──────────────────────────────────────────────────────────────

/** Calculate gold earned since lastTick, cap at MAX_OFFLINE_MINUTES, return updated state. */
export function tickCity(state: CityState): CityState {
  const now     = Date.now()
  const elapsed = now - state.lastTick
  const minutes = Math.min(elapsed / 60_000, MAX_OFFLINE_MINUTES)

  let earned = 0
  for (const cell of state.grid) {
    if (!cell) continue
    const rate = cell.cardType === 'structure'
      ? GOLD_PER_MIN_STRUCTURE[cell.rarity]
      : GOLD_PER_MIN_UNIT[cell.rarity]
    earned += rate * minutes
  }

  return {
    ...state,
    gold:     state.gold + Math.floor(earned),
    lastTick: now,
  }
}

// ── Grid helpers ──────────────────────────────────────────────────────────────

export function placeCard(
  state: CityState,
  index: number,
  cell: CityCell,
): CityState {
  const grid = [...state.grid]
  grid[index] = cell
  return { ...state, grid }
}

export function removeCard(state: CityState, index: number): CityState {
  const grid = [...state.grid]
  grid[index] = undefined
  return { ...state, grid }
}

/** Gold generated per minute for the current city layout. */
export function goldPerMinute(state: CityState): number {
  let total = 0
  for (const cell of state.grid) {
    if (!cell) continue
    total += cell.cardType === 'structure'
      ? GOLD_PER_MIN_STRUCTURE[cell.rarity]
      : GOLD_PER_MIN_UNIT[cell.rarity]
  }
  return total
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

// ── Stat bonus helpers ────────────────────────────────────────────────────────

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
