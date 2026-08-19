import React, { useState, useMemo } from 'react'
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
  mergeAugmentEffects,
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
import { MasteryBar } from '../ui/MasteryBar'
import { AugmentPickerModal } from './AugmentPickerModal'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { CardDetailHeader } from './CardDetailHeader'
import { AugStatRow, masteryStatBonuses } from './AugStatRow'
import { AnimatedSpriteImg, SpriteImg } from '../ui/SpriteImg'
import { RARITY_COLOR } from '../../theme'

interface Props {
  card: Card
  collection: CollectionEntry[]
  deckEntries?: DeckEntry[]
  onClose: () => void
}


function effectSummary(effect: AugmentEffect): string {
  const parts: string[] = []
  if (effect.maxHp)       parts.push(`+${effect.maxHp} HP`)
  if (effect.attack)      parts.push(`+${effect.attack} ATK`)
  if (effect.attackRange) parts.push(`+${effect.attackRange} RNG`)
  if (effect.moveSpeed)   parts.push(`+${effect.moveSpeed} SPD`)
  return parts.join(', ')
}

// TODO: This screen is getting pretty big, consider splitting into multiple sub-screens (e.g. separate set bonus screen, separate augment picker screen instead of modal, etc)
export function CardAugmentScreen({ card, collection, deckEntries, onClose }: Props) {
  const [refresh, setRefresh] = useState(0)
  const [pickerSlot, setPickerSlot] = useState<AugmentSlot | null>(null)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)

  const forceRefresh = () => setRefresh((r: number) => r + 1)

  const owned  = getOwnedCount(collection, card.name)
  const inDeck = deckEntries?.find(e => e.cardName === card.name)?.count ?? 0
  const { level: masteryLvl } = masteryProgress(getMasteryXp(collection, card.name))
  const rarityCol = RARITY_COLOR[card.rarity] ?? 'var(--game-text-color-dim)'

  const equippedMap = getEquippedAugments(card.name)
  const setBonus    = getSetBonus(card.name)
  const souls       = loadAugmentSouls()

  const u = card.unit
  const { atk: atkBonus, hp: hpBonus } = masteryStatBonuses(u, masteryLvl)

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

  function handleUpgrade(inst: AugmentInstance) {
    const err = upgradeAugment(inst.instanceId)
    if (err) {
      setUpgradeError(err)
      setTimeout(() => setUpgradeError(null), 2500)
    }
    forceRefresh()
  }

  return (
// TODO: There is a lot of common structure between this and the CardDetailModal, consider unifying into a single component with some conditional rendering for the augment-specific parts

    <ModalBackdrop onClose={onClose} title={`${card.name} — Augments`}>
      <div className="cas-panel" onClick={(e: React.MouseEvent) => e.stopPropagation()}>

        {/* Header */}
        <CardDetailHeader card={card} collection={collection} colour={rarityCol} onClose={onClose} />

        <div className="cas-body">

          {/* Card tile + base stats */}
          <div className="cas-top u-flex u-gap-4">
            <div className="cas-card-col u-col u-items-c u-gap-2">
          <AnimatedSpriteImg
            name={card.name}
            frameCount={3}
            fps={2}
            className="commander-sprite"
          />

              <div className="cdm-owned">×{owned} owned{inDeck > 0 ? ` · ×${inDeck} in deck` : ''}</div>
            </div>

            <div className="cas-info-col u-grow u-col u-gap-3">
              <div className="cdm-desc">{card.description}</div>
              {card.lore && <div className="cdm-lore">{card.lore}</div>}

              {/* Unit stats — totals shown with the breakdown always open here,
                  since this screen exists specifically to reason about where a
                  card's numbers come from. */}
              {u && u.moveSpeed > 0 && (
                <div className="cdm-stats-block u-flex u-wrap">
                  <AugStatRow label="ATK" base={u.attack}    mastery={atkBonus} augment={totalAugmentEffect.attack}    breakdown />
                  <AugStatRow label="HP"  base={u.maxHp}     mastery={hpBonus}  augment={totalAugmentEffect.maxHp}     breakdown />
                  <AugStatRow label="SPD" base={u.moveSpeed}                    augment={totalAugmentEffect.moveSpeed} breakdown />
                  {u.attackRange > 0 && <AugStatRow label="RNG" base={u.attackRange} augment={totalAugmentEffect.attackRange} breakdown />}
                </div>
              )}
              {u && u.moveSpeed === 0 && (
                <div className="cdm-stats-block u-flex u-wrap">
                  {/* Structures take no augments (applyAugmentBonuses returns
                      early for them), so only mastery HP applies. */}
                  <AugStatRow label="HP" base={u.maxHp} mastery={hpBonus} breakdown />
                </div>
              )}
            </div>
          </div>

          {/* Souls balance */}
          <div className="cas-souls-bar">
            <span style={{ opacity: 0.7, fontSize: 12 }}>Augment Souls:</span>
            <span style={{ color: '#cc88ff', fontWeight: 700 }}>{souls.toLocaleString()} 👻</span>
            {upgradeError && <span style={{ color: '#ff6666', fontSize: 11 }}>{upgradeError}</span>}
          </div>

          {/* Augment slots. Structures are excluded to match the engine:
              applyAugmentBonuses in game/collection.ts returns early for
              anything with moveSpeed === 0 ("structures don't get augments"),
              so offering slots here would let a player spend augments that
              are then silently ignored in battle. */}
          {u && u.moveSpeed === 0 ? (
            <div className="cas-slots-title">Structures can't be augmented.</div>
          ) : (
          <>
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
                      <div className="cas-slot-name" style={{ color: RARITY_COLOR[augCard.rarity] ?? '#fff' }}>
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
                <span className="cas-set-bonus-name" style={{ color: RARITY_COLOR[setDef.rarity] ?? '#fff' }}>
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
          </>
          )}

        </div>
      </div>

      {pickerSlot && (
        <AugmentPickerModal
          slot={pickerSlot}
          cardName={card.name}
          onClose={() => { setPickerSlot(null); forceRefresh() }}
        />
      )}
    </ModalBackdrop>
  )
}
