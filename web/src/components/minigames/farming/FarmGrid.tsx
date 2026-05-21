import React from 'react'
import { FarmState, FARM_COLS, FARM_ROWS } from '../../../game/farmingSim'
import { CityState } from '../../../game/cityBuilder'
import { Walker } from '../citybuilder/walkerTypes'
import { CityGrid } from '../citybuilder/CityGrid'

export interface Props {
  farm:          FarmState
  walkers:       Walker[]
  bulldozer:     boolean
  worldRef:      React.RefObject<HTMLDivElement>
  onCellTap:     (index: number) => void
  onWalkerClick: (cellIndex: number, unitIndex: number) => void
}

export function FarmGrid({ farm, walkers, bulldozer, worldRef, onCellTap, onWalkerClick }: Props) {
  const rows = farm.rows ?? FARM_ROWS
  const cols = farm.cols ?? FARM_COLS

  // Fixed path wear on every interior edge gives the farm a plowed-field grid look
  const h = Array.from({ length: rows * cols }, (_, i) => (i % cols < cols - 1 ? 40 : 0))
  const v = Array.from({ length: rows * cols }, (_, i) => (Math.floor(i / cols) < rows - 1 ? 40 : 0))

  const fakeCityState: CityState = {
    grid:           farm.plots.map(p => p ? { cardName: p.cardName, rarity: p.rarity, stock: p.stock } : undefined),
    rows,
    cols,
    gold:           0,
    resources:      { ...farm.resources, bread: 1 },
    lastTick:       0,
    happiness:      {},
    nextAttackAt:   0,
    fortifications: [],
    builderQueue:   [],
    builderCount:   0,
    lastAttack:     null,
    chronicle:      [],
    completedMilestones: [],
    attacksProcessed:    0,
    tradeOffer:          null,
    activeCaravan:       null,
    history:             [],
    zones:               [],
    activeDisaster:      null,
    nextDisasterAt:      0,
    roadWear:            { h, v },
    carriers:            [],
  }

  return (
    <CityGrid
      city={fakeCityState}
      walkers={walkers}
      builderWalkers={[]}
      visualCarriers={[]}
      bulldozerMode={bulldozer}
      worldRef={worldRef}
      paintBrush={false}
      onCellTap={onCellTap}
      onPaint={() => {}}
      onWalkerClick={onWalkerClick}
    />
  )
}
