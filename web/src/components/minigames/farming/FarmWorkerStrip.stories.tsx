import type { Meta, StoryObj } from '@storybook/react'
import { FarmWorkerStrip } from './FarmWorkerStrip'

const meta: Meta<typeof FarmWorkerStrip> = {
  title: 'Farming/FarmWorkerStrip',
  component: FarmWorkerStrip,
}
export default meta
type Story = StoryObj<typeof FarmWorkerStrip>

export const ThreeOfEight: Story = {
  args: { assignedWorkers: 3, cityPopulation: 8, onAssign: () => {}, onUnassign: () => {} },
}

export const None: Story = {
  args: { assignedWorkers: 0, cityPopulation: 12, onAssign: () => {}, onUnassign: () => {} },
}

export const Full: Story = {
  args: { assignedWorkers: 10, cityPopulation: 10, onAssign: () => {}, onUnassign: () => {} },
}
