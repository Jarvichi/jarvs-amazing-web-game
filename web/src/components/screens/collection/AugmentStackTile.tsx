import React from 'react'
import { AugmentInstance, CardRarity } from '../../../game/types'
import { getAugmentCard, augmentSlotLabel, AugmentSetDef } from '../../../game/augments'
import { RARITY_COLOR } from '../../../theme'
import { Button } from '../../ui/Button'

export interface AugStack {
  setName: string
  setDef: AugmentSetDef | undefined
  instances: AugmentInstance[]   // exactly 7, one per slot
}

export function stackLevelSummary(stack: AugStack): string {
  const levels = stack.instances.map(i => i.level)
  const min = Math.min(...levels)
  const max = Math.max(...levels)
  return min === max ? `Lv${min}` : `Lv${min}–${max}`
}

export function stackUpgradeCost(stack: AugStack, upgradeCost: number): number {
  const minLevel = Math.min(...stack.instances.map(i => i.level))
  const count = stack.instances.filter(i => i.level === minLevel).length
  return count * upgradeCost
}

interface Props {
  stack: AugStack
  souls: number
  upgradeCost: number
  onView: () => void
  onUpgrade: () => void
  onEquipToUnit: () => void
  upgradeError?: string | null
}

export function AugmentStackTile({ stack, souls, upgradeCost, onView, onUpgrade, onEquipToUnit, upgradeError }: Props) {
  const cost      = stackUpgradeCost(stack, upgradeCost)
  const canUpgrade = souls >= cost
  // Rarity colour is data-driven (one of six possible set rarities), so it
  // stays an inline style rather than a CSS class — same reasoning as
  // CardLorePanel's use of the same canonical map (#2206).
  const col       = RARITY_COLOR[stack.setDef?.rarity ?? ('common' as CardRarity)]
  const levels    = stack.instances.map(i => i.level)
  const minLevel  = Math.min(...levels)
  const atMin     = levels.filter(l => l === minLevel).length
  const areAnyEquipped = stack.instances.some(i => i.equippedToCardName)
  const equippedCount = stack.instances.filter(i => i.equippedToCardName).length

  return (
    <div className="aug-stack-tile">
      <div className="aug-stack-header">
        <span className="aug-stack-name" style={{ color: col }}>{stack.setName} Set</span>
        <span className="aug-stack-levels">{stackLevelSummary(stack)}</span>
      </div>
      <div className="aug-stack-slots">
        {stack.instances.map(inst => {
          const card = getAugmentCard(inst.cardId)
          return (
            <span key={inst.instanceId} className="aug-stack-slot-chip" style={{ color: col }}>
              {augmentSlotLabel(card?.augmentSlot ?? 'helmet').slice(0, 4)} Lv{inst.level}
            </span>
          )
        })}
      </div>
      {atMin < 7 && (
        <div className="aug-stack-upgrade-note">
          {atMin} item{atMin !== 1 ? 's' : ''} at Lv{minLevel} · next upgrade: {cost.toLocaleString()} souls
        </div>
      )}
      {upgradeError && <div className="aug-stack-error">{upgradeError}</div>}
      <div className="aug-stack-actions">
        <Button size="sm" onClick={onView}>
          View Stack
        </Button>
        <Button
          className="aug-action-sm"
          variant="gold"
          disabled={!canUpgrade}
          onClick={onUpgrade}
          title={`Upgrade stack · ${cost.toLocaleString()} souls`}
        >
          ↑ Upgrade · {cost.toLocaleString()}
        </Button>
        <Button
          size="sm"
          onClick={onEquipToUnit}
          disabled={areAnyEquipped}
          title={areAnyEquipped ? 'Unequip all items in stack to enable' : 'Equip stack to unit'}
        >
          {areAnyEquipped ? `${equippedCount} already equipped` : 'Equip stack to unit'}
        </Button>
      </div>
    </div>
  )
}
