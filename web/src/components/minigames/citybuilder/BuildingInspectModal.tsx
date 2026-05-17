import React from 'react'
import {
  CityState, CityCell, RESOURCE_ICONS, ResourceType,
  getBuildingProduces, masteryOutputMultiplier, getCardMasteryLevel,
  levelUpCost, LEVEL_UP_COSTS, spawnerUnitCount,
} from '../../../game/cityBuilder'
import { CollectionEntry, getMasteryXp, masteryProgress } from '../../../game/collection'
import { MasteryBar } from '../../ui/MasteryBar'
import { SpriteImg, AnimatedSpriteImg } from '../../ui/SpriteImg'
import { Walker, rageDescription, residentName, getUnitRequirements } from './walkerTypes'

export interface Props {
  cellIndex:      number
  cell:           CityCell
  city:           CityState
  collection:     CollectionEntry[]
  walkers:        Walker[]
  buildingTab:    'residents' | 'upgrade'
  setBuildingTab: (tab: 'residents' | 'upgrade') => void
  onClose:        () => void
  onLevelUp:      (cardName: string) => void
}

export function BuildingInspectModal({
  cellIndex, cell, city, collection, walkers,
  buildingTab, setBuildingTab,
  onClose, onLevelUp,
}: Props) {
  const happiness      = cell.spawnedUnitName ? (city.happiness[cellIndex] ?? 100) : 100
  const unitCount      = cell.spawnedUnitName ? spawnerUnitCount(city, cell.cardName) : 0
  const moodKey        = happiness === 0 ? 'gone' : happiness < 30 ? 'furious' : happiness < 60 ? 'unsettled' : 'content'
  const produces       = getBuildingProduces(cell.cardName)
  const masteryMult    = masteryOutputMultiplier(getCardMasteryLevel(cell.cardName) ?? 0)
  const produceEntries = Object.entries(produces).filter(([, v]) => (v ?? 0) > 0)
  const xp             = getMasteryXp(collection, cell.cardName)
  const { level: mLvl } = masteryProgress(xp)
  const upgradeCost    = levelUpCost(mLvl)
  const canAfford      = city.gold >= upgradeCost

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
              {happiness === 0 ? (
                <div className="city-bld-vacant">Building is vacant — unit left the city</div>
              ) : (
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
          ) : produceEntries.length > 0 ? (
            <>
              <div className="city-bld-section-title">Produces</div>
              {produceEntries.map(([res, amt]) => (
                <div key={res} className="city-bld-produces-row">
                  +{Math.round((amt as number) * masteryMult)} {RESOURCE_ICONS[res as ResourceType]}/min
                </div>
              ))}
            </>
          ) : (
            <div className="city-bld-section-title">Defensive structure</div>
          )
        )}

        {buildingTab === 'upgrade' && (
          <div className="city-bld-upgrade u-col u-gap-4">
            <div className="city-gold-display" style={{ alignSelf: 'center' }}>⚙ {city.gold.toLocaleString()} gold</div>
            <MasteryBar xp={xp} />
            <div className="city-level-cost">
              Next upgrade: <span className="city-gold">⚙ {upgradeCost.toLocaleString()}</span> → ★{mLvl + 1}
            </div>
            <div className="city-level-costs-table u-col u-gap-2">
              {LEVEL_UP_COSTS.map((c, i) => (
                <div key={i} className={`city-cost-row${i < mLvl ? ' city-cost-row--done' : ''}`}>
                  <span>★{i} → ★{i + 1}</span>
                  <span>⚙ {c.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <button
              className={`action-btn${canAfford ? ' action-btn--gold' : ''}`}
              onClick={() => { onLevelUp(cell.cardName); setBuildingTab('upgrade') }}
              disabled={!canAfford}
            >
              {canAfford ? `LEVEL UP (⚙ ${upgradeCost.toLocaleString()})` : `NEED ⚙ ${upgradeCost.toLocaleString()}`}
            </button>
          </div>
        )}

        <button className="action-btn" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  )
}
