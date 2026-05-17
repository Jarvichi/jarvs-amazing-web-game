import React from 'react'
import { Fortification, BuildQueueEntry, FORT_DEFENSE, FORT_MAX_ATTACKS } from '../../../game/cityBuilder'
import { SpriteImg } from '../../ui/SpriteImg'
import { formatCountdown } from '../CityBuilder'

export type FortSlot =
  | { kind: 'active';   fort: Fortification; fortIndex: number }
  | { kind: 'building'; entry: BuildQueueEntry; queueIndex: number }
  | { kind: 'empty' }

export interface Props {
  slot: FortSlot
  area: string
  onClick: () => void
}

export function FortCell({ slot, area,  onClick }: Props) {
  if (slot.kind === 'empty') {
    return (
      <button className="fort-ring-cell" style={{ gridArea: area }}
        onClick={onClick} title="Tap to build a fortification">
        <span className="city-cell-forsale-sign">FOR<br/>SALE</span>
        <span className="city-cell-forsale-post" />
      </button>
    )
  }

  if (slot.kind === 'building') {
    const msLeft = Math.max(0, slot.entry.completesAt - Date.now())
    return (
      <button className="fort-ring-cell fort-ring-cell--building" style={{ gridArea: area }}
        onClick={onClick} title={`Building: ${formatCountdown(msLeft)} left`}>
        <SpriteImg name={slot.entry.cardName} className="fort-ring-sprite" />
        <div className="fort-ring-building-badge">🔨</div>
        <div className="fort-ring-eta">{formatCountdown(msLeft)}</div>
      </button>
    )
  }

  const hpPct    = slot.fort.hp / slot.fort.maxHp
  const maxAtks  = FORT_MAX_ATTACKS[slot.fort.rarity]
  const atksLeft = maxAtks - (slot.fort.attacksTaken ?? 0)
  const hpColor  = hpPct > 0.6 ? '#308030' : hpPct > 0.3 ? '#806020' : '#802020'
  const lifeColor = atksLeft / maxAtks > 0.5 ? '#305080' : atksLeft / maxAtks > 0.25 ? '#705020' : '#702020'

  return (
    <button className="fort-ring-cell fort-ring-cell--active" style={{ gridArea: area }}
      onClick={onClick} title={`${slot.fort.cardName} — tap to inspect`}>
      <SpriteImg name={slot.fort.cardName} className="fort-ring-sprite" />
      <div className="fort-ring-bar-row">
        <div className="fort-ring-bar" style={{ background: '#1a2a1a' }}>
          <div className="fort-ring-bar-fill" style={{ width: `${Math.round(hpPct * 100)}%`, background: hpColor }} />
        </div>
      </div>
      <div className="fort-ring-bar-row">
        <div className="fort-ring-bar" style={{ background: '#0a1018' }}>
          <div className="fort-ring-bar-fill" style={{ width: `${Math.round(atksLeft / maxAtks * 100)}%`, background: lifeColor }} />
        </div>
      </div>
      <div className="fort-ring-defense">🛡{Math.round(FORT_DEFENSE[slot.fort.rarity] * hpPct)}</div>
    </button>
  )
}
