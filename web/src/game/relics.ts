/**
 * Relic system — passive bonuses earned at act completion.
 * Relic definitions live in src/data/relics.json; this module provides the
 * typed effect union, the applyToGame engine, and persistence helpers.
 */

import type { GameState } from './types'
import relicsCatalog from '../data/relics.json'

// ─── Effect types ─────────────────────────────────────────

export type RelicEffect =
  | { type: 'baseHp';     amount: number }
  | { type: 'unitAtk';    amount: number; condition?: 'baseBelowHalf' }
  | { type: 'unitHp';     amount: number }
  | { type: 'maxMana';    amount: number }
  | { type: 'startMana';  amount: number }
  | { type: 'unitRevive'; hp: 'half' | 'full' | number }
  | { type: 'tickHeal';   amount: number; intervalMs: number }
  | { type: 'onPlayAtk';  amount: number }
  // ── Exotic effects — rule-breaking mechanics, one exotic equippable per run ──
  | { type: 'baseHpSet';      amount: number }   // base max HP becomes exactly this value
  | { type: 'atkMult';        mult: number }     // all player units (incl. later deploys) ×mult ATK
  | { type: 'phantomRevive';  chance: number }   // dying units roll this chance to revive at 50% HP
  | { type: 'manaOverflow';   amount: number }   // mana keeps regenerating up to maxMana + amount
  | { type: 'farmSpawn' }                        // building a Farm also spawns a Goblin
  | { type: 'structureDraw' }                    // building any structure draws 1 card

interface RelicData {
  name: string
  icon: string
  desc: string
  exotic?: boolean
  effects: RelicEffect[]
}

// ─── Public relic definition type ─────────────────────────

export interface RelicDef {
  name: string
  icon: string
  desc: string
  exotic: boolean
  applyToGame: (state: GameState) => void
}

// ─── Effect applicator ────────────────────────────────────

function buildApplyToGame(effects: RelicEffect[]): (state: GameState) => void {
  return function(state: GameState) {
    for (const effect of effects) {
      switch (effect.type) {
        case 'baseHp':
          state.playerBase.maxHp += effect.amount
          state.playerBase.hp    += effect.amount
          break
        case 'unitAtk':
          if (effect.condition === 'baseBelowHalf' && state.playerBase.hp >= state.playerBase.maxHp * 0.5) break
          for (const u of state.field) {
            if (u.owner === 'player') u.attack = Math.max(0, u.attack + effect.amount)
          }
          break
        case 'unitHp':
          for (const u of state.field) {
            if (u.owner === 'player') { u.maxHp += effect.amount; u.hp += effect.amount }
          }
          break
        case 'maxMana':
          state.relicManaBonus = (state.relicManaBonus ?? 0) + effect.amount
          break
        case 'startMana':
          state.mana = Math.min(state.mana + effect.amount, state.maxMana)
          break
        case 'unitRevive':
          state.unitReviveHp = effect.hp
          break
        case 'tickHeal':
          state.tickEffects = [...(state.tickEffects ?? []), { type: 'healPlayerUnits', amount: effect.amount, intervalMs: effect.intervalMs, timer: effect.intervalMs }]
          break
        case 'onPlayAtk':
          state.onCardPlayedEffects = [...(state.onCardPlayedEffects ?? []), { attackBonus: effect.amount }]
          break
        case 'baseHpSet':
          state.playerBase.maxHp = effect.amount
          state.playerBase.hp    = Math.min(state.playerBase.hp, effect.amount)
          break
        case 'atkMult':
          state.playerAtkMult = (state.playerAtkMult ?? 1) * effect.mult
          for (const u of state.field) {
            if (u.owner === 'player') u.attack = Math.round(u.attack * effect.mult)
          }
          break
        case 'phantomRevive':
          state.phantomReviveChance = effect.chance
          break
        case 'manaOverflow':
          state.manaOverflowCap = effect.amount
          break
        case 'farmSpawn':
          state.farmSpawnsGoblin = true
          break
        case 'structureDraw':
          state.structureDrawsCard = true
          break
      }
    }
  }
}

// ─── Catalog ──────────────────────────────────────────────

const RELIC_CATALOG: RelicDef[] = (relicsCatalog as RelicData[]).map(data => ({
  name: data.name,
  icon: data.icon,
  desc: data.desc,
  exotic: data.exotic === true,
  applyToGame: buildApplyToGame(data.effects),
}))

export function getRelicDef(name: string): RelicDef | undefined {
  return RELIC_CATALOG.find(r => r.name === name)
}

/** True if the named relic is an exotic. */
export function isExoticRelic(name: string): boolean {
  return getRelicDef(name)?.exotic === true
}

/** Names of every exotic relic in the catalog. */
export function getExoticRelicNames(): string[] {
  return RELIC_CATALOG.filter(r => r.exotic).map(r => r.name)
}

/** Drop chance for an exotic relic by node type (boss > elite; others never drop). */
export const EXOTIC_DROP_CHANCE: Record<string, number> = { boss: 0.15, elite: 0.06 }

/**
 * Rolls an exotic relic drop for a beaten node. Returns the dropped relic name,
 * or null if the roll failed or the player already owns every exotic.
 */
export function rollExoticDrop(nodeType: string): string | null {
  const chance = EXOTIC_DROP_CHANCE[nodeType]
  if (!chance || Math.random() >= chance) return null
  const owned = new Set(getRelics())
  const candidates = getExoticRelicNames().filter(n => !owned.has(n))
  if (candidates.length === 0) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

// ─── Persistent relic collection (survives act resets) ────────────────────────

import { addRelic, removeRelic, getRelics } from './itemStore'

// Relic CRUD delegates to itemStore.ts (see the RELICS section there).
// These names are kept for backward compatibility with existing callers.

/** Returns the list of relic names the player has earned across all runs. */
export function loadEarnedRelics(): string[] {
  return getRelics()
}

/** Adds a relic to the player's permanent collection (no duplicates). Also clears any broken flag. */
export function addEarnedRelic(name: string): void {
  addRelic(name)
  // If this relic was previously broken, restore it
  removeBrokenRelic(name)
}

/** Removes a relic from the player's permanent collection (e.g. when it breaks). */
export function removeEarnedRelic(name: string): void {
  removeRelic(name)
}

// ─── Broken relic tracking ────────────────────────────────────────────────────
// Broken relics are removed from the usable pool but retained as greyed-out
// history on the selection screen. Completing the rewarding act restores them.

const BROKEN_RELICS_KEY = 'jarv_broken_relics'

/** Returns relic names that are currently broken (unequippable). */
export function loadBrokenRelics(): string[] {
  try {
    const raw = localStorage.getItem(BROKEN_RELICS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

/** Marks a relic as broken (shown greyed-out on selection screen). */
export function addBrokenRelic(name: string): void {
  try {
    const existing = loadBrokenRelics()
    if (!existing.includes(name)) {
      localStorage.setItem(BROKEN_RELICS_KEY, JSON.stringify([...existing, name]))
    }
  } catch { /* ignore */ }
}

/** Removes a relic from the broken list (called when it is re-earned). */
export function removeBrokenRelic(name: string): void {
  try {
    localStorage.setItem(BROKEN_RELICS_KEY, JSON.stringify(loadBrokenRelics().filter(n => n !== name)))
  } catch { /* ignore */ }
}
