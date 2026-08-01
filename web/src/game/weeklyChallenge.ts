// ─── Weekly Narrative Challenge ───────────────────────────────────────────────
//
// Beyond the daily challenge: once a week, every player faces the same
// story-framed battle with a constraint (themed deck, no units, themed
// opponent). The challenge is seeded by ISO week number, so it resets for
// everyone at Monday 00:00 UTC. First win of the week grants a Chronicle
// Fragment; three fragments fuse into an Exotic Relic Shard.
//
// Required additional Firestore Security Rules:
//   match /weeklyLeaderboard/{week}/entries/{uid} {
//     allow write: if request.auth != null && request.auth.uid == uid;
//     allow read:  if true;
//   }

import { logError } from '../logger'
import { getCardCatalog, getCardThemeTags } from './cards'
import { hashStr, makeSeededRng, seededShuffle } from './seededRandom'
import {
  getChronicleFragments, addChronicleFragments, removeChronicleFragments,
  getExoticShards, addExoticShards,
} from './itemStore'
import { Card } from './types'
import {
  doc, setDoc, getDocs, collection, query, orderBy, limit, Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import weeklyChallengesData from '../data/weeklyChallenges.json'

const WC_KEY     = 'jarv_weekly_challenge'
const DECK_SIZE  = 20
const FRAGMENTS_PER_SHARD = 3

// ── Types ─────────────────────────────────────────────────────────────────────

export type WeeklyConstraint =
  | { type: 'deck_tags'; tags: string[]; label: string }
  | { type: 'no_units'; label: string }
  | { type: 'opponent_tags'; tags: string[]; label: string }

export interface WeeklyChallengeDef {
  id: string
  loreTitle: string
  loreContext: string
  constraint: WeeklyConstraint
}

export interface WeeklyChallengeState {
  weekKey:  string
  won:      boolean | null  // null = haven't won yet this week
  attempts: number
}

export const WEEKLY_CHALLENGES: WeeklyChallengeDef[] =
  weeklyChallengesData as WeeklyChallengeDef[]

// ── Week seeding ──────────────────────────────────────────────────────────────

/**
 * ISO-8601 week key in UTC, e.g. "2026-W24". ISO weeks start on Monday, so
 * the challenge naturally rotates at Monday 00:00 UTC for every player.
 */
export function getISOWeekKey(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = date.getUTCDay() || 7              // Mon=1 … Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - day)   // shift to this week's Thursday
  const isoYear   = date.getUTCFullYear()
  const yearStart = Date.UTC(isoYear, 0, 1)
  const week = Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7)
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

/** Next Monday 00:00 UTC — when the current challenge expires. */
export function getNextWeeklyReset(now: Date = new Date()): Date {
  const day = now.getUTCDay() || 7
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + (8 - day)))
}

/** This week's challenge — the same for every player. */
export function getWeeklyChallenge(now: Date = new Date()): WeeklyChallengeDef {
  return WEEKLY_CHALLENGES[hashStr(getISOWeekKey(now)) % WEEKLY_CHALLENGES.length]
}

// ── Deck building ─────────────────────────────────────────────────────────────

/** A card's tags: theme tags from cards.json plus the unit's combat tags. */
export function getAllCardTags(card: Card): string[] {
  return [...getCardThemeTags(card.name), ...(card.unit?.tags ?? [])]
}

function hasAnyTag(card: Card, tags: string[]): boolean {
  return getAllCardTags(card).some(t => tags.includes(t))
}

/**
 * Build a seeded deck from a constrained pool. Small thematic pools are
 * handled by allowing a second copy of each card before giving up.
 * Guards (skipped for unit-free decks): at least 3 unit cards and at least
 * 3 cards costing ≤ 3, so the deck is never unwinnable out of the gate.
 */
function buildConstrainedDeck(pool: Card[], xorSeed: number, opts: { allowUnits: boolean }): Card[] {
  const rng      = makeSeededRng(hashStr(getISOWeekKey()) ^ xorSeed)
  const shuffled = seededShuffle(pool, rng)
  const idPrefix = `wc-${(xorSeed >>> 0).toString(16)}`

  const result: Card[] = []
  const copies = new Map<string, number>()
  for (const maxCopies of [1, 2]) {
    for (const card of shuffled) {
      if (result.length >= DECK_SIZE) break
      if ((copies.get(card.name) ?? 0) >= maxCopies) continue
      copies.set(card.name, (copies.get(card.name) ?? 0) + 1)
      result.push({ ...card, id: `${idPrefix}-${result.length}` })
    }
    if (result.length >= DECK_SIZE) break
  }

  if (opts.allowUnits) {
    // Ensure enough units and early plays, swapping highest-cost offenders
    // for the cheapest in-pool fixes (deterministic, no RNG).
    const cheapUnits = pool.filter(c => c.cardType === 'unit').sort((a, b) => a.cost - b.cost)
    let fixIdx = 0
    while (result.filter(c => c.cardType === 'unit').length < 3 && fixIdx < cheapUnits.length) {
      const fix = cheapUnits[fixIdx++]
      if ((copies.get(fix.name) ?? 0) >= 2) continue
      const worst = result.reduce((best, c, i) =>
        c.cardType !== 'unit' && c.cost > result[best].cost ? i : best, 0)
      if (result[worst].cardType === 'unit') break
      copies.set(fix.name, (copies.get(fix.name) ?? 0) + 1)
      result[worst] = { ...fix, id: `${idPrefix}-fixu-${fixIdx}` }
    }
    const cheapCards = [...pool].sort((a, b) => a.cost - b.cost)
    fixIdx = 0
    while (result.filter(c => c.cost <= 3).length < 3 && fixIdx < cheapCards.length) {
      const fix = cheapCards[fixIdx++]
      if (fix.cost > 3) break
      if ((copies.get(fix.name) ?? 0) >= 2) continue
      const worst = result.reduce((best, c, i) => c.cost > result[best].cost ? i : best, 0)
      copies.set(fix.name, (copies.get(fix.name) ?? 0) + 1)
      result[worst] = { ...fix, id: `${idPrefix}-fixc-${fixIdx}` }
    }
  }

  // High-cost cards with no mana structure would soft-lock the deck (players
  // can't edit it). Inject the cheapest mana structure from the full catalog —
  // theme bends rather than the deck breaking. Same rule as the daily.
  const BASE_MAX_MANA = 5
  const maxCost = result.reduce((m, c) => Math.max(m, c.cost), 0)
  const hasManaStructure = result.some(c => c.unit?.structureEffect?.type === 'mana')
  if (maxCost > BASE_MAX_MANA && !hasManaStructure) {
    const manaStructure = getCardCatalog()
      .filter(c => c.unit?.structureEffect?.type === 'mana')
      .sort((a, b) => a.cost - b.cost)[0]
    if (manaStructure) {
      result[result.length - 1] = { ...manaStructure, id: `${idPrefix}-mana` }
    }
  }

  return result
}

/** Player's deck for this week's challenge — same for everyone. */
export function getWeeklyPlayerDeck(): Card[] {
  const catalog    = getCardCatalog()
  const constraint = getWeeklyChallenge().constraint
  let pool: Card[]
  let allowUnits = true
  switch (constraint.type) {
    case 'deck_tags':
      pool = catalog.filter(c => hasAnyTag(c, constraint.tags))
      break
    case 'no_units':
      pool = catalog.filter(c => c.cardType !== 'unit')
      allowUnits = false
      break
    case 'opponent_tags':
      pool = catalog   // constraint applies to the opponent; player deck is unrestricted
      break
  }
  return buildConstrainedDeck(pool, 0x4ee71001, { allowUnits })
}

/** Opponent's deck for this week's challenge. */
export function getWeeklyOpponentDeck(): Card[] {
  const catalog    = getCardCatalog()
  const constraint = getWeeklyChallenge().constraint
  const pool = constraint.type === 'opponent_tags'
    ? catalog.filter(c => hasAnyTag(c, constraint.tags))
    : catalog
  return buildConstrainedDeck(pool, 0x4ee71000, { allowUnits: true })
}

/** Deterministic terrain seed for this week — same battlefield layout for every player. */
export function getWeeklyTerrainSeed(): string {
  return `weekly-${getISOWeekKey()}`
}

// ── Local state ───────────────────────────────────────────────────────────────

export function getWeeklyChallengeState(): WeeklyChallengeState {
  try {
    const raw = localStorage.getItem(WC_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as WeeklyChallengeState
      if (parsed.weekKey === getISOWeekKey()) return parsed
    }
  } catch (e) { logError('getWeeklyChallengeState failed', { error: String(e) }) }
  return { weekKey: getISOWeekKey(), won: null, attempts: 0 }
}

export function saveWeeklyChallengeResult(won: boolean): void {
  const state = getWeeklyChallengeState()
  // Don't increment attempts once the challenge is already completed this week
  if (state.won === true) return
  const next: WeeklyChallengeState = {
    weekKey:  getISOWeekKey(),
    won,
    attempts: state.attempts + 1,
  }
  try { localStorage.setItem(WC_KEY, JSON.stringify(next)) } catch { /* ignore */ }
}

// ── Rewards ───────────────────────────────────────────────────────────────────

export interface WeeklyRewardResult {
  fragments: number   // fragment balance after the grant
  shards: number      // shard balance after the grant
  combined: boolean   // true if fragments fused into a shard just now
}

/**
 * Grant the first-win-of-the-week reward: one Chronicle Fragment. When the
 * balance reaches FRAGMENTS_PER_SHARD the fragments fuse into one Exotic
 * Relic Shard. Returns the resulting balances for the reward UI.
 */
export function grantWeeklyReward(): WeeklyRewardResult {
  addChronicleFragments(1)
  let combined = false
  if (getChronicleFragments() >= FRAGMENTS_PER_SHARD) {
    if (removeChronicleFragments(FRAGMENTS_PER_SHARD)) {
      addExoticShards(1)
      combined = true
    }
  }
  return { fragments: getChronicleFragments(), shards: getExoticShards(), combined }
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface WeeklyLeaderboardEntry {
  uid:           string
  characterName: string
  attempts:      number
  completedAt:   Date
}

/**
 * Publish a weekly challenge win to the Firestore leaderboard.
 * One document per uid per week — overwrites if re-submitted.
 */
export async function publishWeeklyResult(opts: {
  uid:           string
  characterName: string
  attempts:      number
}): Promise<void> {
  const week = getISOWeekKey()
  const ref  = doc(db, 'weeklyLeaderboard', week, 'entries', opts.uid)
  await setDoc(ref, {
    uid:           opts.uid,
    characterName: opts.characterName,
    attempts:      opts.attempts,
    completedAt:   Timestamp.now(),
  })
}

/**
 * Fetch this week's top N leaderboard entries, sorted by attempts ascending.
 * Returns an empty array on error or when offline.
 */
export async function fetchWeeklyLeaderboard(topN = 3): Promise<WeeklyLeaderboardEntry[]> {
  try {
    const week = getISOWeekKey()
    const ref  = collection(db, 'weeklyLeaderboard', week, 'entries')
    const q    = query(ref, orderBy('attempts', 'asc'), limit(topN))
    const snap = await getDocs(q)
    return snap.docs.map((d: import('firebase/firestore').QueryDocumentSnapshot) => {
      const data = d.data()
      return {
        uid:           data.uid,
        characterName: data.characterName,
        attempts:      data.attempts,
        completedAt:   (data.completedAt as Timestamp).toDate(),
      }
    })
  } catch { return [] }
}
