import React, { useMemo, useState } from 'react'
import { AugmentEffect, AugmentInstance, AugmentSlot, Card } from '../../game/types'
import {
  CollectionEntry,
  DeckEntry,
  getOwnedCount,
  getMasteryXp,
  masteryProgress,
  getCardStats,
  AUGMENT_UPGRADE_COST,
  loadAugmentSouls,
  getSetBonus,
  getEquippedAugments,
  upgradeAugment,
  mergeAugmentEffects,
} from '../../game/collection'
import { ALL_AUGMENT_SLOTS, AugmentSetDef, augmentSlotLabel, getAugmentCard, getAugmentSetDef, scaledAugmentEffect } from '../../game/augments'
import { getComboLinks, getSynergyGroups } from '../../game/synergies'
import { CardTile } from './CardTile'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { MasteryBar } from '../ui/MasteryBar'
import { StatRow } from '../ui/StatRow'
import { CardDetailHeader } from './CardDetailHeader'
import { AugStatRow, masteryStatBonuses } from './AugStatRow'
import { AnimatedSpriteImg } from '../ui/SpriteImg'
import { Toolbar } from '../ui/Toolbar/Toolbar'
import { ToolbarButton } from '../ui/Toolbar/ToolbarButton'
import { AugmentPickerModal } from './AugmentPickerModal'
import { ToolbarLabel } from '../ui/Toolbar/ToolbarLabel'
import { ToolbarSpacer } from '../ui/Toolbar/ToolbarSpacer'



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
  // Augment-instance specific (optional)
  augmentLevel?: number
  augmentEquippedTo?: string | null
  canUpgrade?: boolean
  onUpgrade?: () => void
  breakdownValue?: number
  onBreakdown?: () => void
}

// Keep in step with .card-tile--* (--card-frame in cards.css) and
// .rarity-badge--* in collection.css. There are five copies of this mapping
// across the app today — see the consolidation issue.
const RARITY_COLOUR: Record<string, string> = {
  common:    '#999999',
  uncommon:  '#4499ff',
  rare:      '#bb66ff',
  epic:      '#ff8800',
  legendary: '#ffcc00',
  mythic:    '#e040fb',
  shiny:     '#ffe066',
  holofoil:  '#40e0d0',
  glass:     '#a0d8ef',
}


// AugStatRow now lives in ./AugStatRow so CardAugmentScreen shares it.

function effectSummary(effect: AugmentEffect): string {
  const parts: string[] = []
  if (effect.maxHp)       parts.push(`+${effect.maxHp} HP`)
  if (effect.attack)      parts.push(`+${effect.attack} ATK`)
  if (effect.attackRange) parts.push(`+${effect.attackRange} RNG`)
  if (effect.moveSpeed)   parts.push(`+${effect.moveSpeed} SPD`)
  return parts.join(', ')
}


function affinityEffectText(effectType: string, effectAmount: number): string {
  const pct = Math.round(Math.abs(effectAmount - 1) * 100)
  if (effectType === 'attackSpeed') return `+${pct}% attack speed`
  if (effectType === 'damage')      return `+${pct}% damage dealt`
  if (effectType === 'moveSpeed')   return `+${pct}% movement speed`
  return `×${effectAmount} ${effectType}`
}

export function CardDetailModal({ card, collection, deckEntries, onClose, extras = 0, disenchantValue = 0, onDisenchant, onMasterCard, commanderName, promotionsLeft = 0, onPromote, augmentLevel, augmentEquippedTo, canUpgrade, onUpgrade, breakdownValue = 0, onBreakdown }: Props) {
  const owned  = getOwnedCount(collection, card.name)
  const inDeck = deckEntries?.find(e => e.cardName === card.name)?.count ?? 0
  const xp     = getMasteryXp(collection, card.name)

  const forceRefresh = () => setRefresh((r: number) => r + 1)
    
  const { level: masteryLvl, current: xpCur, needed: xpNeeded } = masteryProgress(xp)
  const rarityCol = RARITY_COLOUR[card.rarity] ?? 'var(--game-text-color-dim)'

  const [activeTab, setActiveTab] = useState(0)

  const [refresh, setRefresh] = useState(0)
  const [pickerSlot, setPickerSlot] = useState<AugmentSlot | null>(null)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)  

  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const toggleRow = (key: string) => setExpandedRow(prev => prev === key ? null : key)

  const synergyGroups = getSynergyGroups(card)
  const comboLinks    = getComboLinks(card)

  // Stats — card name for "played", unit name for "died"
  const statsPlayed  = getCardStats(card.name)
  const statsUnit    = card.unit ? getCardStats(card.unit.name) : null

  const equippedMap = getEquippedAugments(card.name)
  const setBonus    = getSetBonus(card.name)
  const souls       = loadAugmentSouls()

  const u = card.unit

  // Mastery stat bonuses. These were computed here and then never rendered —
  // the modal showed base + augments only, so a mastered card understated its
  // real power. Now shared with CardAugmentScreen so both agree.
  const { atk: atkBonus, hp: hpBonus } = masteryStatBonuses(u, masteryLvl)

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

  // Compute total augment effect for live stat display
  const totalAugmentEffect = useMemo(() => {
    let effect: AugmentEffect = {}
    for (const inst of Object.values(equippedMap)) {
      const augCard = getAugmentCard(inst.cardId)
      if (!augCard?.augmentEffect) continue
      const scaled = scaledAugmentEffect(augCard.augmentEffect, inst.level)
      effect = mergeAugmentEffects(effect, scaled)
    }
    if (setBonus) effect = mergeAugmentEffects(effect, setBonus.effect)
    return effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh])

  // Whether any stat is actually boosted — the breakdown toggle is pointless
  // otherwise. Structures never take augments (see applyAugmentBonuses), so
  // only their mastery HP counts.
  const hasStatBonus = u
    ? u.moveSpeed > 0
      ? atkBonus !== 0 || hpBonus !== 0 ||
        [totalAugmentEffect.attack, totalAugmentEffect.maxHp,
         totalAugmentEffect.moveSpeed, totalAugmentEffect.attackRange]
          .some(v => v != null && v !== 0)
      : hpBonus !== 0
    : false

  function handleUpgrade(inst: AugmentInstance) {
    const err = upgradeAugment(inst.instanceId)
    if (err) {
      setUpgradeError(err)
      setTimeout(() => setUpgradeError(null), 2500)
    }
    forceRefresh()
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="cdm-panel">

        {/* Header */}
        <CardDetailHeader card={card} collection={collection} colour={rarityCol} onClose={onClose} />

        <div className="cdm-body u-flex u-gap-6">
          {/* Left: card visual */}
          <div className="cdm-card-col u-col u-items-c u-gap-3">
            <AnimatedSpriteImg
              name={card.name}
              frameCount={3}
              fps={2}
              className="commander-sprite"
            />
            <div className="cdm-owned">×{owned} owned{inDeck > 0 ? ` · ×${inDeck} in deck` : ''}</div>
          </div>

          {/* Right: stats */}
          <div className="cdm-info-col u-grow u-col u-gap-4">
              <div className="cdm-desc">{card.description}</div>
              {card.lore && <div className="cdm-lore">{card.lore}</div>}

              {/* Unit stats */}
              {u && u.moveSpeed > 0 && (
                <div className="cdm-stats-block u-flex u-wrap">
                  <AugStatRow label="ATK" base={u.attack}    mastery={atkBonus} augment={totalAugmentEffect.attack}      breakdown={showBreakdown} />
                  <AugStatRow label="HP"  base={u.maxHp}     mastery={hpBonus}  augment={totalAugmentEffect.maxHp}       breakdown={showBreakdown} />
                  <AugStatRow label="SPD" base={u.moveSpeed}                    augment={totalAugmentEffect.moveSpeed}   breakdown={showBreakdown} />
                  {u.attackRange > 0 && <AugStatRow label="RNG" base={u.attackRange} augment={totalAugmentEffect.attackRange} breakdown={showBreakdown} />}
                  {u.attackCooldownMs > 0 && <AugStatRow label="CD" base={(u.attackCooldownMs / 1000)} />}
                </div>
              )}
              {u && u.moveSpeed === 0 && (
                <div className="cdm-stats-block u-flex u-wrap">
                  {/* No augment delta: applyAugmentBonuses returns early for
                      structures, so showing one promised a bonus the engine
                      would never apply. Mastery HP does apply (+10%/level). */}
                  <AugStatRow label="HP" base={u.maxHp} mastery={hpBonus} breakdown={showBreakdown} />
                </div>
              )}

              {hasStatBonus && (
                <button
                  type="button"
                  className="cdm-breakdown-toggle"
                  onClick={() => setShowBreakdown(v => !v)}
                  aria-expanded={showBreakdown}
                >
                  {showBreakdown ? '▴ Hide breakdown' : '▾ Where do these come from?'}
                </button>
              )}
          </div>
        </div>
        <div className="cdm-details u-col">
              {card.cardType === 'unit' && (
              <Toolbar>
                <ToolbarButton label="Details" onClick={() => setActiveTab(0)} />
                <ToolbarButton label="Augments" onClick={() => setActiveTab(1)} />
<ToolbarSpacer />

  {/* Promote to Commander (unit cards only) */}
        {onPromote && u && u.moveSpeed > 0 && (
          <>
            {commanderName === card.name ? (
              <ToolbarLabel>⭐ Current Commander</ToolbarLabel>
            ) : (
              <>
              <ToolbarButton
                className="extra-btn extra-btn--promote"
                onClick={onPromote}
                locked={promotionsLeft === 0}
                label={promotionsLeft === 0 ? 'Promotion limit reached for today (2/day)' : commanderName ? `Promote to Commander (replaces ${commanderName})` : 'Promote to Commander'}
              />
              </>
            )}
         </>
        )}

              </Toolbar>


              )}
<div className="cdm-info-col u-grow u-col u-gap-4 u-mg-t-md">
            {activeTab === 0 ? (

<>
              {/* Unit details */}
            {u && u.moveSpeed === 0 && u.maxHp > 0 && (
              <div className="cdm-stats-block u-flex u-wrap">
                {u.structureEffect?.type === 'spawn' && (() => {
                  // Mirrors applyMasteryBonus in game/collection.ts: the engine
                  // applies intervalMs * 0.95^level. This preview used to halve
                  // per level (with an invented 1500ms floor), so it promised a
                  // 25s spawner would reach 3.1s at Lv4 when the engine gives
                  // ~20.4s. Keep this in step with collection.ts if that changes.
                  const base = u.structureEffect.intervalMs
                  const rates = [base, ...[2, 3, 4].map(lvl => Math.round(base * Math.pow(0.95, lvl)))]
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

            {/* Augment stats (augment cards only) */}
            {card.augmentEffect && (
              <div className="cdm-augment-block u-col u-gap-2">
                <div className="cdm-stats-block u-flex u-wrap">
                  {card.augmentEffect.maxHp       && <StatRow compact label="HP"  value={`+${card.augmentEffect.maxHp}`} />}
                  {card.augmentEffect.attack      && <StatRow compact label="ATK" value={`+${card.augmentEffect.attack}`} />}
                  {card.augmentEffect.attackRange && <StatRow compact label="RNG" value={`+${card.augmentEffect.attackRange}`} />}
                  {card.augmentEffect.moveSpeed   && <StatRow compact label="SPD" value={`+${card.augmentEffect.moveSpeed}`} />}
                </div>
                {card.setName && card.augmentSlot && (
                  <div className="cdm-augment-meta">{card.setName} Set · {augmentSlotLabel(card.augmentSlot)}</div>
                )}
                {augmentLevel != null && (
                  <div className="cdm-augment-meta">Level {augmentLevel}</div>
                )}
                {augmentEquippedTo != null && (
                  <div className="cdm-augment-meta">
                    {augmentEquippedTo ? `Equipped on: ${augmentEquippedTo}` : 'Unequipped'}
                  </div>
                )}
              </div>
            )}

            {/* Traits */}
            {traits.length > 0 && (
              <div className="cdm-traits u-flex u-wrap u-gap-2">
                {traits.map(t => <span key={t} className="cdm-trait">{t}</span>)}
              </div>
            )}

            {/* Strengths, Weaknesses & Affinity */}
            {u && (u.strengths?.length || u.weaknesses?.length || u.affinity) ? (
              <div className="cdm-sw-block u-col u-gap-1">
                {u.strengths && u.strengths.length > 0 && (
                  <>
                    <button className="cdm-sw-row u-flex u-gap-3 cdm-sw-row--btn" onClick={() => toggleRow('strong')}>
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
                    <button className="cdm-sw-row u-flex u-gap-3 cdm-sw-row--btn" onClick={() => toggleRow('weak')}>
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
                    <button className="cdm-sw-row u-flex u-gap-3 cdm-sw-row--btn" onClick={() => toggleRow('affinity')}>
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

            {/* Synergy — groups this card shares, and the cards it directly pairs with */}
            {(synergyGroups.length > 0 || comboLinks.length > 0) && (
              <div className="cdm-sw-block u-col u-gap-1">
                <button className="cdm-sw-row u-flex u-gap-3 cdm-sw-row--btn" onClick={() => toggleRow('synergy')}>
                  <span className="cdm-sw-label cdm-sw-label--synergy">⚡ Synergy</span>
                  <span className="cdm-sw-tags">
                    {[
                      ...synergyGroups.map(g => g.label),
                      ...(comboLinks.length > 0
                        ? [`${comboLinks.length} card pairing${comboLinks.length === 1 ? '' : 's'}`]
                        : []),
                    ].join(', ')}
                  </span>
                  <span className="cdm-sw-chevron">{expandedRow === 'synergy' ? '▲' : '▼'}</span>
                </button>
                {expandedRow === 'synergy' && (
                  <div className="cdm-sw-detail">
                    {comboLinks.map(link => (
                      <div key={`${link.kind}-${link.partner}`} className="cdm-synergy-item">
                        <strong>{link.partner}</strong> — {link.detail}
                      </div>
                    ))}
                    {synergyGroups.map(g => (
                      <div key={g.id} className="cdm-synergy-item">
                        <strong>{g.icon} {g.label}</strong> — {g.desc}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mastery (not shown for augments) */}
            {card.cardType !== 'augment' && <div className="cdm-mastery-block">
              <div className="cdm-mastery-header">
                <span className={masteryLvl >= 5 ? 'cdm-mastery-elite' : 'cdm-mastery-title'}>
                  {masteryLvl >= 5 ? '⚡' : '★'} Mastery {masteryLvl}{masteryLvl >= 5 ? ' — ELITE' : ''}
                </span>
                {/* Just the target level — the bar below already states the
                    raw xpCur/xpNeeded, as does the modal header. */}
                {masteryLvl < 5 && <span className="cdm-mastery-xp">to Lv{masteryLvl + 1}</span>}
              </div>
              <MasteryBar xp={xp} />
              {u && u.moveSpeed > 0 && (
                <div className="cdm-mastery-milestones">
                  <div className={`cdm-milestone${masteryLvl >= 1 ? ' cdm-milestone--unlocked u-text-gold' : ''}`}>
                    Lv1 — Affinity activates
                  </div>
                  <div className={`cdm-milestone${masteryLvl >= 5 ? ' cdm-milestone--unlocked u-text-gold' : ''}`}>
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
                      <div key={m.text} className={`cdm-milestone${masteryLvl >= m.lvl ? ' cdm-milestone--unlocked u-text-gold' : ''}`}>
                        Lv{m.lvl} — {m.text}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>}

            {/* Battle stats (not shown for augments) */}
            {card.cardType !== 'augment' && (
              <div className="cdm-battle-stats u-col u-gap-1">
                <StatRow compact label="Times played" value={statsPlayed.played} />
                {statsUnit && <StatRow compact label="Units lost" value={statsUnit.died} />}
              </div>
            )}
            </>
          ) : (
            <>{/* Souls balance */}
                      <div className="cas-souls-bar">
                        <span style={{ opacity: 0.7, fontSize: 12 }}>Augment Souls:</span>
                        <span style={{ color: '#cc88ff', fontWeight: 700 }}>{souls.toLocaleString()} 👻</span>
                        {upgradeError && <span style={{ color: '#ff6666', fontSize: 11 }}>{upgradeError}</span>}
                      </div>
            
                      {/* Augment slots */}
                      <div className="cas-slots-title">Equipment Slots</div>
            
                      <div className="cas-slots-grid">
                        {ALL_AUGMENT_SLOTS.map(slot => {
                          const inst = equippedMap[slot]
                          const augCard = inst ? getAugmentCard(inst.cardId) : undefined
                          const scaled = (augCard?.augmentEffect && inst)
                            ? scaledAugmentEffect(augCard.augmentEffect, inst.level)
                            : undefined
            
                          return (
                            <div key={slot} className={`cas-slot${inst ? ' cas-slot--filled' : ''}`}>
                              <div className="cas-slot-label">{augmentSlotLabel(slot)}</div>
                              {inst && augCard ? (
                                <>
                                  <div className="cas-slot-name" style={{ color: RARITY_COLOUR[augCard.rarity] ?? '#fff' }}>
                                    {augCard.name}
                                  </div>
                                  <div className="cas-slot-level">Lv{inst.level}</div>
                                  {scaled && (
                                    <div className="cas-slot-effect">{effectSummary(scaled)}</div>
                                  )}
                                  <div className="cas-slot-actions">
                                    <button
                                      className="action-btn action-btn--gold cas-slot-btn"
                                      disabled={souls < AUGMENT_UPGRADE_COST}
                                      onClick={() => handleUpgrade(inst)}
                                      title={`Upgrade (costs ${AUGMENT_UPGRADE_COST} souls)`}
                                    >
                                      ↑ Upgrade
                                    </button>
                                    <button
                                      className="action-btn cas-slot-btn"
                                      onClick={() => { setPickerSlot(slot); }}
                                    >
                                      Swap
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <button
                                  className="action-btn cas-slot-btn"
                                  onClick={() => setPickerSlot(slot)}
                                >
                                  + Equip
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
            
                      {/* Set bonus */}
                      {(() => {
                        const equipped = Object.values(equippedMap)
                        if (equipped.length === 0) return null
                        const firstAug = getAugmentCard(equipped[0]?.cardId ?? '')
                        const setName  = firstAug?.setName
                        const setDef: AugmentSetDef | undefined = setName ? getAugmentSetDef(setName) : undefined
                        if (!setDef) return null
                        const hasFullSet = !!setBonus
                        const slotsFilledSameSet = equipped.filter(i => getAugmentCard(i.cardId)?.setName === setName).length
                        return (
                          <div className={`cas-set-bonus${hasFullSet ? ' cas-set-bonus--active' : ''}`}>
                            <span className="cas-set-bonus-name" style={{ color: RARITY_COLOUR[setDef.rarity] ?? '#fff' }}>
                              {setName} Set Bonus ({slotsFilledSameSet}/7)
                            </span>
                            <span className="cas-set-bonus-desc">{setDef.setBonusDescription}</span>
                            {hasFullSet && (
                              <span className="cas-set-bonus-effect" style={{ color: '#ffcc00' }}>
                                {effectSummary(setDef.setBonus)} ACTIVE
                              </span>
                            )}
                          </div>
                        )
                      })()}</>
          )
        }
                  </div>

        </div>

        {pickerSlot && (
          <AugmentPickerModal
            slot={pickerSlot}
            cardName={card.name}
            onClose={() => { setPickerSlot(null); forceRefresh() }}
          />
        )}

        {/* Lore is rendered once, up next to the description — it used to also
            repeat verbatim here at the foot of the modal. */}

        {/* Augment upgrade action */}
        {onUpgrade && (
          <div className="cdm-actions">
            <button
              className={`action-btn action-btn--gold${canUpgrade ? '' : ' action-btn--disabled'}`}
              onClick={onUpgrade}
              title={`Costs ${AUGMENT_UPGRADE_COST} souls`}
            >
              ↑ Upgrade ({AUGMENT_UPGRADE_COST} souls)
            </button>
          </div>
        )}

        {/* Augment breakdown action */}
        {onBreakdown && (
          <div className="cdm-actions">
            <button className="extra-btn extra-btn--disenchant" onClick={onBreakdown}>
              💀 Break Down (+{breakdownValue} 👻)
            </button>
          </div>
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
