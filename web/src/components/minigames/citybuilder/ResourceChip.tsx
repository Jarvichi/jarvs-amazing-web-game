import React from 'react'
import { RESOURCE_ICONS, ResourceType } from '../../../game/cityBuilder'

export interface Props {
  res:   ResourceType
  stock: number
  cap:   number
  prod:  number
  cons:  number
}

export function ResourceChip({ res, stock, cap, prod, cons }: Props) {
  const net     = prod - cons
  const fill    = cap > 0 ? stock / cap : 0
  const nearCap = fill >= 0.7
  if (stock === 0 && prod === 0) return null
  return (
    <span
      className={`city-res-chip${nearCap ? ' city-res-chip--capped' : ''}`}
      title={`${res}: ${stock}/${cap} stock, ${net >= 0 ? '+' : ''}${net}/min`}
    >
      <span className="city-res-chip-fill" style={{ width: `${Math.round(fill * 100)}%` }} />
      <span className="city-res-chip-content">
        {RESOURCE_ICONS[res]}{stock}
        {net !== 0 && <span className={net > 0 ? 'city-res-pos' : 'city-res-neg'}>{net > 0 ? `+${net}` : net}</span>}
      </span>
    </span>
  )
}
