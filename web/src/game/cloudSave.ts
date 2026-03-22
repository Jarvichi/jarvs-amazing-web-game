import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

// Required Firestore Security Rules:
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /saves/{userId} {
//         allow read, write: if request.auth != null && request.auth.uid == userId;
//       }
//     }
//   }

// Keys that are device-specific and should not be synced to the cloud.
const SKIP_KEYS = new Set(['jarv_battle_state', 'jarv_player_id'])

const LAST_SYNC_KEY = 'jarv_last_cloud_sync'

export interface CloudSave {
  data: Record<string, string>
  savedAt: Timestamp
}

export function getLastSyncTime(): Date | null {
  try {
    const val = localStorage.getItem(LAST_SYNC_KEY)
    return val ? new Date(val) : null
  } catch { return null }
}

function setLastSyncTime(): void {
  try { localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()) } catch { /* ignore */ }
}

export async function uploadSave(uid: string): Promise<void> {
  const data: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('jarv') && !SKIP_KEYS.has(key)) {
        data[key] = localStorage.getItem(key) ?? ''
      }
    }
  } catch { return }
  await setDoc(doc(db, 'saves', uid), { data, savedAt: Timestamp.now() })
  setLastSyncTime()
}

export async function downloadSave(uid: string): Promise<CloudSave | null> {
  const snap = await getDoc(doc(db, 'saves', uid))
  if (!snap.exists()) return null
  return snap.data() as CloudSave
}

export function applySave(data: Record<string, string>): void {
  try {
    for (const [key, val] of Object.entries(data)) {
      localStorage.setItem(key, val)
    }
    setLastSyncTime()
  } catch { /* ignore */ }
}

/**
 * Fetches the remote save and returns it only if it is newer than the local
 * last-sync timestamp (with a 60-second tolerance to avoid false positives
 * immediately after our own upload). Returns null if up-to-date or on error.
 */
export async function getRemoteSaveIfNewer(uid: string): Promise<CloudSave | null> {
  const remote = await downloadSave(uid)
  if (!remote) return null
  const localSync = getLastSyncTime()
  const remoteDate = remote.savedAt.toDate()
  const cutoff = localSync ? new Date(localSync.getTime() + 60_000) : new Date(0)
  return remoteDate > cutoff ? remote : null
}
