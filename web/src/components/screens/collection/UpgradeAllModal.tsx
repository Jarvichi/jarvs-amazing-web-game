import React from 'react'
import { ModalBackdrop } from '../../ui/ModalBackdrop'
import { Button } from '../../ui/Button'

interface Props {
  items: Array<{ cardName: string; xpGained: number }>
  onClose: () => void
}

export function UpgradeAllModal({ items, onClose }: Props) {
  return (
    <ModalBackdrop onClose={onClose} zIndex={300} title="Upgrade All">
      <div className="daily-modal daily-modal--list">
        <div className="daily-modal-header">★ UPGRADE ALL</div>
        <div className="daily-modal-sub">
          {items.length} card{items.length !== 1 ? 's' : ''} upgraded
        </div>
        <div className="daily-modal-rows">
          {items.map(({ cardName, xpGained }) => (
            <div key={cardName} className="daily-modal-row">
              <span>{cardName}</span>
              <span className="daily-modal-row-value--xp">+{xpGained} XP</span>
            </div>
          ))}
        </div>
        <div className="daily-modal-desc">
          Total: +{items.reduce((s, i) => s + i.xpGained, 0)} mastery XP
        </div>
        <Button onClick={onClose}>OK</Button>
      </div>
    </ModalBackdrop>
  )
}
