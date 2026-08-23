import React from 'react'
import { getKnownSellers, getKnownBuyers, SellerEntry, BuyerEntry } from '../../game/hub/tradeJournal'
import { getHubItemCatalogEntry } from '../../game/itemStore'

function itemDisplay(itemId: string): { name: string; icon: string } {
  const catalog = getHubItemCatalogEntry(itemId)
  return { name: catalog?.name ?? itemId, icon: catalog?.icon ?? '📦' }
}

export function TradeJournalContent() {
  const sellers = getKnownSellers()
  const buyers = getKnownBuyers()

  const sellerRow = (entry: SellerEntry) => {
    const { name, icon } = itemDisplay(entry.itemId)
    const currencyIcon = entry.currency === 'tickets' ? '🎫' : '💎'
    return (
      <div key={`${entry.itemId}:${entry.town}:${entry.speaker}`} className="quests-modal__card">
        <div className="quests-modal__title">{icon} {name}</div>
        <div className="quests-modal__step">
          <span>{entry.speaker} — {entry.town}</span>
          <span>{entry.price} {currencyIcon}</span>
        </div>
      </div>
    )
  }

  const buyerRow = (entry: BuyerEntry) => {
    const { name, icon } = itemDisplay(entry.itemId)
    return (
      <div key={`${entry.itemId}:${entry.town}:${entry.speaker}`} className="quests-modal__card">
        <div className="quests-modal__title">{icon} {name}</div>
        <div className="quests-modal__step">
          <span>{entry.speaker} — {entry.town}</span>
          <span>{entry.rewardSummary}</span>
        </div>
      </div>
    )
  }

  return (
      <>

        <div className="quests-modal__section-label">Known Sellers</div>
        {sellers.length === 0 ? (
          <div className="quests-modal__empty">You haven't found anyone selling anything yet.</div>
        ) : (
          sellers.map(sellerRow)
        )}

        <div className="quests-modal__section-label">Known Buyers</div>
        {buyers.length === 0 ? (
          <div className="quests-modal__empty">You haven't found anyone wanting to trade yet.</div>
        ) : (
          buyers.map(buyerRow)
        )}
      </>
  )
}
