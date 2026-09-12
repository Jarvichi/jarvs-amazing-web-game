import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConsumableTile } from './ConsumableTile'

const meta = {
  component: ConsumableTile,
  title: 'Shop/ConsumableTile',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ConsumableTile>

export default meta
type Story = StoryObj<typeof meta>

const HEALTH_POTION = { id: 'health-potion', name: 'Health Potion', icon: '🧪', desc: 'Restore 15 HP to your base.', lore: '', healAmount: 15, price: 15 }

export const Affordable: Story = {
  args: { consumable: HEALTH_POTION, price: 15, discounted: false, canAfford: true, onBuy: fn() },
}

export const Discounted: Story = {
  args: { consumable: HEALTH_POTION, price: 13, discounted: true, canAfford: true, onBuy: fn() },
}

export const TooExpensive: Story = {
  args: { consumable: HEALTH_POTION, price: 15, discounted: false, canAfford: false, onBuy: fn() },
}
