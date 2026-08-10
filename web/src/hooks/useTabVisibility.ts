import { useEffect, useRef, useState, type RefObject } from 'react'
import { journal, flushResumeJournal } from '../utils/resumeJournal'
import { getGlStats } from '../utils/pixiTelemetry'
import rollbar from '../rollbar'
import { VISIBILITY_BREADCRUMB_THRESHOLD_MS, type Screen } from '../app/screens'

interface UseTabVisibilityArgs {
  screenRef:             RefObject<Screen>
  currentLocationKeyRef: RefObject<string>
}

/**
 * Tracks page visibility so the game loop can pause when the tab is hidden, and
 * emits the "returned from background" breadcrumb used to correlate blank-screen
 * reports against how long the tab sat backgrounded.
 *
 * Reads the current screen/location through refs rather than props so the
 * listener is attached once at mount and never re-bound on navigation.
 */
export function useTabVisibility({ screenRef, currentLocationKeyRef }: UseTabVisibilityArgs): boolean {
  const [isTabHidden, setIsTabHidden] = useState(() => document.hidden)
  const hiddenAtRef = useRef<number | null>(null)  // timestamp the tab was last hidden, for the visibility breadcrumb

  useEffect(() => {
    function handleVisibility() {
      const hidden = document.hidden
      setIsTabHidden(hidden)
      if (hidden) {
        hiddenAtRef.current = Date.now()
        journal('hidden', { screen: screenRef.current }, { coalesce: true })
        return
      }
      // Breadcrumb for any "blank screen after being away" report — logged on
      // every meaningful return from background, not just when something goes
      // wrong, so a later crash/error report can be correlated against how
      // long the tab sat backgrounded and what screen it resumed on.
      const hiddenMs = hiddenAtRef.current != null ? Date.now() - hiddenAtRef.current : null
      hiddenAtRef.current = null
      if (hiddenMs != null && hiddenMs >= VISIBILITY_BREADCRUMB_THRESHOLD_MS) {
        rollbar?.info('[visibility] tab resumed after background', {
          hiddenMs,
          screen: screenRef.current,
          location: currentLocationKeyRef.current,
          ...getGlStats(),
        })
        journal('visible', { hiddenMs, screen: screenRef.current })
        // Deliver anything journaled while backgrounded (context losses,
        // deferred rebuilds) now that the network is reliable again.
        flushResumeJournal('resume')
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return isTabHidden
}
