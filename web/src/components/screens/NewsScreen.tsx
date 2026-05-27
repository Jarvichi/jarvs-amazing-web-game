import React, { useEffect, useState } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { getAllNews, markNewsRead, dismissNewsItem, loadDismissedNewsIds, NewsItem } from '../../game/news'

const ITEMS_PER_PAGE = 10

interface Props {
  onBack: () => void
}

export function NewsScreen({ onBack }: Props) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  useEffect(() => {
    const existingDismissed = new Set(loadDismissedNewsIds())
    setDismissed(existingDismissed)
    getAllNews().then(all => {
      setItems(all)
      markNewsRead(all.map(n => n.id))
      setLoading(false)
    })
  }, [])

  function handleDismiss(id: string) {
    dismissNewsItem(id)
    setDismissed(prev => new Set([...prev, id]))
  }

  const visible = items.filter(n => !dismissed.has(n.id))
  const pageCount = Math.max(1, Math.ceil(visible.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = visible.slice(safePage * ITEMS_PER_PAGE, (safePage + 1) * ITEMS_PER_PAGE)

  // Keep page in bounds when items are dismissed
  useEffect(() => {
    if (page >= pageCount && page > 0) setPage(pageCount - 1)
  }, [visible.length, pageCount, page])

  return (
    <OverlayScreen title="WHAT'S NEW" onBack={onBack}>
      <div className="news-list">
        {loading && <div className="news-loading">Loading…</div>}
        {!loading && visible.length === 0 && (
          <div className="news-empty">No news yet.</div>
        )}
        {!loading && pageItems.map(item => (
          <div key={item.id} className="news-item u-col u-gap-3">
            <div className="news-item__meta u-flex u-items-c u-gap-4">
              <span className="news-item__date">{item.date}</span>
              {item.tag && <span className="news-item__tag">{item.tag}</span>}
              <button
                className="news-item__dismiss"
                onClick={() => handleDismiss(item.id)}
                title="Dismiss"
              >✕</button>
            </div>
            <div className="news-item__title">{item.title}</div>
            {item.imageUrl && (
              <img
                className="news-item__image"
                src={item.imageUrl}
                alt={item.title}
              />
            )}
            <div className="news-item__body">{item.body}</div>
          </div>
        ))}
        {!loading && pageCount > 1 && (
          <div className="news-pagination">
            <button
              className="action-btn"
              disabled={safePage === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >← Prev</button>
            <span className="news-pagination__label">{safePage + 1} / {pageCount}</span>
            <button
              className="action-btn"
              disabled={safePage === pageCount - 1}
              onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
            >Next →</button>
          </div>
        )}
      </div>
    </OverlayScreen>
  )
}
