import React, { useRef, useState } from 'react'
import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Fortifications, Props } from './Fortifications'
import { FORT_MAX_HP } from '../../../game/cityBuilder'
import { getCardCatalog } from '../../../game/cards'

const meta = {
  component: Fortifications,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Fortifications>

export default meta
type Story = StoryObj<typeof meta>

const defenceCards = getCardCatalog().filter(c => c.cardType === 'structure').slice(0, 6)

const baseCity: any = {
  grid: Array(20).fill(null),
  fortifications: [],
  builderQueue: [],
  builderCount: 2,
  gold: 500,
  resources: { wheat: 100, wood: 50, stone: 30, iron: 10 },
  rows: 4,
  nextAttackAt: Date.now() + 3_600_000,
  happiness: {},
}

function Wrapper(props: Omit<Props, 'fortRingRef' | 'fortSlotSel' | 'setFortSlotSel' | 'fortFilter' | 'setFortFilter' | 'fortSort' | 'setFortSort'>) {
  const fortRingRef = useRef<HTMLDivElement>(null)
  const [fortSlotSel, setFortSlotSel] = useState<number | null>(null)
  const [fortFilter, setFortFilter] = useState('all')
  const [fortSort, setFortSort] = useState<'defense' | 'name' | 'rarity'>('defense')
  return (
    <Fortifications
      {...props}
      fortRingRef={fortRingRef}
      fortSlotSel={fortSlotSel}
      setFortSlotSel={setFortSlotSel}
      fortFilter={fortFilter}
      setFortFilter={setFortFilter}
      fortSort={fortSort}
      setFortSort={setFortSort}
    />
  )
}

const sharedCallbacks = {
  onBack: fn(),
  onAddFort: fn(),
  onBuyBuilder: fn(),
  onRemoveFort: fn(),
}

export const Empty: Story = {
  args: {} as any,
  render: () => (
    <Wrapper
      city={baseCity}
      currentTime={Date.now()}
      builderWalkers={[]}
      availableDefenceCards={defenceCards}
      {...sharedCallbacks}
    />
  ),
}

export const WithActiveForts: Story = {
  args: {} as any,
  render: () => (
    <Wrapper
      city={{
        ...baseCity,
        fortifications: [
          { cardName: defenceCards[0]?.name ?? 'Wall', rarity: 'common', hp: FORT_MAX_HP.common, maxHp: FORT_MAX_HP.common, attacksTaken: 0 },
          { cardName: defenceCards[1]?.name ?? 'Tower', rarity: 'rare', hp: Math.round(FORT_MAX_HP.rare * 0.4), maxHp: FORT_MAX_HP.rare, attacksTaken: 2 },
        ],
      }}
      currentTime={Date.now()}
      builderWalkers={[]}
      availableDefenceCards={defenceCards}
      {...sharedCallbacks}
    />
  ),
}

export const BuilderBusy: Story = {
  args: {} as any,
  render: () => (
    <Wrapper
      city={{
        ...baseCity,
        builderQueue: [
          { cardName: defenceCards[0]?.name ?? 'Wall', rarity: 'common', completesAt: Date.now() + 5 * 60_000 },
        ],
      }}
      currentTime={Date.now()}
      builderWalkers={[{ ringX: 80, ringY: 60, ringPhase: 'delivering', cardName: 'Builder', queueIndex: 0, x: 0, y: 0, vx: 0, vy: 0, phase: 'delivering', targetX: 0, targetY: 0, label: '', ringVx: 0, ringVy: 0, ringTargetX: 0, ringTargetY: 0 } as any]}
      availableDefenceCards={defenceCards}
      {...sharedCallbacks}
    />
  ),
}
