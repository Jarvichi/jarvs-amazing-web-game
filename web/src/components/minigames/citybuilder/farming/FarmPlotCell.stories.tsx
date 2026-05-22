import type { Meta, StoryObj } from '@storybook/react'
import { FarmPlotCell } from './FarmPlotCell'
import { FarmState } from '../../../../game/farmingSim'

const baseFarm: FarmState = {
  plots: Array(24).fill(undefined),
  rows: 4, cols: 6,
  workers: 2, maxWorkers: 2,
  lastTick: Date.now(),
  nextRaidAt: Date.now() + 3_600_000,
  lastRaid: null,
  chronicle: [],
  resources: { wheat: 0, wood: 0, ore: 0, bread: 0, planks: 0, metal: 0 },
  carriers: [],
  roadWear: { h: Array(24).fill(0), v: Array(24).fill(0) },
}

const meta: Meta<typeof FarmPlotCell> = {
  title: 'Farming/FarmPlotCell',
  component: FarmPlotCell,
}
export default meta
type Story = StoryObj<typeof FarmPlotCell>

export const Empty: Story = {
  args: {
    plot: undefined, index: 0, farmState: baseFarm,
    highlighted: false, bulldozer: false, onTap: () => {},
  },
}

export const OccupiedFarm: Story = {
  args: {
    plot: { cardName: 'Farm', rarity: 'common', stock: {} },
    index: 0, farmState: baseFarm,
    highlighted: false, bulldozer: false, onTap: () => {},
  },
}

export const OccupiedLumber: Story = {
  args: {
    plot: { cardName: 'Lumber Camp', rarity: 'uncommon', stock: {} },
    index: 1, farmState: baseFarm,
    highlighted: false, bulldozer: false, onTap: () => {},
  },
}

export const BulldozerMode: Story = {
  args: {
    plot: { cardName: 'Farm', rarity: 'common', stock: {} },
    index: 0, farmState: baseFarm,
    highlighted: false, bulldozer: true, onTap: () => {},
  },
}

export const Highlighted: Story = {
  args: {
    plot: undefined, index: 0, farmState: baseFarm,
    highlighted: true, bulldozer: false, onTap: () => {},
  },
}
