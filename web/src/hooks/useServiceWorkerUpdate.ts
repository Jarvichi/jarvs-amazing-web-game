import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { journal } from '../utils/resumeJournal'
import rollbar from '../rollbar'
import type { Screen } from '../app/screens'

interface UseServiceWorkerUpdateResult {
  /** True once a new service worker is waiting. Drives the update toast. */
  needRefresh:       boolean
  /** Player dismissed the toast for the rest of this session. */
  updateDismissed:   boolean
  setUpdateDismissed: Dispatch<SetStateAction<boolean>>
  /** Applies the waiting update (posts SKIP_WAITING) — the toast's UPDATE button. */
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  /** Settings' "check for updates": apply if one is waiting, otherwise poll. */
  checkForUpdates:   () => Promise<void>
}

/**
 * PWA update handling in prompt mode.
 *
 * Deliberately does NOT auto-apply: `registerType: 'prompt'` and the absence of
 * skipWaiting/clientsClaim (documented at length in vite.config.ts) exist to stop
 * force-reload-on-resume from black-screening memory-pressured devices. The
 * player reloads on their terms.
 */
export function useServiceWorkerUpdate(screen: Screen): UseServiceWorkerUpdateResult {
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null)
  // Lets the player dismiss the update prompt for the rest of the session.
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, r) {
      swRegRef.current = r ?? null
      // In standalone (home screen) mode the browser doesn't trigger SW update
      // checks on each launch the way a normal tab does, so we kick one off
      // immediately and then repeat every hour.
      if (r) {
        r.update().catch(() => {})
        setInterval(() => r.update().catch(() => {}), 60 * 60 * 1000)
      }
    },
    onNeedRefresh() {
      // Prompt mode: don't auto-apply. Surface the toast (driven by needRefresh)
      // and let the player reload at a safe moment. Auto-reloading here is what
      // black-screened memory-pressured devices on resume.
      journal('sw-update-available')
      rollbar?.info('[sw] update available — awaiting player confirmation')
    },
  })

  // Reload once the new SW takes control. In prompt mode the new SW only
  // activates after the player taps UPDATE (updateServiceWorker posts
  // SKIP_WAITING) — or when another tab accepts the update — so this no longer
  // fires spontaneously on resume. Attached at mount so we never miss the
  // controllerchange event.
  useEffect(() => {
    if (!navigator.serviceWorker) return
    let reloading = false
    const handler = () => {
      if (reloading) return
      reloading = true
      // Journaled (not just logged live) because a live Rollbar event may not
      // have time to send before the reload — the journal entry survives it and
      // is flushed at boot. A reload with no preceding sw-update-accepted this
      // session means another tab accepted the update.
      journal('sw-controllerchange-reload', { visibility: document.visibilityState })
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', handler)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handler)
  }, [])

  // Trigger SW update check whenever the title screen is shown
  useEffect(() => {
    if (screen === 'title') swRegRef.current?.update().catch(() => {})
  }, [screen])

  const checkForUpdates = useCallback(async () => {
    if (needRefresh) {
      updateServiceWorker(true)
    } else {
      await swRegRef.current?.update().catch(() => {})
    }
  }, [needRefresh, updateServiceWorker])

  return { needRefresh, updateDismissed, setUpdateDismissed, updateServiceWorker, checkForUpdates }
}
