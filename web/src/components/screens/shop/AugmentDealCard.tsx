import React from 'react'
import { Card } from '../../../game/types'
import { ShopAugmentDeal } from '../../../game/shopSchedule'
import { augmentSlotLabel } from '../../../game/augments'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/icons/Icon'

interface Props {
  deal: ShopAugmentDeal
  aug: Card | undefined
  bought: boolean
  canAfford: boolean
  onBuy: () => void
}

export function AugmentDealCard({ deal, aug, bought, canAfford, onBuy }: Props) {
  return (
    <div className={`shop-augment-deal shop-augment-deal--${deal.rarity}${bought ? ' shop-augment-deal--bought' : ''}`}>
      <div className="shop-augment-name">{deal.augmentName}</div>
      {aug && (
        <div className="shop-augment-meta">
          <span className={`rarity-badge rarity-badge--${deal.rarity}`}>{deal.rarity}</span>
          {aug.augmentSlot && <span className="shop-augment-slot">{augmentSlotLabel(aug.augmentSlot)}</span>}
        </div>
      )}
      {aug?.description && <div className="shop-augment-desc">{aug.description}</div>}
      {bought ? (
        <div className="shop-purchased">PURCHASED ✓</div>
      ) : (
        <Button
          variant="gold"
          className={`shop-card-buy-btn${!canAfford ? ' shop-card-buy-btn--poor' : ''}`}
          onClick={onBuy}
          disabled={!canAfford}
        >
          <span className="shop-price">{deal.price}</span> <Icon name="crystal" size={13} />
        </Button>
      )}
    </div>
  )
}
