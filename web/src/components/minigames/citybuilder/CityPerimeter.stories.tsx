import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CityPerimeter } from './CityPerimeter'
import { FORT_MAX_HP } from '../../../game/cityBuilder'

const meta = {
  component: CityPerimeter,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CityPerimeter>

export default meta
type Story = StoryObj<typeof meta>

export const NoForts: Story = {
  args: {
    fortifications: [],
    builderQueue: [],
    onClick: fn(),
  },
}

export const HealthyForts: Story = {
  args: {
    fortifications: [
      { cardName: 'Stone Wall', rarity: 'common', hp: FORT_MAX_HP.common, maxHp: FORT_MAX_HP.common, attacksTaken: 0 },
      { cardName: 'Watchtower', rarity: 'uncommon', hp: FORT_MAX_HP.uncommon, maxHp: FORT_MAX_HP.uncommon, attacksTaken: 0 },
      { cardName: 'Iron Gate', rarity: 'rare', hp: FORT_MAX_HP.rare, maxHp: FORT_MAX_HP.rare, attacksTaken: 1 },
    ],
    builderQueue: [],
    onClick: fn(),
  },
}

export const DamagedForts: Story = {
  args: {
    fortifications: [
      { cardName: 'Stone Wall', rarity: 'common', hp: Math.round(FORT_MAX_HP.common * 0.25), maxHp: FORT_MAX_HP.common, attacksTaken: 3 },
      { cardName: 'Watchtower', rarity: 'uncommon', hp: Math.round(FORT_MAX_HP.uncommon * 0.5), maxHp: FORT_MAX_HP.uncommon, attacksTaken: 2 },
    ],
    builderQueue: [],
    onClick: fn(),
  },
}

export const WithBuildingForts: Story = {
  args: {
    fortifications: [
      { cardName: 'Stone Wall', rarity: 'common', hp: FORT_MAX_HP.common, maxHp: FORT_MAX_HP.common, attacksTaken: 0 },
    ],
    builderQueue: [
      { cardName: 'Watchtower', rarity: 'uncommon' as const, completesAt: Date.now() + 5 * 60 * 1000 },
      { cardName: 'Iron Gate', rarity: 'rare' as const, completesAt: Date.now() + 12 * 60 * 1000 },
    ],
    onClick: fn(),
  },
}
