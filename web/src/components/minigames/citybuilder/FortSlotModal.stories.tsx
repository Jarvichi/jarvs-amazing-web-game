import React from 'react'
import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FortSlotModal } from './FortSlotModal'
import { FORT_MAX_HP } from '../../../game/cityBuilder'
import { getCardCatalog } from '../../../game/cards'

const meta = {
  component: FortSlotModal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FortSlotModal>

export default meta
type Story = StoryObj<typeof meta>

const defenceCards = getCardCatalog().filter(c => c.cardType === 'structure').slice(0, 8)

const baseCity: any = {
  fortifications: [],
  builderQueue: [],
  builderCount: 2,
  gold: 500,
  resources: { wheat: 100, wood: 50, stone: 30, iron: 10 },
}

const callbacks = { onClose: fn(), onRemoveFort: fn() }

export const BuildingSlot: Story = {
  args: {} as any,
  render: () => (
    <FortSlotModal
      slot={{ kind: 'building', entry: { cardName: defenceCards[0]?.name ?? 'Wall', rarity: 'uncommon', completesAt: Date.now() + 12 * 60_000 }, queueIndex: 0 }}
      city={baseCity}
      currentTime={Date.now()}
      {...callbacks}
    />
  ),
}

export const ActiveFortHealthy: Story = {
  args: {} as any,
  render: () => (
    <FortSlotModal
      slot={{ kind: 'active', fort: { cardName: defenceCards[1]?.name ?? 'Tower', rarity: 'rare', hp: FORT_MAX_HP.rare, maxHp: FORT_MAX_HP.rare, attacksTaken: 0 }, fortIndex: 0 }}
      city={baseCity}
      currentTime={Date.now()}
      {...callbacks}
    />
  ),
}

export const ActiveFortDamaged: Story = {
  args: {} as any,
  render: () => (
    <FortSlotModal
      slot={{ kind: 'active', fort: { cardName: defenceCards[1]?.name ?? 'Tower', rarity: 'rare', hp: Math.round(FORT_MAX_HP.rare * 0.2), maxHp: FORT_MAX_HP.rare, attacksTaken: 4 }, fortIndex: 0 }}
      city={baseCity}
      currentTime={Date.now()}
      {...callbacks}
    />
  ),
}
