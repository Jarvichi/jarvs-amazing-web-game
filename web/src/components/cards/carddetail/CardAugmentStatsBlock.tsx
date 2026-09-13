import React from 'react'
import { Card } from '../../../game/types'
import { augmentSlotLabel } from '../../../game/augments'
import { StatRow } from '../../ui/StatRow'

interface Props {
  card: Card
  augmentLevel?: number
  augmentEquippedTo?: string | null
}

/** Shown when viewing an augment card itself (not a unit's equipped
 *  augments) — its stat bonuses, set/slot, and instance level. */
export function CardAugmentStatsBlock({ card, augmentLevel, augmentEquippedTo }: Props) {
  if (!card.augmentEffect) return null
  const effect = card.augmentEffect
  return (
    <div className="cdm-augment-block u-col u-gap-2">
      <div className="cdm-stats-block u-flex u-wrap">
        {effect.maxHp       && <StatRow compact label="HP"  value={`+${effect.maxHp}`} />}
        {effect.attack      && <StatRow compact label="ATK" value={`+${effect.attack}`} />}
        {effect.attackRange && <StatRow compact label="RNG" value={`+${effect.attackRange}`} />}
        {effect.moveSpeed   && <StatRow compact label="SPD" value={`+${effect.moveSpeed}`} />}
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
  )
}
