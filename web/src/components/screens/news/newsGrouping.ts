// Pure helpers behind the What's New screen: which tag chips to offer, and
// how the feed splits into dated groups. No React, no storage — the screen
// orchestrates, these just sort.

import { NEWS_TAGS, type NewsItem } from '../../../game/news'

/** Chip ids: 'all', or one of the NEWS_TAGS values. */
export type NewsFilterId = 'all' | (typeof NEWS_TAGS)[number]

/** Short chip labels — the tag strings themselves are too long for a chip. */
const FILTER_LABEL: Record<NewsFilterId, string> = {
  'all':         'All',
  'EVENT':       'Events',
  'UPDATE':      'Updates',
  'NEW FEATURE': 'Features',
  'BUG FIX':     'Fixes',
}

export interface NewsFilterOption {
  id: NewsFilterId
  label: string
  count: number
}

/**
 * Chips for the tags actually present in the feed. A chip for a tag nothing
 * carries is a dead end, so an absent tag gets no chip; 'All' is always first.
 */
export function buildFilterOptions(items: NewsItem[]): NewsFilterOption[] {
  const options: NewsFilterOption[] = [{ id: 'all', label: FILTER_LABEL.all, count: items.length }]
  for (const tag of NEWS_TAGS) {
    const count = items.filter(n => n.tag === tag).length
    if (count > 0) options.push({ id: tag, label: FILTER_LABEL[tag], count })
  }
  return options
}

export function applyFilter(items: NewsItem[], filter: NewsFilterId): NewsItem[] {
  return filter === 'all' ? items : items.filter(n => n.tag === filter)
}

/**
 * Chronicle chapter announcements are synthesised by chronicle.ts, keyed
 * `chronicle-<chapterId>`. They arrive in batches of near-identical posts, so
 * the screen draws them as one-line rows rather than full cards.
 */
export function isChronicleItem(item: NewsItem): boolean {
  return item.id.startsWith('chronicle-')
}

export type NewsBucketId = 'today' | 'week' | 'month' | 'older'

const BUCKET_LABEL: Record<NewsBucketId, string> = {
  today: 'Today',
  week:  'This week',
  month: 'This month',
  older: 'Earlier',
}

/** Whole days between two ISO dates, or null if either won't parse. */
function daysBetween(fromISO: string, toISO: string): number | null {
  const from = Date.parse(`${fromISO}T00:00:00Z`)
  const to   = Date.parse(`${toISO}T00:00:00Z`)
  if (Number.isNaN(from) || Number.isNaN(to)) return null
  return Math.round((to - from) / 86_400_000)
}

/** Which group a post's date falls in, relative to `todayISO`. */
export function bucketFor(dateISO: string, todayISO: string): NewsBucketId {
  const age = daysBetween(dateISO, todayISO)
  // An unparseable date sorts to the bottom rather than claiming to be today.
  if (age === null) return 'older'
  if (age <= 0) return 'today'
  if (age <= 7) return 'week'
  if (age <= 31) return 'month'
  return 'older'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * "25 Aug" for a post from the current year, "25 Aug 2025" otherwise — the
 * raw ISO string the feed stores is four characters of year every player
 * already knows. Anything that won't parse is passed through unchanged.
 */
export function formatNewsDate(dateISO: string, todayISO: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO)
  if (!match) return dateISO
  const [, year, month, day] = match
  const name = MONTHS[Number(month) - 1]
  if (!name) return dateISO
  const stem = `${Number(day)} ${name}`
  return year === todayISO.slice(0, 4) ? stem : `${stem} ${year}`
}

export interface NewsGroup {
  id: NewsBucketId
  label: string
  items: NewsItem[]
}

/**
 * Splits an already-sorted (newest first) list into dated groups, preserving
 * order and dropping any group that ends up empty.
 */
export function groupByRecency(items: NewsItem[], todayISO: string): NewsGroup[] {
  const order: NewsBucketId[] = ['today', 'week', 'month', 'older']
  return order
    .map(id => ({ id, label: BUCKET_LABEL[id], items: items.filter(n => bucketFor(n.date, todayISO) === id) }))
    .filter(g => g.items.length > 0)
}
