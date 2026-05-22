import React from 'react'
import {
  CityState, CityCell, RESOURCE_ICONS, ResourceType,
  getBuildingProduces, getBuildingConsumes, masteryOutputMultiplier, getCardMasteryLevel,
  levelUpCost, LEVEL_UP_COSTS, WATCHTOWER_LEVEL_UP_COSTS, spawnerUnitCount,
  getCellSynergyBonuses, getCellIncomeBonus,
  cellStockCap, getCellDefenseContrib, INCOME_WALL, CORE_BUILDINGS,
  GOLD_SYMBOL,
} from '../../../game/cityBuilder'
import { CollectionEntry, getMasteryXp, masteryProgress } from '../../../game/collection'
import { MasteryBar } from '../../ui/MasteryBar'
import { SpriteImg, AnimatedSpriteImg } from '../../ui/SpriteImg'
import { Walker, rageDescription, residentName, getUnitRequirements } from './walkerTypes'

export interface Props {
  cellIndex:          number
  cell:               CityCell
  city:               CityState
  collection:         CollectionEntry[]
  walkers:            Walker[]
  buildingTab:        'residents' | 'upgrade'
  setBuildingTab:     (tab: 'residents' | 'upgrade') => void
  onClose:            () => void
  onLevelUp:          (cardName: string) => void
  onMoveIn:           () => void
  /** Optional multiplier applied to displayed production rates (e.g. 1.5 for farm bonus). */
  productionMultiplier?: number
  /** Optional label shown beside the production rate (e.g. "+50% farm bonus"). */
  productionNote?:    string
}

export function BuildingInspectModal({
  cellIndex, cell, city, collection, walkers,
  buildingTab, setBuildingTab,
  onClose, onLevelUp, onMoveIn,
  productionMultiplier = 1,
  productionNote,
}: Props) {
  const happiness      = cell.spawnedUnitName ? (city.happiness[cellIndex] ?? 100) : 100
  const unitCount      = cell.spawnedUnitName ? spawnerUnitCount(city, cell.cardName) : 0
  const moodKey        = happiness === 0 ? 'gone' : happiness < 30 ? 'furious' : happiness < 60 ? 'unsettled' : 'content'
  const produces       = getBuildingProduces(cell.cardName)
  const consumes       = getBuildingConsumes(cell.cardName)
  const masteryMult    = masteryOutputMultiplier(getCardMasteryLevel(cell.cardName) ?? 0)
  const produceEntries = Object.entries(produces).filter(([, v]) => (v ?? 0) > 0)
  const consumeEntries = Object.entries(consumes).filter(([, v]) => (v ?? 0) > 0)
  const stockEntries   = Object.entries(cell.stock ?? {}).filter(([, v]) => (v ?? 0) >= 0.01) as [ResourceType, number][]
  const synergies      = getCellSynergyBonuses(city, cellIndex)
  const synergyMap     = Object.fromEntries(synergies.map(s => [s.resource, s.multiplier]))
  const incomeBonus    = getCellIncomeBonus(city, cellIndex)
  const xp             = getMasteryXp(collection, cell.cardName)
  const { level: mLvl } = masteryProgress(xp)
  const upgradeCost    = levelUpCost(mLvl, cell.cardName)
  const canAfford      = city.gold >= upgradeCost
  const levelUpCosts   = cell.cardName === 'Watchtower' ? WATCHTOWER_LEVEL_UP_COSTS : LEVEL_UP_COSTS
  const defenseContrib = getCellDefenseContrib(cell, city)
  const coreHint       = CORE_BUILDINGS.find(b => b.name === cell.cardName)?.hint

  return (
    <div className="city-req-overlay" onClick={onClose}>
      <div className="city-req-modal" onClick={e => e.stopPropagation()}>
        <div className="city-req-header u-flex u-items-c u-gap-4">
          <SpriteImg name={cell.cardName} className="city-req-sprite" />
          <div className="city-req-name">
            {cell.cardName}
            {mLvl > 0 && <span className="city-req-mastery"> ★{mLvl}</span>}
          </div>
        </div>
        <div className="city-bld-tabs u-flex u-gap-2">
          <button
            className={`city-bld-tab${buildingTab === 'residents' ? ' city-bld-tab--active' : ''}`}
            onClick={() => setBuildingTab('residents')}
          >Residents</button>
          <button
            className={`city-bld-tab${buildingTab === 'upgrade' ? ' city-bld-tab--active' : ''}`}
            onClick={() => setBuildingTab('upgrade')}
          >Upgrade</button>
        </div>

        {buildingTab === 'residents' && (
          cell.spawnedUnitName ? (
            <>
              <div className="city-bld-section-title">Residents ({happiness === 0 ? 0 : unitCount})</div>
              {happiness === 0 ? (() => {
                const reqs   = getUnitRequirements(cell, city, cellIndex)
                const unmet  = reqs.filter(r => !r.met)
                const allMet = unmet.length === 0
                return (
                  <div className="city-bld-vacant-section">
                    <div className="city-bld-vacant">🚪 Vacant — residents left the city</div>
                    <div className="city-bld-vacant-reasons">
                      {unmet.length > 0
                        ? unmet.map((r, i) => <div key={i} className="city-bld-resident-req">✗ {r.text}</div>)
                        : <div className="city-bld-resident-req city-bld-req--met">✓ All conditions now met</div>
                      }
                    </div>
                    <button
                      className={`action-btn${allMet ? '' : ' action-btn--muted'}`}
                      onClick={() => { onMoveIn(); onClose() }}
                    >
                      {allMet ? '🏠 INVITE BACK' : '🏠 INVITE BACK ANYWAY'}
                    </button>
                    {!allMet && (
                      <div className="city-bld-vacant-warn">They may leave again if conditions aren't improved.</div>
                    )}
                  </div>
                )
              })() : (
                Array.from({ length: unitCount }, (_, u) => {
                  const reqs    = getUnitRequirements(cell, city, cellIndex)
                  const unmet   = reqs.filter(r => !r.met)
                  const walker  = walkers.find(wk => wk.cellIndex === cellIndex && wk.unitIndex === u)
                  const taskLabel = walker ? (walker.hidden ? '🏠 Resting at home' : walker.task.label) : null
                  return (
                    <div key={u} className="city-bld-resident">
                      <AnimatedSpriteImg name={cell.spawnedUnitName!} frameCount={3} fps={6} className="city-bld-resident-sprite" />
                      <div className="city-bld-resident-info">
                        <div className="city-bld-resident-name">{residentName(cell.spawnedUnitName!, cellIndex, u)}</div>
                        <div className={`city-req-mood city-req-mood--${moodKey}`}>{rageDescription(happiness)}</div>
                        {taskLabel && <div className="city-bld-resident-task">{taskLabel}</div>}
                        {unmet.map((r, i) => (
                          <div key={i} className="city-bld-resident-req">✗ {r.text}</div>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </>
          ) : produceEntries.length > 0 || consumeEntries.length > 0 || stockEntries.length > 0 || /warehouse|barn|granary|silo|storehouse|vault/i.test(cell.cardName) ? (
            <>
              {stockEntries.length > 0 && (
                <>
              {/warehouse|barn|granary|silo|storehouse|vault/i.test(cell.cardName) && (
                <div className="city-synergy-label">📦 Storage hub — raises all resource caps by {cellStockCap(cell)}</div>
              )}          
              {synergies.map((s, i) => (
                <div key={i} className="city-synergy-label">{s.label}</div>
              ))}              
                  <div className="city-bld-section-title">Stockpile</div>
                  {stockEntries.map(([res, v]) => (
                    <div key={res} className="city-bld-produces-row u-row ">
                      <div className="u-mg-r-md"> {RESOURCE_ICONS[res]} </div><div>{Math.floor(v)} / {cellStockCap(cell)} {res}</div>
                    </div>
                  ))}
                </>
              )}
              {stockEntries.length === 0 && /warehouse|barn|granary|silo|storehouse|vault/i.test(cell.cardName) && (
                <div className="city-bld-section-title">No stock yet</div>
              )}
              {produceEntries.length > 0 && (
                <>
                  <div className="city-bld-section-title">Production rate</div>
                  {produceEntries.map(([res, amt]) => {
                    const sm = synergyMap[res as ResourceType] ?? 0
                    const total = Math.round((amt as number) * masteryMult * (1 + sm) * productionMultiplier)
                    return (
                      <div key={res} className="city-bld-produces-row">
                        +{total} {RESOURCE_ICONS[res as ResourceType]}/min
                        {sm > 0 && <span className="city-synergy-bonus"> ✦ synergy</span>}
                      </div>
                    )
                  })}
                  {productionNote && <div className="city-synergy-label">{productionNote}</div>}
                </>
              )}
              {consumeEntries.length > 0 && (
                <>
                  <div className="city-bld-section-title">Consumes</div>
                  {consumeEntries.map(([res, amt]) => (
                    <div key={res} className="city-bld-produces-row">
                      −{amt} {RESOURCE_ICONS[res as ResourceType]}/min
                    </div>
                  ))}
                </>
              )}

            </>
          ) : cell.spawnedUnitName ? (
            <>
              {incomeBonus > 0 && (
                <div className="city-synergy-label">🌾 Food producer nearby: +{Math.round(incomeBonus * 100)}% gold income</div>
              )}
            </>
          ) : (
            <>
              {coreHint && <div className="city-bld-hint">{coreHint}</div>}
              {defenseContrib > 0 && (
                <>
                  <div className="city-bld-section-title">Defense contribution</div>
                  <div className="city-bld-produces-row">⚔ +{defenseContrib} defense</div>
                  {mLvl < levelUpCosts.length && (
                    <div className="city-bld-produces-row city-synergy-label">
                      Upgrade to ★{mLvl + 1} → ⚔ +{Math.round(defenseContrib * 2)} defense
                    </div>
                  )}
                </>
              )}
              {INCOME_WALL[cell.rarity] > 0 && (
                <>
                  <div className="city-bld-section-title">Income</div>
                  <div className="city-bld-produces-row">+{INCOME_WALL[cell.rarity]} 💰/min</div>
                </>
              )}
            </>
          )
        )}

        {buildingTab === 'upgrade' && (
          <div className="city-bld-upgrade u-col u-gap-4">
            <div className="city-gold-display" style={{ alignSelf: 'center' }}>{GOLD_SYMBOL} {city.gold.toLocaleString()} gold</div>
            <MasteryBar xp={xp} />
            <div className="city-level-cost">
              Next upgrade: <span className="city-gold">{GOLD_SYMBOL} {upgradeCost.toLocaleString()}</span> → ★{mLvl + 1}
            </div>
            <div className="city-level-costs-table u-col u-gap-2">
              {levelUpCosts.map((c, i) => (
                <div key={i} className={`city-cost-row${i < mLvl ? ' city-cost-row--done' : ''}`}>
                  <span>★{i} → ★{i + 1}</span>
                  <span>{GOLD_SYMBOL} {c.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <button
              className={`action-btn${canAfford ? ' action-btn--gold' : ''}`}
              onClick={() => { onLevelUp(cell.cardName); setBuildingTab('upgrade') }}
              disabled={!canAfford}
            >
              {canAfford ? `LEVEL UP (${GOLD_SYMBOL} ${upgradeCost.toLocaleString()})` : `NEED ${GOLD_SYMBOL} ${upgradeCost.toLocaleString()}`}
            </button>
          </div>
        )}

        <button className="action-btn" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  )
}
