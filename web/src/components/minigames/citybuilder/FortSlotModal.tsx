import React from 'react'
import {
  CityState,
  FORT_DEFENSE, FORT_MAX_HP, FORT_MAX_ATTACKS,
  RESOURCE_ICONS, ResourceType,
} from '../../../game/cityBuilder'
import { SpriteImg } from '../../ui/SpriteImg'
import { formatCountdown } from '../CityBuilder'
import { FortSlot } from './FortCell'

export interface Props {
  slot:          Exclude<FortSlot, { kind: 'empty' }>
  city:          CityState
  currentTime:   number
  onClose:       () => void
  onRemoveFort:  (fortIndex: number) => void
}

export function FortSlotModal({ slot, currentTime, onClose, onRemoveFort }: Props) {
  if (slot.kind === 'building') {
    const msLeft = Math.max(0, slot.entry.completesAt - currentTime)
    return (
      <div className="city-req-overlay" onClick={onClose}>
        <div className="city-req-modal" onClick={e => e.stopPropagation()}>
          <div className="city-req-header u-flex u-items-c u-gap-4">
            <div style={{ opacity: 0.5 }}><SpriteImg name={slot.entry.cardName} className="city-req-sprite" /></div>
            <div className="city-req-name">{slot.entry.cardName}</div>
          </div>
          <div className="city-bld-section-title">🔨 Under Construction</div>
          <div style={{ textAlign: 'center', color: '#c09040', fontSize: 14, margin: '8px 0' }}>
            {formatCountdown(msLeft)} remaining
          </div>
          <div style={{ fontSize: 10, color: '#608060', textAlign: 'center' }}>
            🛡 {FORT_DEFENSE[slot.entry.rarity]} defence when complete · {FORT_MAX_HP[slot.entry.rarity]} HP · {FORT_MAX_ATTACKS[slot.entry.rarity]} raids lifespan
          </div>
          <button className="action-btn" style={{ marginTop: 12 }} onClick={onClose}>CLOSE</button>
        </div>
      </div>
    )
  }

  // active fort
  const { fort, fortIndex } = slot
  const hpPct    = fort.hp / fort.maxHp
  const hpColor  = hpPct > 0.6 ? '#40a040' : hpPct > 0.3 ? '#c08020' : '#c04020'
  const maxAtks  = FORT_MAX_ATTACKS[fort.rarity]
  const atksLeft = maxAtks - (fort.attacksTaken ?? 0)
  const lifePct  = atksLeft / maxAtks
  const lifeColor = lifePct > 0.5 ? '#305080' : lifePct > 0.25 ? '#705020' : '#702020'

  return (
    <div className="city-req-overlay" onClick={onClose}>
      <div className="city-req-modal" onClick={e => e.stopPropagation()}>
        <div className="city-req-header u-flex u-items-c u-gap-4">
          <SpriteImg name={fort.cardName} className="city-req-sprite" />
          <div className="city-req-name">{fort.cardName}</div>
        </div>
        <div className="city-fort-details" style={{ width: '100%', gap: 6 }}>
          <div className="city-fort-hp-track">
            <div className="city-fort-hp-bar">
              <div className="city-fort-hp-fill" style={{ width: `${Math.round(hpPct * 100)}%`, background: hpColor }} />
            </div>
            <span className="city-fort-hp-text">{Math.round(fort.hp)}/{fort.maxHp} HP</span>
          </div>
          <div className="city-fort-hp-track" title="Raids until permanent destruction">
            <div className="city-fort-hp-bar">
              <div className="city-fort-hp-fill" style={{ width: `${Math.round(lifePct * 100)}%`, background: lifeColor }} />
            </div>
            <span className="city-fort-hp-text" style={{ color: lifeColor }}>{atksLeft}/{maxAtks} raids</span>
          </div>
          <div className="city-fort-defense-val">🛡 {Math.round(FORT_DEFENSE[fort.rarity] * hpPct)} defence · 🪵 repairs 1HP/5min</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="action-btn action-btn--danger"
            onClick={() => { onRemoveFort(fortIndex); onClose() }}>REMOVE</button>
          <button className="action-btn" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  )
}
