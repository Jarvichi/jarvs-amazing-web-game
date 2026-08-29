// Index of every Firestore document written for a player, so account deletion
// (#2090) can find them all.
//
// Most player data is addressable straight from the uid — `saves/{uid}`,
// `endlessLeaderboard/{uid}`. Leaderboards partitioned by date are not:
// `dailyLeaderboard/{date}/entries/{uid}` needs every date the player ever
// played, and a client cannot enumerate those. Rather than sweep server-side
// (a Cloud Function, which needs the Blaze plan), each such write appends its
// own path here and deletion reads the list back.
//
// Required Firestore rule:
//   match /userIndex/{userId} {
//     allow read, write, delete: if request.auth != null
//                                && request.auth.uid == userId;
//   }
//
// Paths written before this shipped are not in the index and cannot be
// reached — the delete flow's copy says so rather than implying a total wipe.

import { doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../firebase'
import { logError } from '../logger'

const COLLECTION = 'userIndex'

/**
 * Record that `path` holds data for `uid`.
 *
 * Fire-and-forget: a leaderboard submit must not fail because the index write
 * did, so this never throws. It does log — a silently missing index entry is
 * data that survives a deletion request, which is exactly what the store
 * requirement is about, so it is not a "fire-and-forget analytics ping" that
 * the error-logging standard lets us swallow.
 */
export async function recordUserDoc(uid: string, path: string): Promise<void> {
  if (!uid || !path) return
  try {
    await setDoc(
      doc(db, COLLECTION, uid),
      { paths: arrayUnion(path) },
      { merge: true },
    )
  } catch (err) {
    logError('userIndex: failed to record document path', { uid, path, err })
  }
}

/**
 * Every recorded path for `uid`, or an empty array when the player has no
 * index document (nothing date-partitioned was ever written for them).
 */
export async function readUserDocs(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, COLLECTION, uid))
  if (!snap.exists()) return []
  const paths = (snap.data() as { paths?: unknown }).paths
  return Array.isArray(paths) ? paths.filter((p): p is string => typeof p === 'string') : []
}
