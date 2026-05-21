import type { Meta, StoryObj } from '@storybook/react'
import { FarmRaidModal } from './FarmRaidModal'

const meta: Meta<typeof FarmRaidModal> = {
  title: 'Farming/FarmRaidModal',
  component: FarmRaidModal,
}
export default meta
type Story = StoryObj<typeof FarmRaidModal>

export const Repelled: Story = {
  args: {
    raid: {
      at: Date.now(), power: 20, defense: 30,
      outcome: 'repelled',
      stolenResources: {},
      destroyedPlots: [],
    },
    onClose: () => {},
  },
}

export const PartialRaid: Story = {
  args: {
    raid: {
      at: Date.now(), power: 35, defense: 20,
      outcome: 'partial',
      stolenResources: { wheat: 18, wood: 6 },
      destroyedPlots: [],
    },
    onClose: () => {},
  },
}

export const Defeated: Story = {
  args: {
    raid: {
      at: Date.now(), power: 60, defense: 4,
      outcome: 'defeated',
      stolenResources: { wheat: 45, wood: 20, ore: 8 },
      destroyedPlots: ['Farm', 'Lumber Camp'],
    },
    onClose: () => {},
  },
}
