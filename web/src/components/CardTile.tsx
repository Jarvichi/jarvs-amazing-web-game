import React from 'react'
import { Card, UpgradeEffect } from '../game/types'
import { rarityStars } from '../game/cards'
import { SpriteImg } from './SpriteImg'

// ─── Inline SVG icons for upgrade / buff cards ────────────────────────────────
function UpgradeIcon({ effect }: { effect: UpgradeEffect }) {
  const p = { width: 40, height: 36, viewBox: '0 0 40 36', xmlns: 'http://www.w3.org/2000/svg' as const }
  if (effect.type === 'buffAttack') return (
    <svg {...p}>
      <line x1="8"  y1="28" x2="32" y2="8"  stroke="#ff8844" strokeWidth="3" strokeLinecap="round"/>
      <line x1="32" y1="28" x2="8"  y2="8"  stroke="#ff8844" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="8"  cy="8"  r="3" fill="#ffaa66"/>
      <circle cx="32" cy="8"  r="3" fill="#ffaa66"/>
      <circle cx="20" cy="18" r="4" fill="#ff6622"/>
    </svg>
  )
  if (effect.type === 'healUnits') return (
    <svg {...p}>
      <rect x="16" y="6"  width="8"  height="24" rx="2" fill="#33cc66"/>
      <rect x="6"  y="14" width="28" height="8"  rx="2" fill="#33cc66"/>
      <rect x="17" y="7"  width="6"  height="22" rx="1" fill="#66ff99" opacity="0.5"/>
    </svg>
  )
  if (effect.type === 'buffSpeed') return (
    <svg {...p}>
      <polygon points="24,4 14,20 20,20 16,32 28,14 22,14" fill="#ffdd00"/>
      <polygon points="24,5 15,20 21,20 17,31 27,15 21,15" fill="#ffff66" opacity="0.4"/>
    </svg>
  )
  if (effect.type === 'buffMaxHp') return (
    <svg {...p}>
      <path d="M20,30 C10,22 4,16 4,10 C4,6 7,4 11,4 C14,4 17,6 20,10 C23,6 26,4 29,4 C33,4 36,6 36,10 C36,16 30,22 20,30 Z" fill="#cc3344"/>
      <path d="M20,27 C12,21 7,16 7,11 C7,8 9,6 12,6 C15,6 17,8 20,12 C23,8 25,6 28,6 C31,6 33,8 33,11 C33,16 28,21 20,27 Z" fill="#ff5566" opacity="0.7"/>
    </svg>
  )
  if (effect.type === 'buffRange') return (
    <svg {...p}>
      <circle cx="20" cy="18" r="13" fill="none" stroke="#4499ff" strokeWidth="2"/>
      <circle cx="20" cy="18" r="8"  fill="none" stroke="#4499ff" strokeWidth="1.5"/>
      <circle cx="20" cy="18" r="3"  fill="#4499ff"/>
      <line x1="20" y1="2"  x2="20" y2="34" stroke="#4499ff" strokeWidth="1" opacity="0.4"/>
      <line x1="4"  y1="18" x2="36" y2="18" stroke="#4499ff" strokeWidth="1" opacity="0.4"/>
    </svg>
  )
  return null
}

interface Props {
  card: Card
  canAfford?: boolean
  disabled?: boolean
  onClick?: () => void
  lockedSecs?: number   // hero cards: seconds remaining until playable (0 = unlocked)
  upgradeable?: boolean // collection: show ↑ instead of mana cost
}

export function CardTile({ card, canAfford = true, disabled = false, onClick, lockedSecs = 0, upgradeable = false }: Props) {
  const heroLocked = card.isHero && lockedSecs > 0
  const clickable = canAfford && !disabled && !heroLocked

  let stats: string

  if (card.cardType === 'upgrade' && card.upgradeEffect) {
    const e = card.upgradeEffect
    stats = e.type === 'buffAttack'  ? `+${e.amount} ⚔`
          : e.type === 'healUnits'   ? `♥ +${e.amount}`
          : e.type === 'buffSpeed'   ? `+${e.amount} SPD`
          : e.type === 'buffMaxHp'   ? `+${e.amount} ♥`
          : e.type === 'buffRange'   ? `+${e.amount} RNG`
          : `UPGRADE`
  } else if (card.unit) {
    const u = card.unit
    if (u.isWall || u.attack === 0) {
      stats = `♥ ${u.maxHp}`
    } else {
      stats = `⚔ ${u.attack} / ♥ ${u.maxHp}`
    }
  } else {
    stats = ''
  }

  return (
    <div
      className={[
        'card-tile',
        `card-tile--${card.rarity}`,
        clickable ? '' : 'card-tile--disabled',
      ].filter(Boolean).join(' ')}
      onClick={clickable ? onClick : undefined}
      title={heroLocked ? `Hero cards unlock after 30 seconds (${lockedSecs}s remaining)` : card.description}
    >
      <div className={upgradeable ? 'card-cost card-cost--upgrade' : 'card-cost'}>
        {upgradeable ? '↑' : card.cost}
      </div>
      <div className="card-title">{card.name}</div>
      <div className="card-art">
        {card.unit
          ? <SpriteImg name={card.unit.name} className="card-sprite" />
          : card.upgradeEffect
            ? <UpgradeIcon effect={card.upgradeEffect} />
            : null
        }
      </div>
      <div className="card-stats">{stats}</div>
      <div className="card-rarity">{rarityStars(card.rarity)}</div>
      {heroLocked && (
        <div className="card-hero-lock">
          <span className="card-hero-lock-icon">⏳</span>
          <span className="card-hero-lock-secs">{lockedSecs}s</span>
        </div>
      )}
    </div>
  )
}
