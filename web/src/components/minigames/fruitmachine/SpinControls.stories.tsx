import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SpinControls } from './SpinControls'

const meta = {
  component: SpinControls,
} satisfies Meta<typeof SpinControls>

export default meta
type Story = StoryObj<typeof meta>

const defaultArgs = {
  isNudge: false,
  isLucky: false,
  isBusy: false,
  isInAutoSpin: false,
  nudgesAvailable: 0,
  freeSpin: false,
  spinCount: 1 as const,
  autoSpinsLeft: 0,
  canSpin: true,
  onStartSpin: fn(),
  onSetSpinCount: fn(),
  onStopAutoSpin: fn(),
  onFinishNudge: fn(),
  onStopLucky: fn(),
  credits: 10,
  ticketsPerCredit: 2,
  onCashOut: fn(),
  canBuy: false,
  buyCost: 25,
  buyAmount: 5,
  availCrystals: 100,
  onBuyCredits: fn(),
}

export const Default: Story = {
  args: defaultArgs,
}

export const CanBuyCredits: Story = {
  args: {
    ...defaultArgs,
    canBuy: true,
  },
}

export const NudgeActive: Story = {
  args: {
    ...defaultArgs,
    isNudge: true,
    isBusy: true,
    nudgesAvailable: 2,
  },
}

export const LuckyMinigame: Story = {
  args: {
    ...defaultArgs,
    isLucky: true,
    isBusy: true,
  },
}

export const AutoSpinRunning: Story = {
  args: {
    ...defaultArgs,
    isInAutoSpin: true,
    spinCount: 10,
    autoSpinsLeft: 6,
  },
}
