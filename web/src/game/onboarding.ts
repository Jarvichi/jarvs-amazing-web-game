// ─── First-battle onboarding flag (#2305) ──────────────────────────────────
// A brand-new player shouldn't see the daily-reward/gift modals before they
// know what crystals, packs or consumables even are. Gate those on this flag
// instead, set the moment any battle (win, loss or draw) ends.

import { getAllClearedNodeIds } from './world/worldState'

const FIRST_BATTLE_KEY = 'jarv_first_battle_done'

// Keys only ever written by code paths downstream of an actual battle —
// used to backfill the flag for profiles that predate it, so returning
// players aren't newly gated behind a flag they never had.
const LEGACY_SIGNAL_KEYS = ['jarv_win_streak', 'jarvs_handicap']

function hasLegacyPlaySignal(): boolean {
  try {
    if (LEGACY_SIGNAL_KEYS.some(k => localStorage.getItem(k) !== null)) return true
    return getAllClearedNodeIds().length > 0
  } catch {
    return false
  }
}

export function hasPlayedFirstBattle(): boolean {
  try {
    if (localStorage.getItem(FIRST_BATTLE_KEY) === 'true') return true
    if (hasLegacyPlaySignal()) {
      localStorage.setItem(FIRST_BATTLE_KEY, 'true')
      return true
    }
    return false
  } catch {
    return false
  }
}

export function markFirstBattlePlayed(): void {
  try { localStorage.setItem(FIRST_BATTLE_KEY, 'true') } catch { /* ignore */ }
}

// ─── Progressive menu disclosure (#2307) ───────────────────────────────────
// A new player sees a 16-destination menu on turn one. Reveal thresholds
// below are keyed on battles played and days active; both are backfilled to
// a large baseline for profiles with a legacy play signal, so a returning
// player never has a destination they already use disappear.

const BATTLES_PLAYED_KEY = 'jarv_battles_played'
const ESTABLISHED_BASELINE = 999

export function getBattlesPlayed(): number {
  try {
    const raw = localStorage.getItem(BATTLES_PLAYED_KEY)
    if (raw !== null) return Math.max(0, parseInt(raw, 10) || 0)
    const backfill = hasLegacyPlaySignal() ? ESTABLISHED_BASELINE : 0
    localStorage.setItem(BATTLES_PLAYED_KEY, String(backfill))
    return backfill
  } catch {
    return 0
  }
}

export function incrementBattlesPlayed(): number {
  const next = getBattlesPlayed() + 1
  try { localStorage.setItem(BATTLES_PLAYED_KEY, String(next)) } catch { /* ignore */ }
  return next
}

const FIRST_LAUNCH_KEY = 'jarv_first_launch_date'
const DAY_MS = 24 * 60 * 60 * 1000

function utcDayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY_MS)
}

/** 1 on the calendar day of first launch, 2 the next calendar day, etc. */
export function getDaysActive(): number {
  try {
    const now = new Date()
    let raw = localStorage.getItem(FIRST_LAUNCH_KEY)
    if (raw === null) {
      const backdateDays = hasLegacyPlaySignal() ? ESTABLISHED_BASELINE : 0
      raw = new Date(now.getTime() - backdateDays * DAY_MS).toISOString()
      localStorage.setItem(FIRST_LAUNCH_KEY, raw)
    }
    return utcDayNumber(now) - utcDayNumber(new Date(raw)) + 1
  } catch {
    return 1
  }
}
