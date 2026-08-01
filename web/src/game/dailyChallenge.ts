// ─── Daily Challenge ──────────────────────────────────────────────────────────
//
// Each day everyone plays the same fixed-seed deck against the same opponent.
// Win/loss and attempt count are tracked in localStorage.
// Completions are published to Firestore for the daily leaderboard.

import { logError } from '../logger'
import { getCardCatalog } from './cards'
import { hashStr, makeSeededRng, seededShuffle } from './seededRandom'
import { Card } from './types'
import {
  doc, setDoc, getDocs, collection, query, orderBy, limit, where, Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

// Required additional Firestore Security Rules:
//   match /dailyLeaderboard/{date}/entries/{uid} {
//     allow write: if request.auth != null && request.auth.uid == uid;
//     allow read:  if true;
//   }
//   match /endlessLeaderboard/{uid} {
//     allow write: if request.auth != null && request.auth.uid == uid;
//     allow read:  if true;
//   }

const DC_KEY        = 'jarv_daily_challenge'
const DC_STREAK_KEY = 'jarv_daily_streak'
const DECK_SIZE     = 20

const MAX_BUILD_ATTEMPTS = 10  // retry limit for deck validation
const MIN_UNIT_CARDS     = 3   // minimum direct unit (mobile) cards required
const MIN_LOW_COST_CARDS = 3   // minimum cards with cost ≤ 3 (early-game plays)
const MAX_AVG_COST       = 4.0 // average cost ceiling

interface DailyStreakSave {
  streak:      number
  lastWonDate: string
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailyChallengeState {
  date:     string
  won:      boolean | null  // null = haven't won yet today
  attempts: number
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function getDailyDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Returns true if a deck has enough variety and early-game cards to be winnable. */
function isDeckPlayable(cards: Card[]): boolean {
  const unitCount = cards.filter(c => c.cardType === 'unit').length
  if (unitCount < MIN_UNIT_CARDS) return false

  const lowCostCount = cards.filter(c => c.cost <= 3).length
  if (lowCostCount < MIN_LOW_COST_CARDS) return false

  const avgCost = cards.reduce((sum, c) => sum + c.cost, 0) / cards.length
  if (avgCost > MAX_AVG_COST) return false

  return true
}

/** Build a challenge deck of DECK_SIZE cards, seeded deterministically.
 *  Retries up to MAX_BUILD_ATTEMPTS times with slightly different seeds until
 *  the deck passes playability checks. Attempt 0 is identical to the original
 *  algorithm, so valid days remain unchanged. */
function buildChallengeCards(xorSeed: number): Card[] {
  const catalog       = getCardCatalog()
  const BASE_MAX_MANA = 5
  let firstResult: Card[] | null = null

  for (let attempt = 0; attempt < MAX_BUILD_ATTEMPTS; attempt++) {
    // attempt=0 → (hashStr(date) + 0) ^ xorSeed = hashStr(date) ^ xorSeed (original behaviour)
    const rng      = makeSeededRng((hashStr(getDailyDate()) + attempt) ^ xorSeed)
    const shuffled = seededShuffle(catalog, rng)

    // Pick first DECK_SIZE distinct-name cards
    const seen: Set<string> = new Set()
    const result: Card[]    = []
    for (const card of shuffled) {
      if (!seen.has(card.name)) {
        seen.add(card.name)
        result.push({ ...card, id: `dc-${(xorSeed >>> 0).toString(16)}-${attempt}-${result.length}` })
        if (result.length >= DECK_SIZE) break
      }
    }

    // If the deck has cards costing > 5 but no mana structure, inject the cheapest one.
    // Players can't edit the daily deck, so we must ensure it's always self-sufficient.
    const hasManaStructure = result.some(c => c.unit?.structureEffect?.type === 'mana')
    const maxCost = result.reduce((m, c) => Math.max(m, c.cost), 0)
    if (maxCost > BASE_MAX_MANA && !hasManaStructure) {
      const manaStructure = catalog
        .filter(c => c.unit?.structureEffect?.type === 'mana')
        .sort((a, b) => a.cost - b.cost)[0]
      if (manaStructure && !seen.has(manaStructure.name)) {
        result[result.length - 1] = { ...manaStructure, id: `dc-${(xorSeed >>> 0).toString(16)}-mana` }
      }
    }

    if (firstResult === null) firstResult = result
    if (isDeckPlayable(result)) return result
  }

  // All attempts exhausted — apply targeted fixes to the first result.
  // Unreachable in practice, but ensures the fallback is never worse than today's behaviour.
  const fixed      = [...firstResult!]
  const fixedNames = new Set(fixed.map(c => c.name))
  const lowCostUnits = catalog
    .filter(c => c.cardType === 'unit' && c.cost <= 2)
    .sort((a, b) => a.cost - b.cost)
  let lowCostIdx = 0
  while (!isDeckPlayable(fixed) && lowCostIdx < lowCostUnits.length) {
    const replacement = lowCostUnits[lowCostIdx++]
    if (fixedNames.has(replacement.name)) continue
    // Replace the highest-cost non-unit card
    const worstIdx = fixed.reduce((best, c, i) =>
      c.cost > fixed[best].cost && c.cardType !== 'unit' ? i : best, 0)
    fixedNames.delete(fixed[worstIdx].name)
    fixed[worstIdx] = { ...replacement, id: `dc-${(xorSeed >>> 0).toString(16)}-fix-${lowCostIdx}` }
    fixedNames.add(replacement.name)
  }

  return fixed
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Player's deck for today's challenge — same for everyone. */
export function getDailyPlayerDeck(): Card[] {
  return buildChallengeCards(0xda11001a)
}

/** Opponent's deck for today's challenge. */
export function getDailyOpponentDeck(): Card[] {
  return buildChallengeCards(0xda110000)
}

/** Deterministic terrain seed for today — same battlefield layout for every player. */
export function getDailyTerrainSeed(): string {
  return `daily-${getDailyDate()}`
}

export function getDailyChallengeState(): DailyChallengeState {
  try {
    const raw = localStorage.getItem(DC_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DailyChallengeState
      if (parsed.date === getDailyDate()) return parsed
    }
  } catch (e) { logError('getDailyChallengeState failed', { error: String(e) }) }
  return { date: getDailyDate(), won: null, attempts: 0 }
}

export function getDailyWinStreak(): number {
  try {
    const raw = localStorage.getItem(DC_STREAK_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DailyStreakSave
      const today     = getDailyDate()
      const yesterday = new Date(new Date(today).getTime() - 86400000).toISOString().slice(0, 10)
      if (parsed.lastWonDate === today || parsed.lastWonDate === yesterday) return parsed.streak
    }
  } catch { /* ignore */ }
  return 0
}

/** Record a daily win for streak tracking. Returns the updated streak. */
export function recordDailyWin(): number {
  const today     = getDailyDate()
  const yesterday = new Date(new Date(today).getTime() - 86400000).toISOString().slice(0, 10)
  let streak = 1
  try {
    const raw = localStorage.getItem(DC_STREAK_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DailyStreakSave
      if (parsed.lastWonDate === today)      streak = parsed.streak           // already recorded today
      else if (parsed.lastWonDate === yesterday) streak = parsed.streak + 1  // continuing streak
    }
  } catch { /* ignore */ }
  try { localStorage.setItem(DC_STREAK_KEY, JSON.stringify({ streak, lastWonDate: today })) } catch { /* ignore */ }
  return streak
}

export function saveDailyChallengeResult(won: boolean): void {
  const state = getDailyChallengeState()
  // Don't increment attempts once the challenge is already completed for the day
  if (state.won === true) return
  const next: DailyChallengeState = {
    date:     getDailyDate(),
    won:      won,
    attempts: state.attempts + 1,
  }
  try { localStorage.setItem(DC_KEY, JSON.stringify(next)) } catch { /* ignore */ }
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  uid:           string
  playerId:      string
  characterName: string
  attempts:      number
  completedAt:   Date
}

/**
 * Publish a daily challenge win to the Firestore leaderboard.
 * One document per uid per day — overwrites if re-submitted.
 */
export async function publishDailyResult(opts: {
  uid:           string
  playerId:      string
  characterName: string
  attempts:      number
}): Promise<void> {
  const date = getDailyDate()
  const ref  = doc(db, 'dailyLeaderboard', date, 'entries', opts.uid)
  await setDoc(ref, {
    uid:           opts.uid,
    playerId:      opts.playerId,
    characterName: opts.characterName,
    attempts:      opts.attempts,
    completedAt:   Timestamp.now(),
  })
}

/**
 * Fetch today's top N leaderboard entries, sorted by attempts ascending.
 * Returns an empty array on error or when offline.
 */
export async function fetchDailyLeaderboard(topN = 3): Promise<LeaderboardEntry[]> {
  try {
    const date = getDailyDate()
    const ref  = collection(db, 'dailyLeaderboard', date, 'entries')
    const q    = query(ref, orderBy('attempts', 'asc'), limit(topN))
    const snap = await getDocs(q)
    return snap.docs.map((d: import('firebase/firestore').QueryDocumentSnapshot) => {
      const data = d.data()
      return {
        uid:           data.uid,
        playerId:      data.playerId,
        characterName: data.characterName,
        attempts:      data.attempts,
        completedAt:   (data.completedAt as Timestamp).toDate(),
      }
    })
  } catch { return [] }
}

// ── Endless Leaderboard ───────────────────────────────────────────────────────

const ENDLESS_BEST_KEY = 'jarv_endless_best'

interface EndlessBestSave {
  wave:       number
  survivalMs: number
}

export interface EndlessLeaderboardEntry {
  uid:           string
  characterName: string
  wave:          number
  survivalMs:    number
  achievedAt:    Date
}

/** Returns the player's locally-stored personal best for endless mode. */
export function getEndlessPersonalBest(): EndlessBestSave | null {
  try {
    const raw = localStorage.getItem(ENDLESS_BEST_KEY)
    if (raw) return JSON.parse(raw) as EndlessBestSave
  } catch { /* ignore */ }
  return null
}

/**
 * Publish an endless mode run to the all-time leaderboard.
 * Only publishes if this run beats the player's stored personal best.
 * Returns true if published, false otherwise.
 */
export async function publishEndlessResult(opts: {
  uid:           string
  characterName: string
  wave:          number
  survivalMs:    number
}): Promise<boolean> {
  const best = getEndlessPersonalBest()
  const isNewBest = !best
    || opts.wave > best.wave
    || (opts.wave === best.wave && opts.survivalMs > best.survivalMs)
  if (!isNewBest) return false

  try {
    localStorage.setItem(ENDLESS_BEST_KEY, JSON.stringify({ wave: opts.wave, survivalMs: opts.survivalMs }))
  } catch { /* ignore */ }

  const ref = doc(db, 'endlessLeaderboard', opts.uid)
  await setDoc(ref, {
    uid:           opts.uid,
    characterName: opts.characterName,
    wave:          opts.wave,
    survivalMs:    opts.survivalMs,
    achievedAt:    Timestamp.now(),
    date:          getDailyDate(),
  })
  return true
}

/**
 * Fetch the top N all-time endless leaderboard entries.
 * Sorted by wave descending, then survivalMs descending.
 * Returns an empty array on error or when offline.
 */
export async function fetchEndlessLeaderboard(topN = 10): Promise<EndlessLeaderboardEntry[]> {
  try {
    const ref  = collection(db, 'endlessLeaderboard')
    const q    = query(ref, orderBy('wave', 'desc'), limit(topN))
    const snap = await getDocs(q)
    return snap.docs.map((d: import('firebase/firestore').QueryDocumentSnapshot) => {
      const data = d.data()
      return {
        uid:           data.uid,
        characterName: data.characterName,
        wave:          data.wave,
        survivalMs:    data.survivalMs,
        achievedAt:    (data.achievedAt as Timestamp).toDate(),
      }
    })
  } catch { return [] }
}

/**
 * Fetch the top N endless leaderboard entries for today.
 * Only includes scores set (or updated to a personal best) today.
 */
export async function fetchTodaysEndlessLeaderboard(topN = 10): Promise<EndlessLeaderboardEntry[]> {
  try {
    const ref  = collection(db, 'endlessLeaderboard')
    const q    = query(ref, where('date', '==', getDailyDate()), orderBy('wave', 'desc'), limit(topN))
    const snap = await getDocs(q)
    return snap.docs.map((d: import('firebase/firestore').QueryDocumentSnapshot) => {
      const data = d.data()
      return {
        uid:           data.uid,
        characterName: data.characterName,
        wave:          data.wave,
        survivalMs:    data.survivalMs,
        achievedAt:    (data.achievedAt as Timestamp).toDate(),
      }
    })
  } catch { return [] }
}
