/**
 * Commander / Virtual-pet persistence layer.
 *
 * A "commander" is a single unit card the player promotes from their collection.
 * - Max 2 promotions per calendar day.
 * - The commander lives on the title screen and can be interacted with (feed / play / pet).
 * - Each interaction has a 30-minute cooldown and gives a random reward.
 */

import { logError } from '../logger'

const COMMANDER_KEY       = 'jarv_commander'
const PROMO_COUNT_KEY     = 'jarv_commander_promo'   // { date: 'YYYY-MM-DD', count: number }
const MAX_PROMOS_PER_DAY  = 2
const INTERACT_COOLDOWN_MS = 30 * 60 * 1000           // 30 minutes

export interface CommanderState {
  cardName: string
  promotedAt: number         // epoch ms
  petActions: {
    feedAt?:  number
    playAt?:  number
    petAt?:   number
  }
}

// ── Persistence ───────────────────────────────────────────────────────────────

export function loadCommander(): CommanderState | null {
  try {
    const raw = localStorage.getItem(COMMANDER_KEY)
    return raw ? (JSON.parse(raw) as CommanderState) : null
  } catch (e) {
    logError('loadCommander failed', { err: String(e) })
    return null
  }
}

export function saveCommander(state: CommanderState): void {
  try {
    localStorage.setItem(COMMANDER_KEY, JSON.stringify(state))
  } catch (e) {
    logError('saveCommander failed', { err: String(e) })
  }
}

export function clearCommander(): void {
  try {
    localStorage.removeItem(COMMANDER_KEY)
  } catch (e) {
    logError('clearCommander failed', { err: String(e) })
  }
}

// ── Daily promotion cap ───────────────────────────────────────────────────────

function todayString(): string {
  return new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
}

interface PromoRecord { date: string; count: number }

function loadPromoRecord(): PromoRecord {
  try {
    const raw = localStorage.getItem(PROMO_COUNT_KEY)
    if (!raw) return { date: todayString(), count: 0 }
    const rec = JSON.parse(raw) as PromoRecord
    // Reset if it's a new day
    if (rec.date !== todayString()) return { date: todayString(), count: 0 }
    return rec
  } catch (e) {
    logError('loadPromoRecord failed', { err: String(e) })
    return { date: todayString(), count: 0 }
  }
}

function savePromoRecord(rec: PromoRecord): void {
  try {
    localStorage.setItem(PROMO_COUNT_KEY, JSON.stringify(rec))
  } catch (e) {
    logError('savePromoRecord failed', { err: String(e) })
  }
}

/** How many promotions remain today (0 = limit reached). */
export function promotionsRemainingToday(): number {
  const rec = loadPromoRecord()
  return Math.max(0, MAX_PROMOS_PER_DAY - rec.count)
}

/** Promote a card as commander.  Returns false if daily cap exceeded. */
export function promoteCommander(cardName: string): boolean {
  const rec = loadPromoRecord()
  if (rec.count >= MAX_PROMOS_PER_DAY) return false
  saveCommander({ cardName, promotedAt: Date.now(), petActions: {} })
  savePromoRecord({ date: todayString(), count: rec.count + 1 })
  return true
}

// ── Interaction cooldowns ─────────────────────────────────────────────────────

export type PetAction = 'feed' | 'play' | 'pet'

/** Returns true if the action is available (cooldown has passed). */
export function canInteract(state: CommanderState, action: PetAction): boolean {
  const lastAt = state.petActions[`${action}At` as keyof typeof state.petActions]
  if (!lastAt) return true
  return Date.now() - lastAt >= INTERACT_COOLDOWN_MS
}

/** Ms remaining on the cooldown (0 if ready). */
export function cooldownRemaining(state: CommanderState, action: PetAction): number {
  const lastAt = state.petActions[`${action}At` as keyof typeof state.petActions]
  if (!lastAt) return 0
  return Math.max(0, INTERACT_COOLDOWN_MS - (Date.now() - lastAt))
}

/** Record that an action was just performed. */
export function recordInteraction(state: CommanderState, action: PetAction): CommanderState {
  const key = `${action}At` as keyof typeof state.petActions
  return { ...state, petActions: { ...state.petActions, [key]: Date.now() } }
}

// ── Reward pool ───────────────────────────────────────────────────────────────

export type CommanderReward =
  | { type: 'xp';      amount: number }
  | { type: 'crystals'; amount: number }
  | { type: 'card' }
  | { type: 'pack' }

const REWARD_TABLE: Array<{ weight: number; reward: CommanderReward }> = [
  { weight: 50, reward: { type: 'xp',      amount: 5  } },
  { weight: 25, reward: { type: 'xp',      amount: 10 } },
  { weight: 15, reward: { type: 'crystals', amount: 5  } },
  { weight:  7, reward: { type: 'card' } },
  { weight:  3, reward: { type: 'pack' } },
]

export function rollCommanderReward(): CommanderReward {
  const total = REWARD_TABLE.reduce((s, r) => s + r.weight, 0)
  let roll = Math.random() * total
  for (const { weight, reward } of REWARD_TABLE) {
    roll -= weight
    if (roll <= 0) return reward
  }
  return { type: 'xp', amount: 5 }
}

export function formatCooldown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}
