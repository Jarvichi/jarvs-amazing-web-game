import React, { useState } from 'react'

export interface TutorialStep {
  title: string
  body: string
  /** Where to anchor the panel so it doesn't cover the element it describes.
   *  Defaults to 'center'. */
  anchor?: 'center' | 'top'
}

interface Props {
  steps: TutorialStep[]
  onDone: () => void
}

export function TutorialOverlay({ steps, onDone }: Props) {
  const [index, setIndex] = useState(0)
  const step = steps[index]
  const isLast = index === steps.length - 1

  return (
    <div
      className={`tutorial-backdrop${step.anchor === 'top' ? ' tutorial-backdrop--top' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
    >
      <div className="tutorial-panel">
        <div className="tutorial-step-indicator">[ {index + 1} / {steps.length} ]</div>
        <div className="tutorial-title">{step.title}</div>
        <div className="tutorial-body">{step.body}</div>
        <div className="tutorial-actions u-flex u-just-sb u-items-c">
          <button className="tutorial-skip" onClick={onDone}>SKIP</button>
          <button
            className="action-btn"
            onClick={() => isLast ? onDone() : setIndex(i => i + 1)}
          >
            {isLast ? 'GOT IT  ✓' : 'NEXT  →'}
          </button>
        </div>
      </div>
    </div>
  )
}
