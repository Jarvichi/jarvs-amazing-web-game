import React from 'react'
import { loadCollection } from '../../../game/collection'
import { getCardCatalog } from '../../../game/cards'
import { ModalBackdrop } from '../../ui/ModalBackdrop'
import { Button } from '../../ui/Button'
import { CloseButton } from '../../ui/CloseButton'
import { EmptyState } from '../../ui/EmptyState'
import { AugStack } from './AugmentStackTile'

interface Props {
  stack: AugStack
  onEquip: (cardName: string) => void
  onClose: () => void
}

export function AugmentUnitPickerModal({ stack, onEquip, onClose }: Props) {
  const collection = loadCollection()
  const catalog    = getCardCatalog()
  const unitCards  = catalog.filter(c =>
    c.cardType === 'unit' && c.unit && c.unit.moveSpeed > 0 &&
    collection.some(e => e.cardName === c.name && e.count > 0)
  )

  return (
    <ModalBackdrop onClose={onClose} zIndex={400} title={`Equip ${stack.setName} Set to Unit`}>
      <div className="apm-panel">
        <div className="apm-header">
          Equip {stack.setName} Set to Unit
          <CloseButton onClick={onClose} />
        </div>
        {unitCards.length === 0 ? (
          <EmptyState size="sm">No unit cards owned.</EmptyState>
        ) : (
          <div className="apm-list">
            {unitCards.map(card => (
              <div key={card.name} className="apm-item">
                <div className="apm-item-info">
                  <span className="apm-item-name">{card.name}</span>
                  <span className="apm-item-set">
                    {card.rarity.toUpperCase()}
                  </span>
                </div>
                <div className="apm-item-actions">
                  <Button
                    variant="gold"
                    onClick={() => { onEquip(card.name); onClose() }}
                  >
                    Equip Set
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalBackdrop>
  )
}
