import React from 'react'
import { ResourceStock, ResourceType, RESOURCE_ICONS } from '../../../game/cityBuilder'

export interface Props {
  resources:   ResourceStock
  prodRates:   Partial<ResourceStock>
  workers:     number
  farmDefense: number
  nextRaidMs:  number
}

const RESOURCE_ORDER: ResourceType[] = ['wheat', 'wood', 'ore', 'bread', 'planks', 'metal']

function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'IMMINENT'
  const mins = Math.floor(ms / 60_000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function FarmResourceBar({ resources, prodRates, workers, farmDefense, nextRaidMs }: Props) {
  const urgency = nextRaidMs < 1_800_000 ? 'imminent' : nextRaidMs < 5_400_000 ? 'soon' : 'calm'

  return (
    <div className="farm-res-bar">
      {RESOURCE_ORDER.map(res => {
        const stock = Math.round(resources[res] ?? 0)
        const rate  = Math.round((prodRates[res] ?? 0) * 10) / 10
        if (stock === 0 && rate === 0) return null
        return (
          <span key={res} className="city-res-chip" title={`${res}: ${stock} stock, +${rate}/min`}>
            {RESOURCE_ICONS[res]} {stock}
            {rate > 0 && <span className="city-res-pos"> +{rate}</span>}
          </span>
        )
      })}
      <span className="farm-res-stat">👨‍🌾 {workers}</span>
      <span className="farm-res-stat">🛡 {farmDefense}</span>
      <span className={`farm-raid-pill farm-raid-pill--${urgency}`}>
        ⚔ {fmtCountdown(nextRaidMs)}
      </span>
    </div>
  )
}
