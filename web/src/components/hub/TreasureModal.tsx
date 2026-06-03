import React from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import type { HubTreasure } from '../../data/hub/loader'

interface Props {
  treasure: HubTreasure
  onClose:  () => void
}

export function TreasureModal({ treasure, onClose }: Props) {
  const { reward, title } = treasure
  const parts: string[] = []
  if (reward.crystals)    parts.push(`+${reward.crystals} 💎`)
  if (reward.collectible) parts.push(`${reward.collectible.icon} ${reward.collectible.name}`)
  if (reward.consumables) {
    for (const { id, quantity } of reward.consumables) {
      parts.push(`+${quantity} ${id.replace(/_/g, ' ')}`)
    }
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="treasure-modal">
        <div className="treasure-modal__icon">🎁</div>
        <div className="treasure-modal__title">{title}</div>
        <div className="treasure-modal__contains">
          {parts.length > 0 ? parts.join('  ·  ') : 'Empty…'}
        </div>
        <button className="treasure-modal__collect" onClick={onClose}>Collect</button>
      </div>
    </ModalBackdrop>
  )
}
