import React from 'react'
import { CodexRelicEntry } from '../../../game/codex'

export function RelicLorePanel({ relic }: { relic: CodexRelicEntry }) {
  if (!relic.unlocked) {
    return (
      <div className="codex-entry codex-entry--locked">
        <div className="codex-entry-name">{relic.icon} ???</div>
        <div className="codex-entry-locked-hint">Earn this relic to unlock its entry.</div>
      </div>
    )
  }
  return (
    <div className="codex-entry">
      <div className="codex-entry-header">
        <span className="codex-entry-name">{relic.icon} {relic.name}</span>
        {relic.exotic && <span className="relic-exotic-tag codex-relic-exotic-tag">EXOTIC</span>}
      </div>
      <div className="codex-entry-desc">{relic.desc}</div>
      {relic.lore && <div className="codex-entry-lore">"{relic.lore}"</div>}
    </div>
  )
}
