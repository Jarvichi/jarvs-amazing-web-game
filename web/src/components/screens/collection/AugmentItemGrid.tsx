import React from 'react'
import { AugmentInstance, Card } from '../../../game/types'
import { CardTile } from '../../cards/CardTile'
import { Button } from '../../ui/Button'

export interface AugmentGridItem {
  inst: AugmentInstance
  displayCard: Card
  groupLabel: string | null
  breakdownValue: number
}

interface Props {
  items: AugmentGridItem[]
  souls: number
  upgradeCost: number
  onSelect: (item: AugmentGridItem) => void
  onViewEquippedUnit: (cardName: string) => void
  onUpgrade: (inst: AugmentInstance) => void
  onBreakdown: (inst: AugmentInstance) => void
}

/** The individual-augments grid — also used for a stack's 7-slot drill-down. */
export function AugmentItemGrid({ items, souls, upgradeCost, onSelect, onViewEquippedUnit, onUpgrade, onBreakdown }: Props) {
  return (
    <div className="collection-grid u-flex u-wrap u-just-c u-gap-4">
      {items.map(item => {
        const { inst, displayCard, groupLabel, breakdownValue } = item
        return (
        <React.Fragment key={inst.instanceId}>
          {groupLabel && (
            <div className="collection-group-header">{groupLabel}</div>
          )}
          <div className="collection-cell u-col">
            <CardTile
              card={displayCard}
              onClick={() => onSelect(item)}
            />
            <div className="cell-footer">
              <span>Lv{inst.level}</span>
              {inst.equippedToCardName && (
                <span
                  className="aug-item-equipped-link"
                  title={inst.equippedToCardName}
                  onClick={e => { e.stopPropagation(); onViewEquippedUnit(inst.equippedToCardName!) }}
                >↗</span>
              )}
              <Button
                className="aug-action-sm"
                variant="gold"
                disabled={souls < upgradeCost}
                onClick={e => { e.stopPropagation(); onUpgrade(inst) }}
                title={`Upgrade · ${upgradeCost} souls`}
              >↑</Button>
              <Button
                className="aug-action-sm"
                onClick={e => { e.stopPropagation(); onBreakdown(inst) }}
                title={`Break down · +${breakdownValue} souls`}
              >💀</Button>
            </div>
          </div>
        </React.Fragment>
        )
      })}
    </div>
  )
}
