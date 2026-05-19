import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { MilestoneBanner } from './MilestoneBanner'

const meta = {
  component: MilestoneBanner,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MilestoneBanner>

export default meta
type Story = StoryObj<typeof meta>

export const GoldOnly: Story = {
  args: {
    milestone: {
      id: 'first_harvest',
      label: 'First Harvest',
      icon: '🌾',
      description: 'Produce your first wheat.',
      condition: () => false,
      goldReward: 500,
    },
    onDone: fn(),
  },
}

export const WithResourceReward: Story = {
  args: {
    milestone: {
      id: 'stone_age',
      label: 'Stone Age',
      icon: '⛏',
      description: 'Mine your first ore.',
      condition: () => false,
      goldReward: 1000,
      resourceReward: { wood: 50, ore: 20 },
    },
    onDone: fn(),
  },
}
