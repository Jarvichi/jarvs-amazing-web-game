const KEY = 'jarv_hub_friendship'

const XP_THRESHOLDS = [0, 10, 25, 50, 100]  // xp needed to reach levels 1-4

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
  } catch { /* ignore */ }
}

export function getFriendshipData(): Record<string, FriendshipEntry> {
  return load()
}

export function getFriendshipLevel(npcId: string): number {
  return load()[npcId]?.level ?? 0
}

/** Add XP to an NPC's friendship. Returns the new level. */
export function addFriendshipXp(npcId: string, xp: number): number {
  const data = load()
  const entry = data[npcId] ?? { level: 0, xp: 0 }
  entry.xp += xp
  while (entry.level < XP_THRESHOLDS.length && entry.xp >= XP_THRESHOLDS[entry.level]) {
    entry.level += 1
  }
  data[npcId] = entry
  save(data)
  return entry.level
}
