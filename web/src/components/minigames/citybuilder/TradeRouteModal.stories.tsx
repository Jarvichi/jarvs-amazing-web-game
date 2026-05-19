import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TradeRouteModal } from './TradeRouteModal'

const meta = {
  component: TradeRouteModal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TradeRouteModal>

export default meta
type Story = StoryObj<typeof meta>

const baseCity: any = {
  grid: new Array(16).fill(undefined),
  rows: 4,
  resources: { wheat: 100, wood: 50, ore: 0, bread: 0, planks: 0, metal: 0 },
  gold: 1000,
  fortifications: [],
  builderQueue: [],
  happiness: {},
  activeCaravan: null,
  tradeOffer: null,
}

export const SellOffer: Story = {
  args: {
    city: {
      ...baseCity,
      tradeOffer: {
        resource: 'wheat',
        direction: 'sell',
        amount: 80,
        gold: 400,
        expiresAt: Date.now() + 60 * 60 * 1000,
      },
    },
    currentTime: Date.now(),
    onDispatch: fn(),
    onClose: fn(),
  },
}

export const BuyOffer: Story = {
  args: {
    city: {
      ...baseCity,
      tradeOffer: {
        resource: 'ore',
        direction: 'buy',
        amount: 50,
        gold: 600,
        expiresAt: Date.now() + 30 * 60 * 1000,
      },
    },
    currentTime: Date.now(),
    onDispatch: fn(),
    onClose: fn(),
  },
}

export const CaravanAway: Story = {
  args: {
    city: {
      ...baseCity,
      activeCaravan: {
        offer: {
          resource: 'wood',
          direction: 'sell',
          amount: 60,
          gold: 300,
          expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        },
        returnsAt: Date.now() + 45 * 60 * 1000,
      },
    },
    currentTime: Date.now(),
    onDispatch: fn(),
    onClose: fn(),
  },
}

export const NoOffer: Story = {
  args: {
    city: baseCity,
    currentTime: Date.now(),
    onDispatch: fn(),
    onClose: fn(),
  },
}
