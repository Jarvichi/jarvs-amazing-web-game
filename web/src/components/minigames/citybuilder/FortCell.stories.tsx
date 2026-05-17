import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FortCell } from './FortCell'
import { FORT_MAX_HP } from '../../../game/cityBuilder'

const meta = {
  component: FortCell,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof FortCell>

export default meta
type Story = StoryObj<typeof meta>

const sharedArgs = { area: 'f0', onClick: fn() }

export const Empty: Story = {
  args: { ...sharedArgs, slot: { kind: 'empty' } },
}

export const Building: Story = {
  args: {
    ...sharedArgs,
    slot: {
      kind: 'building',
      entry: { cardName: 'Watchtower', rarity: 'uncommon', completesAt: Date.now() + 8 * 60_000 },
      queueIndex: 0,
    },
  },
}

export const ActiveHealthy: Story = {
  args: {
    ...sharedArgs,
    slot: {
      kind: 'active',
      fort: { cardName: 'Stone Wall', rarity: 'common', hp: FORT_MAX_HP.common, maxHp: FORT_MAX_HP.common, attacksTaken: 0 },
      fortIndex: 0,
    },
  },
}

export const ActiveDamaged: Story = {
  args: {
    ...sharedArgs,
    slot: {
      kind: 'active',
      fort: { cardName: 'Iron Gate', rarity: 'rare', hp: Math.round(FORT_MAX_HP.rare * 0.35), maxHp: FORT_MAX_HP.rare, attacksTaken: 3 },
      fortIndex: 1,
    },
  },
}
