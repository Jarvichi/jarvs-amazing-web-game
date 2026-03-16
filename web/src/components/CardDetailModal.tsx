import React from 'react'
import { Card } from '../game/types'
import {
  CollectionEntry,
  DeckEntry,
  getOwnedCount,
  getMasteryXp,
  masteryProgress,
  getCardStats,
} from '../game/collection'
import { CardTile } from './CardTile'

interface Props {
  card: Card
  collection: CollectionEntry[]
  deckEntries?: DeckEntry[]
  onClose: () => void
}

const RARITY_COLOUR: Record<string, string> = {
  common:    '#55cc55',
  uncommon:  '#4499ff',
  rare:      '#bb66ff',
  legendary: '#ffcc00',
}

function statLine(label: string, value: string | number) {
  return (
    <div className="cdm-stat-row">
      <span className="cdm-stat-label">{label}</span>
      <span className="cdm-stat-value">{value}</span>
    </div>
  )
}

export function CardDetailModal({ card, collection, deckEntries, onClose }: Props) {
  const owned  = getOwnedCount(collection, card.name)
  const inDeck = deckEntries?.find(e => e.cardName === card.name)?.count ?? 0
  const xp     = getMasteryXp(collection, card.name)
  const { level: masteryLvl, current: xpCur, needed: xpNeeded } = masteryProgress(xp)
  const xpPct  = xpNeeded > 0 ? Math.round((xpCur / xpNeeded) * 100) : 100
  const rarityCol = RARITY_COLOUR[card.rarity] ?? 'var(--game-text-color-dim)'

  // Stats — card name for "played", unit name for "died"
  const statsPlayed  = getCardStats(card.name)
  const statsUnit    = card.unit ? getCardStats(card.unit.name) : null

  const u = card.unit

  // Build trait tags
  const traits: string[] = []
  if (u) {
    if (u.moveSpeed === 0)   traits.push('structure')
    if (u.isWall)            traits.push('wall')
    if (u.flying)            traits.push('flying')
    if (u.climber)           traits.push('climber')
    if (u.bypassWall && u.moveSpeed > 0) traits.push('ranged')
  }

  return (
    <div className="cdm-backdrop" onClick={onClose}>
      <div className="cdm-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="cdm-header">
          <span className="cdm-name" style={{ color: rarityCol }}>{card.name}</span>
          <span className="cdm-rarity" style={{ color: rarityCol }}>
            {'★'.repeat({ common: 1, uncommon: 2, rare: 3, legendary: 4 }[card.rarity])}
            {' '}{card.rarity.toUpperCase()}
          </span>
          <button className="cdm-close" onClick={onClose}>✕</button>
        </div>

        <div className="cdm-body">
          {/* Left: card visual */}
          <div className="cdm-card-col">
            <CardTile card={card} canAfford={true} />
            <div className="cdm-owned">×{owned} owned{inDeck > 0 ? ` · ×${inDeck} in deck` : ''}</div>
          </div>

          {/* Right: stats */}
          <div className="cdm-info-col">
            <div className="cdm-desc">{card.description}</div>

            {/* Unit stats */}
            {u && u.moveSpeed > 0 && (
              <div className="cdm-stats-block">
                {statLine('ATK',   u.attack)}
                {statLine('HP',    u.maxHp)}
                {statLine('SPD',   u.moveSpeed)}
                {u.attackRange > 0 && statLine('RNG', u.attackRange)}
                {u.attackCooldownMs > 0 && statLine('CD', `${(u.attackCooldownMs / 1000).toFixed(1)}s`)}
              </div>
            )}
            {u && u.moveSpeed === 0 && u.maxHp > 0 && (
              <div className="cdm-stats-block">
                {statLine('HP', u.maxHp)}
              </div>
            )}

            {/* Traits */}
            {traits.length > 0 && (
              <div className="cdm-traits">
                {traits.map(t => <span key={t} className="cdm-trait">{t}</span>)}
              </div>
            )}

            {/* Strengths & Weaknesses */}
            {u && (u.strengths?.length || u.weaknesses?.length) ? (
              <div className="cdm-sw-block">
                {u.strengths && u.strengths.length > 0 && (
                  <div className="cdm-sw-row">
                    <span className="cdm-sw-label cdm-sw-label--strong">⚔ Strong vs</span>
                    <span className="cdm-sw-tags">{u.strengths.join(', ')}</span>
                  </div>
                )}
                {u.weaknesses && u.weaknesses.length > 0 && (
                  <div className="cdm-sw-row">
                    <span className="cdm-sw-label cdm-sw-label--weak">⚠ Weak to</span>
                    <span className="cdm-sw-tags">{u.weaknesses.join(', ')}</span>
                  </div>
                )}
                {u.affinity && (
                  <div className="cdm-sw-row">
                    <span className="cdm-sw-label cdm-sw-label--affinity">✦ Affinity</span>
                    <span className="cdm-sw-tags">{u.affinity.label} (near {u.affinity.withName})</span>
                  </div>
                )}
              </div>
            ) : null}

            {/* Mastery */}
            <div className="cdm-mastery-block">
              <div className="cdm-mastery-header">
                <span style={{ color: '#ffd700' }}>★ Mastery {masteryLvl}</span>
                <span className="cdm-mastery-xp">{xpCur}/{xpNeeded} to Lv{masteryLvl + 1}</span>
              </div>
              <div className="mastery-bar-track" style={{ marginTop: 4 }}>
                <div className="mastery-bar-fill" style={{ width: `${xpPct}%` }} />
              </div>
              {masteryLvl > 0 && u && (
                <div className="cdm-mastery-bonus">
                  {u.moveSpeed > 0
                    ? `+${masteryLvl} ATK  +${masteryLvl * 2} HP (mastery bonus)`
                    : `+${masteryLvl * 10} HP (mastery bonus)`}
                </div>
              )}
            </div>

            {/* Battle stats */}
            <div className="cdm-battle-stats">
              {statLine('Times played',  statsPlayed.played)}
              {statsUnit && statLine('Units lost', statsUnit.died)}
            </div>
          </div>
        </div>

        {/* Lore */}
        {card.lore && (
          <div className="cdm-lore">"{card.lore}"</div>
        )}
      </div>
    </div>
  )
}
