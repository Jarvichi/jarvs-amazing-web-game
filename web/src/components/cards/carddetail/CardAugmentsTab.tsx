import React from 'react'
import { AugmentEffect, AugmentInstance, AugmentSlot } from '../../../game/types'
import { AugmentSoulsBar } from './AugmentSoulsBar'
import { AugmentSlotsGrid } from './AugmentSlotsGrid'
import { AugmentSetBonusPanel } from './AugmentSetBonusPanel'

interface Props {
  souls: number
  upgradeError?: string | null
  upgradeCost: number
  equippedMap: Record<string, AugmentInstance>
  setBonus: { setName: string; effect: AugmentEffect; description: string } | undefined
  onUpgrade: (inst: AugmentInstance) => void
  onPickSlot: (slot: AugmentSlot) => void
}

/** The "Augments" tab: souls balance, the 7 equipment slots, and the set
 *  bonus once all 7 share a set. */
export function CardAugmentsTab({ souls, upgradeError, upgradeCost, equippedMap, setBonus, onUpgrade, onPickSlot }: Props) {
  return (
    <>
      <AugmentSoulsBar souls={souls} upgradeError={upgradeError} />
      <div className="cas-slots-title">Equipment Slots</div>
      <AugmentSlotsGrid
        equippedMap={equippedMap}
        souls={souls}
        upgradeCost={upgradeCost}
        onUpgrade={onUpgrade}
        onPickSlot={onPickSlot}
      />
      <AugmentSetBonusPanel equippedMap={equippedMap} setBonus={setBonus} />
    </>
  )
}
