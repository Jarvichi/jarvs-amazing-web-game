import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { AttackReportModal } from './AttackReportModal'

const meta = {
  component: AttackReportModal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AttackReportModal>

export default meta
type Story = StoryObj<typeof meta>

const baseReport = { at: Date.now(), stolenGold: 0, goldEarned: 0, destroyedBuildings: [] }

export const Repelled: Story = {
  args: {
    attackReport: { ...baseReport, power: 30, defense: 55, outcome: 'repelled' },
    hasDamagedForts: true,
    onClose: fn(),
  },
}

export const PartialDefeat: Story = {
  args: {
    attackReport: { ...baseReport, power: 80, defense: 55, outcome: 'partial', stolenGold: 250, destroyedBuildings: ['Farm', 'Stable'] },
    hasDamagedForts: false,
    onClose: fn(),
  },
}

export const Defeated: Story = {
  args: {
    attackReport: { ...baseReport, power: 200, defense: 30, outcome: 'defeated', stolenGold: 1200, destroyedBuildings: ['Farm', 'Sawmill', 'Dragon Lair'] },
    hasDamagedForts: false,
    onClose: fn(),
  },
}

export const MultipleRaids: Story = {
  args: {
    attackReport: { ...baseReport, power: 90, defense: 40, outcome: 'partial', count: 5, stolenGold: 600, goldEarned: 0, destroyedBuildings: ['Farm'] },
    hasDamagedForts: true,
    onClose: fn(),
  },
}
