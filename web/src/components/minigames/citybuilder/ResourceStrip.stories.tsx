import type { Meta, StoryObj } from '@storybook/react-vite'
import { ResourceStrip } from './ResourceStrip'
import { CityState } from '../../../game/cityBuilder'

const meta = {
  component: ResourceStrip,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ResourceStrip>

export default meta
type Story = StoryObj<typeof meta>

const emptyResources = { wheat: 0, wood: 0, ore: 0, bread: 0, planks: 0, metal: 0 }

function stubCity(resources = emptyResources): CityState {
  return {
    grid: [], gold: 0, resources, lastTick: Date.now(),
    happiness: {}, rows: 4,
    nextAttackAt: Date.now() + 3_600_000,
    fortifications: [], builderQueue: [], builderCount: 2,
    lastAttack: null, chronicle: [], completedMilestones: [],
    attacksProcessed: 0, tradeOffer: null, activeCaravan: null, history: [],
    zones: [], activeDisaster: null, nextDisasterAt: Date.now() + 86_400_000,
    roadWear: { h: [], v: [] }, carriers: [],
  }
}

export const Empty: Story = {
  args: {
    defense: 0, population: 0,
    resources: emptyResources,
    prodRates: {}, consRates: {},
    season: 'spring',
    city: stubCity(),
  },
}

export const WithResources: Story = {
  args: {
    defense: 45, population: 8,
    resources: { wheat: 120, wood: 35, ore: 12, bread: 8, planks: 5, metal: 2 },
    prodRates: { wheat: 10, wood: 4, ore: 2 },
    consRates: { wheat: 6, bread: 1 },
    season: 'summer',
    city: stubCity({ wheat: 120, wood: 35, ore: 12, bread: 8, planks: 5, metal: 2 }),
  },
}

export const CriticalResources: Story = {
  args: {
    defense: 5, population: 12,
    resources: { wheat: 3, wood: 0, ore: 0, bread: 0, planks: 0, metal: 0 },
    prodRates: { wheat: 2 },
    consRates: { wheat: 8 },
    season: 'winter',
    city: stubCity({ wheat: 3, wood: 0, ore: 0, bread: 0, planks: 0, metal: 0 }),
  },
}

export const NearCap: Story = {
  args: {
    defense: 60, population: 10,
    resources: { wheat: 420, wood: 260, ore: 170, bread: 250, planks: 160, metal: 130 },
    prodRates: { wheat: 12, wood: 6, ore: 3, bread: 2, planks: 2, metal: 1 },
    consRates: { wheat: 8 },
    season: 'autumn',
    city: stubCity({ wheat: 420, wood: 260, ore: 170, bread: 250, planks: 160, metal: 130 }),
  },
}
