import React, { useState } from 'react'
import { CRYSTAL_PACK_COST } from '../game/collection'
import { incrementAchievementProgress } from '../game/achievements'
import { getDailyShopItem, loadInventory } from '../game/dailyLogin'
import { OverlayScreen } from './OverlayScreen'

// Shopkeeper rejection lines — always picky, never suspicious
const REJECTION_LINES = [
  "Hmm. Close, but this one has too much character. I need a mint-condition specimen.",
  "The provenance is all wrong — I specifically need one acquired on a Tuesday.",
  "Ah, yes... but this variety has a slightly off-centre weight distribution. Not what I'm after.",
  "I can see it's been well-loved. Mine needs to be completely untouched.",
  "The colour's faded just a touch. I'm holding out for the original hue.",
  "It's the right item, but the wrong season's batch. Try again next time.",
  "Nearly perfect — but I need one with no scratches on the underside.",
  "I appreciate the effort. Unfortunately I've become very particular about the grain.",
  "This one smells faintly of adventure. I need one that's never left a pocket.",
  "Fascinating specimen, truly. But I've already committed to sourcing one locally.",
  "The edges are just slightly worn. I'm looking for factory-fresh only.",
  "You're the third person today. None of you have quite the right one.",
  "Wonderful. Truly. But I made a promise to myself: only the unhandled variety.",
]


interface Props {
  crystals: number
  onBuyCrystalPack: () => void
  onBack: () => void
}

export function ShopScreen({ crystals, onBuyCrystalPack, onBack }: Props) {
  const canBuy = crystals >= CRYSTAL_PACK_COST
  const dailyItem = getDailyShopItem()
  const inventory = loadInventory()
  const hasItem = inventory.some(i => i.id === dailyItem.id)

  const [sellMsg, setSellMsg] = useState<string | null>(null)
  const [sellCount, setSellCount] = useState(0)

  function handleBuyClick() {
    if (canBuy) {
      onBuyCrystalPack()
    } else {
      incrementAchievementProgress('misc:shop_broke_click')
    }
  }

  function handleSellClick() {
    incrementAchievementProgress('misc:shop_sell_attempt')
    setSellMsg(REJECTION_LINES[sellCount % REJECTION_LINES.length])
    setSellCount(c => c + 1)
  }

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
            onClick={handleBuyClick}
            disabled={false}
          >
            {canBuy ? `Buy — ${CRYSTAL_PACK_COST} 💎` : `Need ${CRYSTAL_PACK_COST - crystals} more 💎`}
          </button>
        </div>

        <div className="shop-item">
          <div className="shop-item-icon">🛒</div>
          <div className="shop-item-name">Buying Today</div>
          <div className="shop-item-desc">
            {dailyItem.icon} {dailyItem.name} — "{dailyItem.desc}"
          </div>
          {sellMsg ? (
            <div className="shop-keeper-msg">
              <span className="shop-keeper-label">Shopkeeper:</span> "{sellMsg}"
            </div>
          ) : (
            <div className="shop-item-desc shop-item-desc--muted">
              {hasItem ? "You have this item. The shopkeeper is very interested." : "You don't have this item."}
            </div>
          )}
          <button
            className="action-btn"
            onClick={handleSellClick}
            disabled={!hasItem}
          >
            Sell {dailyItem.icon} {dailyItem.name}
          </button>
        </div>
      </div>
    </OverlayScreen>
  )
}
