import React, { useState } from 'react'
import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { BuildingInspectModal, Props } from './BuildingInspectModal'

const meta = {
  component: BuildingInspectModal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BuildingInspectModal>

export default meta
type Story = StoryObj<typeof meta>

const baseCity: any = {
  grid: [],
  rows: 4,
  happiness: { 0: 80 },
  resources: { wheat: 80, wood: 40, ore: 10, bread: 0, planks: 0, metal: 0 },
  fortifications: [],
  builderQueue: [],
  gold: 600,
}

const spawnerCell: any = {
  cardName: 'Dragon Lair',
  rarity: 'rare',
  spawnedUnitName: 'Dragon',
}

const producerCell: any = {
  cardName: 'Farm',
  rarity: 'common',
}

const walkers = [
  {
    cellIndex: 0, unitIndex: 0, unitName: 'Dragon',
    x: 100, y: 80, vx: 0.5, vy: 0.3,
    turnTimer: 10,
    task: { type: 'patrolling' as const, label: '🛡 Patrolling the walls' },
    taskTimer: 20, bubbleTimer: 5, hidden: false, hiddenTimer: 0, trait: 'brave' as const,
  },
]

function Wrapper(props: Omit<Props, 'buildingTab' | 'setBuildingTab'>) {
  const [buildingTab, setBuildingTab] = useState<'residents' | 'upgrade'>('residents')
  return <BuildingInspectModal {...props} buildingTab={buildingTab} setBuildingTab={setBuildingTab} />
}

export const SpawnerResidents: Story = {
  args: {} as any,
  render: () => (
    <Wrapper
      cellIndex={0}
      cell={spawnerCell}
      city={baseCity}
      collection={[]}
      walkers={walkers}
      onClose={fn()}
      onLevelUp={fn()}
      onMoveIn={fn()}
    />
  ),
}

export const ProducerBuilding: Story = {
  args: {} as any,
  render: () => (
    <Wrapper
      cellIndex={0}
      cell={producerCell}
      city={baseCity}
      collection={[]}
      walkers={[]}
      onClose={fn()}
      onLevelUp={fn()}
      onMoveIn={fn()}
    />
  ),
}

export const UnhappyUnit: Story = {
  args: {} as any,
  render: () => (
    <Wrapper
      cellIndex={0}
      cell={{ ...spawnerCell, affinityWith: 'Knight' }}
      city={{ ...baseCity, happiness: { 0: 20 }, resources: { ...baseCity.resources, wheat: 2 } }}
      collection={[]}
      walkers={[]}
      onClose={fn()}
      onLevelUp={fn()}
      onMoveIn={fn()}
    />
  ),
}
