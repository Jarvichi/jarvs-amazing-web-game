import { describe, it, expect } from 'vitest'
import type { NewsItem } from '../../../game/news'
import {
  applyFilter, bucketFor, buildFilterOptions, formatNewsDate, groupByRecency, isChronicleItem,
} from './newsGrouping'

const TODAY = '2026-08-30'

function item(id: string, date: string, tag?: string): NewsItem {
  return { id, date, tag, title: id, body: '' }
}

describe('bucketFor', () => {
  it('buckets by age relative to today', () => {
    expect(bucketFor('2026-08-30', TODAY)).toBe('today')
    expect(bucketFor('2026-08-25', TODAY)).toBe('week')
    expect(bucketFor('2026-08-20', TODAY)).toBe('month')
    expect(bucketFor('2026-06-01', TODAY)).toBe('older')
  })

  it('treats a future-dated post as today rather than a negative age', () => {
    expect(bucketFor('2026-09-05', TODAY)).toBe('today')
  })

  it('sorts an unparseable date to the bottom', () => {
    expect(bucketFor('not-a-date', TODAY)).toBe('older')
  })
})

describe('groupByRecency', () => {
  it('keeps input order inside groups and drops empty ones', () => {
    const groups = groupByRecency([
      item('a', '2026-08-30'),
      item('b', '2026-08-28'),
      item('c', '2026-08-26'),
      item('d', '2026-01-01'),
    ], TODAY)

    expect(groups.map(g => g.id)).toEqual(['today', 'week', 'older'])
    expect(groups[1].items.map(i => i.id)).toEqual(['b', 'c'])
  })

  it('returns nothing for an empty feed', () => {
    expect(groupByRecency([], TODAY)).toEqual([])
  })
})

describe('buildFilterOptions', () => {
  // Chip order follows NEWS_TAGS, not how often a tag happens to appear, so
  // the row doesn't reshuffle itself as posts are dismissed.
  it('offers All plus only the tags present, each with its count', () => {
    const options = buildFilterOptions([
      item('a', TODAY, 'EVENT'),
      item('b', TODAY, 'EVENT'),
      item('c', TODAY, 'BUG FIX'),
      item('d', TODAY),
    ])

    expect(options).toEqual([
      { id: 'all',     label: 'All',    count: 4 },
      { id: 'BUG FIX', label: 'Fixes',  count: 1 },
      { id: 'EVENT',   label: 'Events', count: 2 },
    ])
  })

  it('offers only All when nothing is tagged', () => {
    expect(buildFilterOptions([item('a', TODAY)]).map(o => o.id)).toEqual(['all'])
  })
})

describe('applyFilter', () => {
  const items = [item('a', TODAY, 'EVENT'), item('b', TODAY, 'UPDATE')]

  it('passes everything through for All', () => {
    expect(applyFilter(items, 'all')).toEqual(items)
  })

  it('keeps only the matching tag', () => {
    expect(applyFilter(items, 'UPDATE').map(i => i.id)).toEqual(['b'])
  })
})

describe('isChronicleItem', () => {
  it('matches the ids chronicle.ts synthesises', () => {
    expect(isChronicleItem(item('chronicle-ch7', TODAY))).toBe(true)
    expect(isChronicleItem(item('secret-rare-abc', TODAY))).toBe(false)
  })
})

describe('formatNewsDate', () => {
  it('drops the year within the current year and keeps it otherwise', () => {
    expect(formatNewsDate('2026-08-25', TODAY)).toBe('25 Aug')
    expect(formatNewsDate('2025-12-01', TODAY)).toBe('1 Dec 2025')
  })

  it('passes through anything that is not an ISO date', () => {
    expect(formatNewsDate('yesterday', TODAY)).toBe('yesterday')
    expect(formatNewsDate('2026-13-01', TODAY)).toBe('2026-13-01')
  })
})
