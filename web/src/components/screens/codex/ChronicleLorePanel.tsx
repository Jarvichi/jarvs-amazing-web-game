import React from 'react'
import { CodexChronicleEntry } from '../../../game/codex'
import { Icon } from '../../ui/icons/Icon'

export function ChronicleLorePanel({ entry }: { entry: CodexChronicleEntry }) {
  if (!entry.unlocked) {
    return (
      <div className="codex-entry codex-entry--locked">
        <div className="codex-entry-name"><Icon name="chronicle" size={13} /> Chapter {entry.number} — ???</div>
        <div className="codex-entry-locked-hint">Complete this Fracture Chronicle chapter to unlock its entry.</div>
      </div>
    )
  }
  return (
    <div className="codex-entry">
      <div className="codex-entry-header">
        <span className="codex-entry-name codex-entry-name--gold"><Icon name="chronicle" size={13} /> {entry.title}</span>
        <span className="codex-entry-tag">CHAPTER {entry.number}</span>
      </div>
      {entry.lore.split('\n\n').map((para, i) => (
        <div key={i} className="codex-entry-desc">{para}</div>
      ))}
    </div>
  )
}
