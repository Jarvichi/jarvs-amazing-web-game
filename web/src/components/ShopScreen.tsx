import React from 'react'
import { CRYSTAL_PACK_COST } from '../game/collection'
import { OverlayScreen } from './OverlayScreen'

interface Props {
  crystals: number
  onBuyCrystalPack: () => void
  onBack: () => void
}

export function ShopScreen({ crystals, onBuyCrystalPack, onBack }: Props) {
  const canBuy = crystals >= CRYSTAL_PACK_COST

  return (
    <OverlayScreen title="SHOP" onBack={onBack} right={<span className="crystal-count">💎 {crystals.toLocaleString()}</span>}>

      <div className="shop-content">
        <div className="shop-item">
          <div className="shop-item-icon">🎁</div>
          <div className="shop-item-name">Card Pack</div>
          <div className="shop-item-desc">
            5 cards · 2 Common · 1 Uncommon · 1 Rare · 1 Bonus
          </div>
          <button
            className="action-btn action-btn--gold"
            onClick={canBuy ? onBuyCrystalPack : undefined}
            disabled={!canBuy}
          >
            {canBuy ? `Buy — ${CRYSTAL_PACK_COST} 💎` : `Need ${CRYSTAL_PACK_COST - crystals} more 💎`}
          </button>
        </div>
      </div>
    </OverlayScreen>
  )
}
