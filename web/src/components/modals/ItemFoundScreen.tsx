import React from 'react'
import { UselessItem } from '../../game/dailyLogin'

interface Props {
  item: UselessItem
  onCollect: () => void
}

export function ItemFoundScreen({ item, onCollect }: Props) {
  return (
    <div className="item-found-screen u-col u-items-c u-gap-8 u-text-c">
      <div className="item-found-header">// ITEM FOUND</div>

      <div className="item-found-icon">{item.icon}</div>
      <div className="item-found-name">{item.name}</div>
      <div className="item-found-desc">{item.desc}</div>
      {item.lore && <div className="item-found-lore">"{item.lore}"</div>}

      <button className="action-btn action-btn--large item-found-btn" onClick={onCollect}>
        TAKE IT &amp; CONTINUE ›
      </button>
    </div>
  )
}
