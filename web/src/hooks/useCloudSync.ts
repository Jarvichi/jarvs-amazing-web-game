import { useState, useRef, useEffect, useCallback } from 'react'
import type { User } from 'firebase/auth'
import { uploadSave, getRemoteSaveIfNewer } from '../game/cloudSave'
import { logWarn } from '../logger'

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

/** Don't re-upload more often than this, however many triggers fire. */
const UPLOAD_THROTTLE_MS = 30 * 1000

/**
 * Throttle for leaving-the-page uploads. Not zero: closing a tab fires
 * visibilitychange→hidden *and* pagehide back to back, and there is no value in
 * writing the same payload twice. Short enough that a genuine background,
 * return, background still saves each time.
 */
const LEAVE_THROTTLE_MS = 2000

/** Periodic auto-upload cadence while the game is open. */
const AUTO_UPLOAD_INTERVAL_MS = 5 * 60 * 1000

/**
 * Keeps the cloud save current and offers to restore a newer one.
 *
 * The restore prompt is deliberately title-screen only — that is the one place
 * it is safe to swap local state out from under the player.
 *
 * Uploads are not. They run wherever the player is, for two reasons that both
 * cost real progress on mobile:
 *
 *  - Uploading only on the title screen meant a player who opened the app,
 *    played a long campaign session and closed the tab from inside a run never
 *    uploaded at all. iOS Safari evicts localStorage after ~7 days without
 *    interaction, so that player has no cloud copy to fall back on.
 *  - Backgrounding is where sessions actually end on a phone, and it is the
 *    last moment we are reliably given before the tab can be killed.
 *
 * So: upload on the way out (hidden/pagehide), and on a timer regardless of
 * screen to cover a hard crash that never fires either event.
 */
export function useCloudSync({ user, screen, flushPlaytimeToStorage }: UseCloudSyncOptions): UseCloudSyncResult {
  const [syncPrompt, setSyncPrompt] = useState<SyncPrompt | null>(null)
  const syncPromptedRef = useRef(false)
  const lastUploadRef = useRef(0)

  // Latest values, read from listeners that are registered once. Without these
  // the effect below would have to re-subscribe on every screen change.
  const uidRef = useRef<string | null>(null)
  uidRef.current = user && !user.isAnonymous ? user.uid : null
  const flushRef = useRef(flushPlaytimeToStorage)
  flushRef.current = flushPlaytimeToStorage

  /**
   * Upload unless we just did. `leaving` shortens the throttle right down for
   * the page-exit case, where this is the last chance we get — it still dedupes
   * the hidden/pagehide pair that a tab close fires.
   */
  const syncNow = useCallback((reason: string, leaving = false): void => {
    const uid = uidRef.current
    if (!uid) return
    if (!navigator.onLine) return
    const now = Date.now()
    if (now - lastUploadRef.current < (leaving ? LEAVE_THROTTLE_MS : UPLOAD_THROTTLE_MS)) return
    lastUploadRef.current = now
    flushRef.current()
    uploadSave(uid).catch(err => {
      // Not logError: the local save is intact and the next trigger retries, so
      // the player is not broken — but a player who only ever fails to upload
      // is one device wipe from losing everything, so it must not be silent.
      logWarn('[cloudSync] upload failed', { reason, err: String(err) })
    })
  }, [])

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

  // Upload as the player leaves — backgrounding the app, switching tabs, or
  // closing it. These are the only events iOS reliably delivers before it can
  // kill the page, so they are forced past the throttle. The write is still
  // best-effort: if the tab dies mid-request the next trigger covers it.
  //
  // Both events are needed. pagehide is the one that fires on a real
  // navigation away or tab close; visibilitychange is the one that fires when
  // the player switches apps, which on a phone is how sessions usually end.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') syncNow('visibility-hidden', true)
    }
    const onPageHide = () => syncNow('pagehide', true)
    // `true` here is the `leaving` flag, not `force` — see syncNow.
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [syncNow])

  // Periodic auto-upload, on every screen rather than only the title. Catches
  // the session that ends in a crash or an OS kill with no hidden/pagehide.
  useEffect(() => {
    const id = setInterval(() => syncNow('interval'), AUTO_UPLOAD_INTERVAL_MS)
    return () => clearInterval(id)
  }, [syncNow])

  return { syncPrompt, clearSyncPrompt: () => setSyncPrompt(null) }
}
