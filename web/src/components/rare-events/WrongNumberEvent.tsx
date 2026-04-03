import React, { useState, useEffect } from 'react'
import { RareEventEffect } from './types'
import { loadPlayerName } from '../../game/questline'

interface Props {
  onDone: (effect: RareEventEffect) => void
}

export function WrongNumberEvent({ onDone }: Props) {
  const [phase, setPhase] = useState<'incoming' | 'reply' | 'done'>('incoming')
  const [visible, setVisible] = useState(false)
  const playerName = loadPlayerName()

  useEffect(() => {
    // Slide in after a short delay
    const t = setTimeout(() => setVisible(true), 300)
    return () => clearTimeout(t)
  }, [])

  function handleReply() {
    setPhase('reply')
    setTimeout(() => {
      setPhase('done')
      setVisible(false)
      setTimeout(() => onDone({
        crystals: 25,
        logMessage: `[KAREN] sry!! wrong ${playerName}!! 😅 compensatory crystals sent`,
      }), 600)
    }, 2200)
  }

  function handleDismiss() {
    setVisible(false)
    setTimeout(() => onDone({
      crystals: 20,
      logMessage: '[KAREN] wrong number. compensation issued.',
    }), 600)
  }

  return (
    <div className={`wn-notification${visible ? ' wn-notification--visible' : ''}`}>
      <div className="wn-app-icon">📱</div>
      <div className="wn-content">
        {phase === 'incoming' && (
          <>
            <div className="wn-sender">Karen M.</div>
            <div className="wn-message">
              hey {playerName}!! BBQ at mine Sat at 7?? Derek got a new grill 😁
              also can u bring potato salad?? 🥗
            </div>
            <div className="wn-actions">
              <button className="wn-btn" onClick={handleReply}>Reply</button>
              <button className="wn-btn wn-btn--muted" onClick={handleDismiss}>Dismiss</button>
            </div>
          </>
        )}
        {phase === 'reply' && (
          <>
            <div className="wn-sender">Karen M.</div>
            <div className="wn-message">omg sry!! wrong {playerName}!! 😅😅 my bad!!</div>
          </>
        )}
        {phase === 'done' && (
          <div className="wn-message">+25 💎 compensatory crystals received</div>
        )}
      </div>
    </div>
  )
}
