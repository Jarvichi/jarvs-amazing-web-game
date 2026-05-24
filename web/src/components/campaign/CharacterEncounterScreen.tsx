import React, { useState } from 'react'
import { getCharacterDef, getCharacterStage, CharacterChoice } from '../../game/characters'

interface Props {
  characterId: string
  onDone: (choice?: CharacterChoice) => void
}

export function CharacterEncounterScreen({ characterId, onDone }: Props) {
  const def   = getCharacterDef(characterId)
  const stage = getCharacterStage(characterId)
  const [response, setResponse] = useState<string | null>(null)
  const [chosen,   setChosen]   = useState<CharacterChoice | null>(null)

  if (!def) return null

  function handleChoice(choice: CharacterChoice) {
    setResponse(choice.response)
    setChosen(choice)
  }

  return (
    <div className="char-screen u-col u-items-c u-gap-6 u-grow">
      <div className="char-header u-col u-items-c u-gap-2">
        <span className="char-icon">{def.icon}</span>
        <div className="char-name">{def.name}</div>
        <div className="char-title">{def.title}</div>
      </div>

      <div className="char-body">
        {stage.greeting.split('\n\n').map((para, i) => (
          <p key={i} className="char-para">{para}</p>
        ))}
      </div>

      {!response && stage.choices && stage.choices.length > 0 && (
        <div className="char-choices u-col u-gap-3">
          {stage.choices.map((c, i) => (
            <button
              key={i}
              className="action-btn char-choice-btn"
              onClick={() => handleChoice(c)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {response && (
        <div className="char-response u-col u-items-c u-gap-4">
          <p className="char-para char-para--response">{response}</p>
          <button className="action-btn" onClick={() => onDone(chosen ?? undefined)}>
            Continue
          </button>
        </div>
      )}

      {!response && (!stage.choices || stage.choices.length === 0) && (
        <button className="action-btn" onClick={() => onDone()}>
          Continue
        </button>
      )}
    </div>
  )
}
