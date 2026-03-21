// ─── Daily Challenge ──────────────────────────────────────────────────────────
//
// Each day everyone plays the same fixed-seed deck against the same opponent.
// Win/loss and attempt count are tracked in localStorage.

import { logError } from '../logger'
import { getCardCatalog } from './cards'
import { Card } from './types'

const DC_KEY    = 'jarv_daily_challenge'
const DECK_SIZE = 20

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

/** FNV-1a 32-bit hash. */
function hashStr(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  }
  return h >>> 0
}

/** Mulberry32 seeded PRNG. */
function makeSeededRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (Math.imul(s ^ (s >>> 15), s | 1) ^ ((s ^ (Math.imul(s ^ (s >>> 7), s | 61))) >>> 14)) >>> 0
    return s / 4294967296
  }
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Build a challenge deck of DECK_SIZE cards, seeded deterministically. */
function buildChallengeCards(xorSeed: number): Card[] {
  const rng     = makeSeededRng(hashStr(getDailyDate()) ^ xorSeed)
  const catalog = getCardCatalog()
  const shuffled = seededShuffle(catalog, rng)

  // Pick first DECK_SIZE distinct-name cards
  const seen: Set<string> = new Set()
  const result: Card[] = []
  for (const card of shuffled) {
    if (!seen.has(card.name)) {
      seen.add(card.name)
      result.push({ ...card, id: `dc-${(xorSeed >>> 0).toString(16)}-${result.length}` })
      if (result.length >= DECK_SIZE) break
    }
  }
  return result
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

export function saveDailyChallengeResult(won: boolean): void {
  const state = getDailyChallengeState()
  const next: DailyChallengeState = {
    date:     getDailyDate(),
    won:      state.won === true ? true : won,   // keep true once won; false if still losing
    attempts: state.attempts + 1,
  }
  try { localStorage.setItem(DC_KEY, JSON.stringify(next)) } catch { /* ignore */ }
}
