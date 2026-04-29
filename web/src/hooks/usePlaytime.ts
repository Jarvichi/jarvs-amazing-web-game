import { useRef, useCallback, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { addPlaytime, loadPlaytime, savePlaytime } from '../game/playtime'
import type { AchievementDef } from '../game/achievements'

interface UsePlaytimeOptions {
  screen: string
  isTabHidden: boolean
  setAchievementToasts: Dispatch<SetStateAction<AchievementDef[]>>
}

/**
 * Tracks total playtime and in-battle time. Persists to localStorage via
 * addPlaytime/savePlaytime and unlocks any time-based achievements.
 *
 * Returns flushPlaytimeToStorage so callers can force a write before a cloud
 * upload (e.g. at battle end or during auto-sync).
 */
export function usePlaytime({ screen, isTabHidden, setAchievementToasts }: UsePlaytimeOptions) {
  // Both refs are null when no timing segment is active (tab hidden).
  // When active: gameTimerRef = segment start; battleTimerRef = battle start or null.
  const gameTimerRef   = useRef<number | null>(document.hidden ? null : Date.now())
  const battleTimerRef = useRef<number | null>(null)

  /**
   * Flush the current in-memory session playtime to localStorage without
   * changing screen state or firing achievement checks. Resets the ref
   * timers to `now` so the next applyPlaytimeTransition won't double-count.
   * Call this immediately before any uploadSave so the cloud save captures
   * the live session time.
   */
  const flushPlaytimeToStorage = useCallback(() => {
    const now = Date.now()
    const totalDelta  = gameTimerRef.current  !== null ? Math.max(0, now - gameTimerRef.current)  : 0
    const battleDelta = battleTimerRef.current !== null ? Math.max(0, now - battleTimerRef.current) : 0
    if (totalDelta > 0 || battleDelta > 0) {
      if (gameTimerRef.current  !== null) gameTimerRef.current  = now
      if (battleTimerRef.current !== null) battleTimerRef.current = now
      const { totalMs, battleMs } = loadPlaytime()
      savePlaytime({ totalMs: totalMs + totalDelta, battleMs: battleMs + battleDelta })
    }
  }, [])

  // Save whatever has accumulated since the last reset, then apply the new state.
  // newScreen / newHidden describe the *incoming* state (after the transition).
  const applyPlaytimeTransition = useCallback((newScreen: string, newHidden: boolean) => {
    const now = Date.now()

    // Compute deltas from the outgoing segment (whatever was running before).
    const totalDelta  = gameTimerRef.current !== null ? Math.max(0, now - gameTimerRef.current) : 0
    const battleDelta = battleTimerRef.current !== null ? Math.max(0, now - battleTimerRef.current) : 0

    // Set up refs for the incoming state.
    if (newHidden) {
      gameTimerRef.current   = null   // stop all timing while hidden
      battleTimerRef.current = null
    } else {
      gameTimerRef.current   = now
      battleTimerRef.current = newScreen === 'playing' ? now : null
    }

    if (totalDelta <= 0 && battleDelta <= 0) return
    const newlyUnlocked = addPlaytime(totalDelta, battleDelta)
    if (newlyUnlocked.length > 0) setAchievementToasts(prev => [...prev, ...newlyUnlocked])
  }, [setAchievementToasts])

  useEffect(() => {
    applyPlaytimeTransition(screen, isTabHidden)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, isTabHidden])

  // Flush on unmount (best-effort — page may close before this runs).
  useEffect(() => {
    return () => { applyPlaytimeTransition(screen, isTabHidden) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { flushPlaytimeToStorage }
}
