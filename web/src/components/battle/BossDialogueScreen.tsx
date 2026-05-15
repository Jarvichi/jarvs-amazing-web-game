import React, { useState, useEffect } from 'react'

interface Props {
  bossName: string
  lines: string[]
  onDone: () => void
}

export function BossDialogueScreen({ bossName, lines, onDone }: Props) {
  const [shownCount, setShownCount] = useState(1)

  function advance() {
    if (shownCount >= lines.length) {
      onDone()
    } else {
      setShownCount(n => n + 1)
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shownCount])

  const allShown = shownCount >= lines.length

  return (
    <div className="boss-dialogue-screen" onClick={advance}>
      <div className="boss-dialogue-speaker">[{bossName.toUpperCase()}]</div>
      <div className="boss-dialogue-lines">
        {lines.slice(0, shownCount).map((line, i) => (
          <div
            key={i}
            className={`boss-dialogue-line${i === shownCount - 1 ? ' boss-dialogue-line--new' : ''}`}
          >
            {line}
          </div>
        ))}
      </div>
      <div className="boss-dialogue-footer">
        {allShown
          ? <span className="boss-dialogue-fight">PRESS ENTER TO FIGHT</span>
          : <span className="boss-dialogue-continue">CLICK TO CONTINUE ›</span>
        }
      </div>
    </div>
  )
}
