import React, { useState } from 'react'
import { SpriteImg } from './SpriteImg'
import { CardRestSelectCandidate } from './CardRestSelectCandidate'

interface Props {
  /** Top 3 most-played card names for this act — candidates to rest. */
  candidates: string[]
  /** Plays-per-card for display (keyed by name). */
  playCounts: Record<string, number>
  /** Cards already resting from previous acts — shown as informational. */
  alreadyResting?: string[]
  onConfirm: (resting: string[]) => void
}

export function CardRestSelect({ candidates, playCounts, alreadyResting = [], onConfirm }: Props) {
  const required = Math.min(2, candidates.length)
  // Pre-select the top `required` candidates
  const [selected, setSelected] = useState<Set<string>>(
    new Set(candidates.slice(0, required))
  )

  function toggle(name: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const ready = selected.size === required

  return (
    <div className="overlay-screen card-rest-screen">
      <div className="card-rest-header">
        <div className="card-rest-title">TROOPS NEED REST</div>
        <div className="card-rest-sub">
          Your most-relied-upon troops must recover between acts.<br />
          Pick <strong>{required}</strong> card{required !== 1 ? 's' : ''} to rest for the next act.
          They will be unavailable in your deck until the act after.
        </div>
      </div>

      {alreadyResting.length > 0 && (
        <div className="card-rest-already">
          <div className="card-rest-already-label">ALREADY RESTING</div>
          <div className="card-rest-already-list">
            {alreadyResting.map(name => (
              <>
                <SpriteImg name={name} className="card-sprite" />
                <span key={name} className="card-rest-already-item">[ZZZ] {name}</span>
              </>
            ))}
          </div>
          <div className="card-rest-already-note">
            These cards are still unavailable — update your deck before the next act.
          </div>
        </div>
      )}

      <div className="card-rest-candidates">
        {candidates.map((name, i) => {
          const isSelected = selected.has(name)
          return (
            <CardRestSelectCandidate 
            key={name} 
            name={name} 
            playCount={playCounts[name] ?? 0} 
            rank={i + 1} 
            isSelected={isSelected} 
            onClick={() => toggle(name)}
             />

          )
        })}
      </div>

      <div className="card-rest-footer">
        <div className="card-rest-note">
          Rested cards show as [RESTING] in the Deck Builder and can't be added to your deck.
        </div>
        <button
          className="action-btn action-btn--large"
          disabled={!ready}
          onClick={() => onConfirm(Array.from(selected))}
        >
          REST {selected.size} CARD{selected.size !== 1 ? 'S' : ''}
        </button>
      </div>
    </div>
  )
}
