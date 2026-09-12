import React from 'react'
import { ConsumableDef } from '../../../game/questline'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/icons/Icon'

interface Props {
  consumable: ConsumableDef
  price: number
  discounted: boolean
  canAfford: boolean
  onBuy: () => void
}

export function ConsumableTile({ consumable, price, discounted, canAfford, onBuy }: Props) {
  return (
    <div className="shop-consumable-tile u-col u-items-c u-gap-3 u-grow">
      <div className="shop-consumable-icon">{consumable.icon}</div>
      <div className="shop-consumable-name">{consumable.name}</div>
      <div className="shop-consumable-desc">{consumable.desc}</div>
      <Button
        variant="gold"
        className={`shop-consumable-buy-btn${canAfford ? '' : ' shop-card-buy-btn--poor'}`}
        onClick={onBuy}
        disabled={!canAfford}
      >
        {discounted && <span className="shop-discount-badge">-10%</span>}
        <span className="shop-price">{price}</span> <Icon name="crystal" size={13} />
      </Button>
    </div>
  )
}
