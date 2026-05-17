import React from 'react'
import { CityState, levelUpCost, LEVEL_UP_COSTS } from '../../../game/cityBuilder'
import { getMasteryXp, masteryProgress, loadCollection } from '../../../game/collection'
import { Card } from '../../../game/types'
import { MasteryBar } from '../../ui/MasteryBar'
import { SpriteImg } from '../../ui/SpriteImg'

export interface Props {
  levelCard:  string
  card:       Card | undefined
  city:       CityState
  onBack:     () => void
  onLevelUp:  (cardName: string) => void
}

export function LevelUpDetail({ levelCard, card, city, onBack, onLevelUp }: Props) {
  const xp               = getMasteryXp(loadCollection(), levelCard)
  const { level: mLvl }  = masteryProgress(xp)
  const cost             = levelUpCost(mLvl)

  return (
    <div className="city-screen u-relative u-col u-gap-2">
      <div className="overlay-header u-flex u-items-c u-gap-6">
        <button className="action-btn" onClick={onBack}>← BACK</button>
        <div className="overlay-title">LEVEL UP CARD</div>
      </div>
      <div className="city-level-detail u-col u-items-c u-gap-5">
        {card && <SpriteImg name={card.name} className="city-level-sprite" />}
        <div className="city-level-name">{levelCard}</div>
        <div className="city-level-stats">
          <div style={{ marginBottom: 4 }}>Mastery</div>
          <MasteryBar xp={xp} />
        </div>
        <div className="city-level-cost">
          Next upgrade costs <span className="city-gold">⚙ {cost.toLocaleString()}</span>
          {' '}and grants mastery ★{mLvl + 1}
        </div>
        <div className="city-level-costs-table u-col u-gap-2">
          {LEVEL_UP_COSTS.map((c, i) => (
            <div key={i} className={`city-cost-row${i < mLvl ? ' city-cost-row--done' : ''}`}>
              <span>★{i} → ★{i + 1}</span>
              <span>⚙ {c.toLocaleString()}</span>
            </div>
          ))}
          <div className={`city-cost-row${mLvl >= LEVEL_UP_COSTS.length ? ' city-cost-row--done' : ''}`}>
            <span>★{LEVEL_UP_COSTS.length}+</span>
            <span>⚙ {LEVEL_UP_COSTS[LEVEL_UP_COSTS.length - 1].toLocaleString()}</span>
          </div>
        </div>
        <button
          className={`action-btn${city.gold >= cost ? ' action-btn--gold' : ''}`}
          onClick={() => onLevelUp(levelCard)}
          disabled={city.gold < cost}
        >
          {city.gold >= cost ? `LEVEL UP (⚙ ${cost.toLocaleString()})` : `NEED ⚙ ${cost.toLocaleString()}`}
        </button>
      </div>
    </div>
  )
}
