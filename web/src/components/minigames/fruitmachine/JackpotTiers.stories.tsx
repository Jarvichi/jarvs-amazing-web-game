import type { Meta, StoryObj } from '@storybook/react-vite'
import { JackpotTiers } from './JackpotTiers'

const meta = {
  component: JackpotTiers,
} satisfies Meta<typeof JackpotTiers>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    grandJackpot: 1250,
  },
}

export const HighGrandJackpot: Story = {
  args: {
    grandJackpot: 12500,
  },
}
