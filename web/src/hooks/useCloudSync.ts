import { useState, useRef, useEffect } from 'react'
import type { User } from 'firebase/auth'
import { uploadSave, getRemoteSaveIfNewer } from '../game/cloudSave'

interface SyncPrompt {
  remoteDate: Date
  data: Record<string, string>
}

interface UseCloudSyncOptions {
  user: User | null
  screen: string
  flushPlaytimeToStorage: () => void
}

interface UseCloudSyncResult {
  syncPrompt: SyncPrompt | null
  clearSyncPrompt: () => void
}

/**
 * Checks for a newer remote save whenever the player lands on the title screen
 * and surfaces a prompt if one is found. Also runs a periodic auto-upload every
 * 5 minutes while the player is on the title screen.
 */
export function useCloudSync({ user, screen, flushPlaytimeToStorage }: UseCloudSyncOptions): UseCloudSyncResult {
  const [syncPrompt, setSyncPrompt] = useState<SyncPrompt | null>(null)
  const syncPromptedRef = useRef(false)

  // On arriving at the title screen, check if the remote save is newer and prompt the user.
  // Reset the prompted flag whenever we leave the title so re-visiting prompts again if needed.
  useEffect(() => {
    if (screen !== 'title') { syncPromptedRef.current = false; return }
    const uid = user?.uid
    if (!uid || user?.isAnonymous) return
    if (syncPromptedRef.current) return
    if (!navigator.onLine) return
    syncPromptedRef.current = true
    getRemoteSaveIfNewer(uid).then(remote => {
      if (remote) setSyncPrompt({ remoteDate: remote.savedAt.toDate(), data: remote.data })
    }).catch(() => { /* offline or error — silently skip */ })
  }, [screen, user])

  // Periodic auto-sync: upload local save every 5 minutes while on the title screen and online.
  useEffect(() => {
    if (screen !== 'title') return
    const uid = user?.uid
    if (!uid || user?.isAnonymous) return
    const id = setInterval(() => {
      if (!navigator.onLine) return
      flushPlaytimeToStorage()
      uploadSave(uid).catch(() => { /* silent */ })
    }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [screen, user, flushPlaytimeToStorage])

  return { syncPrompt, clearSyncPrompt: () => setSyncPrompt(null) }
}
