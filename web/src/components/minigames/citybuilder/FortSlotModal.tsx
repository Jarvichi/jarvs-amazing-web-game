import React from 'react'
import {
  CityState,
  FORT_DEFENSE, FORT_MAX_HP, FORT_MAX_ATTACKS, FORT_PLACE_COST, FORT_BUILD_MINUTES,
  canAffordFortification, canQueueFortification,
  RESOURCE_ICONS, ResourceType,
} from '../../../game/cityBuilder'
import { Card } from '../../../game/types'
import { SpriteImg } from '../../ui/SpriteImg'
import { formatCountdown } from '../CityBuilder'
import { FortSlot } from './FortCell'

const RARITY_ORDER = ['common','uncommon','rare','epic','legendary','mythic','shiny','holofoil','glass']

export interface Props {
  slot: FortSlot
  city: CityState
  currentTime: number
  availableDefenceCards: Card[]
  fortFilter: string
  setFortFilter: (f: string) => void
  fortSort: 'defense' | 'name' | 'rarity'
  setFortSort: (s: 'defense' | 'name' | 'rarity') => void
  onClose: () => void
  onAddFort: (card: Card) => void
  onRemoveFort: (fortIndex: number) => void
}

export function FortSlotModal({
  slot, city, currentTime, availableDefenceCards,
  fortFilter, setFortFilter, fortSort, setFortSort,
  onClose, onAddFort, onRemoveFort,
}: Props) {
  if (slot.kind === 'empty') {
    const canQueue = canQueueFortification(city)
    const rarities = [...new Set(availableDefenceCards.map(c => c.rarity))]
    const filtered = fortFilter === 'all'
      ? availableDefenceCards
      : availableDefenceCards.filter(c => c.rarity === fortFilter)
    const sorted = [...filtered].sort((a, b) => {
      if (fortSort === 'defense') return FORT_DEFENSE[b.rarity] - FORT_DEFENSE[a.rarity]
      if (fortSort === 'name')    return a.name.localeCompare(b.name)
      return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
    })

    return (
      <div className="city-req-overlay" onClick={onClose}>
        <div className="city-req-modal" onClick={e => e.stopPropagation()}>
          <div className="city-req-header u-flex u-items-c u-gap-4">
            <div className="city-req-name">Build a Fortification</div>
          </div>
          {!canQueue ? (
            <div className="city-picker-empty" style={{ padding: '12px 0' }}>
              All builders are busy — wait for one to finish, or hire another.
            </div>
          ) : availableDefenceCards.length === 0 ? (
            <div className="city-picker-empty" style={{ padding: '12px 0' }}>
              No defence cards available. Earn them in battles!
            </div>
          ) : (
            <>
              <div className="city-fort-controls u-flex u-just-sb u-items-c u-gap-3 u-wrap">
                <div className="city-fort-filter">
                  {(['all', ...rarities] as string[]).map(r => (
                    <button key={r}
                      className={`city-fort-filter-btn${fortFilter === r ? ' city-fort-filter-btn--active' : ''}`}
                      onClick={() => setFortFilter(r)}>
                      {r === 'all' ? 'All' : r}
                    </button>
                  ))}
                </div>
                <div className="city-fort-sort">
                  {(['defense','name','rarity'] as const).map(s => (
                    <button key={s}
                      className={`city-fort-sort-btn${fortSort === s ? ' city-fort-sort-btn--active' : ''}`}
                      onClick={() => setFortSort(s)}>
                      {s === 'defense' ? '🛡' : s === 'name' ? 'A–Z' : '★'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="city-picker-section">
                <div className="city-picker-grid">
                  {sorted.length === 0 ? (
                    <div className="city-picker-empty">No cards match this filter.</div>
                  ) : sorted.map(card => {
                    const cost       = FORT_PLACE_COST[card.rarity]
                    const affordable = canAffordFortification(city, card.rarity)
                    return (
                      <button key={card.name}
                        className={`city-picker-card u-col u-items-c u-gap-2 u-pointer${!affordable ? ' city-picker-card--unaffordable' : ''}`}
                        disabled={!affordable}
                        onClick={() => { onAddFort(card); onClose() }}>
                        <SpriteImg name={card.name} className="city-picker-sprite" />
                        <div className="city-picker-name">{card.name}</div>
                        <div className={`city-picker-rarity city-picker-rarity--${card.rarity}`}>{card.rarity}</div>
                        <div className="city-picker-income">🛡{FORT_DEFENSE[card.rarity]} · {FORT_MAX_HP[card.rarity]}HP · {FORT_MAX_ATTACKS[card.rarity]} raids</div>
                        <div className="city-picker-income" style={{ color: '#888' }}>🔨 {
                          FORT_BUILD_MINUTES[card.rarity] >= 1440
                            ? `${Math.round(FORT_BUILD_MINUTES[card.rarity] / 1440)} days`
                            : FORT_BUILD_MINUTES[card.rarity] >= 60
                            ? `${Math.round(FORT_BUILD_MINUTES[card.rarity] / 60)} hrs`
                            : `${FORT_BUILD_MINUTES[card.rarity]} min`
                        }</div>
                        <div className="city-picker-cost">
                          ⚙{cost.gold.toLocaleString()}
                          {(Object.keys(cost) as (keyof typeof cost)[])
                            .filter(k => k !== 'gold' && (cost[k] ?? 0) > 0)
                            .map(k => ` ${RESOURCE_ICONS[k as ResourceType]}${cost[k]}`).join('')}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
          <button className="action-btn" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    )
  }

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
