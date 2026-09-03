import React from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { RunEndCard } from '../ui/RunEndCard'
import { HubTreasure } from '../../data/hub/loader'
import { Button } from '../ui/Button'


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
    <ModalBackdrop onClose={onClose} title={title}>
      <RunEndCard tone="gold" className="treasure-modal u-items-c u-text-c">
        <div className="treasure-modal__icon">🎁</div>
        <div className="treasure-modal__title">{title}</div>
        <div className="treasure-modal__contains">
          {parts.length > 0 ? parts.join('  ·  ') : 'Empty…'}
        </div>
        <Button variant="gold" className="treasure-modal__collect" onClick={onClose}>Collect</Button>
      </RunEndCard>
    </ModalBackdrop>
  )
}
