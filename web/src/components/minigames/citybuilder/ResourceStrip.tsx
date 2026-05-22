import React from 'react'
import { ResourceType, ResourceStock, Season, SEASON_INFO, calculateStorageCaps, CityState, CITY_ROWS, goldIncomeRate, GOLD_SYMBOL } from '../../../game/cityBuilder'
import { ResourceChip } from './ResourceChip'

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
    const incomeRate = Math.round(goldIncomeRate(city))
  return (
    <div>
    <div className="city-res-strip">
      <span className="city-info-chip" title={`Defense: ${defense}`}>🛡 {defense}</span>
      <span className="city-info-chip" title={`Population: ${population}`}>👥 {population}</span>
      <span className="city-info-chip city-season-chip" title={si.flavour}>{si.icon} {si.name}</span>
      <div className="city-gold-display">{GOLD_SYMBOL} {city.gold.toLocaleString()} (+{incomeRate}/min)</div>
    </div>
    <div className="city-res-strip">
      {RESOURCE_TYPES.map(res => (
        <ResourceChip
          key={res}
          res={res}
          stock={Math.floor(resources[res])}
          cap={caps[res]}
          prod={Math.round(prodRates[res] ?? 0)}
          cons={Math.round(consRates[res] ?? 0)}
        />
      ))}
    </div>
    </div>
  )
}
