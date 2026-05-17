import React, { useState } from 'react'
import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FortSlotModal, Props } from './FortSlotModal'
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

function Wrapper(props: Omit<Props, 'fortFilter' | 'setFortFilter' | 'fortSort' | 'setFortSort'>) {
  const [fortFilter, setFortFilter] = useState('all')
  const [fortSort, setFortSort] = useState<'defense' | 'name' | 'rarity'>('defense')
  return <FortSlotModal {...props} fortFilter={fortFilter} setFortFilter={setFortFilter} fortSort={fortSort} setFortSort={setFortSort} />
}

const callbacks = { onClose: fn(), onAddFort: fn(), onRemoveFort: fn() }

export const EmptySlotWithCards: Story = {
  args: {} as any,
  render: () => (
    <Wrapper
      slot={{ kind: 'empty' }}
      city={baseCity}
      currentTime={Date.now()}
      availableDefenceCards={defenceCards}
      {...callbacks}
    />
  ),
}

export const EmptySlotNoCards: Story = {
  args: {} as any,
  render: () => (
    <Wrapper
      slot={{ kind: 'empty' }}
      city={baseCity}
      currentTime={Date.now()}
      availableDefenceCards={[]}
      {...callbacks}
    />
  ),
}

export const BuildingSlot: Story = {
  args: {} as any,
  render: () => (
    <Wrapper
      slot={{ kind: 'building', entry: { cardName: defenceCards[0]?.name ?? 'Wall', rarity: 'uncommon', completesAt: Date.now() + 12 * 60_000 }, queueIndex: 0 }}
      city={baseCity}
      currentTime={Date.now()}
      availableDefenceCards={defenceCards}
      {...callbacks}
    />
  ),
}

export const ActiveFortHealthy: Story = {
  args: {} as any,
  render: () => (
    <Wrapper
      slot={{ kind: 'active', fort: { cardName: defenceCards[1]?.name ?? 'Tower', rarity: 'rare', hp: FORT_MAX_HP.rare, maxHp: FORT_MAX_HP.rare, attacksTaken: 0 }, fortIndex: 0 }}
      city={baseCity}
      currentTime={Date.now()}
      availableDefenceCards={defenceCards}
      {...callbacks}
    />
  ),
}

export const ActiveFortDamaged: Story = {
  args: {} as any,
  render: () => (
    <Wrapper
      slot={{ kind: 'active', fort: { cardName: defenceCards[1]?.name ?? 'Tower', rarity: 'rare', hp: Math.round(FORT_MAX_HP.rare * 0.2), maxHp: FORT_MAX_HP.rare, attacksTaken: 4 }, fortIndex: 0 }}
      city={baseCity}
      currentTime={Date.now()}
      availableDefenceCards={defenceCards}
      {...callbacks}
    />
  ),
}
