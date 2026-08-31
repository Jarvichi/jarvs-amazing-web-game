import React, { useEffect, useMemo, useState } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Button } from '../ui/Button'
import { getChronicleStatus, describeReward, type ChronicleChapterStatus } from '../../game/chronicle'
import { getAllNews, markNewsRead, dismissNewsItem, loadDismissedNewsIds, loadReadNewsIds, NewsItem } from '../../game/news'
import { NewsFilters } from './news/NewsFilters'
import { NewsCard } from './news/NewsCard'
import { ChronicleRow } from './news/ChronicleRow'
import { ChronicleCallout } from './news/ChronicleCallout'
import {
  applyFilter, buildFilterOptions, formatNewsDate, groupByRecency, isChronicleItem,
  type NewsFilterId,
} from './news/newsGrouping'
import { EmptyState } from '../ui/EmptyState'

const ITEMS_PER_PAGE = 10

interface Props {
  onBack: () => void
  /** Opens the Fracture Chronicle. Omitted where there's no route to it. */
  onOpenChronicle?: () => void
}

export function NewsScreen({ onBack, onOpenChronicle }: Props) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  // Captured before the feed is marked read, so "NEW" reflects what the
  // player hadn't seen when they opened the screen rather than nothing at all.
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<NewsFilterId>('all')
  const [page, setPage] = useState(0)

  useEffect(() => {
    setDismissed(new Set(loadDismissedNewsIds()))
    getAllNews().then(all => {
      const alreadyRead = new Set(loadReadNewsIds())
      setUnreadIds(new Set(all.filter(n => !alreadyRead.has(n.id)).map(n => n.id)))
      setItems(all)
      markNewsRead(all.map(n => n.id))
      setLoading(false)
    })
  }, [])

  function handleDismiss(id: string) {
    dismissNewsItem(id)
    setDismissed(prev => new Set([...prev, id]))
  }

  // Chapter metadata for the chronicle posts, keyed by the news id
  // chronicle.ts synthesises them under. Read from the chapter defs rather
  // than parsed back out of the post's prose.
  const chapters = useMemo(() => {
    const byNewsId = new Map<string, ChronicleChapterStatus>()
    for (const c of getChronicleStatus()) {
      if (c.available) byNewsId.set(`chronicle-${c.def.id}`, c)
    }
    return byNewsId
  }, [])
  const latestChapter = useMemo(
    () => [...chapters.values()].reduce<ChronicleChapterStatus | null>(
      (best, c) => (best === null || c.number > best.number ? c : best), null),
    [chapters],
  )

  const todayISO = new Date().toISOString().slice(0, 10)

  // The chapter in the callout is drawn there, so its post is kept out of the
  // feed — printing it twice on one screen is the duplication the LED banner
  // was guilty of. Filtered before the counts and pages are worked out so
  // both stay honest.
  const calloutNewsId = latestChapter ? `chronicle-${latestChapter.def.id}` : null
  const visible = items.filter(n => !dismissed.has(n.id) && n.id !== calloutNewsId)
  const filterOptions = buildFilterOptions(visible)
  // A tag can disappear entirely once its last post is dismissed.
  const activeFilter = filterOptions.some(o => o.id === filter) ? filter : 'all'
  const filtered = applyFilter(visible, activeFilter)

  const pageCount = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(safePage * ITEMS_PER_PAGE, (safePage + 1) * ITEMS_PER_PAGE)
  // Grouping runs over the page, not the whole feed, so a group heading never
  // promises more rows than the page actually shows.
  const groups = groupByRecency(pageItems, todayISO)

  // Keep page in bounds when items are dismissed or the filter narrows.
  useEffect(() => {
    if (page >= pageCount && page > 0) setPage(pageCount - 1)
  }, [filtered.length, pageCount, page])

  return (
    <OverlayScreen title="WHAT'S NEW" onBack={onBack}>
      {!loading && latestChapter && (
        <ChronicleCallout
          number={latestChapter.number}
          title={latestChapter.def.title}
          teaser={latestChapter.def.teaser}
          reward={describeReward(latestChapter.def.reward)}
          unread={!latestChapter.read}
          onOpen={onOpenChronicle}
        />
      )}

      {!loading && visible.length > 0 && (
        <NewsFilters
          options={filterOptions}
          activeId={activeFilter}
          onChange={id => { setFilter(id); setPage(0) }}
        />
      )}

      <div className="news-list">
        {loading && <div className="news-loading">Loading…</div>}
        {!loading && visible.length === 0 && (
          <EmptyState size="sm">No news yet.</EmptyState>
        )}
        {!loading && visible.length > 0 && filtered.length === 0 && (
          <EmptyState size="sm">Nothing tagged that.</EmptyState>
        )}

        {!loading && groups.map(group => (
          <section key={group.id} className="news-group">
            <h2 className="news-group__heading">
              <span>{group.label}</span>
              <span className="news-group__count">{group.items.length}</span>
            </h2>
            {group.items.map(item => {
              const chapter = isChronicleItem(item) ? chapters.get(item.id) : undefined
              const date = formatNewsDate(item.date, todayISO)
              return chapter ? (
                <ChronicleRow
                  key={item.id}
                  number={chapter.number}
                  title={chapter.def.title}
                  teaser={chapter.def.teaser}
                  date={date}
                  reward={describeReward(chapter.def.reward)}
                  unread={unreadIds.has(item.id)}
                  onOpen={onOpenChronicle}
                  onDismiss={() => handleDismiss(item.id)}
                />
              ) : (
                <NewsCard
                  key={item.id}
                  item={item}
                  date={date}
                  unread={unreadIds.has(item.id)}
                  onDismiss={handleDismiss}
                />
              )
            })}
          </section>
        ))}

        {!loading && pageCount > 1 && (
          <div className="news-pagination">
            <Button
              disabled={safePage === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >← Prev</Button>
            <span className="news-pagination__label">{safePage + 1} / {pageCount}</span>
            <Button
              disabled={safePage === pageCount - 1}
              onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
            >Next →</Button>
          </div>
        )}
      </div>
    </OverlayScreen>
  )
}
