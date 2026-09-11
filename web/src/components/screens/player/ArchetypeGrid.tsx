import React from 'react'
import type { Archetype } from '../../../game/types'
import type { ArchetypeDef } from '../../../game/questline'
import { Icon } from '../../ui/icons/Icon'

interface Props {
  defs: (ArchetypeDef & { locked: boolean })[]
  selected: Archetype | null
  onChoose: (id: Archetype) => void
}

export function ArchetypeGrid({ defs, selected, onChoose }: Props) {
  return (
    <div className="character-archetype-grid">
      {defs.map(def => (
        <button
          key={def.id}
          className={`character-archetype-btn${selected === def.id ? ' character-archetype-btn--chosen' : ''}${def.locked ? ' character-archetype-btn--locked' : ''}`}
          onClick={def.locked ? undefined : () => onChoose(def.id)}
          title={def.locked ? `${def.name} — complete the campaign to unlock` : def.name}
        >
          {selected === def.id && (
            <span className="character-archetype-selected-badge">✓ SELECTED</span>
          )}
          <span className="character-archetype-icon">{def.locked ? <Icon name="lock" size={18} /> : def.icon}</span>
          <span className="character-archetype-name">{def.locked ? '???' : def.name}</span>
          {!def.locked && <span className="character-archetype-identity">{def.identity}</span>}
          {!def.locked && <span className="character-archetype-passive">{def.passive}</span>}
        </button>
      ))}
    </div>
  )
}
