// ─── Player Name Uniqueness ────────────────────────────────────────────────
//
// When a player sets their name, we check Firestore to ensure it isn't already
// claimed.  Registered (non-anonymous) users can displace an anonymous holder,
// mirroring the rule that creating an account wins the name.
//
// Required Firestore Security Rules:
//   match /playerNames/{nameKey} {
//     allow read:  if true;
//     allow write: if request.auth != null;
//   }

import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { logError } from '../logger'

export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: 'taken' }

/**
 * Attempt to claim `displayName` for `uid` in the `playerNames` collection.
 *
 * Rules:
 *  - Free name                                          → claim it
 *  - Same uid re-saving                                 → update record
 *  - Existing holder is anonymous + caller is registered → registered wins
 *  - Any other conflict                                  → name is taken
 *
 * On network failure the function returns { ok: true } so gameplay is never
 * blocked by a transient connectivity issue.
 */
export async function claimPlayerName(
  uid: string,
  isAnonymous: boolean,
  displayName: string,
): Promise<ClaimResult> {
  const nameKey = displayName.toLowerCase().trim()
  if (!nameKey) return { ok: true }

  try {
    const ref  = doc(db, 'playerNames', nameKey)
    const snap = await getDoc(ref)

    if (snap.exists()) {
      const data = snap.data() as { uid: string; isAnonymous: boolean }

      // Same user — update timestamp / casing and continue.
      if (data.uid === uid) {
        await setDoc(ref, { uid, isAnonymous, displayName, claimedAt: Timestamp.now() })
        console.info('[playerName] name re-claimed by same user', { uid, nameKey })
        return { ok: true }
      }

      // A registered user can displace an anonymous holder.
      if (data.isAnonymous && !isAnonymous) {
        await setDoc(ref, { uid, isAnonymous, displayName, claimedAt: Timestamp.now() })
        console.info('[playerName] registered user displaced anonymous holder', { uid, nameKey })
        return { ok: true }
      }

      // Name is taken by a different (or equally-privileged) user.
      return { ok: false, reason: 'taken' }
    }

    // Name is free — claim it.
    await setDoc(ref, { uid, isAnonymous, displayName, claimedAt: Timestamp.now() })
    console.info('[playerName] name allocated', { uid, isAnonymous, nameKey })
    return { ok: true }
  } catch (e) {
    // On network / permission errors allow the local save so gameplay isn't blocked.
    logError('claimPlayerName failed', { error: String(e), nameKey, uid })
    return { ok: true }
  }
}
