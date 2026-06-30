import React from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { getCharacterDef, getCharacterState, CharacterStage } from '../../game/characters'

interface Props {
  characterId: string
  onBack: () => void
}

export function NarratorJournalScreen({ characterId, onBack }: Props) {
  const def = getCharacterDef(characterId)
  if (!def) return null

  const { count } = getCharacterState(characterId)
  const seenEncounters = def.encounters.slice(0, Math.min(count, def.encounters.length))
  const epilogueVisits = count - def.encounters.length
  const seenEpilogue = def.epilogue && epilogueVisits > 0
    ? def.epilogue.slice(0, Math.min(epilogueVisits, def.epilogue.length))
    : []
  const seenStages: CharacterStage[] = [...seenEncounters, ...seenEpilogue]

  return (
    <OverlayScreen title={def.name} subtitle={def.title} onBack={onBack}>
      <div className="char-screen u-col u-items-c u-gap-6 u-grow">
        <span className="char-icon">{def.icon}</span>

        {seenStages.length === 0 ? (
          <p className="char-para">You haven't crossed paths with {def.name} yet.</p>
        ) : (
          <div className="char-body u-col u-gap-4">
            {seenStages.map((stage, i) => (
              <div key={i} className="narrator-journal-entry">
                {stage.greeting.split('\n\n').map((para, j) => (
                  <p key={j} className="char-para">{para}</p>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </OverlayScreen>
  )
}
