// In-app account deletion (#2090).
//
// Apple guideline 5.1.1(v) and the Google Play User Data policy both require
// that an app which lets users create an account also lets them delete it from
// inside the app. LoginModal calls createUserWithEmailAndPassword, so both
// apply.
//
// Order matters: Firestore documents go first, while the user is still
// authenticated and the security rules still recognise them as the owner.
// Once deleteUser resolves there is no auth context left to delete anything
// with, and whatever is still there is orphaned for good.

import {
  EmailAuthProvider, reauthenticateWithCredential, deleteUser, type User,
} from 'firebase/auth'
import { doc, getDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { logError } from '../logger'
import { readUserDocs } from './userIndex'
import { loadPlayerName } from './questline'
import { MINI_GAME_LABELS, type MiniGameId } from './miniGames'

export type DeleteAccountResult =
  | { ok: true; orphanedPaths: number }
  | { ok: false; reason: 'wrong-password' | 'requires-recent-login' | 'failed'; message: string }

/**
 * Split a `a/b/c/d` path into the segments Firestore's `doc()` expects.
 * Paths come from our own writers, so they always have an even segment count.
 */
function docFromPath(path: string) {
  const segments = path.split('/').filter(Boolean)
  return doc(db, segments[0], ...segments.slice(1))
}

/**
 * Delete a document, reporting rather than throwing.
 *
 * One unreachable document must not abort the rest of the sweep — a partial
 * deletion that continues removes more personal data than one that stops at
 * the first offline write. Failures are counted and surfaced so the caller can
 * tell the player their data is not fully gone.
 */
async function tryDelete(path: string): Promise<boolean> {
  try {
    await deleteDoc(docFromPath(path))
    return true
  } catch (err) {
    logError('deleteAccount: failed to delete document', { path, err })
    return false
  }
}

/**
 * Release the player's claim on their display name, but only if the record
 * still points at them. `playerNames` is keyed by the lowercased name, not by
 * uid, and a registered player can displace an anonymous holder
 * (playerName.ts) — so the doc under our name may belong to someone else by
 * now, and deleting it would free a name they currently own.
 */
async function deleteOwnPlayerName(uid: string): Promise<boolean> {
  const nameKey = loadPlayerName().toLowerCase().trim()
  if (!nameKey) return true
  try {
    const ref  = doc(db, 'playerNames', nameKey)
    const snap = await getDoc(ref)
    if (!snap.exists()) return true
    if ((snap.data() as { uid?: string }).uid !== uid) return true
    await deleteDoc(ref)
    return true
  } catch (err) {
    logError('deleteAccount: failed to release player name', { uid, err })
    return false
  }
}

/**
 * Every path we can address directly from the uid, without the index.
 */
function directPaths(uid: string): string[] {
  return [
    `saves/${uid}`,
    `endlessLeaderboard/${uid}`,
    ...(Object.keys(MINI_GAME_LABELS) as MiniGameId[])
      .map(gameId => `miniGameLeaderboard/${gameId}/allTime/${uid}`),
  ]
}

/**
 * Reauthenticate, delete the player's Firestore data, then delete the auth
 * user. Local storage is left to the caller so the UI controls when the page
 * reloads.
 *
 * `orphanedPaths` counts documents that could not be deleted (offline, or a
 * rule refusal). Zero means everything reachable is gone. It is never a
 * guarantee that *all* of the player's rows are gone: leaderboard entries
 * written before the userIndex shipped cannot be located at all.
 */
export async function deleteAccount(user: User, password: string): Promise<DeleteAccountResult> {
  if (user.isAnonymous || !user.email) {
    return { ok: false, reason: 'failed', message: 'No account is signed in.' }
  }

  // Firebase refuses deleteUser without a recent login, so prove it up front —
  // before anything is destroyed, so a wrong password costs nothing.
  try {
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, password),
    )
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return { ok: false, reason: 'wrong-password', message: 'Incorrect password.' }
    }
    if (code === 'auth/requires-recent-login') {
      return {
        ok: false,
        reason: 'requires-recent-login',
        message: 'Please sign out and back in, then try again.',
      }
    }
    logError('deleteAccount: reauthentication failed', { code, err })
    return { ok: false, reason: 'failed', message: 'Could not verify your password. Try again.' }
  }

  const uid = user.uid

  // Indexed paths may not be readable offline; an empty list then means we
  // delete less than we should, so a read failure counts as an orphan rather
  // than passing silently.
  let indexed: string[] = []
  let indexReadFailed = false
  try {
    indexed = await readUserDocs(uid)
  } catch (err) {
    indexReadFailed = true
    logError('deleteAccount: failed to read the deletion index', { uid, err })
  }

  const paths = [...new Set([...indexed, ...directPaths(uid), `userIndex/${uid}`])]
  const results = await Promise.all(paths.map(tryDelete))
  const nameReleased = await deleteOwnPlayerName(uid)

  const orphanedPaths =
    results.filter(ok => !ok).length +
    (nameReleased ? 0 : 1) +
    (indexReadFailed ? 1 : 0)

  try {
    await deleteUser(user)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'auth/requires-recent-login') {
      return {
        ok: false,
        reason: 'requires-recent-login',
        message: 'Please sign out and back in, then try again.',
      }
    }
    logError('deleteAccount: deleteUser failed', { uid, code, err })
    return {
      ok: false,
      reason: 'failed',
      message: 'Your saved data was removed, but the account itself could not be deleted. Please try again.',
    }
  }

  return { ok: true, orphanedPaths }
}
