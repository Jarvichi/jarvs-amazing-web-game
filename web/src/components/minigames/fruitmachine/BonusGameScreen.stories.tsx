import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { BonusGameScreen } from './BonusGameScreen'

const meta = {
  component: BonusGameScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BonusGameScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    bonusTiles: [
      { value: 5, collect: false, revealed: false },
      { value: 12, collect: false, revealed: false },
      { value: 0, collect: true, revealed: false },
      { value: 8, collect: false, revealed: false },
      { value: 3, collect: false, revealed: false },
      { value: 0, collect: true, revealed: false },
      { value: 20, collect: false, revealed: false },
      { value: 6, collect: false, revealed: false },
      { value: 15, collect: false, revealed: false },
    ],
    bonusPicksLeft: 3,
    bonusTotalWin: 0,
    onPickTile: fn(),
  },
}

export const InProgress: Story = {
  args: {
    bonusTiles: [
      { value: 5, collect: false, revealed: true },
      { value: 12, collect: false, revealed: false },
      { value: 0, collect: true, revealed: true },
      { value: 8, collect: false, revealed: false },
      { value: 3, collect: false, revealed: false },
      { value: 0, collect: true, revealed: false },
      { value: 20, collect: false, revealed: false },
      { value: 6, collect: false, revealed: false },
      { value: 15, collect: false, revealed: false },
    ],
    bonusPicksLeft: 1,
    bonusTotalWin: 5,
    onPickTile: fn(),
  },
}
