import React from 'react'
import {
  CityState, FORT_DEFENSE,
  MAX_TOTAL_FORTS, MAX_BUILDER_COUNT, DEFAULT_BUILDER_COUNT,
  canQueueFortification, nextBuilderCost, CITY_COLS, CITY_ROWS,
} from '../../../game/cityBuilder'
import { Card } from '../../../game/types'
import { AnimatedSpriteImg } from '../../ui/SpriteImg'
import { OverlayScreen } from '../../ui/OverlayScreen'
import { BuilderWalker } from '../CityBuilder'
import { FortCell, FortSlot } from './FortCell'
import { FortSlotModal } from './FortSlotModal'
import { CityThumbnail } from './CityThumbnail'

export interface Props {
  city: CityState
  currentTime: number
  builderWalkers: BuilderWalker[]
  fortRingRef: React.RefObject<HTMLDivElement>
  fortSlotSel: number | null
  setFortSlotSel: (idx: number | null) => void
  fortFilter: string
  setFortFilter: (f: string) => void
  fortSort: 'defense' | 'name' | 'rarity'
  setFortSort: (s: 'defense' | 'name' | 'rarity') => void
  availableDefenceCards: Card[]
  onBack: () => void
  onAddFort: (card: Card) => void
  onBuyBuilder: () => void
  onRemoveFort: (index: number) => void
}

const SLOT_AREA = ['f0','f1','f2','f3','f4','f5','f6','f7','f8','f9','f10','f11']

export function Fortifications({
  city, currentTime, builderWalkers, fortRingRef,
  fortSlotSel, setFortSlotSel,
  fortFilter, setFortFilter,
  fortSort, setFortSort,
  availableDefenceCards,
  onBack, onAddFort, onBuyBuilder, onRemoveFort,
}: Props) {
  const builderCount = city.builderCount ?? DEFAULT_BUILDER_COUNT
  const freeBuilders = builderCount - city.builderQueue.length
  const builderCost  = nextBuilderCost(city)
  const totalDefense = city.fortifications.reduce(
    (s, f) => s + Math.round(FORT_DEFENSE[f.rarity] * (f.hp / f.maxHp)), 0
  )
  const cityRows = city.rows ?? CITY_ROWS

  const fortSlots: FortSlot[] = Array.from({ length: MAX_TOTAL_FORTS }, (_, i) => {
    if (i < city.fortifications.length)
      return { kind: 'active', fort: city.fortifications[i], fortIndex: i }
    const qi = i - city.fortifications.length
    if (qi < city.builderQueue.length)
      return { kind: 'building', entry: city.builderQueue[qi], queueIndex: qi }
    return { kind: 'empty' }
  })

  const selSlot = fortSlotSel !== null ? fortSlots[fortSlotSel] : null

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
                onClick={() => setFortSlotSel(idx)}
              />
            ))}
            <CityThumbnail grid={city.grid.map(c => c ?? null)} cols={CITY_COLS} rows={cityRows} />
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

        {/* Fort slot modal */}
        {fortSlotSel !== null && selSlot !== null && (
          <FortSlotModal
            slot={selSlot}
            city={city}
            currentTime={currentTime}
            availableDefenceCards={availableDefenceCards}
            fortFilter={fortFilter}
            setFortFilter={setFortFilter}
            fortSort={fortSort}
            setFortSort={setFortSort}
            onClose={() => setFortSlotSel(null)}
            onAddFort={onAddFort}
            onRemoveFort={onRemoveFort}
          />
        )}
      </div>
    </OverlayScreen>
  )
}
