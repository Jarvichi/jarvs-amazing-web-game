import React from 'react'
import { AugmentEffect, AugmentInstance, AugmentSlot } from '../../../game/types'
import { getAugmentCard, augmentSlotLabel, scaledAugmentEffect, ALL_AUGMENT_SLOTS } from '../../../game/augments'
import { RARITY_COLOR } from '../../../theme'
import { Button } from '../../ui/Button'

export function effectSummary(effect: AugmentEffect): string {
  const parts: string[] = []
  if (effect.maxHp)       parts.push(`+${effect.maxHp} HP`)
  if (effect.attack)      parts.push(`+${effect.attack} ATK`)
  if (effect.attackRange) parts.push(`+${effect.attackRange} RNG`)
  if (effect.moveSpeed)   parts.push(`+${effect.moveSpeed} SPD`)
  return parts.join(', ')
}

interface Props {
  equippedMap: Record<string, AugmentInstance>
  souls: number
  upgradeCost: number
  onUpgrade: (inst: AugmentInstance) => void
  onPickSlot: (slot: AugmentSlot) => void
}

/** A unit card's 7 augment-equipment slots. Shared between CardDetailModal's
 *  Augments tab and CardAugmentScreen — the two used to carry an identical
 *  copy of this each. */
export function AugmentSlotsGrid({ equippedMap, souls, upgradeCost, onUpgrade, onPickSlot }: Props) {
  return (
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
                <div className="cas-slot-name" style={{ color: RARITY_COLOR[augCard.rarity] }}>
                  {augCard.name}
                </div>
                <div className="cas-slot-level">Lv{inst.level}</div>
                {scaled && (
                  <div className="cas-slot-effect">{effectSummary(scaled)}</div>
                )}
                <div className="cas-slot-actions">
                  <Button
                    variant="gold"
                    className="cas-slot-btn"
                    disabled={souls < upgradeCost}
                    onClick={() => onUpgrade(inst)}
                    title={`Upgrade (costs ${upgradeCost} souls)`}
                  >
                    ↑ Upgrade
                  </Button>
                  <Button
                    className="cas-slot-btn"
                    onClick={() => onPickSlot(slot)}
                  >
                    Swap
                  </Button>
                </div>
              </>
            ) : (
              <Button
                className="cas-slot-btn"
                onClick={() => onPickSlot(slot)}
              >
                + Equip
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
