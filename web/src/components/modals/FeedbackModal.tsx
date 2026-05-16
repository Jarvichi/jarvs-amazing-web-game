import React, { useState } from 'react'
import { type User } from 'firebase/auth'
import { ModalBackdrop } from '../BuildingBlocks/ModalBackdrop'
import { submitFeedback, FeedbackType } from '../../game/feedback'
import { logError } from '../../logger'

interface Props {
  user: User | null
  onClose: () => void
}

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: '🐛 Bug Report',
  suggestion: '💡 Suggestion',
  other: '💬 Other',
}

export function FeedbackModal({ user, onClose }: Props) {
  const [type, setType]       = useState<FeedbackType>('bug')
  const [subject, setSubject] = useState('')
  const [body, setBody]       = useState('')
  const [status, setStatus]   = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit() {
    if (!subject.trim() || !body.trim()) return
    setStatus('sending')
    setErrorMsg(null)
    try {
      await submitFeedback({ type, subject: subject.trim(), body: body.trim() }, user?.uid)
      setStatus('done')
      setTimeout(onClose, 1800)
    } catch (e) {
      logError('FeedbackModal: submit failed', { error: String(e) })
      setErrorMsg('Failed to send — please try again.')
      setStatus('error')
    }
  }

  return (
    <ModalBackdrop onClose={status === 'sending' ? () => {} : onClose}>
      <div className="confirm-modal" style={{ maxWidth: 400, textAlign: 'left' }}>
        <div className="confirm-modal-title">SEND FEEDBACK</div>

        {status === 'done' ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--game-accent, #f0c040)' }}>
            ✓ Thanks for your feedback!
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div className="settings-label">Type</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(Object.keys(TYPE_LABELS) as FeedbackType[]).map(t => (
                    <button
                      key={t}
                      className={`filter-btn${type === t ? ' filter-btn--active' : ''}`}
                      onClick={() => setType(t)}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="settings-label">Subject</div>
                <input
                  className="settings-text-input"
                  style={{ width: '100%' }}
                  maxLength={120}
                  placeholder="Brief summary…"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>

              <div>
                <div className="settings-label">Details</div>
                <textarea
                  className="settings-text-input"
                  style={{ width: '100%', minHeight: '90px', resize: 'vertical', fontFamily: 'inherit', fontSize: 'inherit' }}
                  maxLength={2000}
                  placeholder="Describe the bug or idea…"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                />
              </div>

              {errorMsg && (
                <div className="settings-label" style={{ color: '#ff4444' }}>{errorMsg}</div>
              )}
            </div>

            <div className="confirm-modal-actions u-flex u-gap-5 u-just-c" style={{ marginTop: '14px' }}>
              <button className="action-btn" onClick={handleSubmit} disabled={status === 'sending' || !subject.trim() || !body.trim()}>
                {status === 'sending' ? 'SENDING…' : 'SEND'}
              </button>
              <button className="action-btn action-btn--danger" onClick={onClose} disabled={status === 'sending'}>
                CANCEL
              </button>
            </div>
          </>
        )}
      </div>
    </ModalBackdrop>
  )
}
