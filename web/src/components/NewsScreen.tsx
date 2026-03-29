import React, { useEffect, useState } from 'react'
import { OverlayScreen } from './OverlayScreen'
import { getAllNews, markNewsRead, NewsItem } from '../game/news'

interface Props {
  onBack: () => void
}

export function NewsScreen({ onBack }: Props) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllNews().then(all => {
      setItems(all)
      markNewsRead(all.map(n => n.id))
      setLoading(false)
    })
  }, [])

  return (
    <OverlayScreen title="WHAT'S NEW" onBack={onBack}>
      {loading && <div className="news-loading">Loading…</div>}
      {!loading && items.length === 0 && (
        <div className="news-empty">No news yet.</div>
      )}
      {!loading && items.map(item => (
        <div key={item.id} className="news-item">
          <div className="news-item__meta">
            <span className="news-item__date">{item.date}</span>
            {item.tag && <span className="news-item__tag">{item.tag}</span>}
          </div>
          <div className="news-item__title">{item.title}</div>
          <div className="news-item__body">{item.body}</div>
        </div>
      ))}
    </OverlayScreen>
  )
}
