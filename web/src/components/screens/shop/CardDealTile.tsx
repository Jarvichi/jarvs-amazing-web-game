import React from 'react'
import { Card } from '../../../game/types'
import { ShopCardDeal } from '../../../game/shopSchedule'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/icons/Icon'
import { CardTile } from '../../cards/CardTile'

interface Props {
  deal: ShopCardDeal
  card: Card | null
  bought: boolean
  price: number
  discounted: boolean
  canAfford: boolean
  onBuy: () => void
}

export function CardDealTile({ deal, card, bought, price, discounted, canAfford, onBuy }: Props) {
  return (
    <div className={`shop-card-deal shop-card-deal--${deal.rarity}${bought ? ' shop-card-deal--bought' : ''}`}>
      {card ? (
        <CardTile card={card} canAfford={canAfford} showDetails={true} />
      ) : ( <>Error!</> ) /* This should never happen since the shop schedule only offers valid cards, but just in case... */}
      {bought ? (
        <div className="shop-purchased">PURCHASED ✓</div>
      ) : (
        <Button
          variant="gold"
          className={`shop-card-buy-btn${!canAfford ? ' shop-card-buy-btn--poor' : ''}`}
          onClick={onBuy}
          disabled={!canAfford}
        >
          {discounted && <span className="shop-discount-badge">-10%</span>}
          <span className="shop-price">{price}</span> <Icon name="crystal" size={13} />
        </Button>
      )}
    </div>
  )
}
