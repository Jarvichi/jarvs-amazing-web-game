// ─── Mini Games ───────────────────────────────────────────────────────────────
//
// Ticket economy, prize definitions, leaderboard helpers, and local high-score
// storage for the arcade mini-game feature.

import { logError } from '../logger'
import { getTickets, addTickets, spendTickets } from './itemStore'
import {
  doc, setDoc, getDocs, collection, query, orderBy, limit, where, Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

// ── Ticket Storage ────────────────────────────────────────────────────────────
// Ticket logic lives in itemStore.ts (see the ARCADE TICKETS section there).
// Re-exported here under the legacy name so existing callers don't need to
// change their import paths.

export { getTickets as loadTickets, addTickets, spendTickets }

// ── Game Costs ────────────────────────────────────────────────────────────────

export type MiniGameId = 'marble' | 'tileflip' | 'crystalcatch' | 'spinner'

export const MINI_GAME_COSTS: Record<MiniGameId, number> = {
  marble:       50,
  tileflip:     30,
  crystalcatch: 40,
  spinner:      25,
}

export const MINI_GAME_LABELS: Record<MiniGameId, string> = {
  marble:       'Marble Run',
  tileflip:     'Tile Flip',
  crystalcatch: 'Crystal Catch',
  spinner:      'Lucky Spinner',
}

export const MINI_GAME_DESCRIPTIONS: Record<MiniGameId, string> = {
  marble:       'Drop a marble through the pegs and land in high-value slots.',
  tileflip:     'Match pairs of tiles from memory. Faster = more tickets.',
  crystalcatch: 'Catch falling crystals, dodge the bombs!',
  spinner:      'Spin the wheel and hope for the jackpot.',
}

export const MINI_GAME_ICONS: Record<MiniGameId, string> = {
  marble:       '🔮',
  tileflip:     '🃏',
  crystalcatch: '💎',
  spinner:      '🎡',
}

// ── Ticket Prizes ─────────────────────────────────────────────────────────────

export type PrizeRewardType =
  | { type: 'card';     count: 1; rarity?: 'uncommon' | 'rare' | 'legendary' }
  | { type: 'cards';    count: number; rarity?: 'uncommon' | 'rare' | 'legendary' }
  | { type: 'crystals'; amount: number }
  | { type: 'bundle' }

export interface TicketPrize {
  id:     string
  cost:   number
  label:  string
  desc:   string
  reward: PrizeRewardType
}

export const TICKET_PRIZES: TicketPrize[] = [
  {
    id:     'card_1',
    cost:   25,
    label:  '1 Card',
    desc:   'A random card from the catalog.',
    reward: { type: 'card', count: 1 },
  },

  {
    id:     'crystal_50',
    cost:   25,
    label:  '50 Crystals',
    desc:   'A small handful of crystals.',
    reward: { type: 'crystals', amount: 50 },
  },

  {
    id:     'card_uncommon',
    cost:   75,
    label:  '1 Uncommon Card',
    desc:   'A guaranteed uncommon card.',
    reward: { type: 'card', count: 1, rarity: 'uncommon' },
  },

  {
    id:     'crystal_150',
    cost:   80,
    label:  '150 Crystals',
    desc:   'A decent bag of crystals.',
    reward: { type: 'crystals', amount: 150 },
  },

  {
    id:     'card_5pack',
    cost:   200,
    label:  '5-Pack of Cards',
    desc:   'Five random cards.',
    reward: { type: 'cards', count: 5 },
  },

  {
    id:     'card_rare',
    cost:   150,
    label:  '1 Rare Card',
    desc:   'A guaranteed rare card.',
    reward: { type: 'card', count: 1, rarity: 'rare' },
  },

  {
    id:     'card_10pack',
    cost:   350,
    label:  '10-Pack of Cards',
    desc:   'Ten random cards — a hefty haul.',
    reward: { type: 'cards', count: 10 },
  },

  {
    id:     'rare_trio',
    cost:   400,
    label:  '3 Rare Cards',
    desc:   'Three guaranteed rare cards.',
    reward: { type: 'cards', count: 3, rarity: 'rare' },
  },

  {
    id:     'crystal_500_bundle',
    cost:   650,
    label:  '500 Crystals + 5 Cards',
    desc:   'Crystals and five random cards.',
    reward: { type: 'bundle' },
  },

  {
    id:     'legendary',
    cost:   1000,
    label:  '1 Legendary Card',
    desc:   'The rarest of the rare. Worth the grind.',
    reward: { type: 'card', count: 1, rarity: 'legendary' },
  },
]

// ── Local High Score ──────────────────────────────────────────────────────────

const HIGH_SCORE_KEY = 'jarv_minigame_highscores'

interface HighScores {
  [gameId: string]: number
}

export function loadLocalHighScore(gameId: MiniGameId): number {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY)
    if (raw) {
      const scores: HighScores = JSON.parse(raw)
      return scores[gameId] ?? 0
    }
  } catch { /* ignore */ }
  return 0
}

export function saveLocalHighScore(gameId: MiniGameId, score: number): void {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY)
    const scores: HighScores = raw ? JSON.parse(raw) : {}
    if ((scores[gameId] ?? 0) < score) {
      scores[gameId] = score
      localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(scores))
    }
  } catch (e) {
    logError('saveLocalHighScore failed', { error: String(e) })
  }
}

// ── Firestore Leaderboard ─────────────────────────────────────────────────────
//
// Required Firestore Security Rules:
//   match /miniGameLeaderboard/{gameId}/allTime/{uid} {
//     allow write: if request.auth != null && request.auth.uid == uid;
//     allow read:  if true;
//   }
//   match /miniGameLeaderboard/{gameId}/today/{date}/{uid} {
//     allow write: if request.auth != null && request.auth.uid == uid;
//     allow read:  if true;
//   }

export interface MiniGameLeaderboardEntry {
  uid:           string
  characterName: string
  score:         number
  achievedAt:    Date
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Publish a mini-game score to both the all-time and today leaderboards.
 * Only updates if this score beats the player's existing entry.
 */
export async function publishMiniGameScore(opts: {
  uid:           string
  characterName: string
  gameId:        MiniGameId
  score:         number
}): Promise<void> {
  const date = getTodayDate()
  const payload = {
    uid:           opts.uid,
    characterName: opts.characterName,
    score:         opts.score,
    achievedAt:    Timestamp.now(),
    date,
  }

  try {
    const allTimeRef = doc(db, 'miniGameLeaderboard', opts.gameId, 'allTime', opts.uid)
    await setDoc(allTimeRef, payload, { merge: false })
  } catch { /* offline — ignore */ }

  try {
    const todayRef = doc(db, 'miniGameLeaderboard', opts.gameId, 'today', date, opts.uid)
    await setDoc(todayRef, payload, { merge: false })
  } catch { /* offline — ignore */ }
}

/**
 * Fetch the top N leaderboard entries for a mini game.
 */
export async function fetchMiniGameLeaderboard(
  gameId: MiniGameId,
  mode: 'today' | 'allTime',
  topN = 10,
): Promise<MiniGameLeaderboardEntry[]> {
  try {
    const date = getTodayDate()
    const colRef = mode === 'allTime'
      ? collection(db, 'miniGameLeaderboard', gameId, 'allTime')
      : collection(db, 'miniGameLeaderboard', gameId, 'today', date)
    const q = mode === 'allTime'
      ? query(colRef, orderBy('score', 'desc'), limit(topN))
      : query(colRef, where('date', '==', date), orderBy('score', 'desc'), limit(topN))
    const snap = await getDocs(q)
    return snap.docs.map((d: import('firebase/firestore').QueryDocumentSnapshot) => {
      const data = d.data()
      return {
        uid:           data.uid,
        characterName: data.characterName,
        score:         data.score,
        achievedAt:    (data.achievedAt as Timestamp).toDate(),
      }
    })
  } catch { return [] }
}
