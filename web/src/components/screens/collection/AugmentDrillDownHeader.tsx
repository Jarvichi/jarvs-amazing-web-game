import React from 'react'
import { Button } from '../../ui/Button'
import { AugStack } from './AugmentStackTile'

interface Props {
  stack: AugStack
  onBack: () => void
  onEquipToUnit: () => void
}

/** Replaces the filter bar while viewing one set's 7 slots in isolation. */
export function AugmentDrillDownHeader({ stack, onBack, onEquipToUnit }: Props) {
  return (
    <div className="aug-stack-drill-header">
      <Button size="sm" onClick={onBack}>← Back to All</Button>
      <span className="aug-stack-drill-title">
        {stack.setName} Set
      </span>
      <Button size="sm" onClick={onEquipToUnit}>
        Equip to Unit
      </Button>
    </div>
  )
}
