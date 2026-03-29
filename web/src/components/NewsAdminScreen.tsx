import React, { useState, useEffect } from 'react'
import { OverlayScreen } from './OverlayScreen'
import { Section } from './Section'
import { NewsItem, NEWS_TAGS, getAllNews, saveNewsToFirestore, deleteNewsFromFirestore } from '../game/news'

interface Props {
  onBack: () => void
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function blankItem(): Omit<NewsItem, 'id'> & { id: string } {
  return {
    id: '',
    title: '',
    body: '',
    date: new Date().toISOString().slice(0, 10),
    tag: 'NEW FEATURE',
  }
}

export function NewsAdminScreen({ onBack }: Props) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState(blankItem())
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  function refresh() {
    setLoading(true)
    getAllNews().then(all => { setItems(all); setLoading(false) })
  }

  useEffect(() => { refresh() }, [])

  function handleTitleChange(title: string) {
    setDraft(d => ({
      ...d,
      title,
      id: d.id === '' || d.id === slugify(d.title) ? slugify(title) : d.id,
    }))
  }

  async function handleCreate() {
    if (!draft.id || !draft.title || !draft.body) {
      setStatus('ID, title, and body are required.')
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      await saveNewsToFirestore(draft as NewsItem)
      setDraft(blankItem())
      setStatus('Saved!')
      refresh()
    } catch (e) {
      setStatus(`Error: ${String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(`Delete news item "${id}"?`)) return
    try {
      await deleteNewsFromFirestore(id)
      setStatus(`Deleted ${id}`)
      refresh()
    } catch (e) {
      setStatus(`Error: ${String(e)}`)
    }
  }

  return (
    <OverlayScreen title="NEWS ADMIN" onBack={onBack}>

      <Section title="Create Post">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <div className="settings-label">ID (auto)</div>
              <input
                className="settings-text-input"
                value={draft.id}
                onChange={e => setDraft(d => ({ ...d, id: e.target.value }))}
                placeholder="auto-generated"
              />
            </div>
            <div style={{ flex: 1, minWidth: '80px' }}>
              <div className="settings-label">Date</div>
              <input
                type="date"
                className="settings-text-input"
                value={draft.date}
                onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
              />
            </div>
            <div>
              <div className="settings-label">Tag</div>
              <select
                className="settings-select"
                value={draft.tag ?? ''}
                onChange={e => setDraft(d => ({ ...d, tag: e.target.value || undefined }))}
              >
                <option value="">(none)</option>
                {NEWS_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="settings-label">Title</div>
            <input
              className="settings-text-input"
              style={{ width: '100%' }}
              value={draft.title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Post title…"
            />
          </div>

          <div>
            <div className="settings-label">Body</div>
            <textarea
              className="settings-text-input"
              style={{ width: '100%', minHeight: '80px', resize: 'vertical', fontFamily: 'inherit', fontSize: 'inherit' }}
              value={draft.body}
              onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
              placeholder="Post content…"
            />
          </div>

          <button className="action-btn" onClick={handleCreate} disabled={saving}>
            {saving ? 'SAVING…' : 'CREATE POST'}
          </button>
          {status && <div className="settings-label" style={{ color: status.startsWith('Error') ? '#ff4444' : '#33ff33' }}>{status}</div>}
        </div>
      </Section>

      <Section title={`Active Posts (${items.length})`}>
        {loading && <div className="news-loading">Loading…</div>}
        {!loading && items.length === 0 && <div className="news-empty">No posts yet.</div>}
        {!loading && items.map(item => (
          <div key={item.id} className="news-item">
            <div className="news-item__meta">
              <span className="news-item__date">{item.date}</span>
              {item.tag && <span className="news-item__tag">{item.tag}</span>}
              <button
                className="action-btn action-btn--danger"
                style={{ marginLeft: 'auto', padding: '2px 10px', fontSize: '11px' }}
                onClick={() => handleDelete(item.id)}
              >
                DELETE
              </button>
            </div>
            <div className="news-item__title">{item.title}</div>
            <div className="news-item__body">{item.body}</div>
          </div>
        ))}
      </Section>
    </OverlayScreen>
  )
}
