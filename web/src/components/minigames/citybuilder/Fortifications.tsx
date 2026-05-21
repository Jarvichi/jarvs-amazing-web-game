import React, { useState } from 'react'
import {
  CityState, FORT_DEFENSE, FORT_MAX_HP, FORT_MAX_ATTACKS, FORT_PLACE_COST, FORT_BUILD_MINUTES,
  MAX_TOTAL_FORTS, MAX_BUILDER_COUNT, DEFAULT_BUILDER_COUNT,
  canAffordFortification, canQueueFortification,
  nextBuilderCost, CITY_COLS, CITY_ROWS,
  RESOURCE_ICONS, ResourceType,
} from '../../../game/cityBuilder'
import { Card } from '../../../game/types'
import { AnimatedSpriteImg, SpriteImg } from '../../ui/SpriteImg'
import { OverlayScreen } from '../../ui/OverlayScreen'
import { BuilderWalker } from '../CityBuilder'
import { FortCell, FortSlot } from './FortCell'
import { FortSlotModal } from './FortSlotModal'
import { CityThumbnail } from './CityThumbnail'

const RARITY_ORDER = ['common','uncommon','rare','epic','legendary','mythic','shiny','holofoil','glass']

export interface Props {
  city:                 CityState
  currentTime:          number
  builderWalkers:       BuilderWalker[]
  fortRingRef:          React.RefObject<HTMLDivElement>
  fortSlotSel:          number | null
  setFortSlotSel:       (idx: number | null) => void
  availableDefenceCards: Card[]
  onBack:               () => void
  onAddFort:            (card: Card) => void
  onBuyBuilder:         () => void
  onRemoveFort:         (index: number) => void
}

const SLOT_AREA = ['f0','f1','f2','f3','f4','f5','f6','f7','f8','f9','f10','f11']

export function Fortifications({
  city, currentTime, builderWalkers, fortRingRef,
  fortSlotSel, setFortSlotSel,
  availableDefenceCards,
  onBack, onAddFort, onBuyBuilder, onRemoveFort,
}: Props) {
  const [subScreen, setSubScreen] = useState<'slots' | 'picker'>('slots')
  const [fortFilter, setFortFilter] = useState<string>('all')
  const [fortSort, setFortSort]     = useState<'defense' | 'name' | 'rarity'>('defense')

  const builderCount = city.builderCount ?? DEFAULT_BUILDER_COUNT
  const freeBuilders = builderCount - city.builderQueue.length
  const builderCost  = nextBuilderCost(city)
  const totalDefense = city.fortifications.reduce(
    (s, f) => s + Math.round(FORT_DEFENSE[f.rarity] * (f.hp / f.maxHp)), 0
  )
  const cityRows = city.rows ?? CITY_ROWS
  const cityCols = city.cols ?? CITY_COLS

  const fortSlots: FortSlot[] = Array.from({ length: MAX_TOTAL_FORTS }, (_, i) => {
    if (i < city.fortifications.length)
      return { kind: 'active', fort: city.fortifications[i], fortIndex: i }
    const qi = i - city.fortifications.length
    if (qi < city.builderQueue.length)
      return { kind: 'building', entry: city.builderQueue[qi], queueIndex: qi }
    return { kind: 'empty' }
  })

  const selSlot = fortSlotSel !== null ? fortSlots[fortSlotSel] : null

  // ── Full-screen fort picker ───────────────────────────────────────────────────

  if (subScreen === 'picker') {
    const canQueue  = canQueueFortification(city)
    const rarities  = [...new Set(availableDefenceCards.map(c => c.rarity))]
    const filtered  = fortFilter === 'all'
      ? availableDefenceCards
      : availableDefenceCards.filter(c => c.rarity === fortFilter)
    const sorted = [...filtered].sort((a, b) => {
      if (fortSort === 'defense') return FORT_DEFENSE[b.rarity] - FORT_DEFENSE[a.rarity]
      if (fortSort === 'name')    return a.name.localeCompare(b.name)
      return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
    })

    return (
      <OverlayScreen title="🛡 BUILD FORTIFICATION" onBack={() => setSubScreen('slots')}>
        <div className="city-screen u-relative u-col u-gap-2">
          <div className="city-subscreen-scroll">
            {!canQueue ? (
              <div className="city-picker-empty">
                All builders are busy — wait for one to finish, or hire another.
              </div>
            ) : availableDefenceCards.length === 0 ? (
              <div className="city-picker-empty">
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
                  <div className="city-picker-section-label">DEFENCE CARDS</div>
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
                          onClick={() => { onAddFort(card); setSubScreen('slots') }}>
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
          </div>
        </div>
      </OverlayScreen>
    )
  }

  // ── Slots view ────────────────────────────────────────────────────────────────

  return (
    <OverlayScreen
      title="🛡 WALLS &amp; FORTIFICATIONS"
      onBack={onBack}
      right={<span>🛡 {totalDefense} defence</span>}
    >
      <div className="city-screen u-relative u-col u-gap-2">

        {/* Builder info strip */}
        <div className="city-fort-info-row u-flex u-just-sb u-items-c u-wrap u-gap-2">
          <span>🏗 {freeBuilders}/{builderCount} builders free</span>
          {builderCost !== null && builderCount < MAX_BUILDER_COUNT && (
            <button
              className={`filter-btn${city.gold >= builderCost ? ' action-btn--gold' : ''}`}
              style={{ fontSize: 9, padding: '2px 6px' }}
              onClick={onBuyBuilder}
              disabled={city.gold < builderCost}
            >+ Builder ⚙{builderCost.toLocaleString()}</button>
          )}
        </div>

        {/* Fort ring */}
        <div className="fort-ring-wrap" ref={fortRingRef}>
          <div className="fort-ring-grid">
            {fortSlots.map((slot, idx) => (
              <FortCell
                key={idx}
                slot={slot}
                area={SLOT_AREA[idx]}
                onClick={() => {
                  if (slot.kind === 'empty') {
                    setSubScreen('picker')
                  } else {
                    setFortSlotSel(idx)
                  }
                }}
              />
            ))}
            <CityThumbnail grid={city.grid.map(c => c ?? null)} cols={cityCols} rows={cityRows} />
          </div>

          {/* Builder walkers overlay */}
          <div className="city-unit-overlay" style={{ pointerEvents: 'none' }}>
            {builderWalkers.map((b, idx) => (
              <div key={idx} className="city-walker city-builder-walker city-builder-walker--ring"
                style={{ left: Math.round(b.ringX), top: Math.round(b.ringY) }}>
                <div className="city-builder-bubble">
                  {b.ringPhase === 'delivering' ? '🏗 Building the wall' : '🪵 Fetching materials'}
                </div>
                <AnimatedSpriteImg name="Builder" frameCount={3} fps={8} className="city-builder-walker-sprite--ring" />
              </div>
            ))}
          </div>
        </div>

        {/* Info modal for active/building slots only */}
        {fortSlotSel !== null && selSlot !== null && selSlot.kind !== 'empty' && (
          <FortSlotModal
            slot={selSlot}
            city={city}
            currentTime={currentTime}
            onClose={() => setFortSlotSel(null)}
            onRemoveFort={onRemoveFort}
          />
        )}
      </div>
    </OverlayScreen>
  )
}
