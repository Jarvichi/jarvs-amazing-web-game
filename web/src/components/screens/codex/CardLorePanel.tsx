import React from 'react'
import { CodexCardEntry } from '../../../game/codex'
import { RARITY_COLOR } from '../../../theme'
import type { CardRarity } from '../../../game/types'

export function CardLorePanel({ card }: { card: CodexCardEntry }) {
  if (!card.unlocked) {
    return (
      <div className="codex-entry codex-entry--locked">
        <div className="codex-entry-name">??? — {card.cardType}</div>
        <div className="codex-entry-locked-hint">Discover this card to unlock its entry.</div>
      </div>
    )
  }
  return (
    <div className="codex-entry">
      <div className="codex-entry-header">
        {/* RARITY_COLOR (#2206) is the single canonical rarity→colour map,
            replacing four components' worth of independently-drifted
            definitions — reading it here at render time is the fix, not a
            regression, so this inline colour stays rather than becoming a
            parallel (and driftable) set of CSS classes. */}
        <span className="codex-entry-name" style={{ color: RARITY_COLOR[card.rarity as CardRarity] ?? 'var(--hub-text-on)' }}>
          {card.name}
        </span>
        <span className="codex-entry-tag">{card.rarity.toUpperCase()}</span>
        <span className="codex-entry-tag">{card.cardType.toUpperCase()}</span>
      </div>
      <div className="codex-entry-desc">{card.description}</div>
      {card.lore && <div className="codex-entry-lore">"{card.lore}"</div>}
    </div>
  )
}
