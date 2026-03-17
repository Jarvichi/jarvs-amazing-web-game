import React from 'react'
import { RewardDef } from '../game/dailyLogin'
import { CardTile } from './CardTile'
import { getCardCatalog } from '../game/cards'

interface Props {
  reward: RewardDef
  onClose: () => void
}

const CRYSTAL_MSGS = [
  "A gift from the Shattered Dominion.",
  "The path rewards the persistent.",
  "Jarv finds a coin on the road.",
  "The merchant left something behind.",
  "Fortune smiles today.",
]

export function DailyLoginModal({ reward, onClose }: Props) {
  const catalog = getCardCatalog()

  const cardObj = reward.type === 'card' && reward.cardName
    ? catalog.find(c => c.name === reward.cardName) ?? null
    : null

  const crystalMsg = CRYSTAL_MSGS[Math.floor(Math.random() * CRYSTAL_MSGS.length)]

  return (
    <div className="daily-modal-backdrop" onClick={onClose}>
      <div className="daily-modal" onClick={e => e.stopPropagation()}>
        <div className="daily-modal-header">
          ✦ DAILY REWARD ✦
        </div>
        <div className="daily-modal-sub">Welcome back, Jarv.</div>

        <div className="daily-modal-reward">
          {reward.type === 'crystals' && (
            <>
              <div className="daily-modal-icon">💎</div>
              <div className="daily-modal-value">+{reward.amount} Crystals</div>
              <div className="daily-modal-desc">{crystalMsg}</div>
            </>
          )}
          {reward.type === 'card' && cardObj && (
            <>
              <div className="daily-modal-icon">🃏</div>
              <div className="daily-modal-value">New Card!</div>
              <div className="daily-modal-card-wrap">
                <CardTile card={cardObj} canAfford={true} />
              </div>
              <div className="daily-modal-desc">Added to your collection.</div>
            </>
          )}
          {reward.type === 'pack' && (
            <>
              <div className="daily-modal-icon">🎁</div>
              <div className="daily-modal-value">Card Pack!</div>
              <div className="daily-modal-desc">
                {reward.count ?? 5} cards added to your collection.<br />
                Check your Collection to see them.
              </div>
            </>
          )}
          {reward.type === 'item' && (
            <>
              <div className="daily-modal-icon">{reward.icon}</div>
              <div className="daily-modal-value">{reward.name}</div>
              <div className="daily-modal-desc">{reward.desc}</div>
              <div className="daily-modal-desc">{reward.lore}</div>
              <div className="daily-modal-useless-note">
                (Added to your inventory. Completely useless.)
              </div>
            </>
          )}
        </div>

        <button className="action-btn" onClick={onClose}>
          CLAIM ✓
        </button>
      </div>
    </div>
  )
}
