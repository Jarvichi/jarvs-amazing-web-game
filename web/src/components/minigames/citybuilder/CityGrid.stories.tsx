import React, { useRef } from 'react'
import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CityGrid } from './CityGrid'

const meta = {
  component: CityGrid,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CityGrid>

export default meta
type Story = StoryObj<typeof meta>

const emptyCity: any = {
  grid: new Array(16).fill(undefined),
  rows: 4,
  happiness: {},
  resources: { wheat: 0, wood: 0, ore: 0, bread: 0, planks: 0, metal: 0 },
  fortifications: [],
  builderQueue: [],
  gold: 0,
  nextAttackAt: Date.now() + 8 * 60 * 60 * 1000,
}

const populatedCity: any = {
  ...emptyCity,
  grid: [
    { cardName: 'Farm', rarity: 'common' },
    { cardName: 'Dragon Lair', rarity: 'rare', spawnedUnitName: 'Dragon' },
    { cardName: 'Sawmill', rarity: 'common' },
    undefined,
    ...new Array(12).fill(undefined),
  ],
  happiness: { 1: 90 },
}

function WithRef(props: Omit<React.ComponentProps<typeof CityGrid>, 'worldRef'>) {
  const ref = useRef<HTMLDivElement>(null)
  return <CityGrid {...props} worldRef={ref} />
}

export const EmptyCity: Story = {
  args: {} as any,
  render: () => (
    <WithRef
      city={emptyCity}
      walkers={[]}
      builderWalkers={[]}
      bulldozerMode={false}
      onCellTap={fn()}
      onWalkerClick={fn()}
    />
  ),
}

export const PopulatedCity: Story = {
  args: {} as any,
  render: () => (
    <WithRef
      city={populatedCity}
      walkers={[]}
      builderWalkers={[]}
      bulldozerMode={false}
      onCellTap={fn()}
      onWalkerClick={fn()}
    />
  ),
}

export const BulldozerMode: Story = {
  args: {} as any,
  render: () => (
    <WithRef
      city={populatedCity}
      walkers={[]}
      builderWalkers={[]}
      bulldozerMode={true}
      onCellTap={fn()}
      onWalkerClick={fn()}
    />
  ),
}
