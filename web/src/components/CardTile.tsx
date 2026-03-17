import React from 'react'
import { Card } from '../game/types'
import { rarityStars } from '../game/cards'
import { SpriteImg } from './SpriteImg'

const UPGRADE_SPRITE: Record<string, string> = {
  buffAttack: 'upgrade-attack',
  healUnits:  'upgrade-heal',
  buffSpeed:  'upgrade-speed',
  buffMaxHp:  'upgrade-hp',
  buffRange:  'upgrade-range',
}

interface Props {
  card: Card
  canAfford?: boolean
  disabled?: boolean
  onClick?: () => void
  lockedSecs?: number   // hero cards: seconds remaining until playable (0 = unlocked)
  upgradeable?: boolean // collection: show UPGRADE badge
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
      <div className="card-cost">{card.cost}</div>
      {upgradeable && <div className="card-upgrade-badge">UPGRADE</div>}
      <div className="card-title">{card.name}</div>
      <div className="card-art">
        {card.unit
          ? <SpriteImg name={card.unit.name} className="card-sprite" />
          : card.upgradeEffect
            ? <SpriteImg name={UPGRADE_SPRITE[card.upgradeEffect.type] ?? 'upgrade'} className="card-sprite" />
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
