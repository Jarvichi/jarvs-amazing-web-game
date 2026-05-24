import React, { useState } from 'react'
import { Card, AugmentSlot, AugmentEffect, AugmentInstance } from '../../game/types'
import {
  CollectionEntry,
  DeckEntry,
  getOwnedCount,
  getMasteryXp,
  masteryProgress,
  loadAugmentSouls,
  getEquippedAugments,
  getSetBonus,
  upgradeAugment,
  AUGMENT_UPGRADE_COST,
} from '../../game/collection'
import {
  getAugmentCard,
  scaledAugmentEffect,
  augmentSlotLabel,
  ALL_AUGMENT_SLOTS,
  AugmentSetDef,
  getAugmentSetDef,
} from '../../game/augments'
import { CardTile } from './CardTile'
import { StatRow } from '../ui/StatRow'
import { MasteryBar } from '../ui/MasteryBar'
import { AugmentPickerModal } from './AugmentPickerModal'

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
  epic:      '#ff8800',
  legendary: '#ffcc00',
  mythic:    '#e040fb',
  shiny:     '#ffe066',
  holofoil:  '#40e0d0',
  glass:     '#a0d8ef',
}

function effectSummary(effect: AugmentEffect): string {
  const parts: string[] = []
  if (effect.maxHp)       parts.push(`+${effect.maxHp} HP`)
  if (effect.attack)      parts.push(`+${effect.attack} ATK`)
  if (effect.attackRange) parts.push(`+${effect.attackRange} RNG`)
  if (effect.moveSpeed)   parts.push(`+${effect.moveSpeed} SPD`)
  return parts.join(', ')
}

export function CardAugmentScreen({ card, collection, deckEntries, onClose }: Props) {
  const [refresh, setRefresh] = useState(0)
  const [pickerSlot, setPickerSlot] = useState<AugmentSlot | null>(null)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)

  const forceRefresh = () => setRefresh((r: number) => r + 1)

  const owned  = getOwnedCount(collection, card.name)
  const inDeck = deckEntries?.find(e => e.cardName === card.name)?.count ?? 0
  const xp     = getMasteryXp(collection, card.name)
  const { level: masteryLvl, current: xpCur, needed: xpNeeded } = masteryProgress(xp)
  const rarityCol = RARITY_COLOUR[card.rarity] ?? 'var(--game-text-color-dim)'

  const equippedMap = getEquippedAugments(card.name)
  const setBonus    = getSetBonus(card.name)
  const souls       = loadAugmentSouls()

  const u = card.unit

  function handleUpgrade(inst: AugmentInstance) {
    const err = upgradeAugment(inst.instanceId)
    if (err) {
      setUpgradeError(err)
      setTimeout(() => setUpgradeError(null), 2500)
    }
    forceRefresh()
  }

  return (
    <div className="cas-backdrop" onClick={onClose}>
      <div className="cas-panel" onClick={(e: React.MouseEvent) => e.stopPropagation()}>

        {/* Header */}
        <div className="cas-header">
          <span className="cas-name" style={{ color: rarityCol }}>{card.name}</span>
          <span className="cas-rarity" style={{ color: rarityCol }}>
            {'★'.repeat(({ common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6, shiny: 4, holofoil: 4, glass: 4 } as Record<string,number>)[card.rarity] ?? 1)}
            {' '}{card.rarity.toUpperCase()}
          </span>
          <button className="cdm-close" onClick={onClose}>✕</button>
        </div>

        <div className="cas-body">

          {/* Card tile + base stats */}
          <div className="cas-top u-flex u-gap-4">
            <div className="cas-card-col u-col u-items-c u-gap-2">
              <CardTile card={card} canAfford={true} />
              <div className="cdm-owned">×{owned} owned{inDeck > 0 ? ` · ×${inDeck} in deck` : ''}</div>
              {xp > 0 && <MasteryBar xp={xp} />}
            </div>

            <div className="cas-info-col u-grow u-col u-gap-3">
              <div className="cdm-desc">{card.description}</div>
              {card.lore && <div className="cdm-lore" style={{ fontStyle: 'italic', opacity: 0.7, fontSize: 11 }}>{card.lore}</div>}

              {/* Unit stats */}
              {u && u.moveSpeed > 0 && (
                <div className="cdm-stats-block u-flex u-wrap">
                  <StatRow compact label="ATK" value={u.attack} />
                  <StatRow compact label="HP"  value={u.maxHp} />
                  <StatRow compact label="SPD" value={u.moveSpeed} />
                  {u.attackRange > 0 && <StatRow compact label="RNG" value={u.attackRange} />}
                </div>
              )}
              {u && u.moveSpeed === 0 && (
                <div className="cdm-stats-block u-flex u-wrap">
                  <StatRow compact label="HP" value={u.maxHp} />
                </div>
              )}

              {masteryLvl > 0 && (
                <div style={{ fontSize: 11, color: '#ffcc55' }}>Mastery ★{masteryLvl} · {xpCur}/{xpNeeded} XP</div>
              )}
            </div>
          </div>

          {/* Souls balance */}
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
          })()}

        </div>
      </div>

      {pickerSlot && (
        <AugmentPickerModal
          slot={pickerSlot}
          cardName={card.name}
          onClose={() => { setPickerSlot(null); forceRefresh() }}
        />
      )}
    </div>
  )
}
