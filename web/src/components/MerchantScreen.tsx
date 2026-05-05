import React, { useState } from 'react'
import { emitSound } from '../game/sound'
import { Card } from '../game/types'
import { UselessItem } from '../game/dailyLogin'
import { MERCHANT_PRICES, ConsumableDef } from '../game/questline'
import { CardTile } from './CardTile'
import { OverlayScreen } from './OverlayScreen'

export type MerchantItem =
  | { kind: 'card'; card: Card; price: number }
  | { kind: 'item'; inventoryItem: UselessItem; price: number }
  | { kind: 'consumable'; def: ConsumableDef; price: number }

/** Legacy helper: build a card MerchantItem */
export function cardMerchantItem(card: Card): MerchantItem {
  return { kind: 'card', card, price: MERCHANT_PRICES[card.rarity] }
}

function itemKey(item: MerchantItem): string {
  if (item.kind === 'card') return item.card.name
  if (item.kind === 'item') return item.inventoryItem.id
  return `consumable:${item.def.id}`
}

interface Props {
  items: MerchantItem[]
  crystals: number
  onBuy: (item: MerchantItem) => void
  onDone: () => void
}

export function MerchantScreen({ items, crystals, onBuy, onDone }: Props) {
  const [balance, setBalance]     = useState(crystals)
  const [purchased, setPurchased] = useState<Set<string>>(new Set())

  function handleBuy(item: MerchantItem) {
    const key = itemKey(item)
    // Consumables can be bought multiple times
    if (item.kind !== 'consumable' && purchased.has(key)) return
    if (balance < item.price) return
    emitSound('shopPurchase')
    setBalance(b => b - item.price)
    if (item.kind !== 'consumable') setPurchased(p => new Set([...p, key]))
    onBuy(item)
  }

  const cardItems        = items.filter(i => i.kind === 'card')
  const nonCardItems     = items.filter(i => i.kind !== 'card')

  return (
    <OverlayScreen title="MERCHANT" onBack={onDone} right={<span className="crystal-count">💎 {balance.toLocaleString()}</span>}>
      <div className="shop-wrapper">

        <div className="merchant-tagline">
          "Everything has a price. Today, at least these have <em>reasonable</em> ones."
        </div>

        {balance === 0 && (
          <div className="merchant-broke-hint">
            No crystals? Earn them by winning battles in <strong>Quick Play</strong> or <strong>Campaign</strong> — every victory pays out.
          </div>
        )}

        <div className="shop-content">

          {/* ── Card stock ── */}
          {cardItems.length > 0 && (
            <div className="shop-section">
              <div className="shop-section-header">Cards for Sale</div>
              <div className="shop-daily-cards">
                {cardItems.map(item => {
                  if (item.kind !== 'card') return null
                  const key    = itemKey(item)
                  const bought = purchased.has(key)
                  const canBuy = !bought && balance >= item.price
                  return (
                    <div key={key} className={`shop-card-deal shop-card-deal--${item.card.rarity}${bought ? ' shop-card-deal--bought' : ''}`}>
                      <div className="shop-card-rarity">{item.card.rarity.toUpperCase()}</div>
                      <CardTile card={item.card} canAfford={canBuy} onClick={canBuy ? () => handleBuy(item) : undefined} />
                      {bought ? (
                        <div className="shop-purchased">PURCHASED ✓</div>
                      ) : (
                        <button
                          className={`action-btn action-btn--gold shop-card-buy-btn${!canBuy ? ' shop-card-buy-btn--poor' : ''}`}
                          onClick={() => handleBuy(item)}
                          disabled={!canBuy}
                        >
                          {item.price} 💎
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Consumables & Curiosities ── */}
          {nonCardItems.length > 0 && (
            <div className="shop-section">
              <div className="shop-section-header">Supplies & Curiosities</div>
              <div className="shop-consumables">
                {nonCardItems.map(item => {
                  const key = itemKey(item)

                  if (item.kind === 'consumable') {
                    const def = item.def
                    const canBuy = balance >= item.price
                    return (
                      <div key={key} className="shop-consumable-tile">
                        <div className="shop-consumable-icon">{def.icon}</div>
                        <div className="shop-consumable-name">{def.name}</div>
                        <div className="shop-consumable-desc">{def.desc}</div>
                        <button
                          className={`action-btn action-btn--gold shop-consumable-buy-btn${canBuy ? '' : ' shop-card-buy-btn--poor'}`}
                          onClick={() => handleBuy(item)}
                          disabled={!canBuy}
                        >
                          {item.price} 💎
                        </button>
                      </div>
                    )
                  }

                  // kind === 'item' (curiosity)
                  const inv    = item.inventoryItem
                  const bought = purchased.has(key)
                  const canBuy = !bought && balance >= item.price
                  return (
                    <div key={key} className="shop-consumable-tile">
                      <div className="shop-consumable-icon">{inv.icon}</div>
                      <div className="shop-consumable-name">✦ {inv.name}</div>
                      <div className="shop-consumable-desc">{inv.desc}</div>
                      {bought ? (
                        <div className="shop-purchased">PURCHASED ✓</div>
                      ) : (
                        <button
                          className={`action-btn action-btn--gold shop-consumable-buy-btn${canBuy ? '' : ' shop-card-buy-btn--poor'}`}
                          onClick={() => handleBuy(item)}
                          disabled={!canBuy}
                        >
                          {item.price} 💎
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </OverlayScreen>
  )
}
