import React, { useEffect, useState } from 'react'
import { RareEventEffect } from './types'
import { getCardCatalog } from '../../game/cards'

interface Props {
  onDone: (effect: RareEventEffect) => void
}

const TOURIST_LINES = [
  "Oh! Excuse me, is this the Goblin Bazaar? I'm looking for the Goblin Bazaar.",
  "My map says there should be a tavern here. My map is very old.",
  "Sorry, sorry — don't mind me. I'm just passing through.",
  "Lovely battlefield you have here! Very... active.",
  "Could you point me toward the next act? I seem to have wandered off the path.",
]

export function ConfusedTouristEvent({ onDone }: Props) {
  const [line] = useState(() => TOURIST_LINES[Math.floor(Math.random() * TOURIST_LINES.length)])
  const [unitName] = useState(() => {
    // Pick a random unit from the catalog from a different pool
    const catalog = getCardCatalog().filter(c => c.cardType === 'unit')
    return catalog.length > 0 ? catalog[Math.floor(Math.random() * catalog.length)].name : 'Wanderer'
  })
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setLeaving(true), 3500)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!leaving) return
    const id = setTimeout(() => {
      onDone({
        crystals: 5,
        logMessage: `[TOURIST] A confused ${unitName} wandered in, apologised, then left. Left 5 crystals for the trouble.`,
      })
    }, 1000)
    return () => clearTimeout(id)
  }, [leaving, unitName, onDone])

  return (
    <div className="tourist-overlay">
      <div className={`tourist-card${leaving ? ' tourist-card--leaving' : ''}`}>
        <div className="tourist-header">🗺 A CONFUSED TRAVELLER</div>
        <div className="tourist-unit-name">{unitName}</div>
        <div className="tourist-speech">"{line}"</div>
        {leaving && <div className="tourist-exit">*wanders away apologetically*</div>}
      </div>
    </div>
  )
}
