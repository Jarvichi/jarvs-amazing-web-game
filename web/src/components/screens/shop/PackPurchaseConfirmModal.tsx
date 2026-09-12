import React from 'react'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/icons/Icon'

interface Props {
  packQty: number
  totalCost: number
  onCancel: () => void
  onConfirm: () => void
}

export function PackPurchaseConfirmModal({ packQty, totalCost, onCancel, onConfirm }: Props) {
  return (
    <div className="shop-confirm-backdrop" onClick={onCancel}>
      <div className="shop-confirm-modal" onClick={e => e.stopPropagation()}>
        <div className="shop-confirm-title"><Icon name="pack" size={16} /> Card Packs</div>
        <div className="shop-confirm-body">
          This will buy <strong>{packQty} card pack{packQty !== 1 ? 's' : ''}</strong> for <strong><span className="shop-price">{totalCost}</span> <Icon name="crystal" size={13} /></strong>
        </div>
        <div className="shop-confirm-actions">
          <Button onClick={onCancel}>Oh no</Button>
          <Button variant="gold" onClick={onConfirm}>Oh yes!</Button>
        </div>
      </div>
    </div>
  )
}
