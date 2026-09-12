import React from 'react'
import { Button } from '../../ui/Button'
import { ListRow } from '../../ui/rows/ListRow'

interface Props {
  icon: string
  name: string
  desc: string
  hasItem: boolean
  alreadySold: boolean
  npcName: string
  apprenticeWillBuy: boolean
  message: string | null
  onSell: () => void
}

export function SellSlotRow({ icon, name, desc, hasItem, alreadySold, npcName, apprenticeWillBuy, message, onSell }: Props) {
  const statusText = alreadySold
    ? "You've already tried selling this today. Come back tomorrow."
    : hasItem
      ? apprenticeWillBuy
        ? `${npcName} is very interested and will give you a fair deal.`
        : "You have this item. The shopkeeper is very interested."
      : "You don't have this item."

  return (
    <ListRow
      icon={icon}
      title={name}
      subtitle={
        <>
          <div>"{desc}"</div>
          {message ? (
            <div className="shop-keeper-msg"><span className="shop-keeper-label">{npcName}:</span> "{message}"</div>
          ) : (
            <div className="shop-item-desc--muted">{statusText}</div>
          )}
        </>
      }
      actions={
        <Button className={!hasItem ? 'action-btn--dim' : ''} onClick={onSell} disabled={!hasItem || alreadySold}>
          Sell
        </Button>
      }
    />
  )
}
