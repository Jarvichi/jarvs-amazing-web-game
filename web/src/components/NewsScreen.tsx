import React, { useEffect, useState } from 'react'
import { OverlayScreen } from './OverlayScreen'
import { getAllNews, markNewsRead, dismissNewsItem, loadDismissedNewsIds, NewsItem } from '../game/news'

interface Props {
  onBack: () => void
}

export function NewsScreen({ onBack }: Props) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

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

  return (
    <OverlayScreen title="WHAT'S NEW" onBack={onBack}>
      <div className="news-list">
        {loading && <div className="news-loading">Loading…</div>}
        {!loading && visible.length === 0 && (
          <div className="news-empty">No news yet.</div>
        )}
        {!loading && visible.map(item => (
          <div key={item.id} className="news-item">
            <div className="news-item__meta">
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
      </div>
    </OverlayScreen>
  )
}
