import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChroniclePanel } from './ChroniclePanel'

const meta = {
  component: ChroniclePanel,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ChroniclePanel>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    chronicle: [],
    onBack: fn(),
  },
}

export const WithEntries: Story = {
  args: {
    chronicle: [
      '[12:00] The city was founded.',
      '[12:05] A Farm was placed in the city.',
      '[13:20] ⚔ An attack was repelled!',
      '[14:00] 🏆 Milestone reached: First Harvest',
      '[15:30] 🔥 A fire broke out in the city!',
      '[16:00] The fire was extinguished.',
    ],
    onBack: fn(),
  },
}
