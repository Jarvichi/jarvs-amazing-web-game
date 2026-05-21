import React from 'react'
import { FarmPlot, getFarmProductionRate, FarmState } from '../../../game/farmingSim'
import { getBuildingProduces, RESOURCE_ICONS, ResourceType } from '../../../game/cityBuilder'
import { SpriteImg } from '../../ui/SpriteImg'

export interface Props {
  plot:        FarmPlot | undefined
  index:       number
  farmState:   FarmState
  highlighted: boolean
  bulldozer:   boolean
  onTap:       (index: number) => void
}

export function FarmPlotCell({ plot, index, farmState, highlighted, bulldozer, onTap }: Props) {
  if (!plot) {
    return (
      <div
        className={`farm-cell farm-cell--empty${highlighted ? ' farm-cell--highlighted' : ''}`}
        onClick={() => onTap(index)}
        title="Empty plot — tap to place a building"
      >
        <span className="farm-cell-plus">+</span>
      </div>
    )
  }

  const produces = getBuildingProduces(plot.cardName)
  const prodEntries = Object.entries(produces).filter(([, v]) => (v as number) > 0) as [ResourceType, number][]

  return (
    <div
      className={`farm-cell farm-cell--occupied${bulldozer ? ' farm-cell--bulldozer' : ''}${highlighted ? ' farm-cell--highlighted' : ''}`}
      onClick={() => onTap(index)}
      title={bulldozer ? `Remove ${plot.cardName}` : plot.cardName}
    >
      <SpriteImg name={plot.cardName} className="farm-cell-sprite" />
      <span className="farm-cell-name">{plot.cardName}</span>
      {prodEntries.length > 0 && (
        <span className="farm-cell-rate">
          {prodEntries.map(([res]) => RESOURCE_ICONS[res]).join('')}
        </span>
      )}
      {bulldozer && <span className="farm-cell-demolish">✕</span>}
    </div>
  )
}
