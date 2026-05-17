import type { Meta, StoryObj } from '@storybook/react-vite'
import { ResourceStrip } from './ResourceStrip'

const meta = {
  component: ResourceStrip,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ResourceStrip>

export default meta
type Story = StoryObj<typeof meta>

const emptyResources = { wheat: 0, wood: 0, ore: 0, bread: 0, planks: 0, metal: 0 }

export const Empty: Story = {
  args: {
    defense: 0,
    population: 0,
    resources: emptyResources,
    prodRates: {},
    consRates: {},
  },
}

export const WithResources: Story = {
  args: {
    defense: 45,
    population: 8,
    resources: { wheat: 120, wood: 35, ore: 12, bread: 8, planks: 5, metal: 2 },
    prodRates: { wheat: 10, wood: 4, ore: 2 },
    consRates: { wheat: 6, bread: 1 },
  },
}

export const CriticalResources: Story = {
  args: {
    defense: 5,
    population: 12,
    resources: { wheat: 3, wood: 0, ore: 0, bread: 0, planks: 0, metal: 0 },
    prodRates: { wheat: 2 },
    consRates: { wheat: 8 },
  },
}
