import React from 'react'
import { FarmState, FARM_COLS, FARM_ROWS, buildFarmCity } from '../../../../game/farmingSim'
import { Walker } from '../walkerTypes'
import { CityGrid } from '../CityGrid'
import { VisualCarrier } from '../../CityBuilder'

export interface Props {
  toolbar?:      React.ReactNode
  farm:          FarmState
  walkers:       Walker[]
  visualCarriers: VisualCarrier[]
  bulldozer:     boolean
  worldRef:      React.RefObject<HTMLDivElement>
  onCellTap:     (index: number) => void
  onWalkerClick: (cellIndex: number, unitIndex: number) => void
}

export function FarmGrid({
  toolbar,
  farm, walkers, visualCarriers, bulldozer, worldRef, onCellTap, onWalkerClick }: Props) {
  return (
    <CityGrid
      toolbar={toolbar}
      city={buildFarmCity(farm)}
      walkers={walkers}
      builderWalkers={[]}
      visualCarriers={visualCarriers}
      bulldozerMode={bulldozer}
      worldRef={worldRef}
      paintBrush={false}
      onCellTap={onCellTap}
      onPaint={() => {}}
      onWalkerClick={onWalkerClick}
    />
  )
}
