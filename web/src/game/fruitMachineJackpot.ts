// Cloud sync for the Fruit Machine Grand jackpot.
// A single shared Firestore document holds the live pot; every spin increments
// it atomically and a transaction serialises wins to prevent two players
// claiming the same pot simultaneously.

import {
  doc, getDoc, setDoc, runTransaction, increment, Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { logError } from '../logger'

const JACKPOT_DOC = doc(db, 'globalState', 'fruitMachineJackpot')
const GRAND_BASE = 500
const LOCAL_KEY = 'fm_grand'

// Required Firestore security rules:
//   match /globalState/fruitMachineJackpot {
//     allow read: if true;
//     allow write: if request.auth != null;
//   }

/** Reads the live jackpot from Firestore; falls back to localStorage on error. */
export async function fetchGrandJackpot(): Promise<number> {
  try {
    const snap = await getDoc(JACKPOT_DOC)
    if (snap.exists()) {
      const val = snap.data().value as number
      try { localStorage.setItem(LOCAL_KEY, String(val)) } catch { /* ignore */ }
      return val
    }
    // Doc doesn't exist yet — seed it with the local value.
    const local = localJackpot()
    await setDoc(JACKPOT_DOC, { value: local, updatedAt: Timestamp.now() })
    return local
  } catch {
    return localJackpot()
  }
}

/** Atomically increments the shared jackpot by 1 per spin (fire-and-forget). */
export function incrementGrandJackpot(): void {
  setDoc(JACKPOT_DOC, { value: increment(1), updatedAt: Timestamp.now() }, { merge: true })
    .catch(e => logError('fm_grand increment', { error: String(e) }))
}

/**
 * Transaction: reads the current pot, resets it to GRAND_BASE, returns the
 * amount the winner receives. Safe against two simultaneous winners.
 */
export async function claimAndResetGrandJackpot(): Promise<number> {
  try {
    const won = await runTransaction(db, async tx => {
      const snap = await tx.get(JACKPOT_DOC)
      const current = snap.exists() ? (snap.data().value as number) : GRAND_BASE
      tx.set(JACKPOT_DOC, { value: GRAND_BASE, updatedAt: Timestamp.now() })
      return current
    })
    try { localStorage.setItem(LOCAL_KEY, String(GRAND_BASE)) } catch { /* ignore */ }
    return won
  } catch (e) {
    logError('fm_grand claim', { error: String(e) })
    // Fall back: award local value and reset locally.
    const local = localJackpot()
    try { localStorage.setItem(LOCAL_KEY, String(GRAND_BASE)) } catch { /* ignore */ }
    return local
  }
}

function localJackpot(): number {
  try { return parseInt(localStorage.getItem(LOCAL_KEY) ?? String(GRAND_BASE), 10) } catch { return GRAND_BASE }
}
