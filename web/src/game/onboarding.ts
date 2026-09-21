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
