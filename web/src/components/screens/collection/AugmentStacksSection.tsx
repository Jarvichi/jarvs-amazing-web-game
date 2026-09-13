import React from 'react'
import { AugmentStackTile, AugStack } from './AugmentStackTile'

interface Props {
  stacks: AugStack[]
  souls: number
  upgradeCost: number
  stackErrors: Record<string, string | null>
  onView: (stack: AugStack) => void
  onUpgrade: (stack: AugStack) => void
  onEquipToUnit: (stack: AugStack) => void
}

/** The "Complete Sets" section above the individual-augments grid. */
export function AugmentStacksSection({ stacks, souls, upgradeCost, stackErrors, onView, onUpgrade, onEquipToUnit }: Props) {
  if (stacks.length === 0) return null
  return (
    <div className="aug-stacks-section">
      <div className="collection-group-header">Complete Sets ({stacks.length})</div>
      {stacks.map((stack, i) => (
        <AugmentStackTile
          key={`${stack.setName}-${i}`}
          stack={stack}
          souls={souls}
          upgradeCost={upgradeCost}
          onView={() => onView(stack)}
          onUpgrade={() => onUpgrade(stack)}
          onEquipToUnit={() => onEquipToUnit(stack)}
          upgradeError={stackErrors[stack.instances[0].instanceId]}
        />
      ))}
    </div>
  )
}
