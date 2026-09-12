import React from 'react'
import { CodexConversationEntry } from '../../../game/codex'

export function ConversationLorePanel({ entry }: { entry: CodexConversationEntry }) {
  return (
    <div className="codex-entry">
      <div className="codex-entry-header">
        <span className="codex-entry-name">{entry.icon} {entry.name}</span>
        <span className="codex-entry-tag">{entry.title.toUpperCase()}</span>
        <span className="codex-entry-tag">{entry.seenCount} / {entry.stages.length} ENCOUNTERS</span>
      </div>
      <div className="codex-conversation-stages">
        {entry.stages.map((stage) => (
          stage.seen ? (
            <div key={stage.index} className="codex-conversation-stage">
              <div className="codex-conversation-stage-label">ENCOUNTER {stage.index + 1}</div>
              {stage.greeting.split('\n\n').map((para, i) => (
                <div key={i} className="codex-entry-desc">{para}</div>
              ))}
              {stage.choices && (
                <div className="codex-conversation-choices">
                  {stage.choices.map((choice, j) => (
                    <div key={j} className="codex-conversation-choice">
                      <div className="codex-conversation-choice-label">› {choice.label}</div>
                      <div className="codex-conversation-choice-response">{choice.response}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div key={stage.index} className="codex-conversation-stage codex-conversation-stage--locked">
              <div className="codex-conversation-stage-label">ENCOUNTER {stage.index + 1}</div>
              <div className="codex-entry-locked-hint">Meet {entry.name} again to unlock this encounter.</div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}
