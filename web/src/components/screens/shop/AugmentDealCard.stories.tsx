import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { AugmentDealCard } from './AugmentDealCard'
import { exampleCard } from '../../../game/types.sample'

const meta = {
  component: AugmentDealCard,
  title: 'Shop/AugmentDealCard',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AugmentDealCard>

export default meta
type Story = StoryObj<typeof meta>

const AUG_CARD = { ...exampleCard, name: 'Ember Coat', rarity: 'rare' as const, augmentSlot: 'chest' as const, description: 'Coat woven from fire-resistant fibres. +5 HP.' }
const DEAL = { augmentName: AUG_CARD.name, rarity: AUG_CARD.rarity, price: 80 }

export const Affordable: Story = {
  args: { deal: DEAL, aug: AUG_CARD, bought: false, canAfford: true, onBuy: fn() },
}

export const TooExpensive: Story = {
  args: { deal: DEAL, aug: AUG_CARD, bought: false, canAfford: false, onBuy: fn() },
}

export const Bought: Story = {
  args: { deal: DEAL, aug: AUG_CARD, bought: true, canAfford: false, onBuy: fn() },
}
