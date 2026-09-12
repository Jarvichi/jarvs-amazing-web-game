import React from 'react'
import { CodexFragmentEntry } from '../../../game/codex'

export function FragmentLorePanel({ entry }: { entry: CodexFragmentEntry }) {
  if (!entry.discovered) {
    return (
      <div className="codex-entry codex-entry--locked">
        <div className="codex-entry-name">◆ ??? — {entry.actId.toUpperCase()}</div>
        <div className="codex-entry-locked-hint">Find this memory fragment on the campaign map to unlock its entry.</div>
      </div>
    )
  }
  return (
    <div className="codex-entry">
      <div className="codex-entry-header">
        <span className="codex-entry-name codex-entry-name--frost">◆ {entry.title}</span>
        <span className="codex-entry-tag">{entry.actId.toUpperCase()}</span>
      </div>
      {entry.body.split('\n\n').map((para, i) => (
        <div key={i} className="codex-entry-desc">{para}</div>
      ))}
    </div>
  )
}
