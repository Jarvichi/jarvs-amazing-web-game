import { logError } from '../../logger'

const KEY = 'jarv_hub_friendship'

// xp needed to reach levels 1-4 (mirrored below zero for negative/"hated" levels).
const XP_THRESHOLDS = [0, 10, 25, 50, 100]

/** Max level reachable in either direction (length of the threshold ladder). */
export const MAX_FRIENDSHIP_LEVEL = XP_THRESHOLDS.length

export interface FriendshipEntry {
  level: number
  xp: number
}

function load(): Record<string, FriendshipEntry> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, FriendshipEntry>) : {}
  } catch {
    return {}
  }
}

function save(data: Record<string, FriendshipEntry>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch (e) {
    logError('friendship save failed', { error: String(e) })
  }
}

export function getFriendshipData(): Record<string, FriendshipEntry> {
  return load()
}

export function getFriendshipLevel(npcId: string): number {
  return load()[npcId]?.level ?? 0
}

/** Recompute a (possibly negative) level from a total xp value. */
function levelForXp(xp: number): number {
  const sign = xp < 0 ? -1 : 1
  const abs = Math.abs(xp)
  let level = 0
  while (level < XP_THRESHOLDS.length && abs >= XP_THRESHOLDS[level]) {
    level += 1
  }
  return sign * level
}

/**
 * Add (or subtract) XP to an NPC's friendship and recompute its level from
 * scratch — so a negative delta can lower the level (or push it negative,
 * representing a "hated" standing), not just fail to raise it. Returns the
 * new level.
 */
export function addFriendshipXp(npcId: string, xp: number): number {
  const data = load()
  const entry = data[npcId] ?? { level: 0, xp: 0 }
  entry.xp += xp
  entry.level = levelForXp(entry.xp)
  data[npcId] = entry
  save(data)
  return entry.level
}
