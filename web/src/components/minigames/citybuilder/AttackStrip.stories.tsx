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
    attackCountdown: 'IMMINENT',
    attackUrgency: 'imminent',
    attackStrengthLabel: { text: 'Overwhelming', cls: 'strength--overwhelm' },
  },
}

export const Soon: Story = {
  args: {
    msToAttack: 2 * 60 * 60 * 1000,
    attackCountdown: '2h 0m',
    attackUrgency: 'soon',
    attackStrengthLabel: { text: 'Strong', cls: 'strength--strong' },
  },
}

export const Calm: Story = {
  args: {
    msToAttack: 6 * 60 * 60 * 1000,
    attackCountdown: '6h 0m',
    attackUrgency: 'calm',
    attackStrengthLabel: { text: 'Weak', cls: 'strength--weak' },
  },
}
