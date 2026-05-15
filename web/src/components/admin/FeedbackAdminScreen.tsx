import React, { useState, useEffect } from 'react'
import { OverlayScreen } from '../BuildingBlocks/OverlayScreen'
import { Section } from '../BuildingBlocks/Section'
import { FeedbackItem, getAllFeedback, deleteFeedback } from '../../game/feedback'

interface Props {
  onBack: () => void
}

const TYPE_LABELS: Record<string, string> = {
  bug: '🐛 BUG',
  suggestion: '💡 SUGGESTION',
  other: '💬 OTHER',
}

export function FeedbackAdminScreen({ onBack }: Props) {
  const [items, setItems]     = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus]   = useState<string | null>(null)

  function refresh() {
    setLoading(true)
    getAllFeedback().then(all => { setItems(all); setLoading(false) })
  }

  useEffect(() => { refresh() }, [])

  async function handleDelete(id: string) {
    if (!confirm('Delete this feedback item?')) return
    try {
      await deleteFeedback(id)
      setStatus(`Deleted ${id}`)
      refresh()
    } catch (e) {
      setStatus(`Error: ${String(e)}`)
    }
  }

  return (
    <OverlayScreen title="FEEDBACK ADMIN" onBack={onBack}>
      <Section title={`Submissions (${items.length})`}>
        {loading && <div className="news-loading">Loading…</div>}
        {!loading && items.length === 0 && <div className="news-empty">No feedback yet.</div>}
        {!loading && items.map(item => (
          <div key={item.id} className="news-item">
            <div className="news-item__meta">
              <span className="news-item__tag">{TYPE_LABELS[item.type] ?? item.type}</span>
              <span className="news-item__date">{item.submittedAt.slice(0, 16).replace('T', ' ')}</span>
              {item.userId && (
                <span className="news-item__date" style={{ opacity: 0.5, fontSize: '11px' }}>{item.userId.slice(0, 10)}…</span>
              )}
              <button
                className="action-btn action-btn--danger"
                style={{ marginLeft: 'auto', padding: '2px 10px', fontSize: '11px' }}
                onClick={() => handleDelete(item.id)}
              >
                DELETE
              </button>
            </div>
            <div className="news-item__title">{item.subject}</div>
            <div className="news-item__body" style={{ whiteSpace: 'pre-wrap' }}>{item.body}</div>
          </div>
        ))}
        {status && (
          <div className="settings-label" style={{ color: status.startsWith('Error') ? '#ff4444' : '#33ff33', marginTop: '8px' }}>
            {status}
          </div>
        )}
      </Section>
    </OverlayScreen>
  )
}
