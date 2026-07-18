// ─── Town Access ────────────────────────────────────────────────────────────
// Admin-controlled gate on which hub-world towns are reachable by regular
// players. Ravenwatch and Millhaven are always open. Every other town is
// locked until the admin explicitly enables it here; the admin account
// itself is never restricted.
//
// Firestore rules required (see firestore.rules):
//   match /globalState/townAccess {
//     allow read: if true;
//     allow write: if request.auth.uid == "pAB2tLH049PCOI73cQpFlisKpDw1";
//   }

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { logError } from '../logger'

const TOWN_ACCESS_DOC = doc(db, 'globalState', 'townAccess')
const LOCAL_KEY = 'jarv_town_access_cache'

/** Location ids reachable by every player regardless of the admin setting. */
export const ALWAYS_OPEN_LOCATION_IDS: readonly string[] = ['ravenwatch', 'millhaven']

/** Every other town, in world-map order, for the admin toggle screen. */
export const TOGGLEABLE_LOCATIONS: readonly { id: string; label: string }[] = [
  { id: 'ironhold-keep',      label: 'Ironhold Keep' },
  { id: 'thornwood-camp',     label: 'Thornwood Camp' },
  { id: 'gravemoor',          label: 'Gravemoor' },
  { id: 'hollowmere',         label: 'Hollowmere' },
  { id: 'dreadspire-citadel', label: 'Dreadspire Citadel' },
  { id: 'appleford',          label: 'Appleford' },
  { id: 'saltmere-port',      label: 'Saltmere Port' },
  { id: 'harrowfield',        label: 'Harrowfield' },
  { id: 'capital-city',       label: 'Crownhaven' },
  { id: 'royal-palace',       label: 'Royal Palace' },
  { id: 'gearford',           label: 'Gearford' },
]

function loadLocalCache(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) as string[] : []
  } catch {
    return []
  }
}

function saveLocalCache(ids: string[]): void {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
}

/**
 * Fetch the admin-enabled town id list. Falls back to the last-known local
 * cache on error, and to an empty list (locked) if nothing has ever loaded —
 * towns stay locked until the admin turns them on.
 */
export async function fetchEnabledTownIds(): Promise<string[]> {
  try {
    const snap = await getDoc(TOWN_ACCESS_DOC)
    if (snap.exists()) {
      const ids = (snap.data().enabled as string[] | undefined) ?? []
      saveLocalCache(ids)
      return ids
    }
    return loadLocalCache()
  } catch (e) {
    logError('fetchEnabledTownIds failed, using local cache', { error: String(e) })
    return loadLocalCache()
  }
}

/** Admin-only: persist the enabled-town list. Firestore rules reject non-admin writes. */
export async function saveEnabledTownIds(ids: string[]): Promise<void> {
  await setDoc(TOWN_ACCESS_DOC, { enabled: ids })
  saveLocalCache(ids)
}

/** True if `locationId` should be reachable right now for this player. */
export function isTownAccessible(locationId: string, enabledTownIds: Set<string>, isAdmin: boolean): boolean {
  if (isAdmin) return true
  if (ALWAYS_OPEN_LOCATION_IDS.includes(locationId)) return true
  return enabledTownIds.has(locationId)
}

// ── Admin "preview as player" toggle ────────────────────────────────────────
// Local-only per-device flag: while on, the admin account's town-access
// bypass is suppressed so they see the fogged world map exactly as a regular
// player would. Doesn't affect anything else admin-only (Settings stays
// reachable so it can be switched back off).

const PREVIEW_AS_PLAYER_KEY = 'jarv_town_access_preview_as_player'

export function loadPreviewAsPlayer(): boolean {
  try { return localStorage.getItem(PREVIEW_AS_PLAYER_KEY) === 'true' } catch { return false }
}

export function savePreviewAsPlayer(value: boolean): void {
  try { localStorage.setItem(PREVIEW_AS_PLAYER_KEY, String(value)) } catch { /* ignore */ }
}
