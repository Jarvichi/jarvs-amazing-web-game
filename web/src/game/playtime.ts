// ─── Playtime Tracking ───────────────────────────────────────────────────────
//
// Tracks two independent counters (in milliseconds):
//   totalMs   — time spent anywhere in the game (any screen)
//   battleMs  — time spent in active battles ('playing' screen)
//
// Both are stored in localStorage and never reset unless the player wipes their
// save. The addPlaytime() function also fires achievement progress checks and
// returns any newly-unlocked AchievementDefs so the caller can surface toasts.

import { incrementAchievementProgress, AchievementDef } from './achievements'
import { logError } from '../logger'

const TOTAL_KEY  = 'jarv_playtime_total_ms'
const BATTLE_KEY = 'jarv_playtime_battle_ms'

export interface PlaytimeStats {
  totalMs:  number
  battleMs: number
}

export function loadPlaytime(): PlaytimeStats {
  try {
    const totalMs  = parseInt(localStorage.getItem(TOTAL_KEY)  ?? '0', 10) || 0
    const battleMs = parseInt(localStorage.getItem(BATTLE_KEY) ?? '0', 10) || 0
    return { totalMs, battleMs }
  } catch {
    return { totalMs: 0, battleMs: 0 }
  }
}

/**
 * Add elapsed milliseconds to the stored playtime totals, check for newly
 * unlocked achievements, and return any that were just unlocked.
 */
export function addPlaytime(totalDelta: number, battleDelta: number): AchievementDef[] {
  if (totalDelta <= 0 && battleDelta <= 0) return []

  const { totalMs, battleMs } = loadPlaytime()
  const newTotal  = totalMs  + totalDelta
  const newBattle = battleMs + battleDelta

  try {
    if (totalDelta  > 0) localStorage.setItem(TOTAL_KEY,  String(newTotal))
    if (battleDelta > 0) localStorage.setItem(BATTLE_KEY, String(newBattle))
  } catch (e) {
    logError('playtime: failed to save', { e })
  }

  const unlocked: AchievementDef[] = []
  if (totalDelta  > 0) unlocked.push(...incrementAchievementProgress('playtime:total',  totalDelta))
  if (battleDelta > 0) unlocked.push(...incrementAchievementProgress('playtime:battle', battleDelta))
  return unlocked
}

/**
 * Write playtime values directly to localStorage.
 * Use this to flush in-memory session deltas before a cloud save upload
 * so the upload captures the current session's time.
 */
export function savePlaytime(stats: PlaytimeStats): void {
  try {
    localStorage.setItem(TOTAL_KEY,  String(stats.totalMs))
    localStorage.setItem(BATTLE_KEY, String(stats.battleMs))
  } catch (e) {
    logError('playtime: savePlaytime failed', { e })
  }
}

/** Format a millisecond duration as "Xh Ym", "Ym", or "< 1m". */
export function formatPlaytime(ms: number): string {
  const totalMins = Math.floor(ms / 60_000)
  if (totalMins < 1) return '< 1m'
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
