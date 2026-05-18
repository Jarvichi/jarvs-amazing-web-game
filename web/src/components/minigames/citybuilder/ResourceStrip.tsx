import React from 'react'
import { RESOURCE_ICONS, ResourceType, ResourceStock, Season, SEASON_INFO, STORAGE_BASE_CAPS, calculateStorageCaps, CityState } from '../../../game/cityBuilder'

const RESOURCE_TYPES: ResourceType[] = ['wheat', 'wood', 'ore', 'bread', 'planks', 'metal']

export interface Props {
  defense:   number
  population: number
  resources:  ResourceStock
  prodRates:  Partial<Record<ResourceType, number>>
  consRates:  Partial<Record<ResourceType, number>>
  season:     Season
  city:       CityState
}

export function ResourceStrip({ defense, population, resources, prodRates, consRates, season, city }: Props) {
  const si   = SEASON_INFO[season] ?? SEASON_INFO['spring']
  const caps = calculateStorageCaps(city)
  return (
    <div className="city-res-strip">
      <span className="city-info-chip" title={`Defense: ${defense}`}>🛡 {defense}</span>
      <span className="city-info-chip" title={`Population: ${population}`}>👥 {population}</span>
      <span className="city-info-chip city-season-chip" title={si.flavour}>{si.icon} {si.name}</span>
      {RESOURCE_TYPES.map(res => {
        const stock  = Math.floor(resources[res])
        const cap    = caps[res]
        const fill   = cap > 0 ? stock / cap : 0
        const prod   = Math.round(prodRates[res] ?? 0)
        const cons   = Math.round(consRates[res] ?? 0)
        const net    = prod - cons
        const nearCap = fill >= 0.7
        if (stock === 0 && prod === 0) return null
        return (
          <span
            key={res}
            className={`city-res-chip${nearCap ? ' city-res-chip--capped' : ''}`}
            title={`${res}: ${stock}/${cap} stock, ${net >= 0 ? '+' : ''}${net}/min`}
          >
            <span
              className="city-res-chip-fill"
              style={{ width: `${Math.round(fill * 100)}%` }}
            />
            <span className="city-res-chip-content">
              {RESOURCE_ICONS[res]}{stock}
              {net !== 0 && <span className={net > 0 ? 'city-res-pos' : 'city-res-neg'}>{net > 0 ? `+${net}` : net}</span>}
            </span>
          </span>
        )
      })}
    </div>
  )
}
