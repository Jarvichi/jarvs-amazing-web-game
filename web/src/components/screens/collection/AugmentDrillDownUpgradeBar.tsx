import React from 'react'
import { Button } from '../../ui/Button'
import { AugStack, stackLevelSummary, stackUpgradeCost } from './AugmentStackTile'

interface Props {
  stack: AugStack
  souls: number
  upgradeCost: number
  onUpgrade: () => void
}

export function AugmentDrillDownUpgradeBar({ stack, souls, upgradeCost, onUpgrade }: Props) {
  const cost = stackUpgradeCost(stack, upgradeCost)
  return (
    <div className="aug-stack-drill-upgrade">
      <span className="aug-stack-drill-label">
        Stack: {stackLevelSummary(stack)}
      </span>
      <Button
        className="aug-action-sm"
        variant="gold"
        disabled={souls < cost}
        onClick={onUpgrade}
      >
        ↑ Upgrade Stack · {cost.toLocaleString()} souls
      </Button>
    </div>
  )
}
