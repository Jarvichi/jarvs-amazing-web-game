import React from 'react'
import { Card } from '../../game/types'
import { rarityStars } from '../../game/cards'
import { SpriteImg } from '../BuildingBlocks/SpriteImg'
import { useCardDetail } from './useCardDetail'

const UPGRADE_SPRITE: Record<string, string> = {
  buffAttack: 'upgrade-attack',
  healUnits:  'upgrade-heal',
  buffSpeed:  'upgrade-speed',
  buffMaxHp:  'upgrade-hp',
  buffRange:  'upgrade-range',
}

// ─── Card type category ───────────────────────────────────

type CardCategory = 'unit' | 'hero' | 'spawner' | 'defensive' | 'support' | 'buff'

function getCardCategory(card: Card): CardCategory {
  if (card.isHero) return 'hero'
  if (card.cardType === 'upgrade') return 'buff'
  if (card.cardType === 'unit') return 'unit'
  // structure subtypes
  const fx = card.unit?.structureEffect?.type
  if (fx === 'spawn') return 'spawner'
  if (card.unit?.isWall || fx === 'attackAura' || fx === 'slowZone') return 'defensive'
  return 'support' // mana, manaSpeed, healAura, repairAura, unknown
}

const CATEGORY_LABEL: Record<CardCategory, string> = {
  unit:      'UNIT',
  hero:      'HERO',
  spawner:   'SPAWN',
  defensive: 'DEF',
  support:   'SUP',
  buff:      'BUFF',
}

// Inline SVG icons (12×12 viewBox, pixel-art style)
function UnitIcon() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
      {/* sword blade */}
      <line x1="6" y1="1" x2="6" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
      {/* crossguard */}
      <line x1="3" y1="4" x2="9" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
      {/* pommel */}
      <rect x="5" y="9" width="2" height="2" fill="currentColor"/>
    </svg>
  )
}

function HeroIcon() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
      {/* crown base */}
      <rect x="2" y="7" width="8" height="2" fill="currentColor"/>
      {/* three crown points */}
      <rect x="2" y="3" width="2" height="4" fill="currentColor"/>
      <rect x="5" y="2" width="2" height="5" fill="currentColor"/>
      <rect x="8" y="3" width="2" height="4" fill="currentColor"/>
    </svg>
  )
}

function SpawnerIcon() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
      {/* building base */}
      <rect x="1" y="5" width="7" height="6" stroke="currentColor" strokeWidth="1" fill="none"/>
      {/* roof peak */}
      <polyline points="1,5 4.5,2 8,5" stroke="currentColor" strokeWidth="1" fill="none"/>
      {/* exit arrow */}
      <line x1="9" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
      <polyline points="10,6 12,8 10,10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="square" strokeLinejoin="miter"/>
    </svg>
  )
}

function DefensiveIcon() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
      {/* shield outline */}
      <path d="M6 1 L10 3 L10 7 Q10 10 6 11 Q2 10 2 7 L2 3 Z" stroke="currentColor" strokeWidth="1" fill="none"/>
      {/* shield cross */}
      <line x1="6" y1="3.5" x2="6" y2="8.5" stroke="currentColor" strokeWidth="1" strokeLinecap="square"/>
      <line x1="3.5" y1="6" x2="8.5" y2="6" stroke="currentColor" strokeWidth="1" strokeLinecap="square"/>
    </svg>
  )
}

function SupportIcon() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
      {/* diamond gem */}
      <polygon points="6,1 10,5 6,11 2,5" stroke="currentColor" strokeWidth="1" fill="none"/>
      {/* facet line */}
      <line x1="2" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="0.8"/>
      <line x1="6" y1="1" x2="4" y2="5" stroke="currentColor" strokeWidth="0.8"/>
      <line x1="6" y1="1" x2="8" y2="5" stroke="currentColor" strokeWidth="0.8"/>
    </svg>
  )
}

function BuffIcon() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" fill="none">
      {/* lightning bolt */}
      <polyline points="8,1 4,6 7,6 4,11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="square" strokeLinejoin="miter"/>
    </svg>
  )
}

const CATEGORY_ICON: Record<CardCategory, React.ReactNode> = {
  unit:      <UnitIcon />,
  hero:      <HeroIcon />,
  spawner:   <SpawnerIcon />,
  defensive: <DefensiveIcon />,
  support:   <SupportIcon />,
  buff:      <BuffIcon />,
}

interface Props {
  card: Card
  canAfford?: boolean
  disabled?: boolean
  onClick?: () => void
  lockedSecs?: number   // hero cards: seconds remaining until playable (0 = unlocked)
  upgradeable?: boolean // collection: show UPGRADE badge
  showDetails?: boolean  // collection: show details button
}

export function CardTile({ card, canAfford = true, disabled = false, onClick, lockedSecs = 0, upgradeable = false , showDetails = false }: Props) {
  const heroLocked = card.isHero && lockedSecs > 0
  const clickable = canAfford && !disabled && !heroLocked
  const { openDetail, cardDetailNode } = useCardDetail()

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

  const isSecret = card.rarity === 'mythic' || card.rarity === 'shiny' || card.rarity === 'holofoil' || card.rarity === 'glass'
  const secretLabel: Record<string, string> = { mythic: 'MYTHIC', shiny: 'SHINY', holofoil: 'HOLO', glass: 'GLASS' }

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
      {isSecret && (
        <div className={`card-secret-badge card-secret-badge--${card.rarity}`}>
          {secretLabel[card.rarity]}
        </div>
      )}
      {card.rarity === 'glass' && card.glassBreakChance && (
        <div className="card-glass-warning" title={`${Math.round(card.glassBreakChance * 100)}% chance to shatter on play`}>💎</div>
      )}
      {card.isHero && <>


        <div className="hero-badge-wrap">
         <span className="hero-badge">HERO</span>
        </div>
      </>}




      <div className="card-cost">{card.cost}</div>
      {upgradeable && <div className="card-upgrade-badge">UPGRADE</div>}
      <div className="card-title">{card.name}</div>
      <div className="card-art u-flex u-items-c u-just-c">
        {card.unit
          ? <SpriteImg name={card.unit.name} className="card-sprite" />
          : card.upgradeEffect
            ? <SpriteImg name={card.name} fallbackName={UPGRADE_SPRITE[card.upgradeEffect.type] ?? 'upgrade'} className="card-sprite" />
            : null
        }
      </div>

      <div className="card-stats">{stats}</div>
      <div className="card-bottom-row u-flex u-items-c u-just-sb u-gap-1">
        <div className="card-rarity">{rarityStars(card.rarity)}</div>
        <div className={`card-type-badge card-type-badge--${getCardCategory(card)}`}>
          {CATEGORY_ICON[getCardCategory(card)]}
          <span>{CATEGORY_LABEL[getCardCategory(card)]}</span>
        </div>
        {showDetails && (
          <div className="cell-footer">
              <button
                className="extra-btn cdm-info-btn"
                onClick={e => { e.stopPropagation(); openDetail(card) }}
                title="Card details"
              >ⓘ</button>
            </div>       
        )} 
      </div>
      {heroLocked && (
        <div className="card-hero-lock u-absolute u-col u-items-c u-just-c">
          <span className="card-hero-lock-icon">⏳</span>
          <span className="card-hero-lock-secs">{lockedSecs}s</span>
        </div>
      )}
      {cardDetailNode}
    </div>
  )
}
