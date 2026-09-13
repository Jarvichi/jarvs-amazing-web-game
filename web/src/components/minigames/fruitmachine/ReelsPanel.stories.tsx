import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ReelsPanel } from './ReelsPanel'

const meta = {
  component: ReelsPanel,
} satisfies Meta<typeof ReelsPanel>

export default meta
type Story = StoryObj<typeof meta>

const defaultArgs = {
  display: ['🍒', '🔔', '💎'] as [string, string, string],
  held: [false, false, false] as [boolean, boolean, boolean],
  recentlyHeld: [false, false, false] as [boolean, boolean, boolean],
  reelPositions: [0, 3, 6] as [number, number, number],
  ladderDisplay: 'Stay' as const,
  isSpinning: false,
  isBusy: false,
  isLucky: false,
  nudgesAvailable: 0,
  onNudge: fn(),
  onToggleHold: fn(),
}

export const Default: Story = {
  args: defaultArgs,
}

export const HeldReels: Story = {
  args: {
    ...defaultArgs,
    held: [true, false, true],
    recentlyHeld: [true, false, true],
  },
}

export const Spinning: Story = {
  args: {
    ...defaultArgs,
    isSpinning: true,
    isBusy: true,
  },
}

export const NudgesAvailable: Story = {
  args: {
    ...defaultArgs,
    nudgesAvailable: 2,
    ladderDisplay: '+1',
  },
}

export const LuckyMinigame: Story = {
  args: {
    ...defaultArgs,
    isLucky: true,
    ladderDisplay: 'Lose',
  },
}
