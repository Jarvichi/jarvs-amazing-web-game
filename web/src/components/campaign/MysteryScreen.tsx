import React, { useState } from 'react'
import { RewardDef } from '../../game/dailyLogin'

const LORE_LINES = [
  '"I arrived expecting a fight. Found only silence — and something left behind."',
  '"The battlefield was empty. Not abandoned. Cleared. Something had already been here."',
  '"No enemy. No struggle. Just the soft crunch of ash underfoot, and a chest someone forgot to take."',
  '"The field looked ready for battle. But the battle had already happened — without me."',
  '"Arrived late. The others had already dealt with whatever this was. Left me a consolation prize."',
]

interface Props {
  reward: RewardDef
  onCollect: () => void
}

export function MysteryScreen({ reward, onCollect }: Props) {
  const [lore] = useState(() => LORE_LINES[Math.floor(Math.random() * LORE_LINES.length)])

  const rewardLabel = reward.type === 'crystals'
    ? `◆ ${reward.amount} crystals`
    : reward.type === 'item'
      ? `${reward.icon} ${reward.name}`
      : reward.type === 'card'
        ? `Card: ${reward.name}`
        : 'A reward'

  return (
    <div className="mystery-screen">
      <div className="mystery-header">// MYSTERY NODE</div>

      <div className="mystery-field">
        <div className="mystery-field-icon">🌫</div>
        <div className="mystery-field-label">EMPTY BATTLEFIELD</div>
      </div>

      <div className="mystery-lore">{lore}</div>

      <div className="mystery-chest">
        <div className="mystery-chest-icon">📦</div>
        <div className="mystery-chest-label">UNCLAIMED REWARD</div>
        <div className="mystery-reward-value">{rewardLabel}</div>
      </div>

      <button className="action-btn action-btn--large mystery-collect-btn" onClick={onCollect}>
        COLLECT &amp; CONTINUE ›
      </button>
    </div>
  )
}
