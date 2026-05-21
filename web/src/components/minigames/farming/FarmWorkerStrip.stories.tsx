import type { Meta, StoryObj } from '@storybook/react'
import { FarmWorkerStrip } from './FarmWorkerStrip'

const meta: Meta<typeof FarmWorkerStrip> = {
  title: 'Farming/FarmWorkerStrip',
  component: FarmWorkerStrip,
}
export default meta
type Story = StoryObj<typeof FarmWorkerStrip>

export const TwoOfTwo: Story = {
  args: {
    assignedWorkers: 2, maxWorkers: 2, nextFarmerCost: 1_000_000, cityGold: 500_000,
    onAssign: () => {}, onUnassign: () => {}, onHireFarmer: () => {},
  },
}

export const CanAffordHire: Story = {
  args: {
    assignedWorkers: 1, maxWorkers: 2, nextFarmerCost: 1_000_000, cityGold: 2_000_000,
    onAssign: () => {}, onUnassign: () => {}, onHireFarmer: () => {},
  },
}

export const MaxReached: Story = {
  args: {
    assignedWorkers: 10, maxWorkers: 10, nextFarmerCost: null, cityGold: 50_000_000,
    onAssign: () => {}, onUnassign: () => {}, onHireFarmer: () => {},
  },
}
