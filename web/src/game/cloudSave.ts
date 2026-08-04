import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

// Firestore security rules live in `firestore.rules` at the repo root — the
// single source of truth, deployed by the deploy-firebase CI job. This file
// previously carried a partial copy that had drifted out of date.

// Keys that are device-specific and should not be synced to the cloud.
const SKIP_KEYS = new Set(['jarv_battle_state', 'jarv_player_id'])

const LAST_SYNC_KEY = 'jarv_last_cloud_sync'
const PLAYER_ID_KEY = 'jarv_player_id'

function getDeviceId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY)
  if (!id) {
    id = `player-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    localStorage.setItem(PLAYER_ID_KEY, id)
  }
  return id
}

export interface CloudSave {
  data: Record<string, string>
  savedAt: Timestamp
  deviceId?: string
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
  await setDoc(doc(db, 'saves', uid), { data, savedAt: Timestamp.now(), deviceId: getDeviceId() })
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
  // If the save was uploaded from this same device, always use local state.
  if (remote.deviceId && remote.deviceId === getDeviceId()) return null
  const localSync = getLastSyncTime()
  const remoteDate = remote.savedAt.toDate()
  const cutoff = localSync ? new Date(localSync.getTime() + 60_000) : new Date(0)
  return remoteDate > cutoff ? remote : null
}
