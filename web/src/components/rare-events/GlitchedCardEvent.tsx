import React, { useEffect, useState } from 'react'
import { RareEventEffect } from './types'

interface Props {
  onDone: (effect: RareEventEffect) => void
}

const GLITCH_NAMES = [
  'ERR_CARD_NULL',
  'UNIT_UNDEFINED',
  '░░░░░░░',
  'NaN Goblin',
  'undefined',
  'CARD_MISSING',
  'null ptr unit',
  '??????????',
  'CORRUPTED',
  'SEGFAULT_WARRIOR',
]

const HOVER_REVEAL = 'Real card restored. The glitch has been... contained. Probably.'

export function GlitchedCardEvent({ onDone }: Props) {
  const [revealed, setRevealed] = useState(false)
  const glitchName = GLITCH_NAMES[Math.floor(Math.random() * GLITCH_NAMES.length)]

  useEffect(() => {
    if (!revealed) return
    const id = setTimeout(() => {
      onDone({
        logMessage: `[SYSTEM] Card corruption detected and patched. ${glitchName} was actually a Goblin.`,
      })
    }, 2000)
    return () => clearTimeout(id)
  }, [revealed, glitchName, onDone])

  return (
    <div className="glitch-card-overlay">
      <div className="glitch-card-label">⚠ CARD CORRUPTION DETECTED</div>
      <div
        className={`glitch-card-tile${revealed ? ' glitch-card-tile--revealed' : ''}`}
        onPointerEnter={() => setRevealed(true)}
        onPointerDown={() => setRevealed(true)}
      >
        {revealed ? (
          <>
            <div className="glitch-card-name">Goblin</div>
            <div className="glitch-card-restored">{HOVER_REVEAL}</div>
          </>
        ) : (
          <>
            <div className="glitch-card-name glitch-text">{glitchName}</div>
            <div className="glitch-card-hint">tap to inspect</div>
          </>
        )}
      </div>
    </div>
  )
}
