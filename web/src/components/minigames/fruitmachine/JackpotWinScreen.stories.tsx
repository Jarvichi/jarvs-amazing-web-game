import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { JackpotWinScreen } from './JackpotWinScreen'

const meta = {
  component: JackpotWinScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof JackpotWinScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Mini: Story = {
  args: {
    jackpotWon: { tier: 'Mini', amount: 10 },
    onDismiss: fn(),
  },
}

export const Grand: Story = {
  args: {
    jackpotWon: { tier: 'Grand', amount: 1250 },
    onDismiss: fn(),
  },
}
