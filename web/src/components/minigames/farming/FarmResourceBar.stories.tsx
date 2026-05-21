import type { Meta, StoryObj } from '@storybook/react'
import { FarmResourceBar } from './FarmResourceBar'

const meta: Meta<typeof FarmResourceBar> = {
  title: 'Farming/FarmResourceBar',
  component: FarmResourceBar,
}
export default meta
type Story = StoryObj<typeof FarmResourceBar>

export const Producing: Story = {
  args: {
    resources: { wheat: 42, wood: 18, ore: 5, bread: 0, planks: 0, metal: 0 },
    prodRates: { wheat: 4.5, wood: 2.1 },
    workers: 3,
    farmDefense: 6,
    nextRaidMs: 2 * 3600 * 1000,
  },
}

export const RaidImminent: Story = {
  args: {
    resources: { wheat: 10, wood: 5, ore: 0, bread: 0, planks: 0, metal: 0 },
    prodRates: { wheat: 3 },
    workers: 1,
    farmDefense: 2,
    nextRaidMs: 15 * 60 * 1000,
  },
}

export const Empty: Story = {
  args: {
    resources: { wheat: 0, wood: 0, ore: 0, bread: 0, planks: 0, metal: 0 },
    prodRates: {},
    workers: 0,
    farmDefense: 0,
    nextRaidMs: 4 * 3600 * 1000,
  },
}
