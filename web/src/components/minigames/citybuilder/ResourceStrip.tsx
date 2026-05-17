import React from 'react'
import { RESOURCE_ICONS, ResourceType, ResourceStock } from '../../../game/cityBuilder'

const RESOURCE_TYPES: ResourceType[] = ['wheat', 'wood', 'ore', 'bread', 'planks', 'metal']

export interface Props {
  defense:   number
  population: number
  resources:  ResourceStock
  prodRates:  Partial<Record<ResourceType, number>>
  consRates:  Partial<Record<ResourceType, number>>
}

export function ResourceStrip({ defense, population, resources, prodRates, consRates }: Props) {
  return (
    <div className="city-res-strip">
      <span className="city-info-chip" title={`Defense: ${defense}`}>🛡 {defense}</span>
      <span className="city-info-chip" title={`Population: ${population}`}>👥 {population}</span>
      {RESOURCE_TYPES.map(res => {
        const stock = Math.floor(resources[res])
        const prod  = prodRates[res] ?? 0
        const cons  = consRates[res] ?? 0
        const net   = prod - cons
        if (stock === 0 && prod === 0) return null
        return (
          <span key={res} className="city-res-chip" title={`${res}: ${stock} stock, ${net >= 0 ? '+' : ''}${net}/min`}>
            {RESOURCE_ICONS[res]}{stock}
            {net !== 0 && <span className={net > 0 ? 'city-res-pos' : 'city-res-neg'}>{net > 0 ? `+${net}` : net}</span>}
          </span>
        )
      })}
    </div>
  )
}
