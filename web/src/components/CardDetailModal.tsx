import React, { useState } from 'react'
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
import { ModalBackdrop } from './ModalBackdrop'
import { MasteryBar } from './MasteryBar'
import { StatRow } from './StatRow'

interface Props {
  card: Card
  collection: CollectionEntry[]
  deckEntries?: DeckEntry[]
  onClose: () => void
  extras?: number
  disenchantValue?: number
  onDisenchant?: () => void
  onMasterCard?: () => void
}

const RARITY_COLOUR: Record<string, string> = {
  common:    '#55cc55',
  uncommon:  '#4499ff',
  rare:      '#bb66ff',
  legendary: '#ffcc00',
}


function affinityEffectText(effectType: string, effectAmount: number): string {
  const pct = Math.round(Math.abs(effectAmount - 1) * 100)
  if (effectType === 'attackSpeed') return `+${pct}% attack speed`
  if (effectType === 'damage')      return `+${pct}% damage dealt`
  if (effectType === 'moveSpeed')   return `+${pct}% movement speed`
  return `×${effectAmount} ${effectType}`
}

export function CardDetailModal({ card, collection, deckEntries, onClose, extras = 0, disenchantValue = 0, onDisenchant, onMasterCard }: Props) {
  const owned  = getOwnedCount(collection, card.name)
  const inDeck = deckEntries?.find(e => e.cardName === card.name)?.count ?? 0
  const xp     = getMasteryXp(collection, card.name)
  const { level: masteryLvl, current: xpCur, needed: xpNeeded } = masteryProgress(xp)
  const rarityCol = RARITY_COLOUR[card.rarity] ?? 'var(--game-text-color-dim)'

  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const toggleRow = (key: string) => setExpandedRow(prev => prev === key ? null : key)

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
    // Append combat tags that aren't already represented
    for (const t of (u.tags ?? [])) {
      if (!traits.includes(t)) traits.push(t)
    }
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="cdm-panel">

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
                <StatRow compact label="ATK" value={u.attack} />
                <StatRow compact label="HP"  value={u.maxHp} />
                <StatRow compact label="SPD" value={u.moveSpeed} />
                {u.attackRange > 0 && <StatRow compact label="RNG" value={u.attackRange} />}
                {u.attackCooldownMs > 0 && <StatRow compact label="CD" value={`${(u.attackCooldownMs / 1000).toFixed(1)}s`} />}
              </div>
            )}
            {u && u.moveSpeed === 0 && u.maxHp > 0 && (
              <div className="cdm-stats-block">
                <StatRow compact label="HP" value={u.maxHp} />
              </div>
            )}

            {/* Traits */}
            {traits.length > 0 && (
              <div className="cdm-traits">
                {traits.map(t => <span key={t} className="cdm-trait">{t}</span>)}
              </div>
            )}

            {/* Strengths, Weaknesses & Affinity */}
            {u && (u.strengths?.length || u.weaknesses?.length || u.affinity) ? (
              <div className="cdm-sw-block">
                {u.strengths && u.strengths.length > 0 && (
                  <>
                    <button className="cdm-sw-row cdm-sw-row--btn" onClick={() => toggleRow('strong')}>
                      <span className="cdm-sw-label cdm-sw-label--strong">⚔ Strong vs</span>
                      <span className="cdm-sw-tags">{u.strengths.join(', ')}</span>
                      <span className="cdm-sw-chevron">{expandedRow === 'strong' ? '▲' : '▼'}</span>
                    </button>
                    {expandedRow === 'strong' && (
                      <div className="cdm-sw-detail">
                        Deals <strong>×1.5 damage</strong> against units tagged:{' '}
                        {u.strengths.map(t => <em key={t}>{t}</em>).reduce<React.ReactNode[]>((a, el, i) => i === 0 ? [el] : [...a, ', ', el], [])}
                      </div>
                    )}
                  </>
                )}
                {u.weaknesses && u.weaknesses.length > 0 && (
                  <>
                    <button className="cdm-sw-row cdm-sw-row--btn" onClick={() => toggleRow('weak')}>
                      <span className="cdm-sw-label cdm-sw-label--weak">⚠ Weak to</span>
                      <span className="cdm-sw-tags">{u.weaknesses.join(', ')}</span>
                      <span className="cdm-sw-chevron">{expandedRow === 'weak' ? '▲' : '▼'}</span>
                    </button>
                    {expandedRow === 'weak' && (
                      <div className="cdm-sw-detail">
                        Enemies tagged{' '}
                        {u.weaknesses.map(t => <em key={t}>{t}</em>).reduce<React.ReactNode[]>((a, el, i) => i === 0 ? [el] : [...a, ', ', el], [])}{' '}
                        deal <strong>×1.5 damage</strong> to this unit.
                      </div>
                    )}
                  </>
                )}
                {u.affinity && (
                  <>
                    <button className="cdm-sw-row cdm-sw-row--btn" onClick={() => toggleRow('affinity')}>
                      <span className="cdm-sw-label cdm-sw-label--affinity">✦ Affinity</span>
                      <span className="cdm-sw-tags">{u.affinity.label}</span>
                      <span className="cdm-sw-chevron">{expandedRow === 'affinity' ? '▲' : '▼'}</span>
                    </button>
                    {expandedRow === 'affinity' && (
                      <div className="cdm-sw-detail">
                        When a <strong>{u.affinity.withName}</strong> is nearby (within {u.affinity.range}px),
                        grants <strong>{affinityEffectText(u.affinity.effectType, u.affinity.effectAmount)}</strong>.
                        <br />"{u.affinity.label}"
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : null}

            {/* Mastery */}
            <div className="cdm-mastery-block">
              <div className="cdm-mastery-header">
                <span style={{ color: '#ffd700' }}>★ Mastery {masteryLvl}</span>
                <span className="cdm-mastery-xp">{xpCur}/{xpNeeded} to Lv{masteryLvl + 1}</span>
              </div>
              <MasteryBar xp={xp} />
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
              <StatRow compact label="Times played" value={statsPlayed.played} />
              {statsUnit && <StatRow compact label="Units lost" value={statsUnit.died} />}
            </div>
          </div>
        </div>

        {/* Lore */}
        {card.lore && (
          <div className="cdm-lore">"{card.lore}"</div>
        )}

        {/* Sell / Upgrade actions (collection only) */}
        {extras > 0 && (onDisenchant || onMasterCard) && (
          <div className="cdm-actions">
            {onDisenchant && (
              <button className="extra-btn extra-btn--disenchant" onClick={onDisenchant}>
                Sell +{disenchantValue}💎
              </button>
            )}
            {onMasterCard && (
              <button className="extra-btn extra-btn--master" onClick={onMasterCard}>
                Upgrade +{extras}XP
              </button>
            )}
          </div>
        )}
      </div>
    </ModalBackdrop>
  )
}
