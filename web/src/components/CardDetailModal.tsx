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
  commanderName?: string | null
  promotionsLeft?: number
  onPromote?: () => void
}

const RARITY_COLOUR: Record<string, string> = {
  common:    '#55cc55',
  uncommon:  '#4499ff',
  rare:      '#bb66ff',
  epic:      '#ff8800',
  legendary: '#ffcc00',
}


function affinityEffectText(effectType: string, effectAmount: number): string {
  const pct = Math.round(Math.abs(effectAmount - 1) * 100)
  if (effectType === 'attackSpeed') return `+${pct}% attack speed`
  if (effectType === 'damage')      return `+${pct}% damage dealt`
  if (effectType === 'moveSpeed')   return `+${pct}% movement speed`
  return `×${effectAmount} ${effectType}`
}

export function CardDetailModal({ card, collection, deckEntries, onClose, extras = 0, disenchantValue = 0, onDisenchant, onMasterCard, commanderName, promotionsLeft = 0, onPromote }: Props) {
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

  // Mastery stat bonuses (mirroring applyMasteryBonus in collection.ts)
  const atkBonus = (u && u.moveSpeed > 0) ? masteryLvl : 0
  const hpBonus  = u
    ? u.moveSpeed > 0
      ? masteryLvl * 2
      : Math.round(u.maxHp * (1 + 0.1 * masteryLvl)) - u.maxHp
    : 0

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
            {'★'.repeat({ common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 }[card.rarity])}
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
                <StatRow compact label="ATK" value={atkBonus > 0 ? <>{u.attack + atkBonus} <span className="cdm-stat-bonus">(+{atkBonus})</span></> : u.attack} />
                <StatRow compact label="HP"  value={hpBonus  > 0 ? <>{u.maxHp  + hpBonus}  <span className="cdm-stat-bonus">(+{hpBonus})</span></> : u.maxHp} />
                <StatRow compact label="SPD" value={u.moveSpeed} />
                {u.attackRange > 0 && <StatRow compact label="RNG" value={u.attackRange} />}
                {u.attackCooldownMs > 0 && <StatRow compact label="CD" value={`${(u.attackCooldownMs / 1000).toFixed(1)}s`} />}
              </div>
            )}
            {u && u.moveSpeed === 0 && u.maxHp > 0 && (
              <div className="cdm-stats-block">
                <StatRow compact label="HP" value={hpBonus > 0 ? <>{u.maxHp + hpBonus} <span className="cdm-stat-bonus">(+{hpBonus})</span></> : u.maxHp} />
                {u.structureEffect?.type === 'spawn' && (() => {
                  const rates: number[] = []
                  let ms = u.structureEffect.intervalMs
                  for (let i = 0; i < 4; i++) {
                    rates.push(ms)
                    ms = Math.max(1500, Math.floor(ms / 2))
                  }
                  return (
                    <>
                      <StatRow compact label="Spawn" value={`${(rates[0] / 1000).toFixed(1)}s`} />
                      <div className="cdm-spawn-levels">
                        {rates.slice(1).map((r, i) => (
                          <span key={i} className="cdm-spawn-lvl">Lv{i + 2}: {(r / 1000).toFixed(1)}s</span>
                        ))}
                      </div>
                    </>
                  )
                })()}
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
                      <span className="cdm-sw-label cdm-sw-label--affinity">
                        {masteryLvl < 1 ? '🔒' : '✦'} Affinity
                      </span>
                      <span className="cdm-sw-tags">{u.affinity.label}</span>
                      <span className="cdm-sw-chevron">{expandedRow === 'affinity' ? '▲' : '▼'}</span>
                    </button>
                    {expandedRow === 'affinity' && (
                      <div className="cdm-sw-detail">
                        {masteryLvl < 1 && (
                          <div className="cdm-locked-note">Requires Mastery 1 to activate.</div>
                        )}
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
                <span style={{ color: masteryLvl >= 5 ? '#ff9900' : '#ffd700' }}>
                  {masteryLvl >= 5 ? '⚡' : '★'} Mastery {masteryLvl}{masteryLvl >= 5 ? ' — ELITE' : ''}
                </span>
                {masteryLvl < 5 && <span className="cdm-mastery-xp">{xpCur}/{xpNeeded} to Lv{masteryLvl + 1}</span>}
              </div>
              <MasteryBar xp={xp} />
              {u && u.moveSpeed > 0 && (
                <div className="cdm-mastery-milestones">
                  <div className={`cdm-milestone${masteryLvl >= 1 ? ' cdm-milestone--unlocked' : ''}`}>
                    Lv1 — Affinity activates
                  </div>
                  <div className={`cdm-milestone${masteryLvl >= 5 ? ' cdm-milestone--unlocked' : ''}`}>
                    Lv5 — Elite: +10% damage dealt
                  </div>
                </div>
              )}
              {u && u.moveSpeed === 0 && (() => {
                const se = u.structureEffect as { type: string } | undefined
                const milestones: { lvl: number; text: string }[] = [
                  { lvl: 1, text: '+10% max HP per level' },
                ]
                if (u.isWall) {
                  milestones.push({ lvl: 5, text: 'Elite: self-repairs 2 HP every 6s' })
                } else if (se?.type === 'spawn') {
                  milestones.push({ lvl: 1, text: '−5% spawn interval per level' })
                } else if (se?.type === 'mana') {
                  milestones.push({ lvl: 5, text: 'Elite: +1 mana produced per turn' })
                } else if (se?.type === 'healAura') {
                  milestones.push({ lvl: 1, text: '+1 heal per level' })
                  milestones.push({ lvl: 5, text: 'Elite: 25% faster heal pulses' })
                } else if (se?.type === 'repairAura') {
                  milestones.push({ lvl: 1, text: '+1 repair per level' })
                  milestones.push({ lvl: 5, text: 'Elite: 25% faster repair pulses' })
                } else if (se?.type === 'attackAura') {
                  milestones.push({ lvl: 1, text: '+1 ATK aura per 2 levels' })
                } else if (se?.type === 'manaSpeed') {
                  milestones.push({ lvl: 1, text: '4% faster mana regen per level' })
                }
                return (
                  <div className="cdm-mastery-milestones">
                    {milestones.map(m => (
                      <div key={m.text} className={`cdm-milestone${masteryLvl >= m.lvl ? ' cdm-milestone--unlocked' : ''}`}>
                        Lv{m.lvl} — {m.text}
                      </div>
                    ))}
                  </div>
                )
              })()}
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

        {/* Promote to Commander (unit cards only) */}
        {onPromote && u && u.moveSpeed > 0 && (
          <div className="cdm-actions cdm-actions--commander">
            {commanderName === card.name ? (
              <div className="cdm-commander-badge">⭐ Current Commander</div>
            ) : (
              <button
                className="extra-btn extra-btn--promote"
                onClick={onPromote}
                disabled={promotionsLeft === 0}
                title={promotionsLeft === 0 ? 'Promotion limit reached for today (2/day)' : undefined}
              >
                {promotionsLeft === 0
                  ? '🔒 Promotions used today'
                  : `⭐ Promote to Commander${commanderName ? ` (replaces ${commanderName})` : ''}`}
              </button>
            )}
            {promotionsLeft > 0 && commanderName !== card.name && (
              <div className="cdm-promo-hint">{promotionsLeft} promotion{promotionsLeft !== 1 ? 's' : ''} remaining today</div>
            )}
          </div>
        )}
      </div>
    </ModalBackdrop>
  )
}
