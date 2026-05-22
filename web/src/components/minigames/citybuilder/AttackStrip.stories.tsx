import type { Meta, StoryObj } from '@storybook/react-vite'
import { AttackStrip } from './AttackStrip'

const meta = {
  component: AttackStrip,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AttackStrip>

export default meta
type Story = StoryObj<typeof meta>

export const Imminent: Story = {
  args: {
    msToAttack: 0,
    occupiedCount: 8,
    defense: 5,
  },
}

export const Soon: Story = {
  args: {
    msToAttack: 2 * 60 * 60 * 1000,
    occupiedCount: 6,
    defense: 15,
  },
}

export const Calm: Story = {
  args: {
    msToAttack: 6 * 60 * 60 * 1000,
    occupiedCount: 4,
    defense: 30,
  },
}
