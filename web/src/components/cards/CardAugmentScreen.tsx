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
import { getAugmentCard, scaledAugmentEffect } from '../../game/augments'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { CardDetailHeader } from './carddetail/CardDetailHeader'
import { AugStatRow, masteryStatBonuses } from './carddetail/AugStatRow'
import { AugmentSoulsBar } from './carddetail/AugmentSoulsBar'
import { AugmentSlotsGrid } from './carddetail/AugmentSlotsGrid'
import { AugmentSetBonusPanel } from './carddetail/AugmentSetBonusPanel'
import { AugmentPickerModal } from './AugmentPickerModal'
import { AnimatedSpriteImg } from '../ui/SpriteImg'
import { RARITY_COLOR } from '../../theme'

interface Props {
  card: Card
  collection: CollectionEntry[]
  deckEntries?: DeckEntry[]
  onClose: () => void
}

export function CardAugmentScreen({ card, collection, deckEntries, onClose }: Props) {
  const [refresh, setRefresh] = useState(0)
  const [pickerSlot, setPickerSlot] = useState<AugmentSlot | null>(null)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)

  const forceRefresh = () => setRefresh((r: number) => r + 1)

  const owned  = getOwnedCount(collection, card.name)
  const inDeck = deckEntries?.find(e => e.cardName === card.name)?.count ?? 0
  const { level: masteryLvl } = masteryProgress(getMasteryXp(collection, card.name))
  const rarityCol = RARITY_COLOR[card.rarity]

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

          <AugmentSoulsBar souls={souls} upgradeError={upgradeError} />

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
              <AugmentSlotsGrid
                equippedMap={equippedMap}
                souls={souls}
                upgradeCost={AUGMENT_UPGRADE_COST}
                onUpgrade={handleUpgrade}
                onPickSlot={setPickerSlot}
              />
              <AugmentSetBonusPanel equippedMap={equippedMap} setBonus={setBonus} />
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
