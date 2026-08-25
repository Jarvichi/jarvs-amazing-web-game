// ─── Chronicle community vote tally ──────────────────────────────────────────
//
// Season 2 decisions are personal (see docs/chronicle-s2.md §2) — each player's
// choice only branches their own copy of the story. This module adds the
// optional community layer on top: a shared per-chapter tally showing how the
// rest of the Dominion answered the same question.
//
// Mirrors the Fruit Machine jackpot's shared-Firestore pattern
// (fruitMachineJackpot.ts): a single document per chapter, incremented
// atomically and fire-and-forget, with every read tolerant of failure.
//
// Firestore rules required (see firestore.rules):
//   match /chronicleVotes/{chapterId} {
//     allow read: if true;
//     allow write: if request.auth != null;
//   }
//
// Document schema — one numeric field per decision option id:
//   { "vigil": 128, "accord": 94, "unbinding": 203 }

import { doc, getDoc, setDoc, increment, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { logError } from '../logger'

/** Option id -> number of players who chose it. */
export type ChronicleTally = Record<string, number>

const VOTES_COLLECTION = 'chronicleVotes'

function voteDoc(chapterId: string) {
  return doc(db, VOTES_COLLECTION, chapterId)
}

/**
 * Records one vote for `optionId` on `chapterId`. Fire-and-forget: a failure
 * here must never block the player's decision, which is already saved locally.
 *
 * Call this only when the decision is newly made — `recordChronicleDecision`
 * is first-pick-final, so a re-click must not inflate the tally.
 */
export function castChronicleVote(chapterId: string, optionId: string): void {
  setDoc(
    voteDoc(chapterId),
    { [optionId]: increment(1), updatedAt: Timestamp.now() },
    { merge: true },
  ).catch(e => logError('chronicle vote failed', { error: String(e), chapterId, optionId }))
}

/**
 * Reads the live tally for a chapter, throwing if Firestore is unreachable.
 * An absent document is not an error — it means nobody has voted yet, and
 * returns an empty tally.
 *
 * Prefer this wherever "Firestore is down" and "nobody voted" must not be
 * confused: an empty tally read from a failed request looks exactly like a
 * real unanimous zero, and anything deciding story canon off the result would
 * act on data that doesn't exist.
 */
export async function fetchChronicleTallyStrict(chapterId: string): Promise<ChronicleTally> {
  const snap = await getDoc(voteDoc(chapterId))
  if (!snap.exists()) return {}
  const tally: ChronicleTally = {}
  for (const [key, value] of Object.entries(snap.data())) {
    if (typeof value === 'number') tally[key] = value
  }
  return tally
}

/**
 * Forgiving read for UI: an absent document *or* an unreachable Firestore both
 * come back as an empty tally, which renders as "no data". The player's own
 * choice is already saved locally, so a failed tally read is cosmetic.
 */
export async function fetchChronicleTally(chapterId: string): Promise<ChronicleTally> {
  try {
    return await fetchChronicleTallyStrict(chapterId)
  } catch {
    return {}
  }
}

/** Total votes cast across every option. */
export function totalVotes(tally: ChronicleTally): number {
  return Object.values(tally).reduce((sum, n) => sum + n, 0)
}

/**
 * Share of the vote for one option, 0–1. Returns null when nothing has been
 * counted yet, so the UI can distinguish "0%" from "no data".
 */
export function voteShare(tally: ChronicleTally, optionId: string): number | null {
  const total = totalVotes(tally)
  if (total <= 0) return null
  return (tally[optionId] ?? 0) / total
}

/**
 * The option id with the most votes, or null on a tie / no votes. This is what
 * the between-drops authoring workflow reads to decide how the next chapter's
 * canon reacts (docs/chronicle-s2.md §6).
 */
export function leadingOption(tally: ChronicleTally): string | null {
  const entries = Object.entries(tally)
  if (entries.length === 0) return null
  const max = Math.max(...entries.map(([, n]) => n))
  if (max <= 0) return null
  const leaders = entries.filter(([, n]) => n === max)
  return leaders.length === 1 ? leaders[0][0] : null
}
