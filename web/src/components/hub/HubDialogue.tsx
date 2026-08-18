import React, { useEffect, useRef, useState } from 'react'

export interface DialogueChoice {
  label: string
  onClick: () => void
  primary?: boolean
  /** Visually dims the choice (e.g. an action that isn't available yet) without blocking the tap — onClick still fires so it can explain why. */
  disabled?: boolean
  /** Marks a "walk away" choice (Farewell, Not now, Cancel, ...) that declines
   *  without side effects — the auto-dismiss-on-walk logic in HubWorld looks
   *  for this to know it's safe to close a choice-bearing dialogue. */
  isExit?: boolean
}

interface Props {
  line:         string | null
  onClose:      () => void
  speakerName?: string
  choices?:     DialogueChoice[]
}

const TYPE_SPEED_MS = 16

/** Reveals `text` one character at a time; resets whenever `text` changes.
 *  Returns a `skip` function that jumps straight to the full text. */
function useTypewriter(text: string): { shown: string; done: boolean; skip: () => void } {
  const [count, setCount] = useState(text.length)
  const textRef = useRef(text)
  textRef.current = text

  useEffect(() => {
    setCount(0)
    if (!text) return
    const id = setInterval(() => {
      setCount(c => {
        if (c >= textRef.current.length) return c
        return c + 1
      })
    }, TYPE_SPEED_MS)
    return () => clearInterval(id)
  }, [text])

  return {
    shown: text.slice(0, count),
    done:  count >= text.length,
    skip:  () => setCount(text.length),
  }
}

export function HubDialogue({ line, onClose, speakerName, choices }: Props) {
  const { shown, done, skip } = useTypewriter(line ?? '')
  const hasChoices = !!choices && choices.length > 0
  const monogram = speakerName ? speakerName.trim().charAt(0).toUpperCase() : null

  return (
    <div
      className={`hub-dialogue-wrap${line ? ' hub-dialogue-wrap--visible' : ''}`}
      onClick={() => { if (!done) skip() }}
    >
      <div className={`hub-dialogue-box${speakerName ? '' : ' hub-dialogue-box--narration'}`}>
        {speakerName && (
          <div className="hub-dialogue-header">
            <div className="hub-dialogue-badge" aria-hidden="true">{monogram}</div>
            <div className="hub-dialogue-name">{speakerName}</div>
          </div>
        )}

        <div className="hub-dialogue-line">
          {shown}
          {!done && <span className="hub-dialogue-caret" aria-hidden="true">▌</span>}
        </div>

        {done && (
          <div className={`hub-dialogue-choices${hasChoices && choices!.length > 1 ? ' hub-dialogue-choices--stacked' : ''}`}>
            {hasChoices
              ? choices!.map(c => (
                  <button
                    key={c.label}
                    className={`action-btn action-btn--sm hub-dialogue-choice${c.primary && !c.disabled ? ' action-btn--gold' : ''}${c.disabled ? ' hub-dialogue-choice--disabled' : ''}`}
                    onClick={e => { e.stopPropagation(); c.onClick() }}
                  >
                    {c.label}
                  </button>
                ))
              : (
                  <button
                    className="action-btn action-btn--sm hub-dialogue-choice hub-dialogue-choice--ok"
                    onClick={e => { e.stopPropagation(); onClose() }}
                  >
                    OK <span className="hub-dialogue-continue-hint">▼</span>
                  </button>
                )
            }
          </div>
        )}
      </div>
    </div>
  )
}
