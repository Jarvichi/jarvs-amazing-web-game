import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CardDealTile } from './CardDealTile'
import { exampleCard } from '../../../game/types.sample'

const meta = {
  component: CardDealTile,
  title: 'Shop/CardDealTile',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CardDealTile>

export default meta
type Story = StoryObj<typeof meta>

const DEAL = { cardName: exampleCard.name, rarity: exampleCard.rarity, price: 30 }

export const Affordable: Story = {
  args: { deal: DEAL, card: exampleCard, bought: false, price: 30, discounted: false, canAfford: true, onBuy: fn() },
}

export const Discounted: Story = {
  args: { deal: DEAL, card: exampleCard, bought: false, price: 27, discounted: true, canAfford: true, onBuy: fn() },
}

export const TooExpensive: Story = {
  args: { deal: DEAL, card: exampleCard, bought: false, price: 30, discounted: false, canAfford: false, onBuy: fn() },
}

export const Bought: Story = {
  args: { deal: DEAL, card: exampleCard, bought: true, price: 30, discounted: false, canAfford: false, onBuy: fn() },
}
