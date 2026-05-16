import React, { useState } from 'react'
import { EventData, EventChoice, loadPlayerName } from '../../game/questline'

interface Props {
  event: EventData
  onChoice: (choice: EventChoice) => void
  playerHp: number
  maxHp: number
}

function hpColor(hp: number, max: number): string {
  const pct = hp / max
  if (pct > 0.5) return '#33ff33'
  if (pct > 0.25) return '#ffcc00'
  return '#ff4444'
}

export function EventScreen({ event, onChoice, playerHp, maxHp }: Props) {
  const [picked, setPicked] = useState<EventChoice | null>(null)
  const playerName = loadPlayerName()

  function handlePick(choice: EventChoice) {
    if (picked) return
    setPicked(choice)
  }

  // Preview HP after applying the picked choice's effect
  const previewHp: number = (() => {
    if (!picked) return playerHp
    const effects = picked.effect.type === 'compound' ? picked.effect.effects : [picked.effect]
    let hp = playerHp
    for (const effect of effects) {
      if (effect.type === 'healHp') hp = Math.min(maxHp, hp + effect.amount)
      if (effect.type === 'damageHp') hp = Math.max(1, hp - effect.amount)
    }
    return hp
  })()

  const displayHp  = previewHp
  const hpPct      = Math.max(0, displayHp / maxHp)
  const hpChanged  = displayHp !== playerHp

  return (
    <div className="event-screen">
      <div className="event-type-tag">[EVENT]</div>
      <div className="event-title">{event.title}</div>

      {/* HP bar */}
      <div className="event-hp-area">
        <span className="event-hp-label">HP</span>
        <div className="event-hp-track">
          <div
            className="event-hp-fill"
            style={{ width: `${hpPct * 100}%`, background: hpColor(displayHp, maxHp) }}
          />
        </div>
        <span className="event-hp-text" style={{ color: hpColor(displayHp, maxHp) }}>
          {hpChanged
            ? <>{playerHp} <span className="event-hp-delta u-text-red">→ {displayHp}</span></>
            : <>{displayHp}/{maxHp}</>}
        </span>
      </div>

      <div className="event-description">{event.description.replace(/\bJarv\b/g, playerName)}</div>

      <div className="event-choices">
        {event.choices.map((choice, i) => {
          const isChosen   = picked?.label === choice.label
          const isDisabled = picked !== null && !isChosen
          return (
            <button
              key={i}
              className={[
                'event-choice',
                isChosen   ? 'event-choice--chosen'   : '',
                isDisabled ? 'event-choice--disabled' : '',
              ].join(' ')}
              onClick={() => handlePick(choice)}
              disabled={isDisabled}
            >
              <span className="event-choice-letter">{String.fromCharCode(65 + i)}.</span>
              <span className="event-choice-label u-grow">{choice.label}</span>
            </button>
          )
        })}
      </div>

      {picked && (
        <>
          <div className="event-result">
            {picked.effect.type === 'nothing' ? picked.consequence : `${picked.consequence}…`}
          </div>
          <button className="action-btn event-continue-btn" onClick={() => onChoice(picked)}>
            CONTINUE →
          </button>
        </>
      )}
    </div>
  )
}
