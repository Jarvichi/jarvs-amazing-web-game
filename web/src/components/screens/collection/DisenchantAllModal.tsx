import React from 'react'
import { ModalBackdrop } from '../../ui/ModalBackdrop'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/icons/Icon'

interface Props {
  items: Array<{ cardName: string; crystals: number }>
  onClose: () => void
}

export function DisenchantAllModal({ items, onClose }: Props) {
  return (
    <ModalBackdrop onClose={onClose} zIndex={300} title="Disenchant All">
      <div className="daily-modal daily-modal--list">
        <div className="daily-modal-header">🔮 DISENCHANT ALL</div>
        <div className="daily-modal-sub">
          {items.length} card{items.length !== 1 ? 's' : ''} sold
        </div>
        <div className="daily-modal-rows">
          {items.map(({ cardName, crystals }) => (
            <div key={cardName} className="daily-modal-row">
              <span>{cardName}</span>
              <span className="daily-modal-row-value--crystal">+{crystals} <Icon name="crystal" size={12} /></span>
            </div>
          ))}
        </div>
        <div className="daily-modal-desc">
          Total: +{items.reduce((s, i) => s + i.crystals, 0)} <Icon name="crystal" size={13} />
        </div>
        <Button onClick={onClose}>OK</Button>
      </div>
    </ModalBackdrop>
  )
}
