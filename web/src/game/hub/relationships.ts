const KEY = 'jarv_hub_relationships'

// Same ladder as friendship (see friendship.ts) — points needed to reach levels 1-4.
const POINT_THRESHOLDS = [0, 10, 25, 50, 100]

export type RelationshipTrack = 'ally' | 'rival' | 'romance'

export const RELATIONSHIP_TRACKS: RelationshipTrack[] = ['ally', 'rival', 'romance']

export interface RelationshipEntry {
  /** Dominant track — the one with the most points (null until any points earned). */
  track: RelationshipTrack | null
  /** 0-4, derived from the dominant track's point total. */
  level: number
  /** Accumulated points per track. */
  points: Record<RelationshipTrack, number>
}

type RelationshipStore = Record<string, RelationshipEntry>

function emptyEntry(): RelationshipEntry {
  return { track: null, level: 0, points: { ally: 0, rival: 0, romance: 0 } }
}

function load(): RelationshipStore {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as RelationshipStore) : {}
  } catch {
    return {}
  }
}

function save(store: RelationshipStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch { /* ignore */ }
}

function levelForPoints(points: number): number {
  let level = 0
  while (level < POINT_THRESHOLDS.length && points >= POINT_THRESHOLDS[level]) {
    level += 1
  }
  return level
}

/** Recompute the dominant track + level from the per-track point totals. */
function recompute(entry: RelationshipEntry): RelationshipEntry {
  let dominant: RelationshipTrack | null = entry.track
  let best = dominant ? entry.points[dominant] : 0
  for (const track of RELATIONSHIP_TRACKS) {
    // Strictly greater so ties keep the current dominant track (stable steering).
    if (entry.points[track] > best) {
      best = entry.points[track]
      dominant = track
    }
  }
  entry.track = best > 0 ? dominant : null
  entry.level = entry.track ? levelForPoints(entry.points[entry.track]) : 0
  return entry
}

/** Max level reachable (length of the threshold ladder). */
export const MAX_RELATIONSHIP_LEVEL = POINT_THRESHOLDS.length

/**
 * Progress of the dominant track toward the next level. `nextThreshold` is null
 * once the max level is reached. Pure — safe to call from view components.
 */
export function relationshipProgress(
  entry: RelationshipEntry,
): { points: number; nextThreshold: number | null } {
  const points = entry.track ? entry.points[entry.track] : 0
  const nextThreshold = POINT_THRESHOLDS[entry.level] ?? null
  return { points, nextThreshold }
}

export function getRelationshipData(): Record<string, RelationshipEntry> {
  return load()
}

export function getRelationship(npcId: string): RelationshipEntry {
  return load()[npcId] ?? emptyEntry()
}

export function getRelationshipTrack(npcId: string): RelationshipTrack | null {
  return load()[npcId]?.track ?? null
}

export function getRelationshipLevel(npcId: string): number {
  return load()[npcId]?.level ?? 0
}

/**
 * Add points to one of an NPC's relationship tracks, recompute the dominant
 * track + level, and persist. Returns the updated entry.
 */
export function addRelationshipPoints(
  npcId: string,
  track: RelationshipTrack,
  points: number,
): RelationshipEntry {
  const store = load()
  const entry = store[npcId] ?? emptyEntry()
  entry.points[track] = (entry.points[track] ?? 0) + points
  recompute(entry)
  store[npcId] = entry
  save(store)
  return entry
}
