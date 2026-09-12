import React from 'react'
import { CodexWorldEntry } from '../../../game/codex'

export function WorldLorePanel({ entry }: { entry: CodexWorldEntry }) {
  if (!entry.unlocked) {
    return (
      <div className="codex-entry codex-entry--locked">
        <div className="codex-entry-name">??? — {entry.title}</div>
        <div className="codex-entry-locked-hint">Complete this act to unlock its entry.</div>
      </div>
    )
  }
  return (
    <div className="codex-entry">
      <div className="codex-entry-header">
        <span className="codex-entry-name codex-entry-name--soft">{entry.subtitle}</span>
        <span className="codex-entry-tag">{entry.title}</span>
      </div>
      {entry.shardLore && <div className="codex-entry-lore">"{entry.shardLore}"</div>}
      {entry.bossName !== '???' && (
        <div className="codex-entry-boss">
          <span className="codex-entry-boss-label">GUARDIAN</span>
          <span className="codex-entry-boss-name">{entry.bossName}</span>
          {entry.bossDescription && (
            <span className="codex-entry-desc"> — {entry.bossDescription}</span>
          )}
        </div>
      )}
    </div>
  )
}
