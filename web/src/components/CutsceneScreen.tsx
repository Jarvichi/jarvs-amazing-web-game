import React, { useState, useEffect } from 'react'
import { CutscenePanel } from '../game/questline'

interface Props {
  panels: CutscenePanel[]
  onDone: () => void
}

export function CutsceneScreen({ panels, onDone }: Props) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  const panel = panels[index]
  const isLast = index === panels.length - 1

  function advance() {
    if (isLast) {
      onDone()
      return
    }
    // Fade out → bump index → fade in
    setVisible(false)
    setTimeout(() => {
      setIndex(i => i + 1)
      setVisible(true)
    }, 200)
  }

  // Keyboard: Enter or Space to advance
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, isLast])

  if (!panel) return null

  // Split newlines into paragraphs for proper rendering
  const paragraphs = panel.text.split('\n\n').filter(Boolean)

  return (
    <div className="cutscene-screen" onClick={advance}>
      <div className={`cutscene-content${visible ? ' cutscene-content--visible' : ''}`}>
        <div className="cutscene-act-label">// {panel.title}</div>
        {panel.image && (
          <img src={`${import.meta.env.BASE_URL}${panel.image}`} alt="" className="cutscene-image" />
        )}
        <div className="cutscene-body">
          {paragraphs.map((p, i) => (
            <p key={i} className="cutscene-paragraph">{p}</p>
          ))}
        </div>
      </div>

      <div className="cutscene-footer">
        <span className="cutscene-progress">{index + 1} / {panels.length}</span>
        <span className="cutscene-continue">{isLast ? 'PRESS ENTER TO BEGIN' : 'CLICK TO CONTINUE ›'}</span>
      </div>
    </div>
  )
}
