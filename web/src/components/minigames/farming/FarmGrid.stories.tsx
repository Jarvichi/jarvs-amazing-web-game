import React, { useRef } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { FarmGrid } from './FarmGrid'
import { FarmState } from '../../../game/farmingSim'
import { Walker } from '../citybuilder/walkerTypes'

const farm: FarmState = {
  plots: [
    { cardName: 'Farm', rarity: 'common', stock: {} },
    { cardName: 'Lumber Camp', rarity: 'uncommon', stock: {} },
    undefined,
    { cardName: 'Farm', rarity: 'common', stock: {} },
    undefined,
    undefined,
    undefined,
    { cardName: 'Farm', rarity: 'common', stock: {} },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined,
  ],
  rows: 4, cols: 6,
  workers: 2,
  lastTick: Date.now(),
  nextRaidAt: Date.now() + 3_600_000,
  lastRaid: null,
  chronicle: [],
  resources: { wheat: 5, wood: 2, ore: 0, bread: 0, planks: 0, metal: 0 },
}

const sampleWalkers: Walker[] = [
  {
    cellIndex: 0, unitIndex: 0, unitName: 'farmer', x: 50, y: 60,
    vx: 1, vy: 0,
    turnTimer: 20, task: { type: 'farming', label: '🌾 Working the fields' },
    taskTimer: 10, bubbleTimer: 20, hidden: false, hiddenTimer: 0,
    trait: 'industrious', waypoints: [],
  },
  {
    cellIndex: 1, unitIndex: 0, unitName: 'farmer', x: 130, y: 100,
    vx: 0, vy: 1,
    turnTimer: 30, task: { type: 'idle', label: '🚶 Taking a stroll' },
    taskTimer: 40, bubbleTimer: 0, hidden: false, hiddenTimer: 0,
    trait: 'sociable', waypoints: [],
  },
]

function Wrapper() {
  const worldRef = useRef<HTMLDivElement>(null)
  return (
    <div style={{ padding: 16, background: '#1a2a1a' }}>
      <FarmGrid
        farm={farm}
        walkers={sampleWalkers}
        bulldozer={false}
        worldRef={worldRef}
        onCellTap={(i) => console.log('cell', i)}
        onWalkerClick={(ci, ui) => console.log('walker', ci, ui)}
      />
    </div>
  )
}

const meta: Meta<typeof FarmGrid> = {
  title: 'Farming/FarmGrid',
  component: FarmGrid,
  render: () => <Wrapper />,
}
export default meta
type Story = StoryObj<typeof FarmGrid>

export const Default: Story = {}

export const BulldozerMode: Story = {
  render: () => {
    const worldRef = useRef<HTMLDivElement>(null)
    return (
      <div style={{ padding: 16, background: '#1a2a1a' }}>
        <FarmGrid
          farm={farm}
          walkers={[]}
          bulldozer={true}
          worldRef={worldRef}
          onCellTap={(i) => console.log('bulldoze', i)}
          onWalkerClick={() => {}}
        />
      </div>
    )
  },
}
