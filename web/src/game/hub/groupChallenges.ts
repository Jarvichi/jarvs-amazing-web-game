// ─── Group daily challenges ───────────────────────────────────────────────────
//
// Tracks a shared "how many distinct members have you completed today" count
// for a named group (e.g. `stokeFlame`'s optional groupId — light every
// brazier in a courtyard before the day ends). Same lazy-date-expiry idiom as
// flames.ts/digs.ts: a stale date is treated as "nothing done today" on read,
// with no explicit reset needed — so if the group isn't finished before the
// day rolls over, the count (and, independently, each member's own daily
// state — see flames.ts) simply starts fresh next time.

const KEY = 'jarv_hub_group_challenges'

interface GroupEntry { date: string; memberIds: string[] }
type GroupStore = Record<string, GroupEntry>

function load(): GroupStore {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as GroupStore) : {}
  } catch {
    return {}
  }
}

function save(store: GroupStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch { /* ignore */ }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Distinct member ids recorded for this group today (empty if none yet, or the last recorded day wasn't today). */
export function getGroupProgressToday(groupId: string): string[] {
  const entry = load()[groupId]
  return entry && entry.date === todayKey() ? entry.memberIds : []
}

/** Records `memberId` as done for `groupId` today, returning the resulting (deduped) member list. */
export function recordGroupMember(groupId: string, memberId: string): string[] {
  const store = load()
  const prev = store[groupId]
  const memberIds = prev && prev.date === todayKey() ? [...prev.memberIds] : []
  if (!memberIds.includes(memberId)) memberIds.push(memberId)
  store[groupId] = { date: todayKey(), memberIds }
  save(store)
  return memberIds
}
